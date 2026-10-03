// Local demo backend. Holds the agent's key (from env only), calls the Sworn SDK, sends the demo
// payment. The browser reaches it only through /api (vite proxy). Run: pnpm backend
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import type { ChallengeJob, DemoConfig, PreflightResult, Scenario } from "../src/api.ts";
import { HttpError, loadSdk } from "./sdk-adapter.ts";
import { parseRecording } from "./recording.ts";

const env = process.env;
const port = Number(env.DEMO_PORT ?? 8788);
const rpcUrl = env.DEMO_RPC_URL ?? "http://127.0.0.1:8545";
const isLocalRpc = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(rpcUrl);
const allowRemoteTx = env.DEMO_ALLOW_REMOTE_TX === "1";

function optAddress(key: string): Address | null {
  const v = env[key]?.trim();
  if (!v) return null;
  if (!isAddress(v)) throw new Error(`${key} is not an address`);
  return getAddress(v);
}

const sworn = optAddress("SWORN_ADDRESS");
const token = optAddress("DEMO_TOKEN") ?? getAddress("0x20C0000000000000000000000000000000000000");
const feeToken = optAddress("DEMO_FEE_TOKEN") ?? token;

let account: LocalAccount | null = null;
let signerReason: string | undefined;
if (env.DEMO_CLIENT_KEY?.trim()) {
  account = privateKeyToAccount(env.DEMO_CLIENT_KEY.trim() as `0x${string}`);
} else {
  signerReason = "DEMO_CLIENT_KEY is not set";
}
if (account && !isLocalRpc && !allowRemoteTx) {
  signerReason = `refusing to sign for a non-local RPC (${rpcUrl}); set DEMO_ALLOW_REMOTE_TX=1 to allow`;
}
const agent = account?.address ?? optAddress("DEMO_AGENT_ADDRESS");

const scenarios: Scenario[] = [];
const r = optAddress("DEMO_RECEIVER");
const rBlocked = optAddress("DEMO_RECEIVER_BLOCKED");
const amount = env.DEMO_AMOUNT?.trim() || "500";
if (r) scenarios.push({ id: "honest", receiver: r, amount, serverUrl: env.HONEST_SERVER_URL ?? "", mode: "honest" });
if (rBlocked)
  scenarios.push({ id: "dishonest", receiver: rBlocked, amount, serverUrl: env.DISHONEST_SERVER_URL ?? "", mode: "dishonest-demo" });

const sdk = await loadSdk(env.SWORN_SDK_PATH);
const recordingPath = env.DEMO_RECORDING_LOG?.trim();

const tip20 = parseAbi([
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

async function chain() {
  const probe = createPublicClient({ transport: http(rpcUrl) });
  const id = await probe.getChainId();
  const c = defineChain({
    id,
    name: `chain ${id}`,
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  return { c, pub: createPublicClient({ chain: c, transport: http(rpcUrl) }) };
}

async function amountUnits(): Promise<bigint> {
  const { pub } = await chain();
  const d = await pub.readContract({ address: token, abi: tip20, functionName: "decimals" });
  return parseUnits(amount, d);
}

function scenario(id: unknown): Scenario {
  const s = scenarios.find((x) => x.id === id);
  if (!s) throw new HttpError(400, `scenario ${String(id)} is not configured (DEMO_RECEIVER / DEMO_RECEIVER_BLOCKED)`);
  return s;
}

function needSigner(): LocalAccount {
  if (!account || signerReason) throw new HttpError(501, `no signer: ${signerReason}`);
  return account;
}

function needSworn(): Address {
  if (!sworn) throw new HttpError(501, "SWORN_ADDRESS is not set");
  return sworn;
}

const jobs = new Map<string, ChallengeJob>();

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "body is not JSON");
  }
}

const json = (res: ServerResponse, status: number, v: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
};

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const path = url.pathname.replace(/^\/api/, "");

  if (req.method === "GET" && path === "/config") {
    const cfg: DemoConfig = {
      agent,
      token,
      feeToken,
      scenarios,
      sdk: { ready: sdk.ready, reason: sdk.reason },
      signer: { ready: !!account && !signerReason, reason: signerReason },
      recording: { available: !!recordingPath, source: recordingPath },
    };
    return json(res, 200, cfg);
  }

  if (req.method === "POST" && path === "/preflight") {
    const s = scenario((await body(req)).scenario);
    const acct = needSigner();
    const units = await amountUnits();
    const out = await sdk.preflight(
      s.serverUrl,
      { from: acct.address, token, receiver: s.receiver, amount: units, feeToken, client: acct.address },
      { account: acct, rpcUrl, sworn: needSworn() },
    );
    const result: PreflightResult = {
      response: out.response,
      amountUnits: units.toString(),
      sdk: { protected: out.protected, note: out.note },
      payment: out.payment,
    };
    return json(res, 200, result);
  }

  if (req.method === "POST" && path === "/pay") {
    const s = scenario((await body(req)).scenario);
    const acct = needSigner();
    const { c, pub } = await chain();
    const wallet = createWalletClient({ account: acct, chain: c, transport: http(rpcUrl) });
    const hash = await wallet.writeContract({
      address: token,
      abi: tip20,
      functionName: "transfer",
      args: [s.receiver, await amountUnits()],
    });
    await pub.waitForTransactionReceipt({ hash });
    return json(res, 200, { txHash: hash });
  }

  if (req.method === "POST" && path === "/challenge") {
    const b = await body(req);
    scenario(b.scenario);
    const acct = needSigner();
    const ctx = { account: acct, rpcUrl, sworn: needSworn() };
    if (!sdk.ready) throw new HttpError(501, `Sworn SDK not available: ${sdk.reason}`);
    const now = Date.now();
    const job: ChallengeJob = { id: randomUUID(), phase: "witness", startedAt: now, phaseStartedAt: { witness: now }, log: [], now };
    jobs.set(job.id, job);
    sdk
      .challenge(b.response, ctx, (e) => {
        if (e.phase === "log") job.log.push(e.line);
        else {
          job.phase = e.phase;
          job.phaseStartedAt[e.phase] ??= Date.now();
          if (e.line) job.log.push(e.line);
        }
      })
      .then(({ txHash }) => {
        job.txHash = txHash;
        job.phase = "done";
        job.phaseStartedAt.done = Date.now();
      })
      .catch((e: Error) => {
        job.phase = "failed";
        job.error = e.message;
        job.phaseStartedAt.failed = Date.now();
      });
    return json(res, 202, { ...job, now: Date.now() });
  }

  if (req.method === "GET" && path.startsWith("/challenge/")) {
    const job = jobs.get(decodeURIComponent(path.slice("/challenge/".length)));
    if (!job) throw new HttpError(404, "no such challenge job");
    return json(res, 200, { ...job, now: Date.now() });
  }

  if (req.method === "GET" && path === "/recording") {
    if (!recordingPath) throw new HttpError(404, "DEMO_RECORDING_LOG is not set");
    return json(res, 200, parseRecording(recordingPath));
  }

  throw new HttpError(404, `no route ${req.method} ${url.pathname}`);
}

createServer((req, res) => {
  route(req, res).catch((e: unknown) => {
    const status = e instanceof HttpError ? e.status : 500;
    const msg = e instanceof Error ? ((e as { shortMessage?: string }).shortMessage ?? e.message) : String(e);
    json(res, status, { error: msg });
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`sworn demo backend on http://127.0.0.1:${port}`);
  console.log(`  rpc ${rpcUrl}${isLocalRpc ? " (local)" : ""}; sworn ${sworn ?? "(unset)"}`);
  console.log(`  agent ${agent ?? "(unset)"}; signer ${signerReason ? "OFF: " + signerReason : "on"}`);
  console.log(`  sdk ${sdk.ready ? "ready" : "NOT READY: " + sdk.reason}`);
  console.log(`  scenarios: ${scenarios.map((s) => s.id).join(", ") || "(none — set DEMO_RECEIVER / DEMO_RECEIVER_BLOCKED)"}`);
});
