// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SwornZoneVerifier} from "../src/SwornZoneVerifier.sol";
import {ISP1Verifier} from "../src/vendor/sp1-contracts/ISP1Verifier.sol";

interface IVerifierHash {
    function VERIFIER_HASH() external pure returns (bytes32);
}

/// @title Spec 003 AC-Z5 — deploy SwornZoneVerifier on Tempo Moderato. NOT run by an agent.
/// @notice Driven by scripts/deploy-zone-verifier.sh, which only prints unless given --send. The key
///         comes from SWORN_DEPLOYER_KEY in the environment (scripts/with-keys.sh), never a flag.
///         Constructor arguments come from the environment (the wrapper sets them):
///         ZONE_SP1_VERIFIER, ZONE_VKEY, ZONE_PARENT_CHAIN_ID, ZONE_ID, ZONE_GENESIS_ARTIFACT_HASH.
contract DeployZoneVerifier is Script {
    uint256 constant MODERATO = 42431;
    bytes32 constant SP1_V6_1_0_GROTH16_HASH = 0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696;

    function _args() internal view returns (address sp1, bytes32 vkey, uint256 parent, uint32 zone, bytes32 genesis) {
        sp1 = vm.envAddress("ZONE_SP1_VERIFIER");
        vkey = vm.envBytes32("ZONE_VKEY");
        parent = vm.envUint("ZONE_PARENT_CHAIN_ID");
        zone = uint32(vm.envUint("ZONE_ID"));
        genesis = vm.envBytes32("ZONE_GENESIS_ARTIFACT_HASH");
    }

    function _preflight(address sp1) internal view {
        require(block.chainid == MODERATO, "DeployZoneVerifier: not Moderato (42431)");
        require(sp1.code.length > 0, "DeployZoneVerifier: SP1 verifier has no code");
        require(IVerifierHash(sp1).VERIFIER_HASH() == SP1_V6_1_0_GROTH16_HASH, "DeployZoneVerifier: not SP1 v6.1.0 Groth16");
    }

    function run() external {
        (address sp1, bytes32 vkey, uint256 parent, uint32 zone, bytes32 genesis) = _args();
        _preflight(sp1);
        uint256 pk = vm.envUint("SWORN_DEPLOYER_KEY");
        vm.startBroadcast(pk);
        SwornZoneVerifier z = new SwornZoneVerifier(ISP1Verifier(sp1), vkey, parent, zone, genesis);
        vm.stopBroadcast();
        console.log("SwornZoneVerifier ", address(z));
        console.log("  codehash        ", vm.toString(address(z).codehash));
        console.log("  SP1_VERIFIER    ", address(z.SP1_VERIFIER()));
        console.log("  ZONE_VKEY       ", vm.toString(z.ZONE_VKEY()));
        console.log("  PARENT_CHAIN_ID ", z.PARENT_CHAIN_ID());
        console.log("  PINNED_ZONE_ID  ", z.PINNED_ZONE_ID());
        console.log("  PINNED_GENESIS_ARTIFACT_HASH", vm.toString(z.PINNED_GENESIS_ARTIFACT_HASH()));
        console.log("Check the receipt: status 1 and gasUsed < gas limit. Record it from the receipt, not memory.");
    }

    /// @notice Local (forge-simulated) gas of the creation tx; no key. The wrapper divides the chain's
    ///         eth_estimateGas by this to choose -g (Tempo prices deployed bytes ~12.8x Ethereum).
    function localCreationGas() external returns (uint256 gasUsed) {
        (address sp1, bytes32 vkey, uint256 parent, uint32 zone, bytes32 genesis) = _args();
        bytes memory init = abi.encodePacked(type(SwornZoneVerifier).creationCode, abi.encode(sp1, vkey, parent, zone, genesis));
        uint256 calldataGas;
        for (uint256 i = 0; i < init.length; i++) {
            calldataGas += init[i] == 0 ? 4 : 16;
        }
        uint256 g0 = gasleft();
        new SwornZoneVerifier(ISP1Verifier(sp1), vkey, parent, zone, genesis);
        gasUsed = (g0 - gasleft()) + 21_000 + calldataGas;
        console.log("localCreationGas", gasUsed);
    }
}

/// @title Spec 003 AC-Z5 — send one `attest` to a deployed SwornZoneVerifier. NOT run by an agent.
/// @notice Driven by scripts/zone-attest.sh --send. ZONE_VERIFIER and ZONE_ATTEST_CALLDATA (the exact
///         calldata the wrapper printed) come from the environment, the key from SWORN_DEPLOYER_KEY.
contract AttestZoneBatch is Script {
    function run() external {
        require(block.chainid == 42431, "AttestZoneBatch: not Moderato (42431)");
        address z = vm.envAddress("ZONE_VERIFIER");
        bytes memory data = vm.envBytes("ZONE_ATTEST_CALLDATA");
        require(bytes4(data) == SwornZoneVerifier.attest.selector, "AttestZoneBatch: calldata is not attest(...)");
        uint256 pk = vm.envUint("SWORN_DEPLOYER_KEY");
        vm.startBroadcast(pk);
        (bool ok, bytes memory ret) = z.call(data);
        vm.stopBroadcast();
        require(ok, string(abi.encodePacked("attest reverted: ", vm.toString(ret))));
        console.log("attest sent to", z);
    }

    /// @notice Local (forked) gas of the attest tx; no key.
    function localGas() external returns (uint256 gasUsed) {
        address z = vm.envAddress("ZONE_VERIFIER");
        bytes memory data = vm.envBytes("ZONE_ATTEST_CALLDATA");
        uint256 calldataGas;
        for (uint256 i = 0; i < data.length; i++) {
            calldataGas += data[i] == 0 ? 4 : 16;
        }
        uint256 g0 = gasleft();
        (bool ok,) = z.call(data);
        require(ok, "attest reverts in simulation");
        gasUsed = (g0 - gasleft()) + 21_000 + calldataGas;
        console.log("localGas", gasUsed);
    }
}
