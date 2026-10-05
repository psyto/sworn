import { useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { api, BackendError, type ChallengeJob, type DemoConfig, type Recording, type Scenario } from "../api.ts";
import { RECEIVE_POLICY_GUARD } from "../chain/config.ts";
import { DataError } from "../chain/errors.ts";
import { elapsed, money, short, signed } from "../chain/format.ts";
import { load, type Loadable } from "../chain/loadable.ts";
import { parsePreflightResponse, verifyPreflight, type VerifiedAnswer } from "../chain/preflight.ts";
import { readBalance, readPayment, readSlash, type PaymentOutcome, type SlashOutcome } from "../chain/reads.ts";
import { AddrLink, ErrorBox, TopBar, TxLink, useChain, useRead } from "../ui/common.tsx";
import { HowItWorks } from "../ui/HowItWorks.tsx";

const backendErr = (e: unknown) =>
  e instanceof BackendError ? new DataError("backend", e.message) : e instanceof DataError ? e : new DataError("backend", String(e));

export function WalletPage() {
  const demo = useRead(() => api.config(), []);
  return (
    <>
      <TopBar page="wallet" />
      <main className="page customer-page">
        <section className="customer-hero">
          <p className="role-tag">Payment protection · Moderato testnet</p>
          <h1>Know when a successful payment did not reach its recipient.</h1>
          <p>Sworn reserves a provider's bond before you rely on its payment check. If the check is proven wrong, that bond pays you automatically.</p>
        </section>
        {demo.status === "loading" || demo.status === "idle" ? <p className="loading">Connecting to the local demo backend…</p> : null}
        {demo.status === "error" ? <ErrorBox error={demo.error} title="Demo backend unavailable" /> : null}
        {demo.status === "ok" ? <Flow demo={demo.value} /> : null}
        <HowItWorks />
        <p className="footer">
          Every number on this page is read from the chain, or from a server answer whose reservation was read back from the
          chain. Moderato testnet only · unaudited · no users, revenue or mainnet yet · compensation is capped by the bond
          the server reserved (500 here) · it covers the answer about one block, not a later payment.
        </p>
      </main>
    </>
  );
}

function Flow({ demo }: { demo: DemoConfig }) {
  const honest = demo.scenarios.find((s) => s.id === "honest");
  const liar = demo.scenarios.find((s) => s.id === "dishonest");
  return (
    <>
      {!demo.sdk.ready || !demo.signer.ready ? (
        <div className="result info" role="status">
          <b>Some actions are unavailable</b>
          {!demo.sdk.ready ? <span className="sub">Sworn SDK: {demo.sdk.reason}</span> : null}
          {!demo.signer.ready ? <span className="sub">Signer: {demo.signer.reason}</span> : null}
          <span className="sub">Nothing below is simulated: without them the buttons report the error.</span>
        </div>
      ) : null}
      <div className="roles user-status" data-testid="roles">
        <span className="role"><b>Your wallet</b></span>
        <span className="role"><b>500 USD payment</b></span>
        <span className="role"><b>Bond-backed check</b></span>
      </div>
      {liar ? <ScenarioCard step={1} demo={demo} s={liar} /> : <Missing what="DEMO_RECEIVER_BLOCKED (R′)" />}
      <details className="developer-details">
        <summary>Technical details and control case</summary>
        <p className="sub">The live demo roles are: paying agent, preflight provider and challenger. Values below are read from the chain.</p>
        {demo.agent ? <AgentBalance agent={demo.agent} token={demo.token} /> : null}
        {honest ? <ScenarioCard step={2} demo={demo} s={honest} /> : <Missing what="DEMO_RECEIVER (R)" />}
      </details>
    </>
  );
}

function Missing({ what }: { what: string }) {
  return <div className="error">Scenario not configured: set {what} for the demo backend.</div>;
}

function AgentBalance({ agent, token }: { agent: Address; token: Address }) {
  const { client } = useChain();
  const bal = useRead(() => readBalance(client, token, agent), [client, agent, token], 3000);
  return (
    <div className="row sub" data-testid="agent-balance">
      Agent <AddrLink address={agent} /> · balance{" "}
      {bal.status === "ok" ? <b className="num">{money(bal.value.value, bal.value.decimals)}</b> : bal.status === "error" ? "unreadable" : "…"}
    </div>
  );
}

function ScenarioCard({ step, demo, s }: { step: number; demo: DemoConfig; s: Scenario }) {
  const { client, cfg } = useChain();
  const liar = s.mode === "dishonest-demo";
  const [answer, setAnswer] = useState<Loadable<VerifiedAnswer>>({ status: "idle" });
  const [payment, setPayment] = useState<Loadable<PaymentOutcome>>({ status: "idle" });
  const [paymentPrice, setPaymentPrice] = useState<{ txHash?: Hex } | undefined>();
  const raw = useRef<unknown>(null);

  const buy = () => {
    setPayment({ status: "idle" });
    void load(async () => {
      if (!demo.agent) throw new DataError("config", "the backend has no agent address");
      const r = await api.preflight(s.id).catch((e) => Promise.reject(backendErr(e)));
      setPaymentPrice(r.payment);
      raw.current = r.response;
      const resp = parsePreflightResponse(r.response);
      return verifyPreflight(client, cfg, resp, {
        client: demo.agent,
        from: demo.agent,
        token: demo.token,
        feeToken: demo.feeToken,
        receiver: s.receiver,
        amount: BigInt(r.amountUnits),
      });
    }, setAnswer);
  };

  const pay = () =>
    void load(async () => {
      const { txHash } = await api.pay(s.id).catch((e) => Promise.reject(backendErr(e)));
      return readPayment(client, { txHash, token: demo.token, from: demo.agent!, receiver: s.receiver });
    }, setPayment);

  return (
    <section className={`card${liar ? " liar" : ""}`} aria-labelledby={`q-${s.id}`}>
      {liar ? (
        <div className="liar-banner" role="note">
          Demo scenario: this payment check is deliberately wrong
        </div>
      ) : null}
      <div className="card-head">
        <span className="step-no">{liar ? "Payment review" : `Control · step ${step}`}</span>
        <span className={`badge ${liar ? "liar" : "honest"}`}>{liar ? "test scenario" : "correct result"}</span>
      </div>
      <span className="role-tag">Recipient check</span>
      <h2 className="question" id={`q-${s.id}`}>
        Send {s.amount} USD
      </h2>
      {liar ? (
        <p className="sub" style={{ margin: 0 }}>
          This recipient's receive policy will divert the payment rather than reject it. The check below is deliberately wrong so the protection path can be shown.
        </p>
      ) : null}

      <div className="row">
        <button className="btn" onClick={buy} disabled={answer.status === "loading"}>
          {answer.status === "loading" ? "Checking recipient…" : "Check recipient"}
        </button>
        <span className="sub">
          A provider answers and locks its own bond before you pay.
        </span>
      </div>

      <AnswerView a={answer} liar={liar} price={paymentPrice} />

      {answer.status === "ok" ? (
        <>
          <div className="row">
            <button className="btn secondary" onClick={pay} disabled={payment.status === "loading"}>
              {payment.status === "loading" ? "Sending payment…" : `Send ${s.amount} USD`}
            </button>
          </div>
          <PaymentView p={payment} answer={answer.value} />
          {liar && payment.status === "ok" ? <ChallengePanel s={s} answer={answer.value} raw={raw.current} demo={demo} /> : null}
        </>
      ) : null}
    </section>
  );
}

function AnswerView({ a, liar, price }: { a: Loadable<VerifiedAnswer>; liar: boolean; price?: { txHash?: Hex } }) {
  if (a.status === "idle") return null;
  if (a.status === "loading") return <p className="loading">Paying the server, then reading its reservation back from the chain…</p>;
  if (a.status === "error")
    return (
      <ErrorBox
        error={a.error}
        title={a.error.code === "backend" ? "Could not buy the answer" : "Answer not shown — it did not check out on chain"}
      />
    );
  const v = a.value;
  const d = v.token.decimals;
  const q = v.response.question;
  return (
    <div className={`result ${liar ? "bad" : "ok"}`} data-testid="answer">
      <span className="role-tag">Payment check complete</span>
      <span className="big">{liar ? "500 USD protection reserved" : "Recipient check passed"}</span>
      <span>{liar ? "If this check is proven wrong, you can claim the provider's 500 USD bond." : `The check expects the recipient to receive ${signed(v.receiverDelta, d)}.`}</span>
      <span>
        Provider bond reserved: <b className="num">{money(v.reserved.coverage, d)}</b> · <TxLink hash={v.response.reserveTx}>on-chain receipt</TxLink>
      </span>
      {price?.txHash ? (
        <span className="sub">
          Paid for the answer over MPP: <TxLink hash={price.txHash} />
        </span>
      ) : null}
      <details>
        <summary>Technical check details</summary>
        <ul className="checks">
          <li>
            <code>Reserved</code> event in that tx, from Sworn <AddrLink address={v.response.sworn} />, server{" "}
            <AddrLink address={v.response.server} />
          </li>
          <li>its digest = EIP-712 digest of this exact question + answer (computed here and by the contract)</li>
          <li>it pays this agent ({short(v.reserved.client)}) if the answer is proven wrong</li>
          <li>
            block {q.blockNumber.toString()} by hash <code>{short(q.blockHash, 6)}</code>
          </li>
          <li>guest vkey matches the contract's GUEST_VKEY</li>
          <li>
            fee charged {money(v.response.answer.feeCharged, d)} · gas {v.response.answer.gasUsed.toString()} · success{" "}
            {String(v.response.answer.success)}
          </li>
        </ul>
      </details>
    </div>
  );
}

function PaymentView({ p, answer }: { p: Loadable<PaymentOutcome>; answer: VerifiedAnswer }) {
  if (p.status === "idle") return null;
  if (p.status === "loading") return <p className="loading">Sending, then reading where the money went…</p>;
  if (p.status === "error") return <ErrorBox error={p.error} />;
  const v = p.value;
  const d = v.decimals;
  const credited = v.receiverBalance.after - v.receiverBalance.before;
  const diverted = v.diverted > 0n;
  return (
    <div className={`result ${diverted ? "bad" : "ok"}`} data-testid="payment">
      <span className="role-tag">Payment result</span>
      <span className="big" data-testid="tx-status">
        {v.success ? (diverted ? "Sent — but not delivered" : "Payment delivered") : "Payment did not send"}
      </span>
      <span className="sub">The chain accepted the transfer. <TxLink hash={v.txHash}>View receipt</TxLink></span>
      <div className="contrast" data-testid="contrast">
        <div>
          <span className="sub">Recipient received</span>
          <span className="huge">{signed(credited, d)}</span>
        </div>
        <div>
          <span className="sub">Held in guard</span>
          <span className="huge">{signed(v.guardBalance.after - v.guardBalance.before, d)}</span>
        </div>
      </div>
      {diverted ? (
        <span><b>You may now prove the payment check was wrong and claim its reserved protection.</b></span>
      ) : null}
      <details><summary>Technical payment details</summary><span className="sub">Block {v.blockNumber.toString()} · check claimed {signed(answer.receiverDelta, d)} at block {answer.response.question.blockNumber.toString()} · diverted amount {money(v.diverted, d)} to <AddrLink address={RECEIVE_POLICY_GUARD} label="ReceivePolicyGuard" />.</span></details>
    </div>
  );
}

// -------------------------------------------------------------------------------------------
// Challenge: real elapsed time from the backend's job clock. A recorded run is offered only
// as a separate, labelled panel.
// -------------------------------------------------------------------------------------------

const PHASES: { id: ChallengeJob["phase"]; label: string }[] = [
  { id: "witness", label: "Witness for block N (the agent's SDK captured it when the answer was reserved)" },
  { id: "proving", label: "Proving: tempo-revm in SP1, then Groth16" },
  { id: "submitting", label: "Submitting the proof to Sworn on Tempo" },
  { id: "done", label: "Paid out" },
];

function ChallengePanel({ s, answer, raw, demo }: { s: Scenario; answer: VerifiedAnswer; raw: unknown; demo: DemoConfig }) {
  const { client, cfg } = useChain();
  const [job, setJob] = useState<Loadable<ChallengeJob>>({ status: "idle" });
  const [slash, setSlash] = useState<Loadable<SlashOutcome>>({ status: "idle" });
  const [tick, setTick] = useState(Date.now());
  const skew = useRef(0);
  const N = answer.response.question.blockNumber.toString();

  const start = () =>
    void load(async () => {
      const j = await api.challenge(s.id, raw).catch((e) => Promise.reject(backendErr(e)));
      skew.current = j.now - Date.now();
      return j;
    }, setJob);

  const jobId = job.status === "ok" ? job.value.id : null;
  const phase = job.status === "ok" ? job.value.phase : null;
  useEffect(() => {
    if (!jobId || phase === "done" || phase === "failed") return;
    const t = setInterval(() => {
      setTick(Date.now());
      api.job(jobId).then(
        (j) => {
          skew.current = j.now - Date.now();
          setJob({ status: "ok", value: j, readAt: Date.now() });
        },
        (e) => setJob({ status: "error", error: backendErr(e) }),
      );
    }, 1000);
    return () => clearInterval(t);
  }, [jobId, phase]);

  const txHash = job.status === "ok" ? job.value.txHash : undefined;
  useEffect(() => {
    if (txHash) void load(() => readSlash(client, cfg, { txHash, digest: answer.response.digest }), setSlash);
  }, [txHash, client, cfg, answer.response.digest]);

  return (
    <div className="card" style={{ background: "var(--surface-2)" }} data-testid="challenge">
      <span className="role-tag">Claim protection</span>
      <div className="row">
        <button className="btn" onClick={start} disabled={job.status === "loading" || (job.status === "ok" && job.value.phase !== "failed")}>
          Prove the check was wrong
        </button>
        <span className="sub">Sworn re-runs the recorded execution and pays only if the check is proven wrong.</span>
      </div>
      {job.status === "error" ? <ErrorBox error={job.error} title="Challenge could not start" /> : null}
      {job.status === "ok" ? <JobView job={job.value} N={N} now={tick + skew.current} /> : null}
      {slash.status === "loading" ? <p className="loading">Reading the payout from the chain…</p> : null}
      {slash.status === "error" ? <ErrorBox error={slash.error} /> : null}
      {slash.status === "ok" ? (
        <div className="result ok" data-testid="payout">
          <span className="big">✓ {money(slash.value.coverage, slash.value.decimals)} paid from the provider's bond</span>
          <span>
            Agent balance <span className="num">{money(slash.value.clientBalance.before, slash.value.decimals)}</span> →{" "}
            <b className="num">{money(slash.value.clientBalance.after, slash.value.decimals)}</b> at block{" "}
            {slash.value.blockNumber.toString()} · <TxLink hash={slash.value.txHash}>payout tx</TxLink>
          </span>
        </div>
      ) : null}
      {demo.recording.available ? <RecordedRun /> : null}
    </div>
  );
}

function JobView({ job, N, now }: { job: ChallengeJob; N: string; now: number }) {
  const end = job.phaseStartedAt.done ?? job.phaseStartedAt.failed ?? now;
  const proveStart = job.phaseStartedAt.proving;
  const idx = PHASES.findIndex((p) => p.id === job.phase);
  return (
    <div className="progress" aria-live="polite">
      <p style={{ margin: 0 }}>
        Re-running Tempo's own EVM inside a zero-knowledge proof, against block <b className="num">{N}</b>'s hash.
      </p>
      <div className="row">
        <span className="timer" data-testid="elapsed">
          {elapsed(end - job.startedAt)}
        </span>
        <span className="sub">
          real elapsed time
          {proveStart ? ` · proving ${elapsed((job.phaseStartedAt.submitting ?? end) - proveStart)}` : ""} · a local proof takes several
          minutes (6–9 measured on this machine)
        </span>
      </div>
      <div className={`bar${job.phase === "done" || job.phase === "failed" ? "" : " indeterminate"}`}>
        <span style={job.phase === "done" ? { width: "100%" } : undefined} />
      </div>
      <ol className="phases">
        {PHASES.map((p, i) => (
          <li key={p.id} className={job.phase === "failed" ? "later" : i < idx || job.phase === "done" ? "done" : i === idx ? "now" : "later"}>
            <span className="dot">{i < idx || job.phase === "done" ? "✓" : i === idx ? "●" : "○"}</span>
            {p.label}
          </li>
        ))}
      </ol>
      {job.phase === "failed" ? <ErrorBox error={new Error(job.error ?? "failed")} title="Challenge failed" /> : null}
      {job.log.length ? (
        <details>
          <summary>Prover log ({job.log.length} lines)</summary>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {job.log.slice(-40).join("\n")}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

const SPEED = 30;

function RecordedRun() {
  const [rec, setRec] = useState<Loadable<Recording>>({ status: "idle" });
  const [t0, setT0] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (t0 === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [t0]);
  const play = () =>
    void load(api.recording, setRec).then((r) => {
      if (r.status === "ok") {
        setT0(Date.now());
        setNow(Date.now());
      }
    });
  if (rec.status !== "ok" || t0 === null)
    return (
      <div className="row">
        <button className="btn ghost" onClick={play}>
          Watch a recorded proving run, fast-forwarded {SPEED}×
        </button>
        {rec.status === "error" ? <ErrorBox error={rec.error} /> : null}
      </div>
    );
  const total = rec.value.steps.reduce((a, s) => a + s.seconds, 0);
  const sim = Math.min(total, ((now - t0) / 1000) * SPEED);
  let acc = 0;
  return (
    <div className="recorded" data-testid="recorded">
      <span className="label">
        Recorded run · fast-forward {SPEED}× · not this challenge
      </span>
      <span className="sub">
        Measured durations from <code>{rec.value.source}</code>
        {rec.value.cycles ? ` · ${rec.value.cycles.toLocaleString()} zkVM cycles` : ""}. Real total {total.toFixed(1)} s.
      </span>
      <div className="bar">
        <span style={{ width: `${(sim / total) * 100}%` }} />
      </div>
      <ol className="phases">
        {rec.value.steps.map((s) => {
          const start = acc;
          acc += s.seconds;
          const cls = sim >= acc ? "done" : sim >= start ? "now" : "later";
          return (
            <li key={s.label} className={cls}>
              <span className="dot">{cls === "done" ? "✓" : cls === "now" ? "●" : "○"}</span>
              {s.label} — <span className="num">{s.seconds.toFixed(1)} s</span>
            </li>
          );
        })}
      </ol>
      <span className="sub num">
        recorded clock {elapsed(sim * 1000)} / {elapsed(total * 1000)}
      </span>
    </div>
  );
}
