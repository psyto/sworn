import { blockUrl, MODERATO, RECEIVE_POLICY_GUARD, TAKES, type Take } from "../chain/config.ts";
import { money, short, signed } from "../chain/format.ts";
import type { Loadable } from "../chain/loadable.ts";
import type { Timeline as T } from "../chain/timeline.ts";
import { AddrLink, ErrorBox, TxLink, utc } from "./common.tsx";

interface Props {
  take: Take;
  state: Loadable<T>;
  onPick: (t: Take) => void;
  onVerify: () => void;
}

export function TimelineSection({ take, state, onPick, onVerify }: Props) {
  const busy = state.status === "loading";
  return (
    <section className="section" id="slashes" aria-labelledby="happened">
      <div className="section-head">
        <p className="eyebrow">Read live from chain</p>
        <h2 id="happened">The same engine, on Tempo's EVM: three slashes</h2>
        <p className="lede">
          A server sold a paid answer about a TIP-20 transfer and reserved part of its bond behind it. The answer was wrong, and
          a Groth16 proof of tempo-revm, Tempo's own EVM, sent that bond to the paying agent. It has happened three times on Moderato;
          every number below is read by your browser.
        </p>
      </div>
      <p className="note">
        <b>An honest note.</b> Anyone can check this demo's question with <code>eth_simulateV1</code> on a Tempo RPC. That is
        why it makes a good demo: you can see the server lied without trusting us. What it shows is the engine behind the slash,
        not a product.
      </p>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Which slash">
          {TAKES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === take.id}
              className={t.id === take.id ? "on" : ""}
              onClick={() => onPick(t)}
              disabled={busy}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onVerify} disabled={busy}>
          {busy ? "Reading…" : "Verify again"}
        </button>
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {state.status === "loading" || state.status === "idle" ? (
          <div className="card loading">
            <span className="pulse" aria-hidden /> Reading three transactions and six balances from rpc.moderato.tempo.xyz…
          </div>
        ) : state.status === "error" ? (
          <ErrorBox error={state.error} onRetry={onVerify} />
        ) : (
          <Steps t={state.value} readAt={state.readAt} />
        )}
      </div>
    </section>
  );
}

function Steps({ t, readAt }: { t: T; readAt: number }) {
  const { reservation: r, payment: p, slash: s, paymentToken: pt, bondTokenMeta: bt } = t;
  const receiverDelta = p.receiverAfter - p.receiverBefore;
  const guardDelta = p.guardAfter - p.guardBefore;
  const clientDelta = s.clientAfter - s.clientBefore;
  return (
    <>
      <ol className="timeline">
        <li className="step liar">
          <div className="step-meta">
            <span className="step-no">01 · Reserve</span>
            <span className="role-tag">Preflight provider</span>
            <span className="badge liar">demo: configured to lie</span>
          </div>
          <h3>
            Provider answers <span className="claim">“receiver {signed(r.claimedDelta, pt.decimals)}”</span> and reserves{" "}
            {money(r.coverage, bt.decimals)} of its bond behind it
          </h3>
          <p className="q">
            The agent asked: if <AddrLink address={r.payer} /> sends {money(r.amount, pt.decimals)} {pt.symbol} to{" "}
            <AddrLink address={r.receiver} />, what is the receiver credited, as of block{" "}
            <a className="mono" href={blockUrl(MODERATO, r.aboutBlock)} target="_blank" rel="noreferrer">
              {r.aboutBlock.toString()}
            </a>
            ?
          </p>
          <dl className="facts">
            <dt>Event</dt>
            <dd className="mono">
              Reserved(server <AddrLink address={r.server} />, client <AddrLink address={r.client} />, coverage{" "}
              {money(r.coverage, bt.decimals)} {bt.symbol})
            </dd>
            <dt>Block</dt>
            <dd className="mono">
              {r.blockNumber.toString()} · {utc(r.timestamp)}
            </dd>
          </dl>
          <TxLink hash={r.txHash} />
        </li>

        <li className="step">
          <div className="step-meta">
            <span className="step-no">02 · Pay</span>
            <span className="role-tag">Paying agent</span>
          </div>
          <h3>
            The agent sends {money(r.amount, pt.decimals)} {pt.symbol} to the receiver
          </h3>
          <p className={`status ${p.success ? "ok" : "bad"}`}>{p.success ? "✓ transaction succeeded" : "✗ transaction reverted"}</p>
          <div className="contrast" role="group" aria-label="Where the money went">
            <div className={receiverDelta === 0n ? "bad" : ""}>
              <span className="label">receiver</span>
              <span className="huge">{signed(receiverDelta, pt.decimals)}</span>
              <span className="mono sub">
                <AddrLink address={r.receiver} />
              </span>
            </div>
            <div>
              <span className="label">ReceivePolicyGuard</span>
              <span className="huge">{signed(guardDelta, pt.decimals)}</span>
              <span className="mono sub">
                <AddrLink address={RECEIVE_POLICY_GUARD} />
              </span>
            </div>
          </div>
          <p className="sub">
            Balances of {pt.symbol} read at block {(p.blockNumber - 1n).toString()} and {p.blockNumber.toString()}.{" "}
            {p.blockedByPolicy && "The receiver's policy blocks this sender, so Tempo holds the money in its guard (TransferBlocked). "}
            Succeeded is not the same as paid.
          </p>
          <dl className="facts">
            <dt>Block</dt>
            <dd className="mono">
              {p.blockNumber.toString()} · {utc(p.timestamp)}
            </dd>
          </dl>
          <TxLink hash={p.txHash} />
        </li>

        <li className="step">
          <div className="step-meta">
            <span className="step-no">03 · Prove</span>
            <span className="role-tag">Challenger</span>
          </div>
          <h3>A challenger proves the answer wrong with a Groth16 proof</h3>
          <p>
            <AddrLink address={s.challenger} /> re-ran the asked transfer with Tempo's own EVM inside SP1, on block{" "}
            {r.aboutBlock.toString()}'s state, and sent the proof. Sworn.sol verified it on Tempo against that block's hash.
          </p>
          <dl className="facts">
            <dt>Block</dt>
            <dd className="mono">
              {s.blockNumber.toString()} · {utc(s.timestamp)}
            </dd>
          </dl>
          <TxLink hash={s.txHash} />
        </li>

        <li className="step paid">
          <div className="step-meta">
            <span className="step-no">04 · Paid</span>
            <span className="role-tag">Paying agent</span>
          </div>
          <h3>Slashed: the provider's bond pays the agent</h3>
          <div className="payout">
            <span className="label">agent</span>
            <span className="huge">
              {signed(clientDelta, bt.decimals)} <span className="unit">{bt.symbol}</span>
            </span>
          </div>
          <dl className="facts">
            <dt>Event</dt>
            <dd className="mono">
              Slashed(server <AddrLink address={s.server} />, client <AddrLink address={s.client} />, coverage{" "}
              {money(s.coverage, bt.decimals)})
            </dd>
            <dt>Agent balance</dt>
            <dd className="mono">
              {money(s.clientBefore, bt.decimals)} → {money(s.clientAfter, bt.decimals)} (block {(s.blockNumber - 1n).toString()} →{" "}
              {s.blockNumber.toString()})
            </dd>
          </dl>
          <TxLink hash={s.txHash} />
        </li>
      </ol>
      <p className="readat">
        Read at {new Date(readAt).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")} from rpc.moderato.tempo.xyz · Sworn{" "}
        <AddrLink address={MODERATO.sworn} label={short(MODERATO.sworn)} />. The proof covers the answer about block{" "}
        {r.aboutBlock.toString()}; the later payment shows what that answer missed.
      </p>
    </>
  );
}
