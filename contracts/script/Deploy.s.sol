// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Sworn} from "../src/Sworn.sol";

interface IVerifierHash {
    function VERIFIER_HASH() external pure returns (bytes32);
}

/// @title Deploy — Sworn on Tempo Moderato (chain 42431). NOT run by an agent.
/// @notice The founder runs this, through scripts/deploy-moderato.sh (which sizes the gas — see
///         below). The deployer key is read from the environment variable SWORN_DEPLOYER_KEY only;
///         it is never a flag, never a file in this repo.
///
///         Refuses to broadcast unless every placeholder in Sworn.sol has been filled:
///         GUEST_VKEY != 0, GUEST_VERSION != 0, and SP1_VERIFIER has code whose VERIFIER_HASH is
///         SP1 v6.1.0 Groth16's. Sworn has no constructor and no setter, so a wrong constant
///         cannot be fixed after deployment — only redeployed.
///
///         Gas on Tempo (reckn spec 011 §10.1, tempo.json measured.foundryGasEstimation):
///         `forge script` sizes each broadcast tx from its OWN local simulation × -g (default 130),
///         not from the chain's eth_estimateGas. Tempo charges ~2,577 gas per deployed byte (vs ~202)
///         and ~254k per cold SSTORE, so a creation is under-sized ~5–6× and burns its whole limit
///         (reckn lost 1.71 PathUSD that way). deploy-moderato.sh therefore asks the chain for its
///         estimate first and passes an explicit -g that covers it with headroom, under Tempo's
///         30,000,000 per-tx cap (TEMPO_T1_TX_GAS_LIMIT_CAP).
contract Deploy is Script {
    uint256 constant MODERATO = 42431;
    bytes32 constant SP1_V6_1_0_GROTH16_HASH = 0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696;

    function _preflight() internal view {
        require(block.chainid == MODERATO, "Deploy: not Moderato (42431)");
        require(_guestVkey() != bytes32(0), "Deploy: Sworn.GUEST_VKEY is still the placeholder");
        require(_guestVersion() != bytes32(0), "Deploy: Sworn.GUEST_VERSION is still the placeholder");
        address v = _verifier();
        require(v.code.length > 0, "Deploy: Sworn.SP1_VERIFIER has no code on this chain (placeholder?)");
        require(
            IVerifierHash(v).VERIFIER_HASH() == SP1_V6_1_0_GROTH16_HASH,
            "Deploy: SP1_VERIFIER is not SP1 v6.1.0 Groth16"
        );
    }

    // Constants are read from the compiled contract through a throwaway local instance, so the
    // script can never disagree with the code it deploys.
    function _local() internal returns (Sworn) {
        return new Sworn();
    }

    Sworn private probe;

    function _guestVkey() internal view returns (bytes32) {
        return probe.GUEST_VKEY();
    }

    function _guestVersion() internal view returns (bytes32) {
        return probe.GUEST_VERSION();
    }

    function _verifier() internal view returns (address) {
        return probe.SP1_VERIFIER();
    }

    function run() external {
        probe = _local(); // local simulation only (outside broadcast)
        _preflight();
        uint256 pk = vm.envUint("SWORN_DEPLOYER_KEY");

        vm.startBroadcast(pk);
        Sworn sworn = new Sworn();
        vm.stopBroadcast();

        console.log("Sworn             ", address(sworn));
        console.log("  codehash        ", vm.toString(address(sworn).codehash));
        console.log("  SP1_VERIFIER    ", sworn.SP1_VERIFIER());
        console.log("  GUEST_VKEY      ", vm.toString(sworn.GUEST_VKEY()));
        console.log("  GUEST_VERSION   ", vm.toString(sworn.GUEST_VERSION()));
        console.log("  BOND_TOKEN      ", sworn.BOND_TOKEN());
        console.log("Check the receipt: status 1 and gasUsed < gas limit. Record it from the receipt, not memory.");
    }

    /// @notice Local (forge-simulated) gas of the creation tx, no key needed. deploy-moderato.sh
    ///         divides the chain's eth_estimateGas by this to choose -g.
    function localCreationGas() external returns (uint256 gasUsed) {
        bytes memory init = type(Sworn).creationCode;
        uint256 calldataGas;
        for (uint256 i = 0; i < init.length; i++) {
            calldataGas += init[i] == 0 ? 4 : 16;
        }
        uint256 g0 = gasleft();
        new Sworn();
        gasUsed = (g0 - gasleft()) + 21_000 + calldataGas;
        console.log("localCreationGas", gasUsed);
    }
}
