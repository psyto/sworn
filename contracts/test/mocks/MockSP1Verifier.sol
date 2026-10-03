// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ISP1Verifier} from "../../src/vendor/sp1-contracts/ISP1Verifier.sol";

/// @notice Unit-test stand-in for SP1's Groth16 verifier. A "proof" is valid only for the exact
///         (vkey, publicValues, proof) triple a test registered with `prove`, so a proof made for
///         another program (vkey) or other public values is rejected — as with the real verifier.
contract MockSP1Verifier is ISP1Verifier {
    mapping(bytes32 => bool) public valid;

    error MockInvalidProof();

    function prove(bytes32 vkey, bytes calldata publicValues, bytes calldata proof) external {
        valid[keccak256(abi.encode(vkey, publicValues, proof))] = true;
    }

    function verifyProof(bytes32 vkey, bytes calldata publicValues, bytes calldata proof) external view {
        if (!valid[keccak256(abi.encode(vkey, publicValues, proof))]) revert MockInvalidProof();
    }
}
