import { getAddress, isAddress, type Address, type Hex } from "viem";
import { DataError } from "./errors.ts";

/** Everything the browser needs to read the chain. No keys — ever. */
export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  networkLabel: string;
  sworn: Address;
  /** keccak256 of Sworn's runtime code, if pinned (002 §3.3). */
  swornCodehash?: Hex;
  explorerUrl: string;
  feedLookback: bigint;
}

/** TIP-20 precompile that holds funds a receive policy blocked (tempo `RECEIVE_POLICY_GUARD_ADDRESS`). */
export const RECEIVE_POLICY_GUARD: Address = getAddress("0xb10c000000000000000000000000000000000000");

type Env = Record<string, string | undefined>;

function need(env: Env, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new DataError("config", `${key} is not set (see demo/.env.example)`);
  return v;
}

function addr(env: Env, key: string): Address {
  const v = need(env, key);
  if (!isAddress(v)) throw new DataError("config", `${key} is not an address: ${v}`);
  return getAddress(v);
}

export function loadConfig(env: Env): ChainConfig {
  const chainId = Number(need(env, "VITE_CHAIN_ID"));
  if (!Number.isInteger(chainId) || chainId <= 0) throw new DataError("config", "VITE_CHAIN_ID is not a chain id");
  const codehash = env.VITE_SWORN_CODEHASH?.trim();
  return {
    rpcUrl: need(env, "VITE_RPC_URL"),
    chainId,
    networkLabel: env.VITE_NETWORK_LABEL?.trim() || `chain ${chainId}`,
    sworn: addr(env, "VITE_SWORN_ADDRESS"),
    swornCodehash: codehash ? (codehash as Hex) : undefined,
    explorerUrl: (env.VITE_EXPLORER_URL?.trim() || "https://explore.testnet.tempo.xyz").replace(/\/$/, ""),
    feedLookback: BigInt(env.VITE_FEED_LOOKBACK?.trim() || "20000"),
  };
}

export const txUrl = (c: ChainConfig, hash: string) => `${c.explorerUrl}/tx/${hash}`;
export const addressUrl = (c: ChainConfig, a: string) => `${c.explorerUrl}/address/${a}`;
