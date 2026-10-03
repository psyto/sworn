//! Sworn core — shared by the native host and the SP1 guest (spec 001 §R3, as amended by §R3.7).
//!
//! 1. bind the raw Tempo header to `q.blockHash`, check `header.number == q.blockNumber`,
//! 2. MPT-verify every witnessed account/slot against the header's stateRoot,
//! 3. execute exactly one R3.2 `TempoTxEnv` with Tempo's own EVM (`tempo-revm`), fees ON,
//! 4. read `balanceOf(receiver)` as a RAW storage lookup before (witness) and after (committed
//!    post-state) — never as an EVM call inside the transaction's journal (R3.7),
//! 5. return `publicValues = abi.encode(GUEST_VERSION, blockHash, Question, Answer)` (R3.1).
//!
//! Anything the rules in R3.3 forbid is an `Abort` (the guest panics, so no proof exists).

use alloy_primitives::{Address, B256, Bytes, U256, b256, keccak256};
use alloy_rlp::Decodable;
use alloy_sol_types::{SolCall, SolValue, sol};
use alloy_trie::{Nibbles, TrieAccount, proof::verify_proof};
use core::{cell::RefCell, fmt};
use revm::{
    ExecuteEvm, MainContext,
    context::{
        CfgEnv, Context, TxEnv,
        result::{EVMError, ExecutionResult, ResultAndState},
    },
    database_interface::{DBErrorMarker, Database},
    primitives::TxKind,
    state::{AccountInfo, Bytecode, EvmState},
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, num::NonZeroU64, rc::Rc};
use tempo_chainspec::TempoHardfork;
use tempo_primitives::{TempoAddressExt, TempoHeader, transaction::calc_gas_balance_spending};
use tempo_revm::{
    ExecutionContext, TempoBlockEnv, TempoEvm, TempoInvalidTransaction, TempoTxEnv,
    gas_params::tempo_gas_params_with_amsterdam,
};
use revm::context::result::HaltReason;

pub use tempo_precompiles::tip20::tip20_slots;

/// `keccak256("sworn-guest-v1")` — asserted by `tests::guest_version_is_keccak_of_label`.
pub const GUEST_VERSION: B256 =
    b256!("0x51e24160ef5467ba88166fd247c9bfb07b88e76ee08e430346c1353fda5e233d");
pub const GUEST_VERSION_LABEL: &str = "sworn-guest-v1";
pub const MODERATO_CHAIN_ID: u64 = 42431;

include!(concat!(env!("OUT_DIR"), "/moderato_config.rs"));

sol! {
    /// R3.1 as amended by R3.7 (`blockHash` after `blockNumber`). Field order is ABI.
    #[derive(Debug, PartialEq, Eq)]
    struct Question {
        uint64  chainId;
        uint64  blockNumber;
        bytes32 blockHash;
        address from;
        address token;
        bytes   data;
        address feeToken;
        uint64  gasLimit;
    }
    #[derive(Debug, PartialEq, Eq)]
    struct Answer {
        bool    success;
        bytes32 returnDataHash;
        uint64  gasUsed;
        uint256 feeCharged;
        address receiver;
        uint256 receiverBefore;
        uint256 receiverAfter;
    }
    /// EIP-712 top-level type of the contract's reservation digest (contracts/src/Sworn.sol).
    #[derive(Debug, PartialEq, Eq)]
    struct SwornAnswer {
        Question question;
        Answer answer;
    }
    function transfer(address to, uint256 amount) external returns (bool);
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external;
}

/// `abi.encode(bytes32 GUEST_VERSION, bytes32 blockHash, Question q, Answer a)`.
pub fn public_values(block_hash: B256, q: &Question, a: &Answer) -> Vec<u8> {
    (GUEST_VERSION, block_hash, q.clone(), a.clone()).abi_encode_params()
}

/// EIP-712 digest the contract computes in `reserve` / `digestOf(q, a)`:
/// domain {name:"Sworn", version:"1", chainId, verifyingContract}, type `SwornAnswer(Question,Answer)`.
pub fn eip712_digest(chain_id: u64, verifying_contract: Address, q: &Question, a: &Answer) -> B256 {
    use alloy_sol_types::SolStruct;
    let domain = alloy_sol_types::eip712_domain! {
        name: "Sworn",
        version: "1",
        chain_id: chain_id,
        verifying_contract: verifying_contract,
    };
    SwornAnswer { question: q.clone(), answer: a.clone() }.eip712_signing_hash(&domain)
}

/// Inverse of [`public_values`]; used by tests and the fixture exporter.
pub fn decode_public_values(pv: &[u8]) -> Result<(B256, B256, Question, Answer), String> {
    <(B256, B256, Question, Answer)>::abi_decode_params(pv).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------------------------------------
// Hardfork schedule: Tempo's own genesis `config` keys (`TempoHardfork::genesis_key`) read from the
// vendored tempo-chainspec genesis file at build time; resolution mirrors
// `tempo_chainspec::spec::TempoHardforks::tempo_hardfork_at`.
// ------------------------------------------------------------------------------------------------

fn genesis_config(key: &str) -> Option<u64> {
    MODERATO_GENESIS_CONFIG.iter().find(|(k, _)| *k == key).map(|(_, v)| *v)
}

pub fn moderato_fork_time(fork: TempoHardfork) -> Option<u64> {
    match fork.genesis_key() {
        None => Some(0), // Genesis
        Some(k) => genesis_config(k),
    }
}

pub fn moderato_hardfork_at(timestamp: u64) -> TempoHardfork {
    for &fork in TempoHardfork::VARIANTS.iter().rev() {
        if moderato_fork_time(fork).is_some_and(|t| timestamp >= t) {
            return fork;
        }
    }
    TempoHardfork::Genesis
}

pub fn moderato_epoch_length() -> NonZeroU64 {
    genesis_config("epochLength").and_then(NonZeroU64::new).unwrap_or(NonZeroU64::MIN)
}

// ------------------------------------------------------------------------------------------------
// Abort rules (R3.3)
// ------------------------------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Abort {
    HeaderHash { expected: B256, got: B256 },
    HeaderDecode(String),
    BlockNumber { header: u64, question: u64 },
    ChainId(u64),
    NotTip20(Address),
    Selector,
    NonCanonicalCalldata,
    VirtualReceiver(Address),
    ReceiverIsSender(Address),
    BlockHashRead(u64),
    MissingAccount(Address),
    MissingStorage(Address, U256),
    MissingCode(B256),
    Proof(String),
    QuestionDecode(String),
}
impl fmt::Display for Abort {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}

// ------------------------------------------------------------------------------------------------
// Witness
// ------------------------------------------------------------------------------------------------

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

/// Guest input. `question` is `abi.encode(Question)` so the guest decodes exactly what the
/// contract hashes.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Input {
    pub raw_header: Bytes,
    pub accounts: Vec<AccountWitness>,
    pub question: Bytes,
}

#[derive(Debug, Clone)]
pub struct DbFault(pub Abort);
impl fmt::Display for DbFault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}
impl core::error::Error for DbFault {}
impl DBErrorMarker for DbFault {}

/// Witness-closed DB: anything not authenticated is an error, never a default.
#[derive(Debug, Default, Clone)]
pub struct WitnessDb {
    accounts: BTreeMap<Address, (Option<AccountInfo>, BTreeMap<U256, U256>)>,
    codes: BTreeMap<B256, Bytecode>,
}

impl Database for WitnessDb {
    type Error = DbFault;
    fn basic(&mut self, a: Address) -> Result<Option<AccountInfo>, DbFault> {
        self.accounts.get(&a).map(|(i, _)| i.clone()).ok_or(DbFault(Abort::MissingAccount(a)))
    }
    fn code_by_hash(&mut self, h: B256) -> Result<Bytecode, DbFault> {
        self.codes.get(&h).cloned().ok_or(DbFault(Abort::MissingCode(h)))
    }
    fn storage(&mut self, a: Address, s: U256) -> Result<U256, DbFault> {
        let (_, st) = self.accounts.get(&a).ok_or(DbFault(Abort::MissingAccount(a)))?;
        st.get(&s).copied().ok_or(DbFault(Abort::MissingStorage(a, s)))
    }
    fn block_hash(&mut self, n: u64) -> Result<B256, DbFault> {
        Err(DbFault(Abort::BlockHashRead(n)))
    }
}

/// Wraps any DB and records the FIRST fault (missing witness, BLOCKHASH). A fault inside a
/// precompile can surface as a revert/custom error rather than a DB error, so the outcome of a
/// run with a recorded fault is never trusted: it is an `Abort`.
#[derive(Debug)]
pub struct Tracked<DB> {
    pub inner: DB,
    pub fault: Rc<RefCell<Option<Abort>>>,
}
impl<DB> Tracked<DB> {
    pub fn new(inner: DB) -> Self {
        Self { inner, fault: Rc::new(RefCell::new(None)) }
    }
    fn note<T>(&self, r: Result<T, DbFault>) -> Result<T, DbFault> {
        if let Err(e) = &r {
            self.fault.borrow_mut().get_or_insert(e.0.clone());
        }
        r
    }
}
impl<DB: Database<Error = DbFault>> Database for Tracked<DB> {
    type Error = DbFault;
    fn basic(&mut self, a: Address) -> Result<Option<AccountInfo>, DbFault> {
        let r = self.inner.basic(a);
        self.note(r)
    }
    fn code_by_hash(&mut self, h: B256) -> Result<Bytecode, DbFault> {
        let r = self.inner.code_by_hash(h);
        self.note(r)
    }
    fn storage(&mut self, a: Address, s: U256) -> Result<U256, DbFault> {
        let r = self.inner.storage(a, s);
        self.note(r)
    }
    fn block_hash(&mut self, n: u64) -> Result<B256, DbFault> {
        self.note(Err(DbFault(Abort::BlockHashRead(n))))
    }
}

const EMPTY_ROOT: B256 = alloy_trie::EMPTY_ROOT_HASH;
const EMPTY_CODE_HASH: B256 = alloy_trie::KECCAK_EMPTY;

/// Header binding: keccak(raw) == expected, then decode.
pub fn bind_header(raw_header: &[u8], expected: B256) -> Result<TempoHeader, Abort> {
    let got = keccak256(raw_header);
    if got != expected {
        return Err(Abort::HeaderHash { expected, got });
    }
    TempoHeader::decode(&mut &raw_header[..]).map_err(|e| Abort::HeaderDecode(e.to_string()))
}

/// Does this account leaf exist in the trie? (EIP-161 empty accounts are absent.)
pub fn account_exists(nonce: u64, balance: U256, code_hash: B256, storage_root: B256) -> bool {
    !(nonce == 0 && balance.is_zero() && code_hash == EMPTY_CODE_HASH && storage_root == EMPTY_ROOT)
}

pub fn verify_account(state_root: B256, acc: &AccountWitness) -> Result<(), Abort> {
    if keccak256(&acc.code) != acc.code_hash {
        return Err(Abort::Proof(format!("code hash {}", acc.address)));
    }
    let exists = account_exists(acc.nonce, acc.balance, acc.code_hash, acc.storage_root);
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
    .map_err(|e| Abort::Proof(format!("account {}: {e:?}", acc.address)))
}

pub fn verify_slot(storage_root: B256, address: Address, s: &StorageWitness) -> Result<(), Abort> {
    verify_proof(
        storage_root,
        Nibbles::unpack(keccak256(s.slot.to_be_bytes::<32>())),
        (!s.value.is_zero()).then(|| alloy_rlp::encode(s.value)),
        s.proof.iter(),
    )
    .map_err(|e| Abort::Proof(format!("storage {address} {}: {e:?}", s.slot)))
}

/// MPT-verify every account/slot against `state_root`; build the closed DB.
pub fn build_witness_db(state_root: B256, accounts: &[AccountWitness]) -> Result<WitnessDb, Abort> {
    let mut db = WitnessDb::default();
    for acc in accounts {
        verify_account(state_root, acc)?;
        let mut slots = BTreeMap::new();
        for s in &acc.storage {
            verify_slot(acc.storage_root, acc.address, s)?;
            slots.insert(s.slot, s.value);
        }
        let exists = account_exists(acc.nonce, acc.balance, acc.code_hash, acc.storage_root);
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
    Ok(db)
}

// ------------------------------------------------------------------------------------------------
// Environment (mirrors tempo-evm `TempoEvmConfig::evm_env` for a Moderato header)
// ------------------------------------------------------------------------------------------------

pub fn block_env(header: &TempoHeader) -> TempoBlockEnv {
    let h = &header.inner;
    let mut block = TempoBlockEnv::default();
    block.inner.number = U256::from(h.number);
    block.inner.beneficiary = h.beneficiary;
    block.inner.timestamp = U256::from(h.timestamp);
    block.inner.gas_limit = h.gas_limit;
    block.inner.basefee = h.base_fee_per_gas.unwrap_or_default();
    block.inner.difficulty = U256::ZERO; // merge active from genesis on Moderato
    block.inner.prevrandao = Some(h.mix_hash);
    block.timestamp_millis_part = header.timestamp_millis_part;
    block.epoch_length = moderato_epoch_length();
    block.proposer_public_key = header.consensus_context.map(|c| c.proposer);
    block
}

/// `fees_on = true` is R3.2 (nonce, balance, base-fee, fee-charge checks ON). `false` reproduces
/// the RPC `eth_call` path (used only by the host to explain RPC differences; never by the guest).
pub fn cfg_env(spec: TempoHardfork, fees_on: bool) -> CfgEnv<TempoHardfork> {
    let mut cfg = CfgEnv::new_with_spec_and_gas_params(spec, tempo_gas_params_with_amsterdam(spec, false));
    cfg.chain_id = MODERATO_CHAIN_ID;
    cfg.tx_gas_limit_cap = spec.tx_gas_limit_cap();
    cfg.disable_eip3607 = true;
    cfg.disable_block_gas_limit = true;
    if !fees_on {
        cfg.disable_nonce_check = true;
        cfg.disable_base_fee = true;
        cfg.disable_balance_check = true;
        cfg.disable_fee_charge = true;
    }
    cfg
}

pub type TempoResult = Result<ResultAndState<HaltReason>, EVMError<DbFault, TempoInvalidTransaction>>;

/// Run one transaction with Tempo's EVM; returns the uncommitted result + state diff.
pub fn transact<DB: Database + fmt::Debug>(
    db: DB,
    cfg: CfgEnv<TempoHardfork>,
    block: TempoBlockEnv,
    tx: TempoTxEnv,
) -> Result<ResultAndState<HaltReason>, EVMError<DB::Error, TempoInvalidTransaction>> {
    let ctx = Context::mainnet()
        .with_db(db)
        .with_block(block)
        .with_cfg(cfg)
        .with_tx(TempoTxEnv::default());
    let mut evm = TempoEvm::new(ctx, ());
    evm.transact(tx)
}

// ------------------------------------------------------------------------------------------------
// The question
// ------------------------------------------------------------------------------------------------

/// TIP-20 `balances` mapping slot: keccak(pad(owner) ++ BALANCES).
pub fn tip20_balance_slot(owner: Address) -> U256 {
    let mut buf = [0u8; 64];
    buf[12..32].copy_from_slice(owner.as_slice());
    buf[32..].copy_from_slice(&tip20_slots::BALANCES.to_be_bytes::<32>());
    U256::from_be_bytes(keccak256(buf).0)
}

/// Static checks of R3.3 that need no state. Returns the decoded receiver.
pub fn check_question(q: &Question) -> Result<Address, Abort> {
    if q.chainId != MODERATO_CHAIN_ID {
        return Err(Abort::ChainId(q.chainId));
    }
    if !q.token.is_tip20() {
        return Err(Abort::NotTip20(q.token));
    }
    let data = q.data.as_ref();
    let receiver = if data.len() >= 4 && data[..4] == transferCall::SELECTOR {
        let c = transferCall::abi_decode(data).map_err(|_| Abort::NonCanonicalCalldata)?;
        if c.abi_encode() != data {
            return Err(Abort::NonCanonicalCalldata);
        }
        c.to
    } else if data.len() >= 4 && data[..4] == transferWithMemoCall::SELECTOR {
        let c = transferWithMemoCall::abi_decode(data).map_err(|_| Abort::NonCanonicalCalldata)?;
        if c.abi_encode() != data {
            return Err(Abort::NonCanonicalCalldata);
        }
        c.to
    } else {
        return Err(Abort::Selector);
    };
    if receiver.is_virtual() {
        return Err(Abort::VirtualReceiver(receiver));
    }
    if receiver == q.from {
        return Err(Abort::ReceiverIsSender(receiver));
    }
    Ok(receiver)
}

/// R3.2: the one transaction, fully fixed.
pub fn question_tx(q: &Question, nonce: u64, base_fee: u64) -> TempoTxEnv {
    TempoTxEnv {
        inner: TxEnv {
            caller: q.from,
            kind: TxKind::Call(q.token),
            data: q.data.clone(),
            value: U256::ZERO,
            gas_limit: q.gasLimit,
            nonce,
            gas_price: base_fee as u128,
            gas_priority_fee: Some(0),
            access_list: Default::default(),
            chain_id: Some(MODERATO_CHAIN_ID),
            ..Default::default()
        },
        fee_token: Some(q.feeToken),
        fee_payer: None,
        tempo_tx_env: None,
        execution_context: ExecutionContext::Simulation,
        is_system_tx: false,
        ..Default::default()
    }
}

/// Everything the host wants to look at besides the Answer (diagnostics; not committed).
#[derive(Debug, Clone)]
pub struct Outcome {
    pub answer: Answer,
    pub return_data: Bytes,
    /// `Some(reason)` when the transaction is invalid (rejected before execution).
    pub invalid: Option<String>,
    pub logs: Vec<alloy_primitives::Log>,
    pub state: EvmState,
    pub spec: TempoHardfork,
}

fn post_slot(state: &EvmState, a: Address, slot: U256) -> Option<U256> {
    state.get(&a).and_then(|acc| acc.storage.get(&slot)).map(|s| s.present_value)
}

/// Execute `q` on `db` (state after N) with N's block environment. Generic over the DB so the host
/// runs the identical code over an RPC-backed lazy DB (witness discovery) and the guest over the
/// MPT-verified witness.
pub fn answer_question<DB: Database<Error = DbFault> + fmt::Debug>(
    header: &TempoHeader,
    block_hash: B256,
    q: &Question,
    db: DB,
    fees_on: bool,
) -> Result<Outcome, Abort> {
    answer_question_env(header, block_hash, q, db, fees_on, true)
}

/// Host-only variant for the AC-1a harness: `explicit_fee_token = false` leaves `fee_token = None`
/// (the env the RPC builds for a legacy request without `feeToken`). The guest never calls this
/// with anything but `(fees_on = true, explicit_fee_token = true)`.
pub fn answer_question_env<DB: Database<Error = DbFault> + fmt::Debug>(
    header: &TempoHeader,
    block_hash: B256,
    q: &Question,
    db: DB,
    fees_on: bool,
    explicit_fee_token: bool,
) -> Result<Outcome, Abort> {
    if q.blockHash != block_hash {
        return Err(Abort::HeaderHash { expected: q.blockHash, got: block_hash });
    }
    if header.inner.number != q.blockNumber {
        return Err(Abort::BlockNumber { header: header.inner.number, question: q.blockNumber });
    }
    let receiver = check_question(q)?;
    let mut db = Tracked::new(db);
    let fault = db.fault.clone();
    let spec = moderato_hardfork_at(header.inner.timestamp);

    // Raw lookups on the pre-state (witness): sender nonce, receiver balance.
    let nonce = db.basic(q.from).map_err(|e| e.0)?.map(|i| i.nonce).unwrap_or(0);
    let slot = tip20_balance_slot(receiver);
    let receiver_before = db.storage(q.token, slot).map_err(|e| e.0)?;

    let base_fee = header.inner.base_fee_per_gas.unwrap_or_default();
    let mut tx = question_tx(q, nonce, base_fee);
    if !explicit_fee_token {
        tx.fee_token = None;
    }
    let res = transact(db, cfg_env(spec, fees_on), block_env(header), tx);
    if let Some(a) = fault.borrow().clone() {
        return Err(a);
    }
    let out = match res {
        Ok(ResultAndState { result, state }) => {
            let gas_used = result.tx_gas_used();
            let (success, ret, logs) = match result {
                ExecutionResult::Success { output, logs, .. } => (true, output.into_data(), logs),
                ExecutionResult::Revert { output, logs, .. } => (false, output, logs),
                ExecutionResult::Halt { logs, .. } => (false, Bytes::new(), logs),
            };
            let receiver_after = post_slot(&state, q.token, slot).unwrap_or(receiver_before);
            // Fee in fee-token units = handler's `calc_gas_balance_spending(gasUsed, effectiveGasPrice)`;
            // effective gas price of this legacy-typed env = base fee.
            let fee = if fees_on { calc_gas_balance_spending(gas_used, base_fee as u128) } else { U256::ZERO };
            Outcome {
                answer: Answer {
                    success,
                    returnDataHash: keccak256(&ret),
                    gasUsed: gas_used,
                    feeCharged: fee,
                    receiver,
                    receiverBefore: receiver_before,
                    receiverAfter: receiver_after,
                },
                return_data: ret,
                invalid: None,
                logs,
                state,
                spec,
            }
        }
        Err(EVMError::Database(e)) => return Err(e.0),
        // Rejected before execution (nonce, fee balance, fee token, gas cap, ...): the transaction
        // would not be included. Defined answer: success=false, empty return, 0 gas, 0 fee, no move.
        Err(e) => Outcome {
            answer: Answer {
                success: false,
                returnDataHash: keccak256([]),
                gasUsed: 0,
                feeCharged: U256::ZERO,
                receiver,
                receiverBefore: receiver_before,
                receiverAfter: receiver_before,
            },
            return_data: Bytes::new(),
            invalid: Some(format!("{e:?}")),
            logs: vec![],
            state: Default::default(),
            spec,
        },
    };
    Ok(out)
}

/// The guest's whole job: verify, execute, encode. `Err` = abort (no proof).
pub fn run(input: &Input) -> Result<(Vec<u8>, Question, Answer), Abort> {
    let q = Question::abi_decode(&input.question).map_err(|e| Abort::QuestionDecode(e.to_string()))?;
    let header = bind_header(&input.raw_header, q.blockHash)?;
    if header.inner.number != q.blockNumber {
        return Err(Abort::BlockNumber { header: header.inner.number, question: q.blockNumber });
    }
    check_question(&q)?;
    let db = build_witness_db(header.inner.state_root, &input.accounts)?;
    let out = answer_question(&header, q.blockHash, &q, db, true)?;
    Ok((public_values(q.blockHash, &q, &out.answer), q, out.answer))
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::address;

    fn q(data: Vec<u8>) -> Question {
        Question {
            chainId: MODERATO_CHAIN_ID,
            blockNumber: 1,
            blockHash: B256::repeat_byte(1),
            from: address!("0xa5b53544c0ccb58c1936cb4fe9a5d15eac419832"),
            token: address!("0x20c0000000000000000000000000000000000002"),
            data: data.into(),
            feeToken: address!("0x20c0000000000000000000000000000000000002"),
            gasLimit: 100_000,
        }
    }
    fn xfer(to: Address) -> Vec<u8> {
        transferCall { to, amount: U256::from(5) }.abi_encode()
    }
    const R: Address = address!("0x8624b22d64678985aaee78abff7643e58e69076c");

    #[test]
    fn guest_version_is_keccak_of_label() {
        assert_eq!(GUEST_VERSION, keccak256(GUEST_VERSION_LABEL.as_bytes()));
    }

    #[test]
    fn encoding_round_trip() {
        let qq = q(transferWithMemoCall { to: R, amount: U256::from(7), memo: B256::repeat_byte(9) }.abi_encode());
        let a = Answer {
            success: true,
            returnDataHash: keccak256([1u8]),
            gasUsed: 31130,
            feeCharged: U256::from(21),
            receiver: R,
            receiverBefore: U256::from(1),
            receiverAfter: U256::from(8),
        };
        let pv = public_values(qq.blockHash, &qq, &a);
        let (v, bh, q2, a2) = decode_public_values(&pv).unwrap();
        assert_eq!((v, bh, &q2, &a2), (GUEST_VERSION, qq.blockHash, &qq, &a));
        // Solidity abi.encode(bytes32,bytes32,Question,Answer): head = 4 words; Question is dynamic
        // (offset), Answer is static (7 inline words) -> head is 2 + 1 + 7 = 10 words.
        assert_eq!(&pv[0..32], GUEST_VERSION.as_slice());
        assert_eq!(&pv[32..64], qq.blockHash.as_slice());
        assert_eq!(U256::from_be_slice(&pv[64..96]), U256::from(10 * 32));
        assert_eq!(Question::abi_decode(&qq.abi_encode()).unwrap(), qq);
    }

    /// Reproduces contracts/test/vectors/eip712.json (ethers 6.13.7 TypedDataEncoder) byte-for-byte.
    #[test]
    fn eip712_digest_matches_ethers_vector() {
        use alloy_sol_types::SolStruct;
        let r = address!("0x2222222222222222222222222222222222222222");
        let qq = Question {
            chainId: 42431,
            blockNumber: 1234567,
            blockHash: B256::repeat_byte(0xab),
            from: address!("0x1111111111111111111111111111111111111111"),
            token: address!("0x20C0000000000000000000000000000000000001"),
            data: transferCall { to: r, amount: U256::from(500_000_000u64) }.abi_encode().into(),
            feeToken: address!("0x20C0000000000000000000000000000000000000"),
            gasLimit: 300000,
        };
        let a = Answer {
            success: true,
            returnDataHash: keccak256(U256::from(1).to_be_bytes::<32>()),
            gasUsed: 51234,
            feeCharged: U256::from(25617),
            receiver: r,
            receiverBefore: U256::from(1000000),
            receiverAfter: U256::from(501000000),
        };
        let sa = SwornAnswer { question: qq.clone(), answer: a.clone() };
        assert_eq!(sa.eip712_type_hash(), keccak256(
            "SwornAnswer(Question question,Answer answer)Answer(bool success,bytes32 returnDataHash,uint64 gasUsed,uint256 feeCharged,address receiver,uint256 receiverBefore,uint256 receiverAfter)Question(uint64 chainId,uint64 blockNumber,bytes32 blockHash,address from,address token,bytes data,address feeToken,uint64 gasLimit)"));
        assert_eq!(qq.eip712_hash_struct(), b256!("0x23ce92c58caed27416865d773338752c793b9d41601bbe31ffe6df0d47253ac0"));
        assert_eq!(a.eip712_hash_struct(), b256!("0xb6585b0cf764195f822d96310dbb89a30c7be3ef4fb12d11e81adf29ad04d484"));
        assert_eq!(
            eip712_digest(42431, address!("0x5300000000000000000000000000000000000001"), &qq, &a),
            b256!("0xeb63a2ddddd9bd16cc00817ca7f9c771921bc18bed5a8ecf1d2f50c48877bf48")
        );
    }

    #[test]
    fn abort_wrong_selector() {
        let mut d = xfer(R);
        d[0] ^= 1;
        assert_eq!(check_question(&q(d)), Err(Abort::Selector));
    }

    #[test]
    fn abort_non_tip20_token() {
        let mut qq = q(xfer(R));
        qq.token = address!("0x1111111111111111111111111111111111111111");
        assert_eq!(check_question(&qq), Err(Abort::NotTip20(qq.token)));
    }

    #[test]
    fn abort_chain_id() {
        let mut qq = q(xfer(R));
        qq.chainId = 4217;
        assert_eq!(check_question(&qq), Err(Abort::ChainId(4217)));
    }

    #[test]
    fn abort_virtual_receiver() {
        let v = Address::new_virtual([1, 2, 3, 4].into(), [5, 6, 7, 8, 9, 10].into());
        assert!(v.is_virtual());
        assert_eq!(check_question(&q(xfer(v))), Err(Abort::VirtualReceiver(v)));
    }

    #[test]
    fn abort_receiver_is_sender() {
        let qq = q(xfer(address!("0xa5b53544c0ccb58c1936cb4fe9a5d15eac419832")));
        assert_eq!(check_question(&qq), Err(Abort::ReceiverIsSender(qq.from)));
    }

    #[test]
    fn abort_non_canonical_calldata() {
        let mut d = xfer(R);
        d.push(0);
        assert_eq!(check_question(&q(d)), Err(Abort::NonCanonicalCalldata));
    }

    #[test]
    fn accepts_transfer_and_memo() {
        assert_eq!(check_question(&q(xfer(R))), Ok(R));
        let m = transferWithMemoCall { to: R, amount: U256::from(1), memo: B256::ZERO }.abi_encode();
        assert_eq!(check_question(&q(m)), Ok(R));
    }

    #[test]
    fn abort_header_hash_mismatch() {
        let raw = [0xc0u8];
        assert!(matches!(bind_header(&raw, B256::ZERO), Err(Abort::HeaderHash { .. })));
    }

    #[test]
    fn abort_blockhash_read() {
        let mut db = Tracked::new(WitnessDb::default());
        assert!(db.block_hash(5).is_err());
        assert_eq!(db.fault.borrow().clone(), Some(Abort::BlockHashRead(5)));
    }

    #[test]
    fn abort_missing_witness() {
        let mut db = Tracked::new(WitnessDb::default());
        assert!(db.basic(R).is_err());
        assert_eq!(db.fault.borrow().clone(), Some(Abort::MissingAccount(R)));
    }

    #[test]
    fn hardfork_schedule_from_chainspec_genesis() {
        // keys come from tempo's genesis file via TempoHardfork::genesis_key
        assert_eq!(moderato_fork_time(TempoHardfork::T11), Some(1788962400));
        assert_eq!(moderato_hardfork_at(1788962399), TempoHardfork::T10);
        assert_eq!(moderato_hardfork_at(1788962400), TempoHardfork::T11);
        assert_eq!(moderato_hardfork_at(1771858800), TempoHardfork::T1B); // T1A and T1B coincide
        assert_eq!(moderato_epoch_length().get(), 21600);
        assert_eq!(genesis_config("chainId"), Some(MODERATO_CHAIN_ID));
    }

    #[test]
    fn tip20_balance_slot_matches_measured() {
        // measured via debug_traceCall prestate diff on Moderato, 2026-10-03
        assert_eq!(
            tip20_balance_slot(R),
            U256::from_be_bytes(b256!("0x57c6732ca19d7df374e536a4827fc04f52b7bdff3025b088380cdc3e076e774f").0)
        );
    }
}
