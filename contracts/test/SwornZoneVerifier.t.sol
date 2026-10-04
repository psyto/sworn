// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    SwornZoneVerifier,
    BlockTransition,
    DepositQueueTransition,
    TokenEnablementTransition
} from "../src/SwornZoneVerifier.sol";
import {ISP1Verifier} from "../src/vendor/sp1-contracts/ISP1Verifier.sol";
import {SP1Verifier as SP1VerifierGroth16V6} from "../src/vendor/sp1-contracts/v6.1.0/SP1VerifierGroth16.sol";
import {MockSP1Verifier} from "./mocks/MockSP1Verifier.sol";

/// @notice Spec 003 (docs/specs/003-zone-verifier.md) AC-Z2 and AC-Z4.
///         Vectors (all produced by the Rust side, spikes/zone-spf/host):
///           test/vectors/zone-digest-golden.json          AC-Z2 golden vector (synthetic, every field distinct)
///           test/vectors/zone-hardfork-placeholder.json   REAL SP1 v6.1.0 Groth16 proof of hardfork_t13_recovery
///                                                         for verifier 0x…5a0e5a0e on chain 42431
abstract contract ZoneBase is Test {
    string constant TYPE_STRING =
        "SwornZoneBatchAttestation(uint256 parentChainId,address verifier,uint32 zoneId,uint64 tempoBlockNumber,uint64 anchorBlockNumber,bytes32 anchorBlockHash,uint64 expectedWithdrawalBatchIndex,uint256 nextZoneHeight,bytes32 prevBlockHash,bytes32 nextBlockHash,bytes32 prevProcessedHash,bytes32 nextProcessedHash,uint64 prevDepositNumber,uint64 nextDepositNumber,uint64 prevProcessedTokenCount,uint64 nextProcessedTokenCount,bytes32 withdrawalQueueHash,bytes32 verifierConfigHash,bytes32 genesisArtifactHash,uint256 destinationChainId)";
    /// Hard-coded; also in attest/src/lib.rs (TYPEHASH) and spec §6 AC-Z2.
    bytes32 constant TYPEHASH = 0x92642ea5ff5c47ad5a0c977fa87d5a0634b45661ad091c055f6905e7a51d8221;
    /// The Moderato SP1 v6.1.0 Groth16 verifier (deployments/moderato.json).
    address constant MODERATO_SP1 = 0x2c77329747b7C8B293514A6129404D4cefDd9B18;

    /// Same signature as SwornZoneVerifier.ZoneBatchVerified (solc 0.8.20 cannot emit another contract's event).
    event ZoneBatchVerified(
        uint32 zoneId, uint256 nextZoneHeight, bytes32 prevBlockHash, bytes32 nextBlockHash, bytes32 digest
    );

    struct Args {
        uint32 zoneId;
        uint64 tempoBlockNumber;
        uint64 anchorBlockNumber;
        bytes32 anchorBlockHash;
        uint64 expectedWithdrawalBatchIndex;
        uint256 nextZoneHeight;
        BlockTransition bt;
        DepositQueueTransition dq;
        TokenEnablementTransition te;
        bytes32 withdrawalQueueHash;
        bytes verifierConfig;
    }

    struct Vec {
        Args a;
        address verifier;
        uint256 chainId;
        uint256 parentChainId;
        bytes32 genesisArtifactHash;
        bytes32 digest;
        bytes publicValues;
    }

    function _vec(string memory path) internal view returns (Vec memory v) {
        string memory j = vm.readFile(path);
        v.verifier = vm.parseJsonAddress(j, ".verifier");
        v.chainId = vm.parseJsonUint(j, ".destinationChainId");
        v.parentChainId = vm.parseJsonUint(j, ".parentChainId");
        v.genesisArtifactHash = vm.parseJsonBytes32(j, ".genesisArtifactHash");
        v.digest = vm.parseJsonBytes32(j, ".digest");
        v.publicValues = vm.parseJsonBytes(j, ".publicValues");
        v.a = _args(j);
    }

    function _args(string memory j) internal pure returns (Args memory a) {
        a.zoneId = uint32(vm.parseJsonUint(j, ".args.zoneId"));
        a.tempoBlockNumber = uint64(vm.parseJsonUint(j, ".args.tempoBlockNumber"));
        a.anchorBlockNumber = uint64(vm.parseJsonUint(j, ".args.anchorBlockNumber"));
        a.anchorBlockHash = vm.parseJsonBytes32(j, ".args.anchorBlockHash");
        a.expectedWithdrawalBatchIndex = uint64(vm.parseJsonUint(j, ".args.expectedWithdrawalBatchIndex"));
        a.nextZoneHeight = vm.parseJsonUint(j, ".args.nextZoneHeight");
        a.bt = BlockTransition(vm.parseJsonBytes32(j, ".args.prevBlockHash"), vm.parseJsonBytes32(j, ".args.nextBlockHash"));
        a.dq = DepositQueueTransition(
            vm.parseJsonBytes32(j, ".args.prevProcessedHash"),
            vm.parseJsonBytes32(j, ".args.nextProcessedHash"),
            uint64(vm.parseJsonUint(j, ".args.prevDepositNumber")),
            uint64(vm.parseJsonUint(j, ".args.nextDepositNumber"))
        );
        a.te = TokenEnablementTransition(
            uint64(vm.parseJsonUint(j, ".args.prevProcessedTokenCount")),
            uint64(vm.parseJsonUint(j, ".args.nextProcessedTokenCount"))
        );
        a.withdrawalQueueHash = vm.parseJsonBytes32(j, ".args.withdrawalQueueHash");
        a.verifierConfig = vm.parseJsonBytes(j, ".verifierConfig");
    }

    /// Field i (0..14, the 15 digest fields that come from `verify` arguments, in struct order) changed.
    function _mutated(Args memory a, uint256 i) internal pure returns (Args memory m) {
        // A deep copy (memory-struct assignment would alias `a`).
        m.zoneId = a.zoneId;
        m.tempoBlockNumber = a.tempoBlockNumber;
        m.anchorBlockNumber = a.anchorBlockNumber;
        m.anchorBlockHash = a.anchorBlockHash;
        m.expectedWithdrawalBatchIndex = a.expectedWithdrawalBatchIndex;
        m.nextZoneHeight = a.nextZoneHeight;
        m.withdrawalQueueHash = a.withdrawalQueueHash;
        m.verifierConfig = bytes.concat(a.verifierConfig);
        m.bt = BlockTransition(a.bt.prevBlockHash, a.bt.nextBlockHash);
        m.dq = DepositQueueTransition(a.dq.prevProcessedHash, a.dq.nextProcessedHash, a.dq.prevDepositNumber, a.dq.nextDepositNumber);
        m.te = TokenEnablementTransition(a.te.prevProcessedTokenCount, a.te.nextProcessedTokenCount);
        if (i == 0) m.zoneId = a.zoneId + 1;
        else if (i == 1) m.tempoBlockNumber = a.tempoBlockNumber + 1;
        else if (i == 2) m.anchorBlockNumber = a.anchorBlockNumber + 1;
        else if (i == 3) m.anchorBlockHash = a.anchorBlockHash ^ bytes32(uint256(1));
        else if (i == 4) m.expectedWithdrawalBatchIndex = a.expectedWithdrawalBatchIndex + 1;
        else if (i == 5) m.nextZoneHeight = a.nextZoneHeight + 1;
        else if (i == 6) m.bt.prevBlockHash = a.bt.prevBlockHash ^ bytes32(uint256(1));
        else if (i == 7) m.bt.nextBlockHash = a.bt.nextBlockHash ^ bytes32(uint256(1));
        else if (i == 8) m.dq.prevProcessedHash = a.dq.prevProcessedHash ^ bytes32(uint256(1));
        else if (i == 9) m.dq.nextProcessedHash = a.dq.nextProcessedHash ^ bytes32(uint256(1));
        else if (i == 10) m.dq.prevDepositNumber = a.dq.prevDepositNumber + 1;
        else if (i == 11) m.dq.nextDepositNumber = a.dq.nextDepositNumber + 1;
        else if (i == 12) m.te.prevProcessedTokenCount = a.te.prevProcessedTokenCount + 1;
        else if (i == 13) m.te.nextProcessedTokenCount = a.te.nextProcessedTokenCount + 1;
        else if (i == 14) m.withdrawalQueueHash = a.withdrawalQueueHash ^ bytes32(uint256(1));
        else revert("field index");
    }

    function _deploy(address at, address sp1, bytes32 vkey, uint256 parentChainId, uint32 zoneId, bytes32 genesis)
        internal
        returns (SwornZoneVerifier z)
    {
        deployCodeTo("SwornZoneVerifier.sol:SwornZoneVerifier", abi.encode(sp1, vkey, parentChainId, zoneId, genesis), at);
        z = SwornZoneVerifier(at);
    }

    function _verify(SwornZoneVerifier z, Args memory a, bytes memory proof) internal view returns (bool) {
        return z.verify(
            a.zoneId,
            a.tempoBlockNumber,
            a.anchorBlockNumber,
            a.anchorBlockHash,
            a.expectedWithdrawalBatchIndex,
            a.nextZoneHeight,
            a.bt,
            a.dq,
            a.te,
            a.withdrawalQueueHash,
            a.verifierConfig,
            proof
        );
    }

    function _attest(SwornZoneVerifier z, Args memory a, bytes memory proof) internal {
        z.attest(
            a.zoneId,
            a.tempoBlockNumber,
            a.anchorBlockNumber,
            a.anchorBlockHash,
            a.expectedWithdrawalBatchIndex,
            a.nextZoneHeight,
            a.bt,
            a.dq,
            a.te,
            a.withdrawalQueueHash,
            a.verifierConfig,
            proof
        );
    }

    function _digest(SwornZoneVerifier z, Args memory a) internal view returns (bytes32) {
        return z.attestationDigest(
            a.zoneId,
            a.tempoBlockNumber,
            a.anchorBlockNumber,
            a.anchorBlockHash,
            a.expectedWithdrawalBatchIndex,
            a.nextZoneHeight,
            a.bt,
            a.dq,
            a.te,
            a.withdrawalQueueHash,
            a.verifierConfig
        );
    }

    /// verify must revert with exactly `err`; attest too (same check).
    function _expectBoth(SwornZoneVerifier z, Args memory a, bytes memory proof, bytes4 err) internal {
        vm.expectRevert(err);
        this.extVerify(z, a, proof);
        vm.expectRevert(err);
        _attest(z, a, proof);
    }

    function extVerify(SwornZoneVerifier z, Args memory a, bytes memory proof) external view returns (bool) {
        return _verify(z, a, proof);
    }

    /// Every case of AC-Z4 against verifier `sp1` for vector `v` with `proof` and `vkey`.
    function _acz4(Vec memory v, address sp1, bytes32 vkey, bytes memory proof) internal {
        vm.chainId(v.chainId);
        SwornZoneVerifier z = _deploy(v.verifier, sp1, vkey, v.parentChainId, v.a.zoneId, v.genesisArtifactHash);
        assertEq(_digest(z, v.a), v.digest, "contract digest != Rust digest");

        // Passes verify and attest; attest emits the event and writes no storage (D4).
        assertTrue(_verify(z, v.a, proof));
        vm.record();
        vm.expectEmit(true, true, true, true, address(z));
        emit ZoneBatchVerified(v.a.zoneId, v.a.nextZoneHeight, v.a.bt.prevBlockHash, v.a.bt.nextBlockHash, v.digest);
        _attest(z, v.a, proof);
        (, bytes32[] memory writes) = vm.accesses(address(z));
        assertEq(writes.length, 0, "attest wrote storage");

        // Calldata fields: each of the 15, mutated individually. zoneId trips the pin first (WrongZone);
        // that zoneId is also IN the digest is shown by a clone pinned to the mutated zone.
        for (uint256 i = 0; i < 15; i++) {
            Args memory m = _mutated(v.a, i);
            assertTrue(_digest(z, m) != v.digest, "mutated field did not change the digest");
            _expectBoth(z, m, proof, i == 0 ? SwornZoneVerifier.WrongZone.selector : SwornZoneVerifier.InvalidProof.selector);
        }
        {
            Args memory m = _mutated(v.a, 0);
            SwornZoneVerifier zz = _deploy(v.verifier, sp1, vkey, v.parentChainId, m.zoneId, v.genesisArtifactHash);
            _expectBoth(zz, m, proof, SwornZoneVerifier.InvalidProof.selector);
            _deploy(v.verifier, sp1, vkey, v.parentChainId, v.a.zoneId, v.genesisArtifactHash); // restore
        }
        // Wrong verifierConfig: Nitro's 0x01, empty, and 0x02 with a trailing byte.
        bytes[3] memory badCfg = [bytes(hex"01"), bytes(""), bytes(hex"0200")];
        for (uint256 k = 0; k < 3; k++) {
            Args memory m = _mutated(v.a, 14);
            m.withdrawalQueueHash = v.a.withdrawalQueueHash;
            m.verifierConfig = badCfg[k];
            _expectBoth(z, m, proof, SwornZoneVerifier.WrongVerifierConfig.selector);
        }

        // Immutable/derived fields, via clones with the same vkey at the same address.
        _expectBoth(_deploy(v.verifier, sp1, vkey, v.parentChainId + 1, v.a.zoneId, v.genesisArtifactHash), v.a, proof, SwornZoneVerifier.InvalidProof.selector);
        _expectBoth(_deploy(v.verifier, sp1, vkey, v.parentChainId, v.a.zoneId, v.genesisArtifactHash ^ bytes32(uint256(1))), v.a, proof, SwornZoneVerifier.InvalidProof.selector);
        z = _deploy(v.verifier, sp1, vkey, v.parentChainId, v.a.zoneId, v.genesisArtifactHash);
        assertTrue(_verify(z, v.a, proof), "restored original");
        // ... at a different address
        _expectBoth(_deploy(address(uint160(v.verifier) + 1), sp1, vkey, v.parentChainId, v.a.zoneId, v.genesisArtifactHash), v.a, proof, SwornZoneVerifier.InvalidProof.selector);
        // ... the original under a different block.chainid
        vm.chainId(1);
        _expectBoth(z, v.a, proof, SwornZoneVerifier.InvalidProof.selector);
        vm.chainId(v.chainId);
        assertTrue(_verify(z, v.a, proof));

        // A flipped proof byte (past the 4-byte verifier selector), and a wrong vkey.
        bytes memory bad = bytes.concat(proof);
        bad[bad.length - 1] ^= 0x01;
        _expectBoth(z, v.a, bad, SwornZoneVerifier.InvalidProof.selector);
        _expectBoth(_deploy(v.verifier, sp1, vkey ^ bytes32(uint256(1)), v.parentChainId, v.a.zoneId, v.genesisArtifactHash), v.a, proof, SwornZoneVerifier.InvalidProof.selector);
    }
}

contract SwornZoneVerifierTest is ZoneBase {
    string constant GOLDEN = "test/vectors/zone-digest-golden.json";
    string constant REAL = "test/vectors/zone-hardfork-placeholder.json";

    // ---------------------------------------------------------------- AC-Z2

    function test_ACZ2_typehash_is_literal_and_hardcoded() public {
        assertEq(keccak256(bytes(TYPE_STRING)), TYPEHASH, "keccak(literal) != hard-coded");
        SwornZoneVerifier z = _deploy(address(0xBEEF), address(1), bytes32(uint256(1)), 1337, 1, bytes32(uint256(1)));
        assertEq(z.ATTESTATION_TYPEHASH(), TYPEHASH, "contract typehash");
        string memory j = vm.readFile(GOLDEN);
        assertEq(keccak256(bytes(vm.parseJsonString(j, ".typeString"))), keccak256(bytes(TYPE_STRING)), "Rust type string");
        assertEq(vm.parseJsonBytes32(j, ".typehash"), TYPEHASH, "Rust typehash");
        assertEq(z.ZONE_GUEST_VERSION(), keccak256("sworn-zone-guest-v1"));
        assertEq(z.ZONE_GUEST_VERSION(), vm.parseJsonBytes32(j, ".zoneGuestVersion"));
        assertEq(z.ZK_VERIFIER_CONFIG_V1_HASH(), vm.parseJsonBytes32(j, ".verifierConfigHash"));
    }

    function test_ACZ2_golden_vector_matches_rust() public {
        Vec memory v = _vec(GOLDEN);
        vm.chainId(v.chainId);
        SwornZoneVerifier z = _deploy(v.verifier, address(1), bytes32(uint256(1)), v.parentChainId, v.a.zoneId, v.genesisArtifactHash);
        assertEq(_digest(z, v.a), v.digest, "Solidity digest != Rust golden digest");
        assertEq(abi.encode(z.ZONE_GUEST_VERSION(), v.digest), v.publicValues, "public values layout");
    }

    // ---------------------------------------------------------------- AC-Z4, mock SP1 verifier
    // The mock accepts only the exact (vkey, publicValues, proof) registered, and the public values are
    // the Rust golden digest — so a contract that ignored or mis-placed any field would be caught.

    function test_ACZ4_mock_all_cases() public {
        Vec memory v = _vec(GOLDEN);
        MockSP1Verifier m = new MockSP1Verifier();
        bytes32 vk = keccak256("mock-vkey");
        bytes memory proof = hex"4388a21c00112233445566778899";
        m.prove(vk, v.publicValues, proof);
        _acz4(v, address(m), vk, proof);
    }

    // ---------------------------------------------------------------- AC-Z4, REAL proof + REAL verifier

    function test_ACZ4_REAL_groth16_placeholder_all_cases() public {
        string memory j = vm.readFile(REAL);
        Vec memory v = _vec(REAL);
        bytes32 vk = vm.parseJsonBytes32(j, ".vkey");
        bytes memory proof = vm.parseJsonBytes(j, ".proof");
        assertEq(v.verifier, 0x000000000000000000000000000000005a0E5A0E, "fixture is for the placeholder address");
        assertEq(v.chainId, 42431);
        assertEq(v.parentChainId, 1337);
        assertEq(v.a.zoneId, 1);
        assertEq(v.genesisArtifactHash, 0xd39aa765427c64ea95821bd5f93d44c89854b0f00fec0e21137421d04fb7c11e);
        assertEq(abi.encode(keccak256("sworn-zone-guest-v1"), v.digest), v.publicValues);
        // The real SP1 v6.1.0 Groth16 verifier bytecode, at the address Moderato has it.
        vm.etch(MODERATO_SP1, address(new SP1VerifierGroth16V6()).code);
        assertEq(SP1VerifierGroth16V6(MODERATO_SP1).VERIFIER_HASH(), 0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696);
        SP1VerifierGroth16V6(MODERATO_SP1).verifyProof(vk, v.publicValues, proof); // the raw pairing check
        _acz4(v, MODERATO_SP1, vk, proof);
    }

    // ---------------------------------------------------------------- constructor

    function test_constructor_rejects_zero_parameters() public {
        bytes memory code = vm.getCode("SwornZoneVerifier.sol:SwornZoneVerifier");
        bytes[4] memory bad = [
            abi.encode(address(0), bytes32(uint256(1)), uint256(1337), uint32(1), bytes32(uint256(1))),
            abi.encode(address(1), bytes32(0), uint256(1337), uint32(1), bytes32(uint256(1))),
            abi.encode(address(1), bytes32(uint256(1)), uint256(0), uint32(1), bytes32(uint256(1))),
            abi.encode(address(1), bytes32(uint256(1)), uint256(1337), uint32(1), bytes32(0))
        ];
        for (uint256 i = 0; i < 4; i++) {
            bytes memory init = bytes.concat(code, bad[i]);
            address d;
            assembly {
                d := create(0, add(init, 0x20), mload(init))
            }
            assertEq(d, address(0), "zero parameter accepted");
        }
    }
}
