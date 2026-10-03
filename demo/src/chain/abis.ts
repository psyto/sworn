import { parseAbi } from "viem";
export { swornAbi } from "./sworn.abi.ts";

/** The TIP-20 surface the demo reads (tempo crates/contracts/src/precompiles/tip20.rs). */
export const tip20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
]);

/** tempo crates/contracts/src/precompiles/receive_policy_guard.rs */
export const receivePolicyGuardAbi = parseAbi([
  "event TransferBlocked(address indexed token, address indexed receiver, uint64 indexed blockedNonce, uint256 amount, uint8 receiptVersion, bytes receipt)",
]);
