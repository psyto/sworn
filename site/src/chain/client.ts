// Adapted from demo/src/chain/client.ts: a bare viem client (no wallet, no public-action bundle) so the
// static page stays small; reads go through tree-shaken actions from viem/actions.
import { createClient, defineChain, http, type Client } from "viem";
import type { ChainConfig } from "./config.ts";

export function makeChain(c: ChainConfig) {
  return defineChain({
    id: c.chainId,
    name: c.networkLabel,
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: { default: { http: [c.rpcUrl] } },
    blockExplorers: { default: { name: "Tempo explorer", url: c.explorerUrl } },
    testnet: true,
  });
}

export function makePublicClient(c: ChainConfig): Client {
  // public Moderato RPC rate-limits (429, -32005); viem backs off and retries
  return createClient({ chain: makeChain(c), transport: http(c.rpcUrl, { retryCount: 6, retryDelay: 300 }) });
}
