import { useEffect, useState } from "react";
import { MODERATO, addressUrl } from "../chain/config.ts";
import { short } from "../chain/format.ts";
import type { Loadable } from "../chain/loadable.ts";
import {
  BATCH_CONTENTS,
  FIXTURE,
  HARDFORK_BATCH,
  MALFORMED,
  PRE_T13_SELECTOR,
  WITHDRAWAL_BATCH,
  isNonZero,
  type AttestLine,
  type VerifyNow,
  type ZoneAttest,
} from "../chain/zone.ts";
import { AddrLink, ErrorBox, TxLink, utc } from "./common.tsx";
import { Pipeline, type PipeNode } from "./ProofDiagram.tsx";
import deployments from "../../../deployments/moderato.json";

/** The proving record of the batch the page shows first (the one with a withdrawal). */
const PROVING = deployments.SwornZoneVerifierWithdrawal.attest.proving;

const ZONE_NODES: PipeNode[] = [
  { title: "Zone batch verifier", sub: ["Tempo's own code", "prove_zone_batch"] },
  { title: "SP1 zkVM", sub: ["runs it, proves", "the run"] },
  { title: "Groth16", sub: ["succinct proof", "made locally"] },
  { title: "SwornZoneVerifier", sub: ["on Moderato", "IVerifier's signature"], tempo: true },
];

const REPO = "https://github.com/psyto/sworn";
const SPEC = `${REPO}/blob/main/docs/specs/003-zone-verifier.md`;
const SPEC4 = `${REPO}/blob/main/docs/specs/004-tee-plus-zk.md`;
const STUB_SRC = "https://github.com/tempoxyz/zones/blob/ac49071ff975151256dc61414986eb9c0933e811/crates/contracts/src/runtime/tempo/Verifier.sol";

interface Props {
  attest: Loadable<ZoneAttest>;
  also: Loadable<AttestLine>;
  check: Loadable<VerifyNow>;
  onRetry: () => void;
  onVerify: () => void;
}

type ProofJobStatus = "queued" | "proving" | "verifying" | "verified" | "failed";
interface ProofJob {
  id: string;
  caseName: string;
  status: ProofJobStatus;
  startedAt: string;
  finishedAt: string | null;
  fixturePath: string;
  log: { at: string; source: string; line: string }[];
  proof: { digest: string; vkey: string; proveWallSecs: number; mode: string } | null;
  error: string | null;
}
interface OperatorHealth {
  status: "ready";
  localOnly: true;
  fixture: { expected: { withdrawals: number; userTransactions: number; estimatedMinutes: number; peakRamGB: number } };
  current: ProofJob | null;
}

const OPERATOR = "http://127.0.0.1:4317";

function useLocalProofJob() {
  const canReachWorker = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [worker, setWorker] = useState<"checking" | "offline" | "ready">(canReachWorker ? "checking" : "offline");
  const [job, setJob] = useState<ProofJob | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReachWorker) return;
    let stopped = false;
    let timer: number | undefined;
    const read = async () => {
      try {
        const response = await fetch(`${OPERATOR}/health`);
        if (!response.ok) throw new Error(`operator returned ${response.status}`);
        const value = await response.json() as OperatorHealth;
        if (stopped) return;
        setWorker("ready");
        // A persisted fixture job should not become the landing page's state. Keep a recent result visible
        // while an operator is actually working, but start a fresh page in the ready state.
        // A running job always shows; a finished one stays for 10 minutes after it finished.
        const cur = value.current;
        const running = cur && ["queued", "proving", "verifying"].includes(cur.status);
        const isRecent = cur && Date.now() - Date.parse(cur.finishedAt ?? cur.startedAt) < 10 * 60 * 1000;
        setJob(running || isRecent ? cur : null);
      } catch {
        if (!stopped) setWorker("offline");
      }
    };
    const tick = async () => {
      await read();
      if (!stopped) timer = window.setTimeout(tick, 2500);
    };
    void tick();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [canReachWorker]);

  const start = async () => {
    setStartError(null);
    let response: Response;
    try {
      response = await fetch(`${OPERATOR}/proof-jobs`, { method: "POST", headers: { "X-Sworn-Operator": "1" } });
    } catch (error) {
      // Only a network failure means the worker is not reachable.
      setStartError(error instanceof Error ? error.message : String(error));
      setWorker("offline");
      return;
    }
    const value = await response.json().catch(() => ({})) as { job?: ProofJob; error?: string };
    if (value.job) setJob(value.job);
    // A server answer (e.g. 409, a job is already running) is a start error, not "worker offline".
    if (!response.ok || !value.job) setStartError(value.error ?? `operator returned ${response.status}`);
  };
  return { worker, job, start, startError };
}

const Ok = ({ on, children }: { on: boolean; children: string }) =>
  on ? <span className="ok check-line">✓ {children}</span> : <span className="bad-text check-line">✗ does not match</span>;

const clock = (ms: number) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
const H0 = short(MALFORMED.hash, 2);

export function ZoneSection({ attest, also, check, onRetry, onVerify }: Props) {
  const busy = check.status === "loading";
  const stubTrue = check.status === "ok" && check.value.preT13.result === "true";
  const [copied, setCopied] = useState(false);
  const proofJob = useLocalProofJob();
  const auditRecord = () => JSON.stringify({
    kind: "Sworn Zone evidence record",
    scope: "Tempo Zones integration-test fixture on dev chain 1337; not a Moderato Zone batch; no ZonePortal calls this contract instance (our own Zone uses a separate instance).",
    batch: { withdrawals: BATCH_CONTENTS.withdrawals, userTransactions: BATCH_CONTENTS.userTransactions },
    attestation: attest.status === "ok" ? { tx: attest.value.txHash, contract: attest.value.contract, block: attest.value.blockNumber.toString() } : null,
    verification: check.status === "ok" ? { realBatch: "true", changedField: check.value.mutatedError, preT13MalformedBatch: check.value.preT13.result, checkedAt: new Date(check.value.readAt).toISOString() } : null,
    exportedAt: new Date().toISOString(),
  }, null, 2);
  const copyEvidenceLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#zone`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const downloadAuditRecord = () => {
    const file = new Blob([auditRecord()], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sworn-zone-blocks-5-6-evidence.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="section ops-shell" id="evidence" aria-labelledby="zone-h">
      <span id="zone" className="anchor" aria-hidden="true" />
      <aside className="ops-side" aria-label="Zone operations navigation">
        <p className="ops-zone"><span>Fixture batch · Tempo integration test</span>Zone 1 · dev chain 1337</p>
        <div className="ops-nav" aria-hidden="true" title="Static labels, not navigation">
          <span>Batches</span>
          <span className="selected">Proof evidence</span>
        </div>
        <p className="ops-scope">From Tempo&apos;s tests,<br />not a Moderato Zone</p>
      </aside>
      <div className="ops-main">
        <div className="ops-crumb"><span>Proof evidence</span><span>Zone blocks 5–6</span><b>Read live from chain</b></div>
      <div className="section-head">
        <p className="eyebrow">Technical evidence</p>
        <h2 id="zone-h">A fixture batch with a withdrawal (dev chain 1337), verified on Moderato</h2>
        <p className="lede">
          Tempo's own Zone batch verifier ran inside SP1 on a batch with {BATCH_CONTENTS.withdrawals} withdrawal and{" "}
          {BATCH_CONTENTS.userTransactions} user transactions, taken from Tempo's zones integration tests on a dev chain (1337),
          not from a Moderato Zone. A contract on Moderato with the exact signature of Tempo's <code>IVerifier</code> checked the
          Groth16 proof and emitted <code>ZoneBatchVerified</code>. Your browser reads the transaction, event and contract below
          from rpc.moderato.tempo.xyz, and can check the proof again.
        </p>
      </div>

      <figure className="figure">
        <Pipeline
          id="dg-zone"
          nodes={ZONE_NODES}
          label="Tempo's Zone batch verifier (zone_spf::prove_zone_batch) runs inside the SP1 zkVM, the run is wrapped as a Groth16 proof, and SwornZoneVerifier, with IVerifier's signature, verifies it on Moderato."
        />
        <figcaption>
          <code>zone_spf::prove_zone_batch</code> from Tempo's zones repository, with small build patches so it builds for the
          zkVM. The proof of this batch took {(PROVING.cycles / 1e6).toFixed(1)}M cycles and {Math.round(PROVING.groth16WallSecs)} s to make locally.
        </figcaption>
      </figure>

      <ProofJobPanel {...proofJob} />

      <div className="zone-grid">
        <div className="card zone-card" aria-live="polite">
          <p className="eyebrow">The attest transaction · the batch with a withdrawal</p>
          {attest.status === "ok" ? (
            <AttestFacts z={attest.value} />
          ) : attest.status === "error" ? (
            <ErrorBox error={attest.error} onRetry={onRetry} />
          ) : (
            <p className="loading">
              <span className="pulse" aria-hidden /> Reading the attest receipt, its event and the contract…
            </p>
          )}
          <AlsoVerified also={also} />
        </div>

        <div className="card zone-card again" aria-live="polite" aria-busy={busy}>
          <p className="eyebrow">Check it yourself, now</p>
          <p>
            Three live, read-only <code>eth_call</code>s. Nothing is signed or sent.
          </p>
          <div className="evidence-actions">
            <button className="btn" onClick={onVerify} disabled={busy}>
              {busy ? "Calling…" : "Re-verify on chain"}
            </button>
            <button className="btn secondary" onClick={() => { void copyEvidenceLink(); }}>
              {copied ? "Evidence link copied" : "Copy evidence link"}
            </button>
            <button className="btn secondary" onClick={downloadAuditRecord}>
              Download audit record
            </button>
          </div>
          {check.status === "ok" ? (
            <>
              <ol className="calls">
                <li className="row-real">
                  <span className="label">Sworn · the fixture withdrawal batch</span>
                  <span className="result ok">✓ true</span>
                  <span className="sub">The proof from the on-chain attest transaction verifies.</span>
                </li>
                <li className="row-mutated">
                  <span className="label">Sworn · one field changed</span>
                  <span className="result bad">✗ reverts {check.value.mutatedError}()</span>
                  <span className="sub">Change one field and the proof no longer fits.</span>
                </li>
                <li className="row-stub">
                  <span className="label">
                    Moderato's current prototype verifier (pre-T13 reference stub), an equivalent malformed batch
                  </span>
                  <span className="stub-call"><span className="stub-tag mono">Moderato, pre-T13 · called {clock(check.value.readAt)}</span><span>zone 99 · empty hashes · config dead · proof beef</span></span>
                  <span className={`result ${stubTrue ? "warn" : ""}`}>
                    {check.value.preT13.result === "reverted" ? "reverts" : `returns ${check.value.preT13.result}`}
                  </span>
                  <span className="sub">
                    {stubTrue ? (
                      <>
                        On Moderato today, the pre-T13 Solidity reference verifier is a prototype stub: it returns true without
                        checking execution (
                        <a href={STUB_SRC} target="_blank" rel="noreferrer">
                          source
                        </a>
                        ). Tempo&apos;s Zone design relies on a TEE (Nitro) attestation instead; Sworn shows what an independent ZK check adds.
                      </>
                    ) : (
                      <>This call no longer returns true: Moderato's Zone verifier has changed since this page was written.</>
                    )}
                  </span>
                  <details className="call-details">
                    <summary>Technical call details</summary>
                    <code>
                      <AddrLink address={MODERATO.preT13Verifier} label={short(MODERATO.preT13Verifier)} />.verify(zone {MALFORMED.zoneId}, every block number {MALFORMED.number.toString()}, every hash {H0}, verifierConfig {MALFORMED.verifierConfig}, proof {MALFORMED.proof})
                    </code>
                    <span className="sub mono">pre-T13 verify(…), selector {PRE_T13_SELECTOR}: 10 arguments, not IVerifier's 12, so the call is equivalent, not identical</span>
                  </details>
                </li>
              </ol>
              {stubTrue && (
                <p className="compare-line">
                  An equivalent malformed batch is accepted by Moderato's current prototype verifier, while Sworn rejects a
                  mutation of its proven batch.
                </p>
              )}
            </>
          ) : check.status === "error" ? (
            <ErrorBox error={check.error} onRetry={onVerify} />
          ) : (
            <p className="loading">
              <span className="pulse" aria-hidden /> {check.status === "loading" ? "Calling verify(…) on Moderato…" : "Waiting for the receipt read…"}
            </p>
          )}
          {check.status === "ok" && <p className="readat">Called at {clock(check.value.readAt)} on the latest block.</p>}
        </div>
      </div>

      <div className="isnot">
        <div>
          <p className="eyebrow">What it is</p>
          <ul>
            <li>Tempo Zones' own batch verifier, executed inside SP1.</li>
            <li>
              A fixture batch from Tempo&apos;s integration tests with {BATCH_CONTENTS.withdrawals} withdrawal and{" "}
              {BATCH_CONTENTS.userTransactions} user transactions, proven, then verified on Moderato by a standalone contract (not connected to a portal). It accepts the real proof and rejects a mutated input.
            </li>
            <li>A digest bound to the same batch fields Tempo&apos;s TEE (Nitro) attestation commits, plus the destination chain and the exact genesis artifact.</li>
            <li>
              Verified on chain by a contract with <code>IVerifier</code>'s exact signature (
              <a href={SPEC} target="_blank" rel="noreferrer">
                spec 003
              </a>
              ). A second batch, with no withdrawals, was verified the same way.
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">What it is not, yet</p>
          <ul>
            <li>
              <b>These batches are not from Moderato.</b> Both come from Tempo's zones integration tests, on a dev chain (1337):{" "}
              <code>{WITHDRAWAL_BATCH.caseName}</code> (the withdrawal is a test withdrawal, not a Moderato Zone's) and{" "}
              <code>{HARDFORK_BATCH.caseName}</code> (no withdrawals).
            </li>
            <li>
              <b>These two instances are not connected to a ZonePortal.</b> Our own Zone's instance is (
              <a href="#own-zone">above</a>). For Tempo's own Zones, holding withdrawals until ZK finality is a proposal (
              <a href={SPEC4} target="_blank" rel="noreferrer">
                spec 004
              </a>
              ), not built.
            </li>
            <li>
              <b>No Tempo-created Zone settles with it.</b> Tempo's factory fixes each Zone's verifier when the Zone is created,
              so only Tempo can adopt it.
            </li>
            <li>
              <b>No portal caller check.</b> Safe here only because the contract moves and stores nothing.
            </li>
            <li>
              <b>The pinned genesis is a trusted choice.</b> Its hash pins exact bytes; it does not prove they are Tempo's
              authentic spec.
            </li>
            <li>
              <b>Not production-ready, and not audited.</b>
            </li>
          </ul>
        </div>
      </div>
      </div>
    </section>
  );
}

const LOCAL_HOST = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname ?? "");

function ProofJobPanel({ worker, job, start, startError }: ReturnType<typeof useLocalProofJob>) {
  const running = job?.status === "queued" || job?.status === "proving" || job?.status === "verifying";
  return (
    <section className="proof-job" aria-live="polite" aria-label="Local proof job">
      <div>
        <p className="eyebrow">Local prover · operator action</p>
        <h3>Generate evidence for Zone blocks 5–6</h3>
        <p className="sub">Runs the real SP1 Groth16 pipeline for the withdrawal fixture, then runs read-only verification on Moderato.</p>
      </div>
      {worker === "offline" && !LOCAL_HOST ? (
        <div className="job-offline">
          <b>Runs on the operator&apos;s machine.</b>
          <span>The public page cannot start proof jobs; see <code>docs/operator-console.md</code> to run one locally.</span>
        </div>
      ) : worker === "offline" ? (
        <div className="job-offline">
          <b>Local worker not connected.</b>
          <span>Start <code>scripts/start-zone-operator.sh</code> locally. The public site cannot start proof jobs.</span>
        </div>
      ) : (
        <div className="job-controls">
          <button className="btn" onClick={() => { void start(); }} disabled={running || worker === "checking"}>
            {running ? "Proof job running…" : "Start local proof job"}
          </button>
          <span className="job-cost">≈15 min · ≈20 GB RAM · no transaction sent</span>
        </div>
      )}
      {startError && <p className="job-error">Could not start: {startError}</p>}
      {job && (
        <div className={`job-state ${job.status}`}>
          <div><span className="label">Job</span> <code>{job.id}</code></div>
          <div><span className="label">State</span> <b>{job.status}</b>{job.proof && <> · proof {job.proof.mode} · {Math.round(job.proof.proveWallSecs)} s</>}</div>
          {job.status === "verified" && <p className="status ok">✓ New proof passed the read-only on-chain checks. Nothing was sent.</p>}
          {job.error && <p className="job-error">{job.error}</p>}
          {job.log.length > 0 && <details><summary>Worker log</summary><pre>{job.log.slice(-12).map((line) => `${line.source}: ${line.line}`).join("\n")}</pre></details>}
        </div>
      )}
      <p className="job-boundary">Fixture only: one integration-test batch on dev chain 1337. A real Zone needs its operator's witness, its own deployment and version work.</p>
    </section>
  );
}

function AlsoVerified({ also }: { also: Loadable<AttestLine> }) {
  return (
    <div className="also" aria-live="polite">
      <p className="eyebrow">Also verified</p>
      {also.status === "ok" ? (
        <p className="also-line">
          <code>{HARDFORK_BATCH.caseName}</code> (no withdrawals) · zone {also.value.event.zoneId}, height{" "}
          {also.value.event.nextZoneHeight.toString()} · <TxLink hash={also.value.txHash} /> · block {also.value.blockNumber.toString()} ·{" "}
          <AddrLink address={also.value.contract} label={short(also.value.contract, 6)} />{" "}
          {also.value.digestMatchesFixture && also.value.calldataMatchesFixture ? (
            <span className="ok">✓ ZoneBatchVerified, digest and calldata match its fixture</span>
          ) : (
            <span className="bad-text">✗ does not match its fixture</span>
          )}
        </p>
      ) : also.status === "error" ? (
        <ErrorBox error={also.error} />
      ) : (
        <p className="loading">
          <span className="pulse" aria-hidden /> Reading the first batch's attest…
        </p>
      )}
    </div>
  );
}

function AttestFacts({ z }: { z: ZoneAttest }) {
  const e = z.event;
  const im = z.immutables;
  return (
    <>
      <p className="status ok">✓ succeeded · ZoneBatchVerified emitted</p>
      <dl className="facts">
        <dt>Tx</dt>
        <dd>
          <TxLink hash={z.txHash} />
        </dd>
        <dt>Block</dt>
        <dd className="mono">
          {z.blockNumber.toString()} · {utc(z.timestamp)} · {z.gasUsed.toLocaleString("en-US")} gas
        </dd>
        <dt>Contract</dt>
        <dd>
          <AddrLink address={z.contract} label={short(z.contract, 6)} /> · sent by <AddrLink address={z.from} />
        </dd>
      </dl>

      <p className="eyebrow sub-head">What the batch contains</p>
      <dl className="facts">
        <dt>withdrawals</dt>
        <dd className="mono">{BATCH_CONTENTS.withdrawals}</dd>
        <dt>user transactions</dt>
        <dd className="mono">{BATCH_CONTENTS.userTransactions}</dd>
        <dt>counts from</dt>
        <dd>
          deployments/moderato.json's record of the batch
          <Ok on={BATCH_CONTENTS.recordAgrees}>its withdrawalQueueHash agrees with the fixture</Ok>
        </dd>
        <dt>withdrawalQueueHash</dt>
        <dd className="mono">
          {z.withdrawalQueueHash}
          <Ok on={isNonZero(z.withdrawalQueueHash) && z.withdrawalQueueHash.toLowerCase() === FIXTURE.withdrawalQueueHash.toLowerCase()}>
            non-zero (a withdrawal is queued), read from the attest calldata, equals the fixture
          </Ok>
        </dd>
        <dt>from</dt>
        <dd>
          <code>{WITHDRAWAL_BATCH.caseName}</code>, Tempo's zones integration test <code>{BATCH_CONTENTS.integrationTest}</code>, dev chain 1337
        </dd>
      </dl>

      <p className="eyebrow sub-head">Event ZoneBatchVerified, decoded</p>
      <dl className="facts raw">
        <dt>zoneId</dt>
        <dd className="mono">{e.zoneId}</dd>
        <dt>nextZoneHeight</dt>
        <dd className="mono">{e.nextZoneHeight.toString()}</dd>
        <dt>prevBlockHash</dt>
        <dd className="mono">{e.prevBlockHash}</dd>
        <dt>nextBlockHash</dt>
        <dd className="mono">{e.nextBlockHash}</dd>
        <dt>digest</dt>
        <dd className="mono">
          {e.digest}
          <Ok on={z.digestMatchesFixture}>the digest the zkVM guest committed</Ok>
        </dd>
        <dt>calldata</dt>
        <dd>
          <Ok on={z.calldataMatchesFixture}>the attest call's arguments and proof are the ones "Re-verify on chain" uses</Ok>
        </dd>
      </dl>

      <p className="eyebrow sub-head">Contract immutables, read from chain</p>
      <dl className="facts">
        <dt>SP1_VERIFIER</dt>
        <dd>
          <a className="mono" href={addressUrl(MODERATO, im.sp1Verifier)} target="_blank" rel="noreferrer">
            {im.sp1Verifier}
          </a>{" "}
          · {im.sp1VerifierVersion}
        </dd>
        <dt>ZONE_VKEY</dt>
        <dd className="mono">{im.zoneVkey}</dd>
        <dt>PARENT_CHAIN_ID</dt>
        <dd className="mono">{im.parentChainId.toString()} (the dev chain the batch came from)</dd>
        <dt>PINNED_ZONE_ID</dt>
        <dd className="mono">{im.pinnedZoneId}</dd>
        <dt>PINNED_GENESIS_ARTIFACT_HASH</dt>
        <dd className="mono">{im.pinnedGenesisArtifactHash}</dd>
        <dt>match</dt>
        <dd>
          <Ok on={z.immutablesMatch}>all five equal the constructor arguments in deployments/moderato.json</Ok>
        </dd>
        <dt>codehash</dt>
        <dd className="mono">
          {z.codehash}
          <Ok on={z.codehashMatches}>{`equals deployments/moderato.json (${z.codeBytes.toLocaleString("en-US")} bytes)`}</Ok>
        </dd>
      </dl>
    </>
  );
}
