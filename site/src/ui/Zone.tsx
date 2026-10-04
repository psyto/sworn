import { MODERATO, addressUrl } from "../chain/config.ts";
import { short } from "../chain/format.ts";
import type { Loadable } from "../chain/loadable.ts";
import { FIXTURE, type VerifyNow, type ZoneAttest } from "../chain/zone.ts";
import { AddrLink, ErrorBox, TxLink, utc } from "./common.tsx";
import { Pipeline, type PipeNode } from "./ProofDiagram.tsx";
import deployments from "../../../deployments/moderato.json";

const PROVING = deployments.SwornZoneVerifier.attest.proving;

const ZONE_NODES: PipeNode[] = [
  { title: "Zone batch verifier", sub: ["Tempo's own code", "prove_zone_batch"] },
  { title: "SP1 zkVM", sub: ["runs it, proves", "the run"] },
  { title: "Groth16", sub: ["succinct proof", "made locally"] },
  { title: "SwornZoneVerifier", sub: ["on Moderato", "IVerifier's signature"], tempo: true },
];

const REPO = "https://github.com/psyto/sworn";
const SPEC = `${REPO}/blob/main/docs/specs/003-zone-verifier.md`;

interface Props {
  attest: Loadable<ZoneAttest>;
  check: Loadable<VerifyNow>;
  onRetry: () => void;
  onVerify: () => void;
}

const Ok = ({ on, children }: { on: boolean; children: string }) =>
  on ? <span className="ok check-line">✓ {children}</span> : <span className="bad-text check-line">✗ does not match</span>;

export function ZoneSection({ attest, check, onRetry, onVerify }: Props) {
  const busy = check.status === "loading";
  return (
    <section className="section" id="zone" aria-labelledby="zone-h">
      <div className="section-head">
        <p className="eyebrow">Read live from chain</p>
        <h2 id="zone-h">A Tempo Zone batch, verified on Tempo</h2>
        <p className="lede">
          Tempo's own Zone batch verifier ran inside SP1 on a real batch. A contract on Moderato with the exact signature of
          Tempo's <code>IVerifier</code> checked the Groth16 proof and emitted <code>ZoneBatchVerified</code>. Your browser reads
          all of it below from rpc.moderato.tempo.xyz, and can check the proof again.
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
          zkVM. The proof of this batch took {(PROVING.cycles / 1e6).toFixed(1)}M cycles and {Math.round(PROVING.groth16WallSecs)} s to make locally. The heavy edge is on Tempo.
        </figcaption>
      </figure>

      <div className="zone-grid">
        <div className="card zone-card" aria-live="polite">
          <p className="eyebrow">The attest transaction</p>
          {attest.status === "ok" ? (
            <AttestFacts z={attest.value} />
          ) : attest.status === "error" ? (
            <ErrorBox error={attest.error} onRetry={onRetry} />
          ) : (
            <p className="loading">
              <span className="pulse" aria-hidden /> Reading the attest receipt, its event and the contract…
            </p>
          )}
        </div>

        <div className="card zone-card again" aria-live="polite" aria-busy={busy}>
          <p className="eyebrow">Check it yourself, now</p>
          <p>
            Two read-only <code>eth_call</code>s of <code>verify(…)</code> on the deployed contract, with the same{" "}
            {FIXTURE.proofBytes}-byte proof the attest transaction sent. Nothing is signed or sent.
          </p>
          <button className="btn" onClick={onVerify} disabled={busy}>
            {busy ? "Calling…" : "Verify again"}
          </button>
          {check.status === "ok" ? (
            <ol className="calls">
              <li>
                <span className="label">the real batch</span>
                <code>verify(zone 1, height {FIXTURE.nextZoneHeight.toString()}, …, proof)</code>
                <span className="result ok">✓ true</span>
              </li>
              <li>
                <span className="label">change one field</span>
                <code>verify(zone 1, height {check.value.mutatedHeight.toString()}, …, proof)</code>
                <span className="result bad">✗ reverts {check.value.mutatedError}()</span>
                <span className="sub">Change one field and the proof no longer fits.</span>
              </li>
            </ol>
          ) : check.status === "error" ? (
            <ErrorBox error={check.error} onRetry={onVerify} />
          ) : (
            <p className="loading">
              <span className="pulse" aria-hidden /> {check.status === "loading" ? "Calling verify(…) on Moderato…" : "Waiting for the receipt read…"}
            </p>
          )}
          {check.status === "ok" && (
            <p className="readat">Called at {new Date(check.value.readAt).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")} on the latest block.</p>
          )}
        </div>
      </div>

      <div className="isnot">
        <div>
          <p className="eyebrow">What it is</p>
          <ul>
            <li>Tempo Zones' own batch verifier, executed inside SP1.</li>
            <li>A digest bound to everything a Nitro attestation commits, plus the destination chain and the exact genesis artifact.</li>
            <li>
              Verified on chain by a contract with <code>IVerifier</code>'s exact signature (
              <a href={SPEC} target="_blank" rel="noreferrer">
                spec 003
              </a>
              ).
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">What it is not, yet</p>
          <ul>
            <li>
              <b>The batch is not from Moderato.</b> It is <code>hardfork_t13_recovery</code> from Tempo's zones integration
              tests, on a dev chain (1337), with no withdrawals. A second batch from the same tests, with one withdrawal and two
              user transactions, was verified the same way (<a href="https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770">tx</a>); that shows a withdrawal inside a
              proven batch, not that withdrawals are secured.
            </li>
            <li>
              <b>No Zone settles with it.</b> Tempo's factory fixes each Zone's verifier when the Zone is created, so only Tempo
              can adopt it.
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
    </section>
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
          <AddrLink address={MODERATO.zoneVerifier} label={short(MODERATO.zoneVerifier, 6)} /> · sent by <AddrLink address={z.from} />
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
          <Ok on={z.calldataMatchesFixture}>the attest call's arguments and proof are the ones "Verify again" uses</Ok>
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
