// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice REHEARSAL ONLY (local anvil fork). An SP1 verifier that accepts every proof, so the portal's
///         success path (settle -> enqueue -> processWithdrawals) can be exercised without a Groth16 proof.
///         Never deployed to a public chain.
contract AcceptAllSP1 {
    function verifyProof(bytes32, bytes calldata, bytes calldata) external pure {}
}
