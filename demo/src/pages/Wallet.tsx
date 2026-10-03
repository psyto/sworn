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
      <main className="page">
        <section className="hero">
          <h1>On MPP, if a paid answer is wrong, a refund is the server's choice.</h1>
          <p>
            Sworn makes the server lock its own money behind each answer — and pays you from it when a zero-knowledge
            proof shows the answer was wrong. Below, a treasury agent asks before paying.
          </p>
        </section>
        {demo.status === "loading" || demo.status === "idle" ? <p className="loading">Connecting to the local demo backend…</p> : null}
        {demo.status === "error" ? <ErrorBox error={demo.error} title="Demo backend unavailable" /> : null}
        {demo.status === "ok" ? <Flow demo={demo.value} /> : null}
        <HowItWorks />
        <p className="footer">
          Every number on this page is read from the chain, or from a server answer whose reservation was read back from the
          chain. Testnet only · unaudited.
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
      {demo.agent ? <AgentBalance agent={demo.agent} token={demo.token} /> : null}
      {honest ? <ScenarioCard step={1} demo={demo} s={honest} /> : <Missing what="DEMO_RECEIVER (R)" />}
      {liar ? <ScenarioCard step={2} demo={demo} s={liar} /> : <Missing what="DEMO_RECEIVER_BLOCKED (R′)" />}
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
          demo: this server is configured to lie
        </div>
      ) : null}
      <div className="card-head">
        <span className="step-no">Step {step}</span>
        <span className={`badge ${liar ? "liar" : "honest"}`}>{liar ? "dishonest-demo server" : "honest server"}</span>
      </div>
      <h2 className="question" id={`q-${s.id}`}>
        Pay {s.amount} USD to {liar ? "R′" : "R"} <AddrLink address={s.receiver} />?
      </h2>
      {liar ? (
        <p className="sub" style={{ margin: 0 }}>
          R′ has a receive policy that blocks this sender. Tempo does not reject such a transfer — it moves the money to{" "}
          <code>ReceivePolicyGuard</code>.
        </p>
      ) : null}

      <div className="row">
        <button className="btn" onClick={buy} disabled={answer.status === "loading"}>
          {answer.status === "loading" ? "Buying preflight…" : "Buy preflight"}
        </button>
        <span className="sub">
          from <span className="mono">{s.serverUrl || "(server URL unset)"}</span>, paid over MPP
        </span>
      </div>

      <AnswerView a={answer} liar={liar} price={paymentPrice} />

      {answer.status === "ok" ? (
        <>
          <div className="row">
            <button className="btn secondary" onClick={pay} disabled={payment.status === "loading"}>
              {payment.status === "loading" ? "Sending…" : `Send ${s.amount} to ${liar ? "R′" : "R"}`}
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
      <span className="sub">
        As of block <b className="num">{q.blockNumber.toString()}</b>
        {liar ? " · the server claims" : ""}:
      </span>
      <span className="big">
        receiver {signed(v.receiverDelta, d)}
        {liar ? " (claimed)" : ""}
      </span>
      <span>
        Reserved <b className="num">{money(v.reserved.coverage, d)}</b> from the server's bond ·{" "}
        <TxLink hash={v.response.reserveTx}>reserve tx</TxLink> · status <b>{v.status}</b>
      </span>
      {price?.txHash ? (
        <span className="sub">
          Paid for the answer over MPP: <TxLink hash={price.txHash} />
        </span>
      ) : null}
      <details>
        <summary>What was checked on chain</summary>
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
      <span className="sub">
        On chain, block <b className="num">{v.blockNumber.toString()}</b> · <TxLink hash={v.txHash}>payment tx</TxLink>
      </span>
      <span className="big">receiver {signed(credited, d)}</span>
      {diverted ? (
        <span>
          <b className="num">{money(v.diverted, d)}</b> went to <AddrLink address={RECEIVE_POLICY_GUARD} label="ReceivePolicyGuard" />
          {v.blockedByPolicy ? " (TransferBlocked: the receiver's policy)" : ""}.
        </span>
      ) : null}
      {credited !== answer.receiverDelta ? (
        <span className="sub">
          The answer said {signed(answer.receiverDelta, d)} as of block {answer.response.question.blockNumber.toString()}. Whether it
          was wrong <i>about that block</i> is for the proof to decide — not this page.
        </span>
      ) : null}
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
      <div className="row">
        <button className="btn" onClick={start} disabled={job.status === "loading" || (job.status === "ok" && job.value.phase !== "failed")}>
          Challenge the answer
        </button>
        <span className="sub">Anyone may do this; the agent does it itself.</span>
      </div>
      {job.status === "error" ? <ErrorBox error={job.error} title="Challenge could not start" /> : null}
      {job.status === "ok" ? <JobView job={job.value} N={N} now={tick + skew.current} /> : null}
      {slash.status === "loading" ? <p className="loading">Reading the payout from the chain…</p> : null}
      {slash.status === "error" ? <ErrorBox error={slash.error} /> : null}
      {slash.status === "ok" ? (
        <div className="result ok" data-testid="payout">
          <span className="big">You were paid {money(slash.value.coverage, slash.value.decimals)} from the server's bond</span>
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
          {proveStart ? ` · proving ${elapsed((job.phaseStartedAt.submitting ?? end) - proveStart)}` : ""} · a local proof takes about 6–7
          minutes
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
