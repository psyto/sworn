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

const Ok = ({ on, children }: { on: boolean; children: string }) =>
  on ? <span className="ok check-line">✓ {children}</span> : <span className="bad-text check-line">✗ does not match</span>;

const clock = (ms: number) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
const H0 = short(MALFORMED.hash, 2);

export function ZoneSection({ attest, also, check, onRetry, onVerify }: Props) {
  const busy = check.status === "loading";
  const stubTrue = check.status === "ok" && check.value.preT13.result === "true";
  return (
    <section className="section" id="zone" aria-labelledby="zone-h">
      <div className="section-head">
        <p className="eyebrow">Read live from chain</p>
        <h2 id="zone-h">A Tempo Zone batch with a withdrawal, verified on Moderato</h2>
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
          zkVM. The proof of this batch took {(PROVING.cycles / 1e6).toFixed(1)}M cycles and {Math.round(PROVING.groth16WallSecs)} s to make locally. The heavy edge is on Tempo.
        </figcaption>
      </figure>

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
            Three read-only <code>eth_call</code>s. The first two call Sworn's deployed contract with the same{" "}
            {FIXTURE.proofBytes}-byte proof the attest transaction sent; the third calls Moderato's own Zone verifier, for
            comparison. Nothing is signed or sent.
          </p>
          <button className="btn" onClick={onVerify} disabled={busy}>
            {busy ? "Calling…" : "Verify again"}
          </button>
          {check.status === "ok" ? (
            <>
              <ol className="calls">
                <li className="row-real">
                  <span className="label">Sworn · the real withdrawal batch</span>
                  <code>
                    verify(zone {FIXTURE.zoneId}, height {FIXTURE.nextZoneHeight.toString()}, …, withdrawalQueueHash{" "}
                    {short(FIXTURE.withdrawalQueueHash)}, …, proof)
                  </code>
                  <span className="result ok">✓ true</span>
                </li>
                <li className="row-mutated">
                  <span className="label">Sworn · one field changed</span>
                  <code>verify(zone {FIXTURE.zoneId}, height {check.value.mutatedHeight.toString()}, …, proof)</code>
                  <span className="result bad">✗ reverts {check.value.mutatedError}()</span>
                  <span className="sub">Change one field and the proof no longer fits.</span>
                </li>
                <li className="row-stub">
                  <span className="label">
                    Moderato's current prototype verifier (pre-T13 reference stub), an equivalent malformed batch
                  </span>
                  <span className="stub-call">
                    <span className="stub-tag mono">Moderato, pre-T13 · called {clock(check.value.readAt)}</span>
                    <code>
                      <AddrLink address={MODERATO.preT13Verifier} label={short(MODERATO.preT13Verifier)} />
                      .verify(zone {MALFORMED.zoneId}, every block number {MALFORMED.number.toString()}, every hash {H0}, verifierConfig{" "}
                      {MALFORMED.verifierConfig}, proof {MALFORMED.proof})
                    </code>
                    <span className="sub mono">
                      pre-T13 verify(…), selector {PRE_T13_SELECTOR}: 10 arguments, not IVerifier's 12, so the call is equivalent,
                      not identical
                    </span>
                  </span>
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
                        ). Sworn demonstrates the missing ZK check.
                      </>
                    ) : (
                      <>This call no longer returns true: Moderato's Zone verifier has changed since this page was written.</>
                    )}
                  </span>
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
              A real batch with {BATCH_CONTENTS.withdrawals} withdrawal and {BATCH_CONTENTS.userTransactions} user transactions,
              proven and verified on Moderato by a standalone contract. It accepts the real proof and rejects a mutated input.
            </li>
            <li>A digest bound to everything a Nitro attestation commits, plus the destination chain and the exact genesis artifact.</li>
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
              <b>The batches are not from Moderato.</b> Both come from Tempo's zones integration tests, on a dev chain (1337):{" "}
              <code>{WITHDRAWAL_BATCH.caseName}</code> (the withdrawal is a test withdrawal, not a Moderato Zone's) and{" "}
              <code>{HARDFORK_BATCH.caseName}</code> (no withdrawals).
            </li>
            <li>
              <b>Not connected to a ZonePortal; it does not protect withdrawals today.</b> Holding withdrawals until ZK finality
              is a proposal (
              <a href={SPEC4} target="_blank" rel="noreferrer">
                spec 004
              </a>
              ), not built.
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
