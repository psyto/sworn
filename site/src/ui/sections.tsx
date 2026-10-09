import { useEffect, useState } from "react";
import deployments from "../../../deployments/moderato.json";
import { MODERATO, txUrl } from "../chain/config.ts";
import { short } from "../chain/format.ts";
import { FIXTURE } from "../chain/zone.ts";

const REPO = "https://github.com/psyto/sworn";
const DEPLOYMENTS = `${REPO}/blob/main/deployments/moderato.json`;
const SPEC = `${REPO}/blob/main/docs/specs/003-zone-verifier.md`;
const SPEC4 = `${REPO}/blob/main/docs/specs/004-tee-plus-zk.md`;

type Theme = "system" | "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem("sworn-theme");
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sworn-theme", theme);
    } catch {
      /* private mode: fine */
    }
  }, [theme]);
  const next = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  return [theme, next];
}

export function Topbar() {
  const [theme, next] = useTheme();
  return (
    <header className="topbar">
      <span className="brand">Sworn</span>
      <span className="badge testnet">Moderato testnet</span>
      <span className="spacer" />
      <a className="toplink" href={REPO} target="_blank" rel="noreferrer">
        GitHub
      </a>
      <button className="btn ghost" onClick={next} aria-label={`Theme: ${theme}. Change theme`}>
        {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
      </button>
    </header>
  );
}

/** The own-Zone evidence linked from the hero: the payout and the rejected forged batch. */
const PAYOUT_TX = deployments.OwnZone.payout.tx;
const FORGED_TX = deployments.OwnZone.forgedBatch.tx;
/** YouTube links for the two submission videos; null until published (then the links appear). */
const VIDEOS: { pitch: string | null; demo: string | null } = {
  pitch: "https://youtu.be/qTBetXF5SPY",
  demo: "https://youtu.be/GZz52yUDJKo",
};

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Sworn · for Tempo Zones</p>
        <h1>Private execution. Checkable validity.</h1>
        <p className="lede">
          Tempo Zones are private ledgers: users see only their own activity, while the operator&apos;s sequencer set sees every transaction. Sworn turns an operator-supplied
          batch into evidence anyone can verify on chain—without the private ledger or customer transactions.
        </p>
        <div className="hero-actions">
          <a className="btn" href="#own-zone">See the settlement on Moderato</a>
          <a className="text-action" href="#operations">See the Proof Operations test ↓</a>
        </div>
      </div>
      <aside className="hero-proof" aria-label="Built evidence">
        <p className="eyebrow">Built and verifiable</p>
        <strong>3 batches settled<br />1 withdrawal paid<br />1 forged batch rejected</strong>
        <p>
          On Moderato, our own Zone&apos;s portal verified each proof before settling its batch; our sequencer then separately
          paid the withdrawal. A forged batch, even signed by our own sequencer, was rejected on the proof.
        </p>
        <a href={txUrl(MODERATO, PAYOUT_TX)} target="_blank" rel="noreferrer">
          Open the payout transaction <span className="mono">{short(PAYOUT_TX)} ↗</span>
        </a>
        <a href={txUrl(MODERATO, FORGED_TX)} target="_blank" rel="noreferrer">
          Open the rejected forged batch <span className="mono">{short(FORGED_TX)} ↗</span>
        </a>
      </aside>
      <p className="hero-boundary">
        Testnet. On Moderato, our own Zone&apos;s portal requires a verified Sworn proof to settle a batch; the payout is a
        separate action by our sequencer. It is not a
        Tempo-created Zone, and it is unaudited.
      </p>
    </section>
  );
}

export function ReviewGap() {
  return (
    <section className="section story-section" aria-labelledby="review-gap">
      <div className="section-head">
        <p className="eyebrow">The review gap</p>
        <h2 id="review-gap">Private execution should not require blind trust.</h2>
        <p className="lede">
          Tempo Zones are private by design. That is useful for customers, but it leaves a reviewer unable to recreate
          the operator&apos;s complete batch from public data.
        </p>
      </div>
      <div className="audience-grid" aria-label="The two sides of a private-batch review">
        <article className="audience-card operator">
          <p className="eyebrow">Zone operator</p>
          <h3>Has the private ledger and batch witness.</h3>
          <p>It can generate a proof, but should not have to disclose customer transactions to explain a batch.</p>
        </article>
        <article className="audience-card reviewer">
          <p className="eyebrow">Auditor or counterparty</p>
          <h3>Needs a defensible answer about one exact batch.</h3>
          <p>It needs evidence it can independently check—not a spreadsheet, assertion or copy of the ledger.</p>
        </article>
      </div>
    </section>
  );
}

export function ProofFlow() {
  return (
    <section className="section story-section" aria-labelledby="proof-flow">
      <div className="section-head">
        <p className="eyebrow">The product</p>
        <h2 id="proof-flow">From an operator-supplied batch to independent evidence.</h2>
      </div>
      <ol className="product-steps" aria-label="How Sworn creates evidence">
        <li>
          <span className="step-number">01</span>
          <h3>Supply the batch witness</h3>
          <p>The Zone operator chooses a batch it is allowed to share for review.</p>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>Prove Tempo&apos;s own execution</h3>
          <p>Sworn runs the Zone batch verifier in SP1 and exposes a digest, not customer transaction contents.</p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>Let the reviewer verify it</h3>
          <p>Anyone can check the proof against the exact batch-shaped inputs on chain.</p>
        </li>
      </ol>
    </section>
  );
}

/** The digest the guest committed for the proven fixture, as the diagram's chip shows it (read from the fixture). */
const DIGEST = short(FIXTURE.digest);

/**
 * "Only hashes cross this line": Private · Zone operator → Sworn prover · SP1 ┆ Public · Tempo → Reviewer.
 * A CSS-only 8 s loop (styles.css, "data flow"). Without motion the diagram is static and fully visible.
 */
function FlowDiagram() {
  return (
    <div className="dfx" role="img" aria-label={`Diagram: the batch witness goes from the Zone operator to the Sworn prover and stops there. Only the proof and public batch data, with the digest ${DIGEST}, cross to Tempo, where SwornZoneVerifier emits ZoneBatchVerified; a reviewer's check returns true, or InvalidProof() if one field changes.`}>
      <div className="dfx-stage" aria-hidden="true">
        <div className="dfx-card dfx-private">
          <p className="eyebrow">Private · Zone operator</p>
          <div className="dfx-ledger">
            <span><i>sender → recipient</i><i>amount</i></span>
            <span><i>sender → recipient</i><i>amount</i></span>
            <span><i>account → withdrawal</i><i>amount</i></span>
          </div>
          <p className="dfx-lock"><Lock /> Never published</p>
          <div className="dfx-slot"><span className="dfx-doc dfx-wit-home"><Doc /> witness</span></div>
        </div>
        <span className="dfx-wire w1" />
        <div className="dfx-card dfx-prover">
          <p className="eyebrow">Sworn prover · SP1</p>
          <h3>Tempo&apos;s own Zone code</h3>
          <p className="dfx-run"><span className="dfx-ring" /> <span>re-executes the batch</span></p>
          <div className="dfx-slot"><span className="dfx-chip dfx-chip-p">{DIGEST}</span></div>
        </div>
        <div className="dfx-bnd"><span className="dfx-bnd-l">Only proof + public{" "}<br />data cross this line</span></div>
        <div className="dfx-card dfx-public">
          <p className="eyebrow">Public · Tempo</p>
          <h3>SwornZoneVerifier</h3>
          <p className="dfx-badge">✓ ZoneBatchVerified</p>
          <div className="dfx-slot"><span className="dfx-chip dfx-chip-t">{DIGEST}</span></div>
        </div>
        <span className="dfx-wire w3" />
        <div className="dfx-card dfx-reviewer">
          <p className="eyebrow">Reviewer</p>
          <h3>verify(…)</h3>
          <p className="dfx-ok">✓ true</p>
          <p className="dfx-bad">✗ InvalidProof() — one field changed</p>
          <div className="dfx-slot" />
        </div>
        <span className="dfx-tok dfx-tok-wit"><i><Doc /></i></span>
        <span className="dfx-tok dfx-tok-dig"><i>{DIGEST}</i></span>
        <span className="dfx-tok dfx-tok-pulse"><i /></span>
      </div>
    </div>
  );
}

const Doc = () => (
  <svg className="dfx-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
);
const Lock = () => (
  <svg className="dfx-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
);

export function DataFlow() {
  return (
    <section className="section story-section" aria-labelledby="data-flow">
      <div className="section-head">
        <p className="eyebrow">Data flow</p>
        <h2 id="data-flow">What stays private, and what becomes public.</h2>
        <p className="lede">
          The batch witness goes to the prover and stops there. Only the proof, hashes, counters and public batch metadata reach Tempo,
          and that is all a reviewer needs to check the proof: not transaction contents, balances, senders or amounts.
        </p>
      </div>
      <FlowDiagram />
      <p className="df-commits">
        The prover commits one digest: Zone id, Tempo blocks and anchor, state and withdrawal-queue hashes, counters,
        verifier, config, genesis hash, chain. The contract recomputes it from the batch fields and checks the Groth16
        proof.
      </p>
      <div className="df-learns" aria-label="What a reviewer learns">
        <p><b>Learns:</b> Tempo&apos;s own Zone code accepts this exact batch.</p>
        <p><b>Does not learn:</b> balances, senders, recipients or amounts inside the Zone.</p>
        <p className="df-note"><b>Like Zcash? Only in one way.</b> Both use zero knowledge to verify without revealing.
          Zcash proves a shielded transaction is valid; Sworn proves a Zone batch executed correctly. Sworn hides nothing
          from the Zone&apos;s operator, who still sees every transaction.</p>
        <p className="df-note">This diagram shows the fixture batch from Tempo&apos;s integration tests (dev chain 1337), verified
          on Moderato by a standalone verifier, not connected to a portal. The own-Zone run above is separate: its portal calls its own instance of the verifier before it
          settles a batch, and our sequencer pays withdrawals afterwards. Tempo&apos;s own Zones are unchanged; spec 004 is a
          proposal.</p>
      </div>
    </section>
  );
}

export function OperationsTest() {
  return (
    <section className="section story-section operations" id="operations" aria-labelledby="operations-h">
      <div className="section-head">
        <p className="eyebrow">The business test · a hypothesis</p>
        <h2 id="operations-h">Start with one batch. Earn the right to Proof Operations.</h2>
        <p className="lede">
          The evidence is built. The commercial question is deliberately narrow: will a Zone business need this work to
          recur for its next batch or its next Tempo upgrade?
        </p>
      </div>
      <ol className="operation-test">
        <li><b>1. First batch</b><span>An operator supplies a witness for a real review.</span></li>
        <li><b>2. Independent check</b><span>Its reviewer receives the proof and reproducible verification instructions.</span></li>
        <li><b>3. Repeat need</b><span>A next batch or execution upgrade identifies whether there is a budget and recurring work.</span></li>
      </ol>
      <p className="note">
        <b>Market, honestly:</b> it grows with Zones × batches × upgrades, and only if Zones are adopted; no TAM is claimed.
        Later, Sworn could sit beside Tempo&apos;s TEE as an independent check (spec 004, a proposal).<br />
        <b>What is true today:</b> Sworn has no customer, revenue, design partner or payer agreement. The commercial thesis becomes credible only after this repeat
        test.
      </p>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <ul className="disclosures" aria-label="Disclosures">
        <li>Moderato testnet only</li>
        <li>Unaudited</li>
        <li>Fixture batches from Tempo's integration tests (dev chain)</li>
        <li>Live settlement only on our own Zone (one operator), not Tempo's Zones</li>
        <li>Proof gates settlement; no data-availability, liveness or censorship-resistance guarantee</li>
        <li>No customers, revenue or mainnet</li>
      </ul>
      <ul className="links">
        <li>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub: psyto/sworn
          </a>
        </li>
        <li>
          <a href={DEPLOYMENTS} target="_blank" rel="noreferrer">
            deployments/moderato.json
          </a>
        </li>
        <li>
          <a href={SPEC} target="_blank" rel="noreferrer">
            Spec 003: Zone verifier
          </a>
        </li>
        <li>
          <a href={SPEC4} target="_blank" rel="noreferrer">
            Spec 004: TEE + ZK (proposal)
          </a>
        </li>
        {VIDEOS.pitch && (
          <li>
            <a href={VIDEOS.pitch} target="_blank" rel="noreferrer">
              Pitch video
            </a>
          </li>
        )}
        {VIDEOS.demo && (
          <li>
            <a href={VIDEOS.demo} target="_blank" rel="noreferrer">
              Demo video
            </a>
          </li>
        )}
      </ul>
      <p className="fine team">
        Built by Hiroyuki Saito (<a href="https://github.com/psyto" target="_blank" rel="noreferrer">@psyto</a>): Rust on
        Tempo&apos;s stack (Reth, Revm); author of <a href="https://fabrknt.com/dojo" target="_blank" rel="noreferrer">Fabrknt Dojo</a> (21 courses); Uniswap Foundation sponsor prize (Best
        Uniswap Stack Contribution, 3rd place), ETHGlobal Tokyo 2026; 3rd place, Superteam Japan × NTT DOCOMO R&amp;D side track,
        Colosseum&apos;s Solana Cypherpunk Hackathon 2025; 15 years building banking
        systems in Japan.
      </p>
      <p className="fine">
        This page has no backend and holds no keys. It reads Tempo's public Moderato RPC from your browser and sends no
        transactions. Apache-2.0.
      </p>
    </footer>
  );
}
