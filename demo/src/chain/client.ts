import { createPublicClient, defineChain, http, type PublicClient } from "viem";
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

export function makePublicClient(c: ChainConfig): PublicClient {
  return createPublicClient({ chain: makeChain(c), transport: http(c.rpcUrl, { retryCount: 1 }) }) as PublicClient;
}
