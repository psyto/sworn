//! Spec 003 §3–§4 (`docs/specs/003-zone-verifier.md`): the zone guest's input, the
//! `SwornZoneBatchAttestation` digest and the public values.
//!
//! This is the ONE copy of the code. The SP1 guest (`../guest`) and the native host (`../host`)
//! both call [`execute`], so "the guest's public values equal the native host's" compares one
//! function compiled for two targets, not two implementations.

use std::sync::Arc;

use alloy_primitives::{Address, B256, U256, keccak256};
use alloy_sol_types::{SolStruct as _, sol};
pub use zone_spf::{BatchOutput, BatchWitness, PublicInputs};

sol! {
    /// Spec 003 §3. Same first 18 fields as Tempo's `NitroBatchAttestation`
    /// (`zones/crates/prover/src/protocol.rs`), a different struct name, plus the genesis artifact
    /// hash and the destination chain id.
    #[derive(Debug, PartialEq, Eq)]
    struct SwornZoneBatchAttestation {
        uint256 parentChainId;
        address verifier;
        uint32 zoneId;
        uint64 tempoBlockNumber;
        uint64 anchorBlockNumber;
        bytes32 anchorBlockHash;
        uint64 expectedWithdrawalBatchIndex;
        uint256 nextZoneHeight;
        bytes32 prevBlockHash;
        bytes32 nextBlockHash;
        bytes32 prevProcessedHash;
        bytes32 nextProcessedHash;
        uint64 prevDepositNumber;
        uint64 nextDepositNumber;
        uint64 prevProcessedTokenCount;
        uint64 nextProcessedTokenCount;
        bytes32 withdrawalQueueHash;
        bytes32 verifierConfigHash;
        bytes32 genesisArtifactHash;
        uint256 destinationChainId;
    }
}

/// The canonical EIP-712 type string (spec §3, verbatim).
pub const TYPE_STRING: &str = "SwornZoneBatchAttestation(uint256 parentChainId,address verifier,uint32 zoneId,uint64 tempoBlockNumber,uint64 anchorBlockNumber,bytes32 anchorBlockHash,uint64 expectedWithdrawalBatchIndex,uint256 nextZoneHeight,bytes32 prevBlockHash,bytes32 nextBlockHash,bytes32 prevProcessedHash,bytes32 nextProcessedHash,uint64 prevDepositNumber,uint64 nextDepositNumber,uint64 prevProcessedTokenCount,uint64 nextProcessedTokenCount,bytes32 withdrawalQueueHash,bytes32 verifierConfigHash,bytes32 genesisArtifactHash,uint256 destinationChainId)";

/// keccak256(TYPE_STRING), hard-coded (spec §6 AC-Z2). Solidity hard-codes the same value.
pub const TYPEHASH: B256 =
    alloy_primitives::b256!("92642ea5ff5c47ad5a0c977fa87d5a0634b45661ad091c055f6905e7a51d8221");

/// keccak256("sworn-zone-guest-v1").
pub const ZONE_GUEST_VERSION: B256 =
    alloy_primitives::b256!("6fa127679dd53cd8b71ca0ba6579645bc4104bec6c1a180c236d63c471680f31");

/// `verifierConfig` for this ZK verifier: the ASCII bytes of "sworn-sp1-groth16-v1" (20 bytes).
/// Self-describing, and cannot collide with Tempo's one-byte tags: upstream zones commit 344ff785
/// (2026-10-01) defines 0x01 = Nitro and 0x02 = NoProof (spec 003 §3). Earlier drafts used 0x02.
pub const ZK_VERIFIER_CONFIG_V1: &[u8] = b"sworn-sp1-groth16-v1";

/// The guest input (spec §4).
#[derive(Debug, Clone)]
pub struct GuestInput {
    /// Exact bytes of the genesis JSON; hashed before parsing.
    pub genesis_bytes: Vec<u8>,
    pub witness: BatchWitness,
    /// The deployed `SwornZoneVerifier` address.
    pub verifier: Address,
    pub verifier_config: Vec<u8>,
    /// Chain the verifier is deployed on (42431 = Moderato).
    pub destination_chain_id: u64,
}

#[derive(Debug)]
pub enum Error {
    /// The framed input is malformed.
    Input(&'static str),
    /// `verifier_config != ZK_VERIFIER_CONFIG_V1` ("sworn-sp1-groth16-v1").
    WrongVerifierConfig,
    Genesis(String),
    ChainSpec(String),
    Witness(String),
    /// `prove_zone_batch` rejected the witness.
    Spf(zone_spf::Error),
}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Error::Input(m) => write!(f, "malformed input: {m}"),
            Error::WrongVerifierConfig => write!(f, "verifier_config must be \"sworn-sp1-groth16-v1\""),
            Error::Genesis(m) => write!(f, "genesis: {m}"),
            Error::ChainSpec(m) => write!(f, "chainspec: {m}"),
            Error::Witness(m) => write!(f, "witness: {m}"),
            Error::Spf(e) => write!(f, "prove_zone_batch: {e}"),
        }
    }
}

/// What one run produces.
#[derive(Debug)]
pub struct Outcome {
    pub output: BatchOutput,
    pub genesis_artifact_hash: B256,
    pub attestation: SwornZoneBatchAttestation,
    pub digest: B256,
    /// `abi.encode(bytes32 ZONE_GUEST_VERSION, bytes32 digest)`.
    pub public_values: [u8; 64],
}

/// Spec §3: build the attestation struct. Every field has one source.
pub fn attestation(
    public_inputs: &PublicInputs,
    output: &BatchOutput,
    verifier: Address,
    verifier_config: &[u8],
    genesis_artifact_hash: B256,
    destination_chain_id: u64,
) -> SwornZoneBatchAttestation {
    SwornZoneBatchAttestation {
        parentChainId: U256::from(public_inputs.parent_chain_id),
        verifier,
        zoneId: public_inputs.zone_id,
        tempoBlockNumber: public_inputs.tempo_block_number,
        anchorBlockNumber: public_inputs.anchor_block_number,
        anchorBlockHash: public_inputs.anchor_block_hash,
        expectedWithdrawalBatchIndex: public_inputs.expected_withdrawal_batch_index,
        nextZoneHeight: U256::from(output.next_zone_height),
        prevBlockHash: output.block_transition.prevBlockHash,
        nextBlockHash: output.block_transition.nextBlockHash,
        prevProcessedHash: output.deposit_queue_transition.prevProcessedHash,
        nextProcessedHash: output.deposit_queue_transition.nextProcessedHash,
        prevDepositNumber: output.deposit_queue_transition.prevDepositNumber,
        nextDepositNumber: output.deposit_queue_transition.nextDepositNumber,
        prevProcessedTokenCount: output.token_enablement_transition.prevProcessedTokenCount,
        nextProcessedTokenCount: output.token_enablement_transition.nextProcessedTokenCount,
        withdrawalQueueHash: output.withdrawal_queue_hash,
        verifierConfigHash: keccak256(verifier_config),
        genesisArtifactHash: genesis_artifact_hash,
        destinationChainId: U256::from(destination_chain_id),
    }
}

/// EIP-712 `hashStruct` (no domain separator).
pub fn digest(a: &SwornZoneBatchAttestation) -> B256 {
    a.eip712_hash_struct()
}

/// `abi.encode(bytes32 ZONE_GUEST_VERSION, bytes32 digest)`.
pub fn public_values(digest: B256) -> [u8; 64] {
    let mut pv = [0u8; 64];
    pv[..32].copy_from_slice(ZONE_GUEST_VERSION.as_slice());
    pv[32..].copy_from_slice(digest.as_slice());
    pv
}

/// Spec §4, steps 1–4 (the commit itself is the caller's). The guest panics on `Err`.
pub fn execute(input: GuestInput) -> Result<Outcome, Error> {
    if input.verifier_config.as_slice() != ZK_VERIFIER_CONFIG_V1 {
        return Err(Error::WrongVerifierConfig);
    }
    // 1. hash the exact bytes, then parse them.
    let genesis_artifact_hash = keccak256(&input.genesis_bytes);
    let genesis: alloy_genesis::Genesis = serde_json::from_slice(&input.genesis_bytes)
        .map_err(|e| Error::Genesis(e.to_string()))?;
    let spec = zone_chainspec::ZoneChainSpec::from_genesis(genesis)
        .map_err(|e| Error::ChainSpec(format!("{e:?}")))?;
    // 2. Tempo's own stateless proof function, unchanged.
    let config = zone_spf::SpfConfig::new(Arc::new(spec));
    let public_inputs = input.witness.public_inputs.clone();
    let output = zone_spf::prove_zone_batch(&config, input.witness).map_err(Error::Spf)?;
    // 3. digest.
    let attestation = attestation(
        &public_inputs,
        &output,
        input.verifier,
        &input.verifier_config,
        genesis_artifact_hash,
        input.destination_chain_id,
    );
    let digest = digest(&attestation);
    Ok(Outcome { output, genesis_artifact_hash, attestation, digest, public_values: public_values(digest) })
}

// ---------------------------------------------------------------------------------------------
// Input framing (one byte vector, so the generic SP1 runner can pass it with one `write_slice`):
//   u32le len ‖ genesis_bytes ‖ u32le len ‖ witness JSON ‖ verifier (20) ‖ u32le len ‖
//   verifier_config ‖ u64le destination_chain_id
// ---------------------------------------------------------------------------------------------

/// Frame an input whose witness is given as JSON bytes (exactly as the host read them).
pub fn encode_input(
    genesis_bytes: &[u8],
    witness_json: &[u8],
    verifier: Address,
    verifier_config: &[u8],
    destination_chain_id: u64,
) -> Vec<u8> {
    let mut v = Vec::with_capacity(genesis_bytes.len() + witness_json.len() + 64);
    for part in [genesis_bytes, witness_json] {
        v.extend_from_slice(&(part.len() as u32).to_le_bytes());
        v.extend_from_slice(part);
    }
    v.extend_from_slice(verifier.as_slice());
    v.extend_from_slice(&(verifier_config.len() as u32).to_le_bytes());
    v.extend_from_slice(verifier_config);
    v.extend_from_slice(&destination_chain_id.to_le_bytes());
    v
}

struct Reader<'a>(&'a [u8]);
impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
        if self.0.len() < n {
            return Err(Error::Input("truncated"));
        }
        let (a, b) = self.0.split_at(n);
        self.0 = b;
        Ok(a)
    }
    fn len_prefixed(&mut self) -> Result<&'a [u8], Error> {
        let n = u32::from_le_bytes(self.take(4)?.try_into().unwrap()) as usize;
        self.take(n)
    }
}

pub fn decode_input(bytes: &[u8]) -> Result<GuestInput, Error> {
    let mut r = Reader(bytes);
    let genesis_bytes = r.len_prefixed()?.to_vec();
    let witness_json = r.len_prefixed()?;
    let verifier = Address::from_slice(r.take(20)?);
    let verifier_config = r.len_prefixed()?.to_vec();
    let destination_chain_id = u64::from_le_bytes(r.take(8)?.try_into().unwrap());
    if !r.0.is_empty() {
        return Err(Error::Input("trailing bytes"));
    }
    let witness: BatchWitness =
        serde_json::from_slice(witness_json).map_err(|e| Error::Witness(e.to_string()))?;
    Ok(GuestInput { genesis_bytes, witness, verifier, verifier_config, destination_chain_id })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typehash_is_keccak_of_the_literal_and_the_hardcoded_constant() {
        assert_eq!(SwornZoneBatchAttestation::eip712_encode_type(), TYPE_STRING);
        assert_eq!(keccak256(TYPE_STRING.as_bytes()), TYPEHASH);
        let a = SwornZoneBatchAttestation {
            parentChainId: U256::ZERO,
            verifier: Address::ZERO,
            zoneId: 0,
            tempoBlockNumber: 0,
            anchorBlockNumber: 0,
            anchorBlockHash: B256::ZERO,
            expectedWithdrawalBatchIndex: 0,
            nextZoneHeight: U256::ZERO,
            prevBlockHash: B256::ZERO,
            nextBlockHash: B256::ZERO,
            prevProcessedHash: B256::ZERO,
            nextProcessedHash: B256::ZERO,
            prevDepositNumber: 0,
            nextDepositNumber: 0,
            prevProcessedTokenCount: 0,
            nextProcessedTokenCount: 0,
            withdrawalQueueHash: B256::ZERO,
            verifierConfigHash: B256::ZERO,
            genesisArtifactHash: B256::ZERO,
            destinationChainId: U256::ZERO,
        };
        assert_eq!(a.eip712_type_hash(), TYPEHASH);
        assert_eq!(keccak256(b"sworn-zone-guest-v1"), ZONE_GUEST_VERSION);
        assert_eq!(ZK_VERIFIER_CONFIG_V1, &hex_literal_tag()[..]);
        assert_eq!(
            keccak256(ZK_VERIFIER_CONFIG_V1),
            alloy_primitives::b256!("c405c6c7397b2e658a365c7a4e97b646114812fa0357d8f047caabd14012dd23")
        );
    }

    fn hex_literal_tag() -> Vec<u8> {
        alloy_primitives::hex::decode("73776f726e2d7370312d67726f746831362d7631").unwrap()
    }

    /// AC-Z2: the golden vector shared with Solidity (`contracts/test/vectors/zone-digest-golden.json`).
    #[test]
    fn golden_vector_matches_the_shared_file() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../contracts/test/vectors/zone-digest-golden.json");
        let j: serde_json::Value = serde_json::from_slice(&std::fs::read(path).expect("golden file")).unwrap();
        let a = golden();
        assert_eq!(j["typehash"].as_str().unwrap(), format!("{TYPEHASH:#x}"));
        assert_eq!(j["typeString"].as_str().unwrap(), TYPE_STRING);
        assert_eq!(j["digest"].as_str().unwrap(), format!("{:#x}", digest(&a)));
        assert_eq!(j["publicValues"].as_str().unwrap(), format!("0x{}", alloy_primitives::hex::encode(public_values(digest(&a)))));
    }
}

/// AC-Z2 golden vector: every field distinct and non-zero, so a swapped, dropped or mistyped field
/// changes the digest.
pub fn golden() -> SwornZoneBatchAttestation {
    let h = |b: u8| B256::repeat_byte(b);
    SwornZoneBatchAttestation {
        parentChainId: U256::from(1337u64),
        verifier: alloy_primitives::address!("000000000000000000000000000000005a0e5a0e"),
        zoneId: 7,
        tempoBlockNumber: 101,
        anchorBlockNumber: 102,
        anchorBlockHash: h(0xa1),
        expectedWithdrawalBatchIndex: 103,
        nextZoneHeight: U256::from(104u64),
        prevBlockHash: h(0xb1),
        nextBlockHash: h(0xb2),
        prevProcessedHash: h(0xc1),
        nextProcessedHash: h(0xc2),
        prevDepositNumber: 105,
        nextDepositNumber: 106,
        prevProcessedTokenCount: 107,
        nextProcessedTokenCount: 108,
        withdrawalQueueHash: h(0xd1),
        verifierConfigHash: keccak256(ZK_VERIFIER_CONFIG_V1),
        genesisArtifactHash: h(0xe1),
        destinationChainId: U256::from(42431u64),
    }
}
