import { short } from "../chain/format.ts";
import type { Loadable } from "../chain/loadable.ts";
import { OWN_ZONE, type OwnZoneRead } from "../chain/ownZone.ts";
import { AddrLink, ErrorBox, TxLink } from "./common.tsx";

const REPO = "https://github.com/psyto/sworn";
const SPEC = `${REPO}/blob/main/docs/specs/003-zone-verifier.md`;
const PATH_USD = "0x20C0000000000000000000000000000000000000";

/** 1000000 base units = 1 pathUSD (6 decimals). */
const usd = (v: bigint) => `${(Number(v) / 1e6).toFixed(1)} pathUSD`;

export function OwnZoneSection({ ownZone, onRetry }: { ownZone: Loadable<OwnZoneRead>; onRetry: () => void }) {
  return (
    <section className="section" id="own-zone" aria-labelledby="own-zone-h">
      <div className="section-head">
        <p className="eyebrow">Our own Zone on Moderato · {OWN_ZONE.date}</p>
        <h2 id="own-zone-h">A portal that pays a withdrawal only after Sworn's proof passes</h2>
        <p className="lede">
          We ran our own Zone (zone {OWN_ZONE.zoneId}) on Moderato. Its portal calls <code>SwornZoneVerifier</code> in every{" "}
          <code>submitBatch</code>, so a batch settles, and its withdrawals can be paid, only after the Groth16 proof verifies.
          Three batches were proven and settled, then the withdrawal was paid. Your browser reads every value below from
          rpc.moderato.tempo.xyz.
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

      <div className="isnot">
        <div>
          <p className="eyebrow">What it shows</p>
          <ul>
            <li>On this Zone, settlement waits for the proof: no batch, and so no withdrawal, without a verified proof.</li>
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
    </>
  );
}
