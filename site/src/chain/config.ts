import { getAddress, type Address, type Hex } from "viem";
import deployments from "../../../deployments/moderato.json";

/** Everything the page needs to read the chain. No keys, no backend. */
export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  networkLabel: string;
  sworn: Address;
  /** SwornZoneVerifier (spec 003). */
  zoneVerifier: Address;
  explorerUrl: string;
}

/** TIP-20 precompile that holds funds a receive policy blocked (tempo `RECEIVE_POLICY_GUARD_ADDRESS`). */
export const RECEIVE_POLICY_GUARD: Address = getAddress("0xb10c000000000000000000000000000000000000");

export const MODERATO: ChainConfig = {
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  chainId: deployments.chainId,
  networkLabel: "Tempo Moderato testnet",
  sworn: getAddress(deployments.Sworn.address),
  zoneVerifier: getAddress(deployments.SwornZoneVerifier.address),
  explorerUrl: "https://explore.testnet.tempo.xyz",
};

/** The three transactions of one slash. Only the hashes come from deployments/moderato.json; every value is read from chain. */
export interface Take {
  id: "demoLiveTake" | "demoLiveTakeFirst" | "firstSlash";
  label: string;
  reserveTx: Hex;
  paymentTx: Hex;
  challengeTx: Hex;
}

export const TAKES: Take[] = [
  {
    id: "demoLiveTake",
    label: "Demo video take",
    reserveTx: deployments.demoLiveTake.dishonestReserve as Hex,
    paymentTx: deployments.demoLiveTake.paymentDivertedToReceivePolicyGuard as Hex,
    challengeTx: deployments.demoLiveTake.challengeTx as Hex,
  },
  {
    id: "demoLiveTakeFirst",
    label: "Earlier take",
    reserveTx: deployments.demoLiveTakeFirst.dishonestReserve as Hex,
    paymentTx: deployments.demoLiveTakeFirst.paymentDivertedToReceivePolicyGuard as Hex,
    challengeTx: deployments.demoLiveTakeFirst.challengeTx as Hex,
  },
  {
    id: "firstSlash",
    label: "First slash",
    reserveTx: deployments.firstSlash.dishonestReserve as Hex,
    paymentTx: deployments.firstSlash.realPaymentDivertedToReceivePolicyGuard as Hex,
    challengeTx: deployments.firstSlash.challengeTx as Hex,
  },
];

export const txUrl = (c: ChainConfig, hash: string) => `${c.explorerUrl}/tx/${hash}`;
export const addressUrl = (c: ChainConfig, a: string) => `${c.explorerUrl}/address/${a}`;
export const blockUrl = (c: ChainConfig, n: bigint) => `${c.explorerUrl}/block/${n}`;
