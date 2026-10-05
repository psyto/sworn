// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {OwnZonePortal} from "../src/upstream/tempo/OwnZonePortal.sol";
import {SwornZoneVerifier} from "../src/SwornZoneVerifier.sol";
import {AcceptAllSP1} from "../src/rehearsal/AcceptAllSP1.sol";
import {ISP1Verifier} from "../src/vendor/sp1-contracts/ISP1Verifier.sol";
import {
    BlockTransition, DepositQueueTransition, TokenEnablementTransition, DepositPayload, Withdrawal
} from "../src/upstream/interfaces/IZone.sol";

interface ITIP20Min {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// R1: L1-side wiring of an own (non-factory) ZonePortal + SwornZoneVerifier on a LOCAL anvil fork of
/// Moderato (chain 42431). Uses anvil's well-known dev key only. Never run with --rpc-url Moderato.
contract R1L1Wiring is Script {
    address constant PATH_USD = 0x20C0000000000000000000000000000000000000;
    address constant MODERATO_SP1 = 0x2c77329747b7C8B293514A6129404D4cefDd9B18;
    address constant MESSENGER = 0x5A4d000000000000000000000000000000000000;
    uint32 constant ZONE_ID = 4242;
    bytes32 constant VKEY = 0x007ef7314d2624af811844d494aac02736de7a36ce6f5ef52345fcd0bdac5b39;
    bytes constant TAG = "sworn-sp1-groth16-v1";

    // anvil dev keys (public test keys)
    uint256 constant ADMIN_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant SEQ_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant ENC_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    bytes32 constant SETTLEMENT_ATTESTATION_TYPEHASH = keccak256(
        "SettlementAttestation(uint32 zoneId,uint64 sequencerSetVersion,uint256 zoneHeight,uint256 withdrawalBatchIndex,address verifier,uint64 tempoBlockNumber,uint64 anchorBlockNumber,bytes32 anchorBlockHash,bytes32 blockTransitionHash,bytes32 depositQueueTransitionHash,bytes32 tokenEnablementTransitionHash,bytes32 withdrawalQueueHash,bytes32 verifierConfigHash)"
    );

    function run() external {
        require(block.chainid == 42431, "fork of Moderato expected");
        address admin = vm.addr(ADMIN_PK);
        address seq = vm.addr(SEQ_PK);

        vm.startBroadcast(ADMIN_PK);
        bytes32 genesisHash = keccak256("own-zone rehearsal genesis placeholder");
        SwornZoneVerifier realV = new SwornZoneVerifier(ISP1Verifier(MODERATO_SP1), VKEY, 42431, ZONE_ID, genesisHash);
        AcceptAllSP1 mock = new AcceptAllSP1();
        SwornZoneVerifier mockV = new SwornZoneVerifier(ISP1Verifier(address(mock)), VKEY, 42431, ZONE_ID, genesisHash);

        // Two portals: one wired to the real-SP1 verifier (must reject), one to the accept-all one.
        OwnZonePortal pReal = new OwnZonePortal();
        OwnZonePortal pMock = new OwnZonePortal();
        address[] memory none = new address[](0);
        address[] memory seqs = new address[](1);
        seqs[0] = seq;
        pReal.initialize(ZONE_ID, PATH_USD, false, false, none, none, MESSENGER, admin, seqs, 1, address(realV), "");
        pMock.initialize(ZONE_ID, PATH_USD, false, false, none, none, MESSENGER, admin, seqs, 1, address(mockV), "");
        _setEncKey(pMock);
        _setEncKey(pReal);
        ITIP20Min(PATH_USD).approve(address(pMock), type(uint256).max);
        DepositPayload memory dp = DepositPayload({
            ephemeralPubkeyX: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,
            ephemeralPubkeyYParity: 0x02,
            ciphertext: new bytes(64),
            nonce: bytes12(0),
            tag: bytes16(0)
        });
        pMock.deposit(PATH_USD, 1_000_000, 0, dp, admin);
        vm.stopBroadcast();
        console2.log("realVerifier", address(realV));
        console2.log("mockVerifier", address(mockV));
        console2.log("portalReal", address(pReal));
        console2.log("portalMock", address(pMock));
        console2.log("portalMock pathUSD after deposit", ITIP20Min(PATH_USD).balanceOf(address(pMock)));
        console2.log("depositCount", pMock.depositCount());
    }

    function _setEncKey(OwnZonePortal p) internal {
        // Compressed pubkey of ENC_PK: derive via vm.createWallet.
        Vm.Wallet memory w = vm.createWallet(ENC_PK);
        bytes32 x = bytes32(w.publicKeyX);
        uint8 yParity = (w.publicKeyY % 2 == 0) ? 0x02 : 0x03;
        bytes32 message = keccak256(abi.encode(address(p), x, yParity));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ENC_PK, message);
        p.setSequencerEncryptionKey(x, yParity, v, r, s);
    }
}

import {Vm} from "forge-std/Vm.sol";
