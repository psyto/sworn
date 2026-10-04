// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ISP1Verifier} from "./vendor/sp1-contracts/ISP1Verifier.sol";

// Same layouts as Tempo Zones' IZone.sol (zones ac49071f, crates/contracts/src/runtime/interfaces/IZone.sol:72-93),
// so the `verify` selector and calldata are exactly `IVerifier.verify`'s.
struct BlockTransition {
    bytes32 prevBlockHash;
    bytes32 nextBlockHash;
}

struct DepositQueueTransition {
    bytes32 prevProcessedHash;
    bytes32 nextProcessedHash;
    uint64 prevDepositNumber;
    uint64 nextDepositNumber;
}

struct TokenEnablementTransition {
    uint64 prevProcessedTokenCount;
    uint64 nextProcessedTokenCount;
}

/// @notice Tempo Zones' verifier interface (IZone.sol:306-345), verbatim signature.
interface IVerifier {
    function verify(
        uint32 zoneId,
        uint64 tempoBlockNumber,
        uint64 anchorBlockNumber,
        bytes32 anchorBlockHash,
        uint64 expectedWithdrawalBatchIndex,
        uint256 nextZoneHeight,
        BlockTransition calldata blockTransition,
        DepositQueueTransition calldata depositQueueTransition,
        TokenEnablementTransition calldata tokenEnablementTransition,
        bytes32 withdrawalQueueHash,
        bytes calldata verifierConfig,
        bytes calldata proof
    ) external view returns (bool);
}

/// @title SwornZoneVerifier — an SP1 Groth16 verifier for Tempo Zone batches, shaped like `IVerifier`
/// @notice Spec: docs/specs/003-zone-verifier.md. The SP1 guest runs Tempo Zones' own stateless proof
///         function (`zone_spf::prove_zone_batch`) and commits
///         `abi.encode(ZONE_GUEST_VERSION, digest)`, where `digest` is the EIP-712 hashStruct (no domain
///         separator) of `SwornZoneBatchAttestation`. This contract recomputes that digest from the
///         `verify` arguments plus its own immutables, and checks the proof.
///
///         DELIBERATE DEVIATIONS FROM A PRODUCTION VERIFIER (spec §5):
///         D1 PARENT_CHAIN_ID is a constructor argument (1337, the dev chain the batch came from). In
///            production it would be `block.chainid`.
///         D2 No caller check. Nitro's verifier requires the caller to be the zone's canonical portal;
///            there is no portal for this zone here.
///         D3 One pinned zone and one pinned genesis artifact. A production verifier would need a
///            registry chosen by Tempo. Which artifact is pinned is a trusted deployment choice: the hash
///            pins exact bytes, it does not prove they are Tempo's authentic Zone spec.
///         D4 Write-nothing demonstration. D2 is safe only because `attest` moves nothing and stores
///            nothing. This must not be generalized to settlement.
///
///         Compiled with via-IR (foundry.toml compilation_restrictions): the 12-argument `verify` ABI
///         decoder is "stack too deep" under the legacy code generator.
///
///         Immutable, no privileged surface: no setters, no upgrade path, no fallback, no storage writes.
contract SwornZoneVerifier is IVerifier {
    /// @notice keccak256 of the canonical type string (spec §3), hard-coded; the test suite asserts it
    ///         equals keccak256 of the literal string and the Rust side's constant.
    bytes32 public constant ATTESTATION_TYPEHASH = 0x92642ea5ff5c47ad5a0c977fa87d5a0634b45661ad091c055f6905e7a51d8221;
    /// @notice keccak256("sworn-zone-guest-v1"): the first word of the guest's public values.
    bytes32 public constant ZONE_GUEST_VERSION = keccak256("sworn-zone-guest-v1");
    /// @notice keccak256(hex"02"), the hash of ZK_VERIFIER_CONFIG_V1 (Nitro's config is 0x01).
    bytes32 public constant ZK_VERIFIER_CONFIG_V1_HASH = keccak256(hex"02");

    ISP1Verifier public immutable SP1_VERIFIER;
    bytes32 public immutable ZONE_VKEY;
    /// @notice D1: the source (dev) chain of the batch, not this chain.
    uint256 public immutable PARENT_CHAIN_ID;
    uint32 public immutable PINNED_ZONE_ID;
    /// @notice D3: keccak256 of the exact genesis JSON bytes the guest parsed.
    bytes32 public immutable PINNED_GENESIS_ARTIFACT_HASH;

    event ZoneBatchVerified(
        uint32 zoneId, uint256 nextZoneHeight, bytes32 prevBlockHash, bytes32 nextBlockHash, bytes32 digest
    );

    error WrongVerifierConfig();
    error WrongZone();
    error InvalidProof();
    error ZeroParameter();

    constructor(
        ISP1Verifier sp1Verifier,
        bytes32 zoneVkey,
        uint256 parentChainId,
        uint32 pinnedZoneId,
        bytes32 pinnedGenesisArtifactHash
    ) {
        if (address(sp1Verifier) == address(0) || zoneVkey == 0 || parentChainId == 0 || pinnedGenesisArtifactHash == 0)
        {
            revert ZeroParameter();
        }
        SP1_VERIFIER = sp1Verifier;
        ZONE_VKEY = zoneVkey;
        PARENT_CHAIN_ID = parentChainId;
        PINNED_ZONE_ID = pinnedZoneId;
        PINNED_GENESIS_ARTIFACT_HASH = pinnedGenesisArtifactHash;
    }

    /// @inheritdoc IVerifier
    /// @dev Reverts WrongVerifierConfig / WrongZone / InvalidProof; otherwise returns true.
    function verify(
        uint32 zoneId,
        uint64 tempoBlockNumber,
        uint64 anchorBlockNumber,
        bytes32 anchorBlockHash,
        uint64 expectedWithdrawalBatchIndex,
        uint256 nextZoneHeight,
        BlockTransition calldata blockTransition,
        DepositQueueTransition calldata depositQueueTransition,
        TokenEnablementTransition calldata tokenEnablementTransition,
        bytes32 withdrawalQueueHash,
        bytes calldata verifierConfig,
        bytes calldata proof
    ) external view returns (bool) {
        bytes32 digest = attestationDigest(
            zoneId,
            tempoBlockNumber,
            anchorBlockNumber,
            anchorBlockHash,
            expectedWithdrawalBatchIndex,
            nextZoneHeight,
            blockTransition,
            depositQueueTransition,
            tokenEnablementTransition,
            withdrawalQueueHash,
            verifierConfig
        );
        _check(zoneId, verifierConfig, digest, proof);
        return true;
    }

    /// @notice Same arguments and check as `verify`; then emits `ZoneBatchVerified`. Writes nothing (D4).
    function attest(
        uint32 zoneId,
        uint64 tempoBlockNumber,
        uint64 anchorBlockNumber,
        bytes32 anchorBlockHash,
        uint64 expectedWithdrawalBatchIndex,
        uint256 nextZoneHeight,
        BlockTransition calldata blockTransition,
        DepositQueueTransition calldata depositQueueTransition,
        TokenEnablementTransition calldata tokenEnablementTransition,
        bytes32 withdrawalQueueHash,
        bytes calldata verifierConfig,
        bytes calldata proof
    ) external {
        bytes32 digest = attestationDigest(
            zoneId,
            tempoBlockNumber,
            anchorBlockNumber,
            anchorBlockHash,
            expectedWithdrawalBatchIndex,
            nextZoneHeight,
            blockTransition,
            depositQueueTransition,
            tokenEnablementTransition,
            withdrawalQueueHash,
            verifierConfig
        );
        _check(zoneId, verifierConfig, digest, proof);
        emit ZoneBatchVerified(
            zoneId, nextZoneHeight, blockTransition.prevBlockHash, blockTransition.nextBlockHash, digest
        );
    }

    /// @notice EIP-712 hashStruct (no domain separator) of `SwornZoneBatchAttestation` (spec §3) for these
    ///         arguments on this deployment. parentChainId, verifier, verifierConfigHash,
    ///         genesisArtifactHash and destinationChainId come from PARENT_CHAIN_ID, address(this),
    ///         keccak256(verifierConfig), PINNED_GENESIS_ARTIFACT_HASH and block.chainid; every other
    ///         field from the arguments. The three structs are static, so abi.encode lays their fields out
    ///         inline, one 32-byte word each, in the struct's field order — which is EIP-712 encodeData for
    ///         these atomic types.
    function attestationDigest(
        uint32 zoneId,
        uint64 tempoBlockNumber,
        uint64 anchorBlockNumber,
        bytes32 anchorBlockHash,
        uint64 expectedWithdrawalBatchIndex,
        uint256 nextZoneHeight,
        BlockTransition calldata blockTransition,
        DepositQueueTransition calldata depositQueueTransition,
        TokenEnablementTransition calldata tokenEnablementTransition,
        bytes32 withdrawalQueueHash,
        bytes calldata verifierConfig
    ) public view returns (bytes32) {
        return keccak256(
            bytes.concat(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    PARENT_CHAIN_ID,
                    address(this),
                    zoneId,
                    tempoBlockNumber,
                    anchorBlockNumber,
                    anchorBlockHash,
                    expectedWithdrawalBatchIndex
                ),
                abi.encode(
                    nextZoneHeight,
                    blockTransition,
                    depositQueueTransition,
                    tokenEnablementTransition,
                    withdrawalQueueHash,
                    keccak256(verifierConfig),
                    PINNED_GENESIS_ARTIFACT_HASH,
                    block.chainid
                )
            )
        );
    }

    function _check(uint32 zoneId, bytes calldata verifierConfig, bytes32 digest, bytes calldata proof)
        internal
        view
    {
        if (keccak256(verifierConfig) != ZK_VERIFIER_CONFIG_V1_HASH) revert WrongVerifierConfig();
        if (zoneId != PINNED_ZONE_ID) revert WrongZone();
        try SP1_VERIFIER.verifyProof(ZONE_VKEY, abi.encode(ZONE_GUEST_VERSION, digest), proof) {}
        catch {
            revert InvalidProof();
        }
    }
}
