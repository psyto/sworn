// Adapted from demo/src/chain/abis.ts and sworn.abi.ts: only the items this page reads, as JSON ABI
// (no human-readable parser in the bundle). Generated from contracts/src/Sworn.sol's ABI.
const addr = <N extends string, I extends boolean>(name: N, indexed: I) => ({ name, type: "address" as const, indexed });

const question = {
  name: "q", type: "tuple", components: [
    { name: "chainId", type: "uint64" }, { name: "blockNumber", type: "uint64" }, { name: "blockHash", type: "bytes32" },
    { name: "from", type: "address" }, { name: "token", type: "address" }, { name: "data", type: "bytes" },
    { name: "feeToken", type: "address" }, { name: "gasLimit", type: "uint64" },
  ],
} as const;
const answer = {
  name: "a", type: "tuple", components: [
    { name: "success", type: "bool" }, { name: "returnDataHash", type: "bytes32" }, { name: "gasUsed", type: "uint64" },
    { name: "feeCharged", type: "uint256" }, { name: "receiver", type: "address" },
    { name: "receiverBefore", type: "uint256" }, { name: "receiverAfter", type: "uint256" },
  ],
} as const;
const view = <N extends string, T extends string>(name: N, type: T) =>
  ({ type: "function", name, stateMutability: "view", inputs: [], outputs: [{ name: "", type }] }) as const;

export const swornAbi = [
  { type: "function", name: "reserve", stateMutability: "nonpayable", inputs: [question, answer, { name: "client", type: "address" }, { name: "coverage", type: "uint256" }], outputs: [{ name: "digest", type: "bytes32" }] },
  { type: "event", name: "Reserved", anonymous: false, inputs: [addr("server", true), { name: "digest", type: "bytes32", indexed: true }, addr("client", true), { name: "coverage", type: "uint256", indexed: false }, { name: "blockNumber", type: "uint64", indexed: false }, { name: "blockHash", type: "bytes32", indexed: false }, { name: "expiry", type: "uint64", indexed: false }] },
  { type: "event", name: "Slashed", anonymous: false, inputs: [addr("server", true), { name: "digest", type: "bytes32", indexed: true }, addr("client", true), { name: "coverage", type: "uint256", indexed: false }] },
  view("BOND_TOKEN", "address"),
  view("SP1_VERIFIER", "address"),
  view("GUEST_VKEY", "bytes32"),
  view("GUEST_VERSION", "bytes32"),
  view("MAX_AGE", "uint256"),
] as const;

export const verifierAbi = [view("VERSION", "string")] as const;

/** The TIP-20 surface the page reads (tempo crates/contracts/src/precompiles/tip20.rs). */
export const tip20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  view("decimals", "uint8"),
  view("symbol", "string"),
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "transferWithMemo", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "bytes32" }], outputs: [] },
  { type: "event", name: "Transfer", anonymous: false, inputs: [addr("from", true), addr("to", true), { name: "amount", type: "uint256", indexed: false }] },
] as const;

/** tempo crates/contracts/src/precompiles/receive_policy_guard.rs */
export const receivePolicyGuardAbi = [
  { type: "event", name: "TransferBlocked", anonymous: false, inputs: [addr("token", true), addr("receiver", true), { name: "blockedNonce", type: "uint64", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "receiptVersion", type: "uint8", indexed: false }, { name: "receipt", type: "bytes", indexed: false }] },
] as const;
