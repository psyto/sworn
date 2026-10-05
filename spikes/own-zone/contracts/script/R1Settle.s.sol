// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {OwnZonePortal} from "../src/upstream/tempo/OwnZonePortal.sol";
import {
    BlockTransition, DepositQueueTransition, TokenEnablementTransition, Withdrawal
} from "../src/upstream/interfaces/IZone.sol";

interface ITIP20Bal {
    function balanceOf(address) external view returns (uint256);
}

/// R1 phase 2 (LOCAL anvil fork only): a fabricated batch through the own portal -> SwornZoneVerifier.
/// MODE=mock: accept-all SP1 -> batch settles, withdrawal is queued and paid by processWithdrawals.
/// MODE=real: Moderato's real SP1 Groth16 verifier -> submitBatch must revert (garbage proof).
contract R1Settle is Script {
    address constant PATH_USD = 0x20C0000000000000000000000000000000000000;
    uint256 constant SEQ_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    bytes32 constant SETTLEMENT_ATTESTATION_TYPEHASH = keccak256(
        "SettlementAttestation(uint32 zoneId,uint64 sequencerSetVersion,uint256 zoneHeight,uint256 withdrawalBatchIndex,address verifier,uint64 tempoBlockNumber,uint64 anchorBlockNumber,bytes32 anchorBlockHash,bytes32 blockTransitionHash,bytes32 depositQueueTransitionHash,bytes32 tokenEnablementTransitionHash,bytes32 withdrawalQueueHash,bytes32 verifierConfigHash)"
    );
    bytes constant TAG = "sworn-sp1-groth16-v1";

    function run() external {
        OwnZonePortal p = OwnZonePortal(vm.envAddress("PORTAL"));
        bool mock = keccak256(bytes(vm.envString("MODE"))) == keccak256("mock");
        address recipient = address(0xBEEF00000000000000000000000000000000BEEf);

        Withdrawal memory w = Withdrawal({
            token: PATH_USD,
            senderTag: keccak256("sender"),
            to: recipient,
            amount: 250_000,
            memo: bytes32(0),
            gasLimit: 0,
            fallbackNonce: 1,
            callbackData: "",
            encryptedSender: ""
        });
        bytes32 wq = keccak256(abi.encode(w, bytes32(0)));

        // Anchor to a real Moderato block at/before the fork point: anvil-mined blocks have a zero
        // stateRoot and their EIP-2935 entries differ from their RPC hashes (see FEASIBILITY.md R1).
        uint64 tempoBlock = uint64(vm.envUint("TEMPO_BLOCK"));
        (bool ok, bytes memory h) = address(0x0000F90827F1C53a10cb7A02335B175320002935).staticcall(abi.encode(uint256(tempoBlock)));
        require(ok && h.length == 32, "EIP-2935 read failed");
        bytes32 anchorHash = abi.decode(h, (bytes32));
        BlockTransition memory bt = BlockTransition(bytes32(0), keccak256("zone block 1"));
        DepositQueueTransition memory dq = DepositQueueTransition(
            bytes32(0), p.currentDepositQueueHash(), 0, p.depositCount()
        );
        // T13 cursor bootstrap: the initial token (pathUSD) is processed by the first batch.
        TokenEnablementTransition memory te = TokenEnablementTransition(0, 1);
        bytes memory sig = _sign(p, tempoBlock, anchorHash, bt, dq, te, wq);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = sig;

        vm.startBroadcast(SEQ_PK);
        p.submitBatch(tempoBlock, 0, bt, dq, te, wq, TAG, hex"deadbeef", 1, sigs);
        console2.log("submitBatch ok; withdrawalBatchIndex", p.withdrawalBatchIndex());
        console2.log("queue head/tail", p.withdrawalQueueHead(), p.withdrawalQueueTail());
        if (mock) {
            Withdrawal[] memory ws = new Withdrawal[](1);
            ws[0] = w;
            uint256 before = ITIP20Bal(PATH_USD).balanceOf(recipient);
            p.processWithdrawals(ws, bytes32(0));
            console2.log("recipient pathUSD delta", ITIP20Bal(PATH_USD).balanceOf(recipient) - before);
        }
        vm.stopBroadcast();
    }

    function _sign(
        OwnZonePortal p,
        uint64 tempoBlock,
        bytes32 anchorHash,
        BlockTransition memory bt,
        DepositQueueTransition memory dq,
        TokenEnablementTransition memory te,
        bytes32 wq
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_ATTESTATION_TYPEHASH,
                p.zoneId(),
                p.sequencerSetVersion(),
                uint256(1),
                uint256(p.withdrawalBatchIndex()) + 1,
                p.verifier(),
                tempoBlock,
                tempoBlock,
                anchorHash,
                keccak256(abi.encode(bt)),
                keccak256(abi.encode(dq)),
                keccak256(abi.encode(te)),
                wq,
                keccak256(TAG)
            )
        );
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ZonePortal"),
                keccak256("1"),
                block.chainid,
                address(p)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SEQ_PK, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }
}
