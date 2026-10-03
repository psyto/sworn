//! Shared (host + SP1 guest) logic for the Tempo kill-gate spike:
//! 1. bind the raw Tempo header to the claimed block hash, extract stateRoot + env,
//! 2. MPT-verify every witnessed account/slot against that stateRoot,
//! 3. execute one call with Tempo's own EVM (`tempo-revm`) over a witness-closed DB.

use alloy_primitives::{Address, B256, Bytes, U256, keccak256};
use alloy_rlp::Decodable;
use alloy_trie::{Nibbles, TrieAccount, proof::verify_proof};
use core::fmt;
use revm::{
    ExecuteEvm, MainContext,
    context::{CfgEnv, Context, TxEnv, result::ExecutionResult},
    database_interface::{DBErrorMarker, Database},
    primitives::TxKind,
    state::{AccountInfo, Bytecode},
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, num::NonZeroU64};
use tempo_chainspec::hardfork::TempoHardfork;
use tempo_primitives::TempoHeader;
use tempo_revm::{TempoBlockEnv, TempoEvm, TempoTxEnv, gas_params::tempo_gas_params_with_amsterdam};

pub const MODERATO_CHAIN_ID: u64 = 42431;
pub const MODERATO_EPOCH_LENGTH: u64 = 21600;

/// Moderato hardfork activation timestamps (tempo/crates/chainspec/src/genesis/moderato.json).
const MODERATO_SCHEDULE: &[(u64, TempoHardfork)] = &[
    (1770303600, TempoHardfork::T1),
    (1771858800, TempoHardfork::T1B),
    (1773068400, TempoHardfork::T1C),
    (1774537200, TempoHardfork::T2),
    (1776780000, TempoHardfork::T3),
    (1778767200, TempoHardfork::T4),
    (1780495200, TempoHardfork::T5),
    (1781791200, TempoHardfork::T6),
    (1783000800, TempoHardfork::T7),
    (1785160800, TempoHardfork::T8),
    (1785938400, TempoHardfork::T9),
    (1787234400, TempoHardfork::T10),
    (1788962400, TempoHardfork::T11),
    (1791468000, TempoHardfork::T12),
];

pub fn moderato_hardfork_at(ts: u64) -> TempoHardfork {
    let mut hf = TempoHardfork::T0;
    for (t, h) in MODERATO_SCHEDULE {
        if ts >= *t {
            hf = *h;
        }
    }
    hf
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StorageWitness {
    pub slot: U256,
    pub value: U256,
    pub proof: Vec<Bytes>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AccountWitness {
    pub address: Address,
    pub nonce: u64,
    pub balance: U256,
    pub storage_root: B256,
    pub code_hash: B256,
    pub code: Bytes,
    pub account_proof: Vec<Bytes>,
    pub storage: Vec<StorageWitness>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Input {
    pub block_hash: B256,
    pub raw_header: Bytes,
    pub accounts: Vec<AccountWitness>,
    pub caller: Address,
    pub to: Address,
    pub data: Bytes,
    pub gas_limit: u64,
    pub nonce: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Output {
    pub block_number: u64,
    pub block_hash: B256,
    pub state_root: B256,
    pub hardfork: String,
    pub success: bool,
    pub output: Bytes,
    pub gas_used: u64,
}

#[derive(Debug)]
pub enum WitnessDbError {
    MissingAccount(Address),
    MissingCode(B256),
    MissingStorage(Address, U256),
    MissingBlockHash(u64),
}
impl fmt::Display for WitnessDbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}
impl core::error::Error for WitnessDbError {}
impl DBErrorMarker for WitnessDbError {}

/// Witness-closed DB: anything not authenticated is an error, never a default.
#[derive(Debug, Default)]
pub struct WitnessDb {
    accounts: BTreeMap<Address, (Option<AccountInfo>, BTreeMap<U256, U256>)>,
    codes: BTreeMap<B256, Bytecode>,
}

impl Database for WitnessDb {
    type Error = WitnessDbError;
    fn basic(&mut self, a: Address) -> Result<Option<AccountInfo>, Self::Error> {
        self.accounts.get(&a).map(|(i, _)| i.clone()).ok_or(WitnessDbError::MissingAccount(a))
    }
    fn code_by_hash(&mut self, h: B256) -> Result<Bytecode, Self::Error> {
        self.codes.get(&h).cloned().ok_or(WitnessDbError::MissingCode(h))
    }
    fn storage(&mut self, a: Address, s: U256) -> Result<U256, Self::Error> {
        let (_, st) = self.accounts.get(&a).ok_or(WitnessDbError::MissingAccount(a))?;
        st.get(&s).copied().ok_or(WitnessDbError::MissingStorage(a, s))
    }
    fn block_hash(&mut self, n: u64) -> Result<B256, Self::Error> {
        Err(WitnessDbError::MissingBlockHash(n))
    }
}

const EMPTY_ROOT: B256 = alloy_trie::EMPTY_ROOT_HASH;
const EMPTY_CODE_HASH: B256 = alloy_trie::KECCAK_EMPTY;

/// Header binding + MPT verification. Returns the decoded header and a closed DB.
pub fn verify(input: &Input) -> (TempoHeader, WitnessDb) {
    assert_eq!(keccak256(&input.raw_header), input.block_hash, "header hash != block hash");
    let header = TempoHeader::decode(&mut input.raw_header.as_ref()).expect("decode TempoHeader");
    let state_root = header.inner.state_root;

    let mut db = WitnessDb::default();
    for acc in &input.accounts {
        assert_eq!(keccak256(&acc.code), acc.code_hash, "code hash mismatch");
        let exists = !(acc.nonce == 0
            && acc.balance.is_zero()
            && acc.code_hash == EMPTY_CODE_HASH
            && acc.storage_root == EMPTY_ROOT);
        let leaf = TrieAccount {
            nonce: acc.nonce,
            balance: acc.balance,
            storage_root: acc.storage_root,
            code_hash: acc.code_hash,
        };
        verify_proof(
            state_root,
            Nibbles::unpack(keccak256(acc.address)),
            exists.then(|| alloy_rlp::encode(leaf)),
            acc.account_proof.iter(),
        )
        .unwrap_or_else(|e| panic!("account proof {}: {e:?}", acc.address));

        let mut slots = BTreeMap::new();
        for s in &acc.storage {
            verify_proof(
                acc.storage_root,
                Nibbles::unpack(keccak256(s.slot.to_be_bytes::<32>())),
                (!s.value.is_zero()).then(|| alloy_rlp::encode(s.value)),
                s.proof.iter(),
            )
            .unwrap_or_else(|e| panic!("storage proof {} {}: {e:?}", acc.address, s.slot));
            slots.insert(s.slot, s.value);
        }
        let code = Bytecode::new_raw(acc.code.clone());
        db.codes.insert(acc.code_hash, code.clone());
        let info = exists.then(|| AccountInfo {
            balance: acc.balance,
            nonce: acc.nonce,
            code_hash: acc.code_hash,
            code: Some(code),
            ..Default::default()
        });
        db.accounts.insert(acc.address, (info, slots));
    }
    (header, db)
}

/// Execute the call with Tempo's EVM, eth_call-style (no nonce/balance/basefee/fee charge).
pub fn execute(header: &TempoHeader, db: WitnessDb, input: &Input) -> Output {
    let h = &header.inner;
    let spec = moderato_hardfork_at(h.timestamp);
    let mut cfg = CfgEnv::new_with_spec_and_gas_params(spec, tempo_gas_params_with_amsterdam(spec, false));
    cfg.chain_id = MODERATO_CHAIN_ID;
    cfg.tx_gas_limit_cap = spec.tx_gas_limit_cap();
    cfg.disable_nonce_check = true;
    cfg.disable_base_fee = true;
    cfg.disable_balance_check = true;
    cfg.disable_fee_charge = true;
    cfg.disable_eip3607 = true;
    cfg.disable_block_gas_limit = true;

    let mut block = TempoBlockEnv::default();
    block.inner.number = U256::from(h.number);
    block.inner.beneficiary = h.beneficiary;
    block.inner.timestamp = U256::from(h.timestamp);
    block.inner.gas_limit = h.gas_limit;
    block.inner.basefee = h.base_fee_per_gas.unwrap_or_default();
    block.inner.difficulty = h.difficulty;
    block.inner.prevrandao = Some(h.mix_hash);
    block.timestamp_millis_part = header.timestamp_millis_part;
    block.epoch_length = NonZeroU64::new(MODERATO_EPOCH_LENGTH).unwrap();
    block.proposer_public_key = header.consensus_context.map(|c| c.proposer);

    let ctx = Context::mainnet()
        .with_db(db)
        .with_block(block)
        .with_cfg(cfg)
        .with_tx(TempoTxEnv::default());
    let mut evm = TempoEvm::new(ctx, ());

    let tx = TempoTxEnv {
        inner: TxEnv {
            caller: input.caller,
            kind: TxKind::Call(input.to),
            data: input.data.clone(),
            gas_limit: input.gas_limit,
            nonce: input.nonce,
            gas_price: 0,
            chain_id: Some(MODERATO_CHAIN_ID),
            ..Default::default()
        },
        ..Default::default()
    };
    let res = evm.transact(tx).unwrap_or_else(|e| panic!("transact error: {e:?}"));
    let (success, output, gas_used) = match &res.result {
        ExecutionResult::Success { output, .. } => (true, output.data().clone(), res.result.tx_gas_used()),
        ExecutionResult::Revert { output, .. } => (false, output.clone(), res.result.tx_gas_used()),
        ExecutionResult::Halt { .. } => (false, Bytes::new(), res.result.tx_gas_used()),
    };
    Output {
        block_number: h.number,
        block_hash: input.block_hash,
        state_root: h.state_root,
        hardfork: format!("{spec:?}"),
        success,
        output,
        gas_used,
    }
}

pub fn run(input: &Input) -> Output {
    let (header, db) = verify(input);
    execute(&header, db, input)
}
