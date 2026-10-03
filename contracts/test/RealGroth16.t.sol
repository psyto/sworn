// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {Sworn} from "../src/Sworn.sol";
import {SP1Verifier as SP1VerifierGroth16V6} from "../src/vendor/sp1-contracts/v6.1.0/SP1VerifierGroth16.sol";
import {MockTIP20} from "./mocks/MockTIP20.sol";

/// @notice Runs the REAL vendored SP1 v6.1.0 Groth16 verifier against a REAL proof produced by the
///         Rust half. Looks for the first `*.json` in ../out/fixtures/ carrying `proof`,
///         `publicValues` and `vkey` (also accepts `public_values` / `programVKey` / `vk`), all hex.
///         If there is no fixture, every test here is SKIPPED with an explicit reason — never faked.
contract RealGroth16Test is Test {
    string constant DIR = "../out/fixtures";

    struct Fixture {
        bool found;
        string path;
        bytes32 vkey;
        bytes publicValues;
        bytes proof;
    }

    function _key(string memory j, string memory a, string memory b, string memory c)
        internal
        view
        returns (string memory)
    {
        if (vm.keyExistsJson(j, a)) return a;
        if (bytes(b).length != 0 && vm.keyExistsJson(j, b)) return b;
        if (bytes(c).length != 0 && vm.keyExistsJson(j, c)) return c;
        return "";
    }

    function _load() internal view returns (Fixture memory f) {
        string memory dir = vm.envOr("SWORN_FIXTURE_DIR", string(DIR)); // override only to test this loader
        if (!vm.exists(dir)) return f;
        VmSafe.DirEntry[] memory es = vm.readDir(dir, 2);
        for (uint256 i = 0; i < es.length; i++) {
            string memory p = es[i].path;
            bytes memory pb = bytes(p);
            if (es[i].isDir || pb.length < 5) continue;
            if (keccak256(abi.encodePacked(pb[pb.length - 5], pb[pb.length - 4], pb[pb.length - 3], pb[pb.length - 2], pb[pb.length - 1])) != keccak256(".json")) continue;
            string memory j = vm.readFile(p);
            string memory kp = _key(j, ".proof", "", "");
            string memory kpv = _key(j, ".publicValues", ".public_values", "");
            string memory kvk = _key(j, ".vkey", ".programVKey", ".vk");
            if (bytes(kp).length == 0 || bytes(kpv).length == 0 || bytes(kvk).length == 0) continue;
            f.found = true;
            f.path = p;
            f.proof = vm.parseJsonBytes(j, kp);
            f.publicValues = vm.parseJsonBytes(j, kpv);
            f.vkey = vm.parseJsonBytes32(j, kvk);
            return f;
        }
    }

    function decodePv(bytes calldata pv)
        external
        pure
        returns (bytes32 version, bytes32 bh, Sworn.Question memory q, Sworn.Answer memory a)
    {
        return abi.decode(pv, (bytes32, bytes32, Sworn.Question, Sworn.Answer));
    }

    function verify(SP1VerifierGroth16V6 v, bytes32 vk, bytes calldata pv, bytes calldata proof) external view {
        v.verifyProof(vk, pv, proof);
    }

    function test_REAL_groth16_fixture_verifies() public {
        Fixture memory f = _load();
        if (!f.found) {
            console.log("SKIPPED: no SP1 Groth16 fixture in ../out/fixtures/ (Rust half has not produced one).");
            vm.skip(true, "no SP1 Groth16 fixture in ../out/fixtures/");
        }
        console.log("fixture:", f.path);
        SP1VerifierGroth16V6 v = new SP1VerifierGroth16V6();
        assertEq(v.VERIFIER_HASH(), 0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696);
        assertEq(bytes4(f.proof), bytes4(v.VERIFIER_HASH()), "proof selector is not SP1 v6.1.0 Groth16");

        this.verify(v, f.vkey, f.publicValues, f.proof); // real pairing check

        bytes memory tampered = bytes.concat(f.publicValues);
        tampered[tampered.length - 1] ^= 0x01;
        vm.expectRevert();
        this.verify(v, f.vkey, tampered, f.proof);

        vm.expectRevert();
        this.verify(v, keccak256(abi.encode(f.vkey)), f.publicValues, f.proof);

        // The guest's public values must decode as Sworn's layout (R3.1 + R3.7).
        (, bytes32 bh, Sworn.Question memory q,) = this.decodePv(f.publicValues);
        assertEq(bh, q.blockHash, "R3.7: pv.blockHash must equal q.blockHash");
        assertEq(q.chainId, 42431);
    }

    function test_REAL_groth16_fixture_challenge_pays() public {
        Fixture memory f = _load();
        if (!f.found) {
            console.log("SKIPPED: no SP1 Groth16 fixture in ../out/fixtures/ (Rust half has not produced one).");
            vm.skip(true, "no SP1 Groth16 fixture in ../out/fixtures/");
        }
        Sworn sworn = new Sworn();
        (bytes32 version, bytes32 bh, Sworn.Question memory q, Sworn.Answer memory truth) =
            this.decodePv(f.publicValues);
        if (f.vkey != sworn.GUEST_VKEY() || version != sworn.GUEST_VERSION()) {
            console.log("SKIPPED: fixture vkey/version differ from Sworn.GUEST_VKEY/GUEST_VERSION (placeholders?)");
            vm.skip(true, "Sworn GUEST_VKEY/GUEST_VERSION do not match the fixture yet");
        }

        vm.chainId(42431);
        vm.etch(sworn.SP1_VERIFIER(), address(new SP1VerifierGroth16V6()).code);
        vm.etch(sworn.BOND_TOKEN(), type(MockTIP20).runtimeCode);
        MockTIP20 token = MockTIP20(sworn.BOND_TOKEN());
        vm.roll(uint256(q.blockNumber) + 1);
        vm.setBlockhash(q.blockNumber, bh);

        address server = makeAddr("server");
        address client = makeAddr("client");
        token.mint(address(this), 10e6);
        token.approve(address(sworn), 10e6);
        sworn.bond(server, 10e6);

        // The server lies: receiverAfter off by one.
        Sworn.Answer memory lie = truth;
        lie.receiverAfter = truth.receiverAfter + 1;
        vm.prank(server);
        sworn.reserve(q, lie, client, 5e6);
        sworn.challenge(server, q, lie, f.publicValues, f.proof);
        assertEq(token.balanceOf(client), 5e6);

        // The honest answer cannot be slashed with the same proof.
        vm.prank(server);
        sworn.reserve(q, truth, client, 5e6);
        vm.expectRevert(Sworn.AnswerCorrect.selector);
        sworn.challenge(server, q, truth, f.publicValues, f.proof);
    }
}

/// @notice Independent of the Rust half: the vendored verifier accepts a real SP1 v6.1.0 Groth16
///         proof (Reckn's, copied into test/vectors/) and rejects it when tampered.
contract VendoredVerifierSmokeTest is Test {
    function verify(SP1VerifierGroth16V6 v, bytes32 vk, bytes calldata pv, bytes calldata proof) external view {
        v.verifyProof(vk, pv, proof);
    }

    function test_REAL_vendored_verifier_accepts_real_v6_1_0_proof() public {
        string memory j = vm.readFile("test/vectors/reckn-v6.1.0-groth16.json");
        bytes32 vk = vm.parseJsonBytes32(j, ".vkey");
        bytes memory pv = vm.parseJsonBytes(j, ".publicValues");
        bytes memory proof = vm.parseJsonBytes(j, ".proof");
        SP1VerifierGroth16V6 v = new SP1VerifierGroth16V6();
        assertEq(keccak256(bytes(v.VERSION())), keccak256("v6.1.0"));
        this.verify(v, vk, pv, proof);
        bytes memory bad = bytes.concat(pv);
        bad[0] ^= 0x01;
        vm.expectRevert();
        this.verify(v, vk, bad, proof);
        vm.expectRevert();
        this.verify(v, bytes32(uint256(vk) ^ 1), pv, proof);
    }
}
