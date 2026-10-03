// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Sworn} from "../src/Sworn.sol";
import {MockTIP20} from "./mocks/MockTIP20.sol";
import {MockSP1Verifier} from "./mocks/MockSP1Verifier.sol";

/// @notice Unit tests for the contract ACs of spec 001 (§6 AC-3..AC-6 as amended by §R3.6/R3.7).
///         Test names carry the AC id; scripts/check-tests.sh asserts the required set ran and passed.
contract SwornTest is Test {
    Sworn sworn;
    MockTIP20 token;
    MockSP1Verifier verifier;

    address server = makeAddr("server");
    address server2 = makeAddr("server2");
    address client = makeAddr("client");
    address funder = makeAddr("funder");
    address anyone = makeAddr("anyone");

    uint256 constant BOND = 1_000e6;
    uint256 constant COVER = 500e6;
    uint64 constant START_BLOCK = 1000;

    bytes constant PROOF = hex"4388a21c0102030405";

    function setUp() public {
        vm.chainId(42431);
        vm.roll(START_BLOCK);
        vm.warp(1_800_000_000);

        vm.etch(address(0x20C0000000000000000000000000000000000000), type(MockTIP20).runtimeCode);
        token = MockTIP20(0x20C0000000000000000000000000000000000000);
        sworn = new Sworn();
        // Unit tests use a mock verifier etched at whatever address the constant names (the real,
        // deployed SP1VerifierGroth16 v6.1.0 on Moderato); RealGroth16.t.sol uses the real verifier.
        vm.etch(sworn.SP1_VERIFIER(), type(MockSP1Verifier).runtimeCode);
        verifier = MockSP1Verifier(sworn.SP1_VERIFIER());
        assertEq(sworn.BOND_TOKEN(), address(token));
        assertEq(sworn.SP1_VERIFIER(), address(verifier));

        for (uint64 n = START_BLOCK - 40; n < START_BLOCK; n++) {
            vm.setBlockhash(n, keccak256(abi.encode("block", n)));
        }
        _bond(server, BOND);
        _bond(server2, BOND);
    }

    // ---------------------------------------------------------------- helpers

    function _bond(address s, uint256 amount) internal {
        token.mint(funder, amount);
        vm.startPrank(funder);
        token.approve(address(sworn), amount);
        sworn.bond(s, amount);
        vm.stopPrank();
    }

    function _q(uint64 n) internal view returns (Sworn.Question memory q) {
        q = Sworn.Question({
            chainId: 42431,
            blockNumber: n,
            blockHash: blockhash(n),
            from: address(0x1111111111111111111111111111111111111111),
            token: address(0x20C0000000000000000000000000000000000001),
            data: abi.encodeWithSelector(0xa9059cbb, address(0x2222222222222222222222222222222222222222), 500e6),
            feeToken: address(0x20C0000000000000000000000000000000000000),
            gasLimit: 300_000
        });
    }

    function _a() internal pure returns (Sworn.Answer memory) {
        return Sworn.Answer({
            success: true,
            returnDataHash: keccak256(abi.encode(true)),
            gasUsed: 51_234,
            feeCharged: 25_617,
            receiver: address(0x2222222222222222222222222222222222222222),
            receiverBefore: 1e6,
            receiverAfter: 501e6
        });
    }

    function _qa() internal view returns (Sworn.Question memory, Sworn.Answer memory) {
        return (_q(START_BLOCK - 1), _a());
    }

    function _reserve(address s, Sworn.Question memory q, Sworn.Answer memory a) internal returns (bytes32 d) {
        vm.prank(s);
        d = sworn.reserve(q, a, client, COVER);
    }

    function _pv(bytes32 version, bytes32 bh, Sworn.Question memory q, Sworn.Answer memory a)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(version, bh, q, a);
    }

    /// Public values the guest would commit for truth `t` about `q`, registered as a valid proof.
    function _proven(Sworn.Question memory q, Sworn.Answer memory t) internal returns (bytes memory pv) {
        pv = _pv(sworn.GUEST_VERSION(), q.blockHash, q, t);
        verifier.prove(sworn.GUEST_VKEY(), pv, PROOF);
    }

    function _mutA(Sworn.Answer memory a, uint256 i) internal pure returns (Sworn.Answer memory b) {
        b = Sworn.Answer(a.success, a.returnDataHash, a.gasUsed, a.feeCharged, a.receiver, a.receiverBefore, a.receiverAfter);
        if (i == 0) b.success = !a.success;
        else if (i == 1) b.returnDataHash = keccak256("other");
        else if (i == 2) b.gasUsed = a.gasUsed + 1;
        else if (i == 3) b.feeCharged = a.feeCharged + 1;
        else if (i == 4) b.receiver = address(0xBEEF);
        else if (i == 5) b.receiverBefore = a.receiverBefore + 1;
        else if (i == 6) b.receiverAfter = a.receiverAfter + 1;
        else revert("bad field");
    }

    function _mutQ(Sworn.Question memory q, uint256 i) internal pure returns (Sworn.Question memory p) {
        p = Sworn.Question(q.chainId, q.blockNumber, q.blockHash, q.from, q.token, q.data, q.feeToken, q.gasLimit);
        if (i == 0) p.chainId = q.chainId + 1;
        else if (i == 1) p.blockNumber = q.blockNumber - 1;
        else if (i == 2) p.blockHash = keccak256("other block");
        else if (i == 3) p.from = address(0xF00D);
        else if (i == 4) p.token = address(0x20C0000000000000000000000000000000000002);
        else if (i == 5) p.data = abi.encodeWithSelector(0xa9059cbb, address(0x2222222222222222222222222222222222222222), 1);
        else if (i == 6) p.feeToken = address(0x20C0000000000000000000000000000000000003);
        else if (i == 7) p.gasLimit = q.gasLimit + 1;
        else revert("bad field");
    }

    function _assertSolvent() internal view {
        (uint128 f1, uint128 l1,) = sworn.servers(server);
        (uint128 f2, uint128 l2,) = sworn.servers(server2);
        assertEq(token.balanceOf(address(sworn)), uint256(f1) + l1 + f2 + l2, "token balance != sum of bonds");
    }

    /// Server lied with `a`; the proven truth differs in field `i` only. Challenge must pay.
    function _assertPaysForField(uint256 i) internal {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _proven(q, _mutA(a, i));
        uint256 before = token.balanceOf(client);
        vm.prank(anyone);
        sworn.challenge(server, q, a, pv, PROOF);
        assertEq(token.balanceOf(client) - before, COVER, "client not paid");
        (,, Sworn.Status st,) = sworn.reservations(sworn.reservationKey(server, sworn.digestOf(q, a)));
        assertEq(uint8(st), uint8(Sworn.Status.Slashed));
        (uint128 free, uint128 locked,) = sworn.servers(server);
        assertEq(free, BOND - COVER);
        assertEq(locked, 0);
        _assertSolvent();
    }

    // ---------------------------------------------------------------- AC-3: each Answer field alone pays

    function test_AC3_pays_success() public { _assertPaysForField(0); }
    function test_AC3_pays_returnDataHash() public { _assertPaysForField(1); }
    function test_AC3_pays_gasUsed() public { _assertPaysForField(2); }
    function test_AC3_pays_feeCharged() public { _assertPaysForField(3); }
    function test_AC3_pays_receiver() public { _assertPaysForField(4); }
    function test_AC3_pays_receiverBefore() public { _assertPaysForField(5); }
    function test_AC3_pays_receiverAfter() public { _assertPaysForField(6); }

    function test_AC3_pays_at_expiry_boundary() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD());
        bytes memory pv = _proven(q, _mutA(a, 6));
        sworn.challenge(server, q, a, pv, PROOF);
        assertEq(token.balanceOf(client), COVER);
    }

    // ---------------------------------------------------------------- AC-4: challenge reverts

    function test_AC4_reverts_correct_answer() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _proven(q, a);
        vm.expectRevert(Sworn.AnswerCorrect.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function _assertRevertsPvQField(uint256 i) internal {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        Sworn.Question memory p = _mutQ(q, i);
        // A valid proof about a different question (pv.blockHash kept = the reservation's).
        bytes memory pv = _pv(sworn.GUEST_VERSION(), q.blockHash, p, _mutA(a, 6));
        verifier.prove(sworn.GUEST_VKEY(), pv, PROOF);
        vm.expectRevert(Sworn.QuestionMismatch.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_pvq_chainId() public { _assertRevertsPvQField(0); }
    function test_AC4_reverts_pvq_blockNumber() public { _assertRevertsPvQField(1); }
    function test_AC4_reverts_pvq_blockHash() public { _assertRevertsPvQField(2); }
    function test_AC4_reverts_pvq_from() public { _assertRevertsPvQField(3); }
    function test_AC4_reverts_pvq_token() public { _assertRevertsPvQField(4); }
    function test_AC4_reverts_pvq_data() public { _assertRevertsPvQField(5); }
    function test_AC4_reverts_pvq_feeToken() public { _assertRevertsPvQField(6); }
    function test_AC4_reverts_pvq_gasLimit() public { _assertRevertsPvQField(7); }

    function test_AC4_reverts_different_blockHash() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        // Proof over the same question but a different block (e.g. a reorged sibling).
        bytes memory pv = _pv(sworn.GUEST_VERSION(), keccak256("sibling"), q, _mutA(a, 6));
        verifier.prove(sworn.GUEST_VKEY(), pv, PROOF);
        vm.expectRevert(Sworn.PublicBlockHashMismatch.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    /// R3.7: pv.blockHash must equal q.blockHash as well as the stored hash.
    function test_AC4_reverts_pv_blockHash_ne_q_blockHash() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _pv(sworn.GUEST_VERSION(), blockhash(q.blockNumber - 1), q, _mutA(a, 6));
        verifier.prove(sworn.GUEST_VKEY(), pv, PROOF);
        vm.expectRevert(Sworn.PublicBlockHashMismatch.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_no_reservation() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes memory pv = _proven(q, _mutA(a, 6));
        vm.expectRevert(Sworn.NoReservation.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_expired() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD() + 1);
        bytes memory pv = _proven(q, _mutA(a, 6));
        vm.expectRevert(Sworn.Expired.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_second_challenge() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _proven(q, _mutA(a, 6));
        sworn.challenge(server, q, a, pv, PROOF);
        bytes memory pv2 = _proven(q, _mutA(a, 2));
        vm.expectRevert(Sworn.NoReservation.selector);
        sworn.challenge(server, q, a, pv2, PROOF);
        assertEq(token.balanceOf(client), COVER, "paid once only");
    }

    function test_AC4_reverts_released() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes32 d = _reserve(server, q, a);
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD() + 1);
        sworn.release(server, d);
        bytes memory pv = _proven(q, _mutA(a, 6));
        vm.expectRevert(Sworn.NoReservation.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_wrong_vkey() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _pv(sworn.GUEST_VERSION(), q.blockHash, q, _mutA(a, 6));
        verifier.prove(keccak256("some other program"), pv, PROOF); // valid, but for another vkey
        vm.expectRevert(MockSP1Verifier.MockInvalidProof.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_wrong_version() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _pv(keccak256("other guest version"), q.blockHash, q, _mutA(a, 6));
        verifier.prove(sworn.GUEST_VKEY(), pv, PROOF);
        vm.expectRevert(Sworn.WrongGuestVersion.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_invalid_proof() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        bytes memory pv = _pv(sworn.GUEST_VERSION(), q.blockHash, q, _mutA(a, 6)); // never proven
        vm.expectRevert(MockSP1Verifier.MockInvalidProof.selector);
        sworn.challenge(server, q, a, pv, PROOF);
    }

    function test_AC4_reverts_other_servers_reservation() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server2, q, a); // server2 reserved it; server did not
        bytes memory pv = _proven(q, _mutA(a, 6));
        vm.expectRevert(Sworn.NoReservation.selector);
        sworn.challenge(server, q, a, pv, PROOF);
        // and server2's own reservation is still challengeable, paying from server2's bond
        sworn.challenge(server2, q, a, pv, PROOF);
        (uint128 f1, uint128 l1,) = sworn.servers(server);
        assertEq(uint256(f1) + l1, BOND, "server untouched");
        _assertSolvent();
    }

    // ---------------------------------------------------------------- AC-5: reserve reverts

    function test_AC5_reverts_unbonding() public {
        vm.prank(server);
        sworn.beginUnbond();
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        vm.expectRevert(Sworn.Unbonding.selector);
        _reserve(server, q, a);
    }

    function test_AC5_reverts_free_lt_coverage() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        vm.prank(server);
        vm.expectRevert(Sworn.InsufficientFree.selector);
        sworn.reserve(q, a, client, BOND + 1);
        // free shrinks with each reservation
        _reserve(server, q, a);
        _reserve(server, q, _mutA(a, 6));
        vm.expectRevert(Sworn.InsufficientFree.selector);
        _reserve(server, q, _mutA(a, 5));
    }

    function test_AC5_reverts_block_older_than_MAX_AGE() public {
        Sworn.Question memory q = _q(uint64(block.number - sworn.MAX_AGE() - 1));
        vm.expectRevert(Sworn.BlockOutOfWindow.selector);
        _reserve(server, q, _a());
    }

    function test_AC5_reverts_block_is_current() public {
        Sworn.Question memory q = _q(uint64(block.number));
        vm.expectRevert(Sworn.BlockOutOfWindow.selector);
        _reserve(server, q, _a());
    }

    function test_AC5_reverts_block_in_future() public {
        Sworn.Question memory q = _q(uint64(block.number + 1));
        vm.expectRevert(Sworn.BlockOutOfWindow.selector);
        _reserve(server, q, _a());
    }

    function test_AC5_accepts_window_edges() public {
        _reserve(server, _q(uint64(block.number - sworn.MAX_AGE())), _a());
        _reserve(server, _q(uint64(block.number - 1)), _a());
    }

    /// R3.7: q.blockHash must be the canonical blockhash(q.blockNumber).
    function test_AC5_reverts_blockHash_not_canonical() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.blockHash = keccak256("reorged-out sibling");
        vm.expectRevert(Sworn.BlockHashMismatch.selector);
        _reserve(server, q, a);
    }

    function test_AC5_reverts_blockHash_unreadable() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        vm.setBlockhash(q.blockNumber, bytes32(0));
        q.blockHash = bytes32(0);
        vm.expectRevert(Sworn.BlockHashMismatch.selector);
        _reserve(server, q, a);
    }

    function test_AC5_reverts_reused_digest() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes32 d = _reserve(server, q, a);
        vm.expectRevert(Sworn.DigestUsed.selector);
        _reserve(server, q, a);
        // still refused after release
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD() + 1);
        sworn.release(server, d);
        vm.expectRevert(Sworn.DigestUsed.selector);
        _reserve(server, q, a);
    }

    function test_AC5_reverts_no_bond() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        vm.expectRevert(Sworn.NoBond.selector);
        _reserve(makeAddr("unbonded"), q, a);
    }

    function test_AC5_reverts_wrong_chain() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.chainId = 4217;
        vm.expectRevert(Sworn.WrongChain.selector);
        _reserve(server, q, a);
    }

    function test_AC5_same_digest_other_server_not_preoccupied() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes32 d1 = _reserve(server2, q, a);
        bytes32 d2 = _reserve(server, q, a);
        assertEq(d1, d2);
    }

    // ---------------------------------------------------------------- AC-5b: guest abort rules (R3.3) refused at reserve

    function _reserveData(bytes memory data) internal {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.data = data;
        _reserve(server, q, a);
    }

    address constant RCV = address(0x2222222222222222222222222222222222222222);

    function test_AC5_accepts_transfer() public {
        _reserveData(abi.encodeWithSelector(0xa9059cbb, RCV, 500e6));
    }

    function test_AC5_accepts_transferWithMemo() public {
        _reserveData(abi.encodeWithSelector(0x95777d59, RCV, 500e6, bytes32("invoice-42")));
    }

    /// Zero receiver is NOT a guest abort: TIP-20 reverts InvalidRecipient and the guest proves it.
    function test_AC5_accepts_zero_receiver_provable_failure() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.data = abi.encodeWithSelector(0xa9059cbb, address(0), 500e6);
        a.success = true; // the lie
        _reserve(server, q, a);
        bytes memory pv = _proven(q, _mutA(a, 0));
        sworn.challenge(server, q, a, pv, PROOF);
        assertEq(token.balanceOf(client), COVER);
    }

    function test_AC5_reverts_token_not_tip20() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.token = address(0x20C0000000000000000000010000000000000001); // byte 11 != 0
        vm.expectRevert(Sworn.NotTip20Token.selector);
        _reserve(server, q, a);
        q.token = address(0x1111111111111111111111111111111111111112);
        vm.expectRevert(Sworn.NotTip20Token.selector);
        _reserve(server, q, a);
    }

    function test_AC5_accepts_any_tip20_suffix() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        q.token = address(0x20C0000000000000000000000123456789ABcdeF);
        _reserve(server, q, a);
    }

    function test_AC5_reverts_wrong_selector() public {
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(abi.encodeWithSelector(0x23b872dd, RCV, address(0x3333), 1)); // transferFrom
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(abi.encodeWithSelector(0x095ea7b3, RCV, 1)); // approve: right length, wrong selector
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(hex"a905");
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData("");
    }

    function test_AC5_reverts_wrong_length() public {
        bytes memory t = abi.encodeWithSelector(0xa9059cbb, RCV, 500e6);
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(bytes.concat(t, hex"00")); // trailing byte
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(bytes.concat(t, bytes32(0))); // transfer selector with memo length
        bytes memory m = abi.encodeWithSelector(0x95777d59, RCV, 500e6, bytes32("m"));
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(abi.encodeWithSelector(0x95777d59, RCV, 500e6)); // memo selector, 68 bytes
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(bytes.concat(m, hex"00"));
    }

    function test_AC5_reverts_dirty_address_word() public {
        bytes32 dirty = bytes32(uint256(uint160(RCV)) | (uint256(1) << 160));
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(abi.encodePacked(bytes4(0xa9059cbb), dirty, uint256(500e6)));
        vm.expectRevert(Sworn.BadCalldata.selector);
        _reserveData(abi.encodePacked(bytes4(0x95777d59), dirty, uint256(500e6), bytes32("m")));
    }

    function test_AC5_reverts_virtual_receiver() public {
        // TIP-1022: masterId(4) || 0xFD x10 || userTag(6)
        address v = address(0xaABbcCDdfDfdFdfDFDfdfdfDFdFD112233445566);
        vm.expectRevert(Sworn.VirtualReceiver.selector);
        _reserveData(abi.encodeWithSelector(0xa9059cbb, v, 1));
        vm.expectRevert(Sworn.VirtualReceiver.selector);
        _reserveData(abi.encodeWithSelector(0x95777d59, v, 1, bytes32(0)));
        // one byte of the magic off -> not virtual -> accepted
        _reserveData(abi.encodeWithSelector(0xa9059cbb, address(0xAabBCcdDfdFdFdFdfDFdFDFDFDFC112233445566), 1));
    }

    function test_AC5_reverts_receiver_is_sender() public {
        (Sworn.Question memory q,) = _qa();
        vm.expectRevert(Sworn.ReceiverIsSender.selector);
        _reserveData(abi.encodeWithSelector(0xa9059cbb, q.from, 1));
        vm.expectRevert(Sworn.ReceiverIsSender.selector);
        _reserveData(abi.encodeWithSelector(0x95777d59, q.from, 1, bytes32(0)));
    }

    // ---------------------------------------------------------------- AC-6: unbond / withdraw

    function test_AC6_withdraw_reverts_before_delay() public {
        vm.startPrank(server);
        vm.expectRevert(Sworn.NotUnbonding.selector);
        sworn.withdraw();
        sworn.beginUnbond();
        vm.warp(block.timestamp + sworn.UNBOND_DELAY() - 1);
        vm.expectRevert(Sworn.UnbondDelayNotOver.selector);
        sworn.withdraw();
        vm.warp(block.timestamp + 1);
        sworn.withdraw();
        vm.stopPrank();
        assertEq(token.balanceOf(server), BOND);
        assertGt(sworn.UNBOND_DELAY(), sworn.CHALLENGE_PERIOD());
    }

    function test_AC6_withdraw_cannot_take_reserved() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes32 d = _reserve(server, q, a);
        vm.prank(server);
        sworn.beginUnbond();
        vm.warp(block.timestamp + sworn.UNBOND_DELAY());
        vm.prank(server);
        sworn.withdraw();
        assertEq(token.balanceOf(server), BOND - COVER, "only free funds leave");
        (uint128 free, uint128 locked,) = sworn.servers(server);
        assertEq(free, 0);
        assertEq(locked, COVER);
        vm.prank(server);
        vm.expectRevert(Sworn.NothingToWithdraw.selector);
        sworn.withdraw();
        _assertSolvent();
        // after release, the coverage becomes free and can be withdrawn
        sworn.release(server, d);
        vm.prank(server);
        sworn.withdraw();
        assertEq(token.balanceOf(server), BOND);
        _assertSolvent();
    }

    function test_AC6_challenge_pays_during_unbond_delay() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        _reserve(server, q, a);
        vm.prank(server);
        sworn.beginUnbond();
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD()); // inside the delay, still challengeable
        bytes memory pv = _proven(q, _mutA(a, 3));
        sworn.challenge(server, q, a, pv, PROOF);
        assertEq(token.balanceOf(client), COVER);
        vm.warp(block.timestamp + sworn.UNBOND_DELAY());
        vm.prank(server);
        sworn.withdraw();
        assertEq(token.balanceOf(server), BOND - COVER);
        _assertSolvent();
    }

    // ---------------------------------------------------------------- release

    function test_release_permissionless_after_expiry_only() public {
        (Sworn.Question memory q, Sworn.Answer memory a) = _qa();
        bytes32 d = _reserve(server, q, a);
        vm.warp(block.timestamp + sworn.CHALLENGE_PERIOD());
        vm.expectRevert(Sworn.NotExpired.selector);
        sworn.release(server, d);
        vm.warp(block.timestamp + 1);
        vm.prank(anyone);
        sworn.release(server, d);
        (uint128 free, uint128 locked,) = sworn.servers(server);
        assertEq(free, BOND);
        assertEq(locked, 0);
        vm.expectRevert(Sworn.NoReservation.selector);
        sworn.release(server, d);
    }

    // ---------------------------------------------------------------- token defensiveness

    function test_TOKEN_false_return_is_refused() public {
        token.mint(funder, 1);
        vm.prank(funder);
        token.approve(address(sworn), 1);
        token.setReturnFalse(true);
        vm.prank(funder);
        vm.expectRevert(Sworn.TokenTransferFailed.selector);
        sworn.bond(server, 1);
    }

    function test_TOKEN_revert_propagates() public {
        vm.prank(funder); // no balance, no approval: PathUSD-style revert
        vm.expectRevert(Sworn.TokenTransferFailed.selector);
        sworn.bond(server, 1);
    }

    // ---------------------------------------------------------------- EIP-712 vector (ethers, independent)

    function test_EIP712_vector_matches_ethers() public {
        string memory j = vm.readFile("test/vectors/eip712.json");
        address at = 0x5300000000000000000000000000000000000001;
        vm.etch(at, address(sworn).code);
        Sworn s = Sworn(at);

        Sworn.Question memory q = Sworn.Question({
            chainId: uint64(vm.parseJsonUint(j, ".q.chainId")),
            blockNumber: uint64(vm.parseJsonUint(j, ".q.blockNumber")),
            blockHash: vm.parseJsonBytes32(j, ".q.blockHash"),
            from: vm.parseJsonAddress(j, ".q.from"),
            token: vm.parseJsonAddress(j, ".q.token"),
            data: vm.parseJsonBytes(j, ".q.data"),
            feeToken: vm.parseJsonAddress(j, ".q.feeToken"),
            gasLimit: uint64(vm.parseJsonUint(j, ".q.gasLimit"))
        });
        Sworn.Answer memory a = Sworn.Answer({
            success: vm.parseJsonBool(j, ".a.success"),
            returnDataHash: vm.parseJsonBytes32(j, ".a.returnDataHash"),
            gasUsed: uint64(vm.parseJsonUint(j, ".a.gasUsed")),
            feeCharged: vm.parseJsonUint(j, ".a.feeCharged"),
            receiver: vm.parseJsonAddress(j, ".a.receiver"),
            receiverBefore: vm.parseJsonUint(j, ".a.receiverBefore"),
            receiverAfter: vm.parseJsonUint(j, ".a.receiverAfter")
        });
        assertEq(s.SWORN_ANSWER_TYPEHASH(), keccak256(bytes(vm.parseJsonString(j, ".encodeType"))), "encodeType");
        assertEq(s.domainSeparator(), vm.parseJsonBytes32(j, ".domainSeparator"), "domain");
        assertEq(s.hashQuestion(q), vm.parseJsonBytes32(j, ".questionHash"), "question");
        assertEq(s.hashAnswer(a), vm.parseJsonBytes32(j, ".answerHash"), "answer");
        assertEq(s.digestOf(q, a), vm.parseJsonBytes32(j, ".digest"), "digest");
        // Hard-coded copy so a regenerated JSON cannot silently move the target.
        assertEq(s.digestOf(q, a), 0xeb63a2ddddd9bd16cc00817ca7f9c771921bc18bed5a8ecf1d2f50c48877bf48);
    }
}
