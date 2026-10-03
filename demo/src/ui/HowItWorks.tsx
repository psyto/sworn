import { readSwornParams } from "../chain/reads.ts";
import { AddrLink, ErrorBox, useChain, useRead } from "./common.tsx";

export function HowItWorks() {
  const { client, cfg } = useChain();
  const params = useRead(() => readSwornParams(client, cfg), [client, cfg]);
  return (
    <section className="card how" aria-labelledby="how-h">
      <h2 id="how-h" style={{ fontSize: 17 }}>
        How it works
      </h2>
      <ol>
        <li>
          <b>1 · Ask before you pay</b>
          Your agent buys an answer: “if I sent this payment now, how much would the receiver actually get?”
        </li>
        <li>
          <b>2 · The server stakes its own money</b>
          The answering server locks part of its deposit behind that exact answer, on-chain, before you rely on it.
        </li>
        <li>
          <b>3 · Wrong answers pay you</b>
          If the answer was wrong, anyone can prove it — and the locked deposit goes to you. No judge, no owner.
        </li>
      </ol>
      <details>
        <summary>Technical detail</summary>
        <dl>
          <dt>The answer</dt>
          <dd>
            About one TIP-20 <code>transfer</code> as the first transaction on the state after block N, with N's
            block environment and fees on. Not a promise that a later payment lands.
          </dd>
          <dt>Reservation</dt>
          <dd>
            The server calls <code>reserve(question, answer, client, coverage)</code>; the contract computes the
            EIP-712 digest itself, keys it per server, and pins N's block hash (N must be within{" "}
            {params.status === "ok" ? <b className="num">{params.value.maxAge.toString()}</b> : "…"} blocks).
          </dd>
          <dt>Proof</dt>
          <dd>
            Tempo's own EVM (<code>tempo-revm</code>) runs inside an SP1 zkVM guest over state MPT-verified against
            N's state root, bound to N's block hash. The challenger proves the true answer locally.
          </dd>
          <dt>Settlement</dt>
          <dd>
            A Groth16 proof is verified on Tempo by SP1's verifier
            {params.status === "ok" ? (
              <>
                {" "}
                (<AddrLink address={params.value.verifier} />)
              </>
            ) : null}
            ; if any field of the proven answer differs, the reserved coverage is paid to the client. Challenge window:{" "}
            {params.status === "ok" ? <b className="num">{(Number(params.value.challengePeriod) / 3600).toString()} h</b> : "…"}.
          </dd>
          <dt>Guest</dt>
          <dd>
            {params.status === "ok" ? (
              <>
                vkey <code>{params.value.guestVkey}</code>
              </>
            ) : (
              "…"
            )}
          </dd>
          <dt>Contract</dt>
          <dd>
            <AddrLink address={cfg.sworn} /> — no owner, no admin, no upgrade.
          </dd>
        </dl>
        {params.status === "error" ? <ErrorBox error={params.error} title="Could not read the Sworn contract" /> : null}
      </details>
    </section>
  );
}
