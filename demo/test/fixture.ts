// Seeds a local `anvil --network tempo` with a real Sworn deployment, a bonded server, one real
// reservation, and real payments. Used by the data-layer test and by scripts/seed-anvil.ts (for the
// local demo / screenshots). All transactions come from anvil's unlocked dev accounts (no keys).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { makeChain, makePublicClient } from "../src/chain/client.ts";
import { loadConfig, type ChainConfig } from "../src/chain/config.ts";
import { readSwornParams } from "../src/chain/reads.ts";
import { swornAbi } from "../src/chain/sworn.abi.ts";

export const PATH_USD: Address = "0x20C0000000000000000000000000000000000000";
// anvil's default dev accounts (public, deterministic; unlocked by anvil — no keys used here)
const DEV = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
] as const;
export const [DEPLOYER, SERVER, AGENT, RECEIVER, BLOCKED] = DEV;
const TIP403_REGISTRY: Address = getAddress("0x403c000000000000000000000000000000000000");
const registry = parseAbi(["function setReceivePolicy(uint64 senderPolicyId, uint64 tokenFilterId, address recoveryAuthority)"]);
const tip20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
export const WRONG_TX: Hex = keccak256(toHex("not a transaction"));


export async function seedChain(url: string) {
  let bondTx: Hex;
  let payTx: Hex;
  let blockedTx: Hex | undefined;
  let policyUnsupported: string | undefined;
  let cfg: ChainConfig;
  let client: PublicClient;
  let raw: Record<string, unknown>;
    const bytecode = readFileSync(join(import.meta.dirname, "fixtures", "sworn.bytecode"), "utf8").trim() as Hex;
    const base = { VITE_RPC_URL: url, VITE_CHAIN_ID: "42431", VITE_SWORN_ADDRESS: "0x0000000000000000000000000000000000000001" };
    const chain = makeChain(loadConfig(base));
    const wallet = createWalletClient({ chain, transport: http(url) });
    const pub = makePublicClient(loadConfig(base));
    const mined = async (h: Hex) => {
      const r = await pub.waitForTransactionReceipt({ hash: h });
      if (r.status !== "success") throw new Error(`tx ${h} reverted`);
      return r;
    };

    const deploy = await mined(await wallet.deployContract({ abi: swornAbi, bytecode, account: DEPLOYER }));
    const sworn = deploy.contractAddress!;
    cfg = loadConfig({ ...base, VITE_SWORN_ADDRESS: sworn, VITE_SWORN_CODEHASH: keccak256((await pub.getCode({ address: sworn }))!) });
    client = makePublicClient(cfg);

    await mined(await wallet.writeContract({ address: PATH_USD, abi: tip20, functionName: "approve", args: [sworn, 1_000_000_000n], account: SERVER }));
    bondTx = await wallet.writeContract({ address: sworn, abi: swornAbi, functionName: "bond", args: [SERVER, 1_000_000_000n], account: SERVER });
    await mined(bondTx);

    const head = await client.getBlockNumber({ cacheTime: 0 });
    const N = head; // reserve lands in head+1, so N < block.number
    const blockHash = (await client.getBlock({ blockNumber: N })).hash!;
    const before = await client.readContract({ address: PATH_USD, abi: tip20, functionName: "balanceOf", args: [RECEIVER], blockNumber: N });
    const q = {
      chainId: 42431n,
      blockNumber: N,
      blockHash,
      from: AGENT as Address,
      token: PATH_USD,
      data: encodeFunctionData({ abi: tip20, functionName: "transfer", args: [RECEIVER, 500_000_000n] }),
      feeToken: PATH_USD,
      gasLimit: 300_000n,
    };
    const ans = {
      success: true,
      returnDataHash: keccak256("0x0000000000000000000000000000000000000000000000000000000000000001"),
      gasUsed: 51_234n,
      feeCharged: 1_234n,
      receiver: RECEIVER as Address,
      receiverBefore: before,
      receiverAfter: before + 500_000_000n,
    };
    const reserveTx = await wallet.writeContract({
      address: sworn,
      abi: swornAbi,
      functionName: "reserve",
      args: [q, ans, AGENT, 500_000_000n],
      account: SERVER,
    });
    await mined(reserveTx);
    const digest = (await client.readContract({ address: sworn, abi: swornAbi, functionName: "digestOf", args: [q, ans] })) as Hex;
    const params = await readSwornParams(client, cfg);

    // The server's 002 §2 JSON, as strings.
    const s = (v: bigint) => v.toString();
    raw = {
      question: { ...q, chainId: s(q.chainId), blockNumber: s(q.blockNumber), gasLimit: toHex(q.gasLimit) },
      answer: { ...ans, gasUsed: s(ans.gasUsed), feeCharged: s(ans.feeCharged), receiverBefore: s(ans.receiverBefore), receiverAfter: s(ans.receiverAfter) },
      server: SERVER,
      sworn,
      digest,
      reserveTx,
      coverage: "500000000",
      mode: "dishonest-demo",
      guestVersion: params.guestVersion,
      guestVkey: params.guestVkey,
    };
    const expected = { client: AGENT, from: AGENT, token: PATH_USD, feeToken: PATH_USD, receiver: RECEIVER, amount: 500_000_000n };

    payTx = await wallet.writeContract({ address: PATH_USD, abi: tip20, functionName: "transfer", args: [RECEIVER, 500_000_000n], account: AGENT });
    await mined(payTx);

    // R′: a receive policy that rejects every sender (policy 0 = REJECT_ALL), any token (1 = ALLOW_ALL).
    // anvil's embedded Tempo may predate TIP-1028 receive policies (T6); then this case is skipped, loudly.
    const policyArgs = { address: TIP403_REGISTRY, abi: registry, functionName: "setReceivePolicy", args: [0n, 1n, "0x0000000000000000000000000000000000000000"], account: BLOCKED } as const;
    try {
      await pub.simulateContract(policyArgs);
    } catch (e) {
      policyUnsupported = (e as { shortMessage?: string }).shortMessage ?? String(e);
    }
    if (!policyUnsupported) {
      await mined(await wallet.writeContract(policyArgs));
      blockedTx = await wallet.writeContract({ address: PATH_USD, abi: tip20, functionName: "transfer", args: [BLOCKED, 500_000_000n], account: AGENT });
      await mined(blockedTx);
    }
  return { cfg, client, raw, expected, bondTx, payTx, blockedTx, policyUnsupported };
}
