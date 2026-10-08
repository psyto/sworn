import { short } from "../chain/format.ts";
import type { Loadable } from "../chain/loadable.ts";
import { OWN_ZONE, type OwnZoneRead, type OwnZoneVerifyNow } from "../chain/ownZone.ts";
import { AddrLink, ErrorBox, TxLink } from "./common.tsx";

const REPO = "https://github.com/psyto/sworn";
const SPEC = `${REPO}/blob/main/docs/specs/003-zone-verifier.md`;
const PATH_USD = "0x20C0000000000000000000000000000000000000";

/** 1000000 base units = 1 pathUSD (6 decimals). */
const usd = (v: bigint) => `${(Number(v) / 1e6).toFixed(1)} pathUSD`;

const clock = (ms: number) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

interface Props {
  ownZone: Loadable<OwnZoneRead>;
  check: Loadable<OwnZoneVerifyNow>;
  onRetry: () => void;
  onVerify: () => void;
}

export function OwnZoneSection({ ownZone, check, onRetry, onVerify }: Props) {
  const busy = check.status === "loading";
  return (
    <section className="section" id="own-zone" aria-labelledby="own-zone-h">
      <div className="section-head">
        <p className="eyebrow">Our own Zone on Moderato · {OWN_ZONE.date}</p>
        <h2 id="own-zone-h">A portal that settles a batch, and so lets a withdrawal be paid, only after Sworn's proof passes</h2>
        <p className="lede">
          We ran our own Zone (zone {OWN_ZONE.zoneId}) on Moderato. Its portal calls <code>SwornZoneVerifier</code> in every{" "}
          <code>submitBatch</code>, so a batch settles, and its withdrawals can be paid, only after the Groth16 proof verifies.
          Three batches were proven and settled; then our sequencer called <code>processWithdrawals</code> and the withdrawal
          was paid. The proof is a necessary condition for a payout, not a guarantee of one. Your browser reads every value
          below from rpc.moderato.tempo.xyz.
        </p>
      </div>

      <div className="card zone-card" aria-live="polite">
        {ownZone.status === "ok" ? (
          <OwnZoneFacts z={ownZone.value} />
        ) : ownZone.status === "error" ? (
          <ErrorBox error={ownZone.error} onRetry={onRetry} />
        ) : (
          <p className="loading">
            <span className="pulse" aria-hidden /> Reading the portal, three settlement receipts and the payout…
          </p>
        )}
      </div>

      <div className="card zone-card again" aria-live="polite" aria-busy={busy}>
        <p className="eyebrow">Check the withdrawal batch's proof yourself, now</p>
        <p>
          Two live, read-only <code>eth_call</code>s to our Zone's verifier, with the exact call its portal made when the
          withdrawal batch settled. Nothing is signed or sent.
        </p>
        <button className="btn" onClick={onVerify} disabled={busy}>
          {busy ? "Calling…" : "Re-verify on chain"}
        </button>
        {check.status === "ok" ? (
          <>
            <ol className="calls">
              <li>
                <span className="label">The portal's verify call</span>
                <span className="result ok">✓ true</span>
                <span className="sub">
                  The same proof and batch fields that <TxLink hash={check.value.submitTx}>submitBatch {short(check.value.submitTx)}</TxLink>{" "}
                  carries verify against the deployed contract.
                </span>
              </li>
              <li>
                <span className="label">One field changed</span>
                <span className="result bad">✗ reverts {check.value.mutatedError}()</span>
                <span className="sub mono">nextZoneHeight {check.value.height.toString()} → {(check.value.height + 1n).toString()}</span>
              </li>
            </ol>
            <p className="readat">Called at {clock(check.value.readAt)} on the latest block.</p>
          </>
        ) : check.status === "error" ? (
          <ErrorBox error={check.error} onRetry={onVerify} />
        ) : (
          <p className="loading">
            <span className="pulse" aria-hidden /> {busy ? "Calling verify(…) on Moderato…" : "Waiting for the receipt reads…"}
          </p>
        )}
      </div>

      <div className="isnot">
        <div>
          <p className="eyebrow">What it shows</p>
          <ul>
            <li>On this Zone, settlement waits for the proof: no batch, and so no withdrawal, without a verified proof.</li>
            <li>
              The rejection side too: our own sequencer, with a valid signature, submitted a forged batch that replayed a real
              proof; the verifier rejected it and nothing changed.
            </li>
            <li>The Zone's parent is Moderato, and every batch is anchored to real Moderato blocks.</li>
            <li>
              The verifier pins this Zone's genesis and portal (
              <a href={SPEC} target="_blank" rel="noreferrer">
                spec 003, live-run results
              </a>
              ).
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">What it is not</p>
          <ul>
            <li>
              <b>Our own Zone, not a Tempo-created one.</b> Our portal is upstream <code>ZonePortal</code> with one change: the
              deployer, not Tempo's factory, may call <code>initialize</code> once. Tempo's own Zones are unchanged.
            </li>
            <li>
              <b>One operator.</b> Our single sequencer key also decrypts deposits. Withdrawals wait for the proof but are not
              censorship-resistant: the operator must prove and process them.
            </li>
            <li>
              <b>A one-off demonstration.</b> The Zone was stopped after the payout. Callback withdrawals bounce, because
              Moderato's messenger checks the factory.
            </li>
            <li>
              <b>Testnet, and not audited.</b>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function OwnZoneFacts({ z }: { z: OwnZoneRead }) {
  const p = z.payout;
  const paidToUser = p.to === OWN_ZONE.user && p.token === PATH_USD && p.amount === OWN_ZONE.userDelta;
  return (
    <>
      <p className="status ok">
        ✓ {z.batches.length} batches settled · withdrawal paid
      </p>
      <dl className="facts">
        <dt>Portal</dt>
        <dd>
          <AddrLink address={z.portal} label={short(z.portal, 6)} /> · zone {z.zoneId} · {z.withdrawalBatchIndex.toString()} batches
          settled · zone height {z.zoneHeight.toString()}
        </dd>
        <dt>Its verifier</dt>
        <dd>
          <AddrLink address={z.portalVerifier} label={short(z.portalVerifier, 6)} /> · SwornZoneVerifier · parent chain{" "}
          {z.parentChainId.toString()} · pinned zone {z.pinnedZoneId}
        </dd>
      </dl>

      <p className="eyebrow sub-head">Settled batches (each one called the verifier)</p>
      <ol className="calls">
        {z.batches.map((b) => (
          <li key={b.txHash}>
            <span className="label">Zone blocks {b.zoneBlocks}</span>
            <span>{b.content}</span>
            <span className="result ok">✓ settled</span>
            <span className="sub mono">
              <TxLink hash={b.txHash}>submitBatch {short(b.txHash)}</TxLink> · block {b.blockNumber.toString()} · anchor{" "}
              {b.anchorAge.toLocaleString("en-US")} of 8,190 blocks old
            </span>
          </li>
        ))}
      </ol>

      <p className="eyebrow sub-head">The payout</p>
      <dl className="facts">
        <dt>Tx</dt>
        <dd>
          <TxLink hash={p.txHash} /> · block {p.blockNumber.toString()}, after the last settled batch
        </dd>
        <dt>Event</dt>
        <dd className="mono">
          WithdrawalProcessed · to <AddrLink address={p.to} /> · {usd(p.amount)}
          {paidToUser ? (
            <span className="ok check-line">✓ the demo user's 0.5 pathUSD withdrawal</span>
          ) : (
            <span className="bad-text check-line">✗ does not match the recorded withdrawal</span>
          )}
        </dd>
      </dl>

      <p className="eyebrow sub-head">A forged batch, rejected by the proof</p>
      <ol className="calls">
        <li>
          <span className="label">Forged batch 62</span>
          <span>sequencer-signed; made-up withdrawal queue; the real proof of blocks 56-61 replayed</span>
          <span className="result bad">✗ rejected</span>
          <span className="sub mono">
            <TxLink hash={z.forged.txHash}>submitBatch {short(z.forged.txHash)}</TxLink> · block {z.forged.blockNumber.toString()} ·
            status 0 · the trace shows SwornZoneVerifier reverting InvalidProof() · zone height still {z.zoneHeight.toString()}
          </span>
        </li>
      </ol>
    </>
  );
}
