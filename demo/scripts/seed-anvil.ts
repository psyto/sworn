// Local only. Seeds an `anvil --network tempo` at $1 (default http://127.0.0.1:8545) with a real
// Sworn deployment + one real reservation + payments (anvil dev accounts, eth_sendTransaction —
// no key), and prints the env for the UI and backend. The reservation is made by a dev account
// standing in for a server until server/ lands; it is a real on-chain reservation, not UI data.
import { AGENT, BLOCKED, PATH_USD, RECEIVER, seedChain } from "../test/fixture.ts";

const url = process.argv[2] ?? "http://127.0.0.1:8545";
const s = await seedChain(url);
console.error(`seeded ${url}: sworn ${s.cfg.sworn}; reserve ${String(s.raw.reserveTx)}; pay ${s.payTx}`);
if (s.policyUnsupported) console.error(`note: receive policies unavailable on this anvil (${s.policyUnsupported})`);
console.log(
  [
    `VITE_RPC_URL=${url}`,
    `VITE_CHAIN_ID=42431`,
    `VITE_NETWORK_LABEL="local anvil (tempo)"`,
    `VITE_SWORN_ADDRESS=${s.cfg.sworn}`,
    `VITE_SWORN_CODEHASH=${s.cfg.swornCodehash}`,
    `VITE_FEED_LOOKBACK=20000`,
    `DEMO_RPC_URL=${url}`,
    `SWORN_ADDRESS=${s.cfg.sworn}`,
    `DEMO_AGENT_ADDRESS=${AGENT}`,
    `DEMO_TOKEN=${PATH_USD}`,
    `DEMO_FEE_TOKEN=${PATH_USD}`,
    `DEMO_RECEIVER=${RECEIVER}`,
    `DEMO_RECEIVER_BLOCKED=${BLOCKED}`,
  ].join("\n"),
);
