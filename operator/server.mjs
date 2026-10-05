#!/usr/bin/env node
/**
 * Local-only controller for Sworn's real Zone prover.
 *
 * It intentionally accepts one pinned integration-test case. A production
 * service would authenticate a Zone operator and obtain that operator's
 * private witness; this controller must never be exposed to a network.
 */
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SWORN_OPERATOR_PORT ?? 4317);
const jobDir = join(root, "out", "operator-zone-jobs");
const rpc = process.env.RPC ?? "https://rpc.moderato.tempo.xyz";

// Deliberately not user supplied: arbitrary witnesses and Zones need an
// authenticated operator workflow, which is beyond this local demonstrator.
const withdrawalFixture = {
  caseName: "deposit_and_withdrawal_blocks5-6",
  verifier: "0xF2e1E74c14B10bE4dda591dbE50F91b88bDcBA11",
  destinationChainId: "42431",
  expected: { withdrawals: 1, userTransactions: 2, estimatedMinutes: 15, peakRamGB: 20 },
};

/** @type {ReturnType<typeof newJob> | null} */
let current = null;

function newJob() {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  return { id, caseName: withdrawalFixture.caseName, status: "queued", startedAt: new Date().toISOString(), finishedAt: null,
    fixturePath: relative(root, join(jobDir, `${id}.json`)), log: [], proof: null, error: null };
}

function publicJob(job) { return job ? { ...job, log: job.log.slice(-80) } : null; }

function append(job, source, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) if (line) job.log.push({ at: new Date().toISOString(), source, line });
  if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
}

function run(job, command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
    child.stdout.on("data", (data) => append(job, "stdout", data));
    child.stderr.on("data", (data) => append(job, "stderr", data));
    child.on("error", rejectRun);
    child.on("close", (code, signal) => resolveRun({ code, signal }));
  });
}

async function launch(job) {
  try {
    await mkdir(jobDir, { recursive: true });
    job.status = "proving";
    append(job, "operator", `Starting the real local Groth16 prover for ${job.caseName}.`);
    const proof = await run(job, join(root, "scripts", "zone-prove.sh"),
      [withdrawalFixture.verifier, join(root, job.fixturePath), withdrawalFixture.destinationChainId],
      { ZONE_CASE: withdrawalFixture.caseName, RPC: rpc });
    if (proof.code !== 0) throw new Error(`zone-prove.sh exited ${proof.code ?? "null"}${proof.signal ? ` (${proof.signal})` : ""}`);

    const fixture = JSON.parse(await readFile(join(root, job.fixturePath), "utf8"));
    job.proof = { digest: fixture.digest, vkey: fixture.vkey, proveWallSecs: fixture.prove_wall_secs, mode: fixture.mode };
    job.status = "verifying";
    append(job, "operator", "Proof generated. Running the read-only on-chain verification checks.");
    const verify = await run(job, join(root, "scripts", "zone-attest.sh"),
      [withdrawalFixture.verifier, join(root, job.fixturePath)], { RPC: rpc });
    if (verify.code !== 0) throw new Error(`zone-attest.sh exited ${verify.code ?? "null"}${verify.signal ? ` (${verify.signal})` : ""}`);
    job.status = "verified";
    append(job, "operator", "Read-only verification passed. No transaction was sent.");
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    append(job, "operator", job.error);
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

function setCors(req, res) {
  const origin = req.headers.origin;
  // The server listens only on loopback. Allow local Vite previews on any port.
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sworn-Operator");
}
function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

// Requests must come from this machine's own pages. CORS only stops other sites from reading a response;
// it does not stop them from sending a simple POST, so the Host and Origin are checked here, and a custom
// header (which forces a CORS preflight) is required to start a job.
const LOOPBACK = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
function trusted(req) {
  if (!LOOPBACK.test(req.headers.host ?? "")) return false; // DNS rebinding
  const origin = req.headers.origin;
  return !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const server = createServer((req, res) => {
  setCors(req, res);
  if (!trusted(req)) return send(res, 403, { error: "Forbidden: local pages only." });
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ready", localOnly: true, fixture: withdrawalFixture, current: publicJob(current) });
  if (req.method === "GET" && req.url === "/proof-jobs/current") return send(res, 200, { job: publicJob(current) });
  if (req.method === "POST" && req.url === "/proof-jobs") {
    if (req.headers["x-sworn-operator"] !== "1") return send(res, 403, { error: "Missing X-Sworn-Operator header." });
    if (current && ["queued", "proving", "verifying"].includes(current.status)) return send(res, 409, { error: "A proof job is already running.", job: publicJob(current) });
    current = newJob();
    void launch(current);
    return send(res, 202, { job: publicJob(current) });
  }
  return send(res, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Sworn local Zone operator worker: http://127.0.0.1:${port}`);
  console.log("Loopback only. It can run the real prover; it never sends a transaction.");
  console.log(`Fixture output: ${relative(root, jobDir)}/`);
});
process.on("SIGINT", () => server.close(() => process.exit(0)));
