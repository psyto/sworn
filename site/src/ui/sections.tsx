import { useEffect, useState } from "react";
import deployments from "../../../deployments/moderato.json";
import { MODERATO, txUrl } from "../chain/config.ts";
import { short } from "../chain/format.ts";
import { FIXTURE } from "../chain/zone.ts";

const REPO = "https://github.com/psyto/sworn";
const REQUEST = `${REPO}/issues/new?template=request-batch-proof.yml`;
const X_DM = "https://x.com/psyto";
const TELEGRAM = "https://t.me/psyto69";
const PROVER_DOCS = `${REPO}/tree/main/spikes/zone-spf`;
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

/** `base` is the relative path back to the landing page: "./" on the landing page, "../" on evidence/. */
export function Topbar({ base }: { base: string }) {
  const [theme, next] = useTheme();
  return (
    <header className="topbar">
      <a className="brand" href={base}>Sworn</a>
      <span className="badge testnet">Moderato testnet</span>
      <span className="spacer" />
      <a className="toplink" href={`${base}evidence/`}>Evidence</a>
      <a className="toplink hide-sm" href={`${base}#use`}>Use Sworn</a>
      <a className="toplink hide-sm" href={REPO} target="_blank" rel="noreferrer">
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

const SETTLED_TX = deployments.OwnZone.batches[2].submitTx;
const SETTLED_BLOCKS = deployments.OwnZone.batches[2].zoneBlocks;

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Sworn · for Tempo Zones</p>
        <h1>Prove a private batch ran correctly. Without publishing it.</h1>
        <p className="lede">
          Tempo Zones keep transactions private from the public. Sworn proves, with Tempo&apos;s own Zone code, that an
          operator-supplied batch executed correctly, and <strong>anyone can re-check the proof on chain</strong>.
        </p>
        <div className="hero-actions">
          {VIDEOS.pitch && (
            <a className="btn" href={VIDEOS.pitch} target="_blank" rel="noreferrer">
              Watch the 1:49 pitch ↗
            </a>
          )}
          <a className="btn secondary" href="#use">Pilot it on one batch ↓</a>
        </div>
        <a className="hero-proofline" href="evidence/">
          <span><span className="ok">✓</span> 3 batches settled only after the proof verified</span>
          <span><span className="bad">✗</span> a forged batch rejected on the proof</span>
          <span className="muted">our own Zone, Moderato →</span>
        </a>
        <p className="hero-boundary">
          Moderato testnet · unaudited · our own Zone (one operator), not Tempo-created · the payout is a separate action
          by our sequencer
        </p>
      </div>
      <figure className="hero-flow">
        <FlowDiagram />
        <figcaption>
          The batch witness is used by the prover and is not sent on chain; only the proof and public batch data are submitted to the verifier. Shown with the real digest
          of a fixture batch from Tempo&apos;s integration tests (dev chain 1337).
        </figcaption>
      </figure>
    </section>
  );
}

function Receipt() {
  return (
    <div className="receipt-card" aria-label="What happened on Moderato">
      <p className="eyebrow">On Moderato · our own Zone</p>
      <ol className="receipt">
        <li className="ok">
          <span className="mark" aria-hidden="true">✓</span>
          <span><b>Batch {SETTLED_BLOCKS}: proof verified, batch settled</b>
            <a href={txUrl(MODERATO, SETTLED_TX)} target="_blank" rel="noreferrer" className="mono">{short(SETTLED_TX)} ↗</a></span>
        </li>
        <li className="ok">
          <span className="mark" aria-hidden="true">✓</span>
          <span><b>Its withdrawal paid, separately, by our sequencer</b>
            <a href={txUrl(MODERATO, PAYOUT_TX)} target="_blank" rel="noreferrer" className="mono">{short(PAYOUT_TX)} ↗</a></span>
        </li>
        <li className="bad">
          <span className="mark" aria-hidden="true">✗</span>
          <span><b>A forged batch replaying that real proof: rejected</b>
            <a href={txUrl(MODERATO, FORGED_TX)} target="_blank" rel="noreferrer" className="mono">{short(FORGED_TX)} ↗</a></span>
        </li>
      </ol>
      <p>3 batches settled through a portal that requires Sworn&apos;s proof. The forged batch was signed by our own sequencer and passed every check before the proof.</p>
    </div>
  );
}

export function EvidenceTeaser() {
  return (
    <section className="section evidence-intro teaser" aria-labelledby="teaser-h">
      <div className="evidence-intro-copy">
        <p className="eyebrow">Proven on Moderato</p>
        <h2 id="teaser-h">It ran on chain. Check it yourself.</h2>
        <p className="lede">
          The evidence page re-checks the proofs live from your browser, decodes each batch and shows what a reviewer
          learns and what it does not.
        </p>
        <div className="hero-actions">
          <a className="btn" href="evidence/">See the evidence →</a>
        </div>
      </div>
      <Receipt />
    </section>
  );
}

export function EvidenceIntro() {
  return (
    <section className="evidence-intro" aria-labelledby="evidence-start">
      <div className="evidence-intro-copy">
        <p className="eyebrow">For engineers</p>
        <h2 id="evidence-start">Re-check the evidence on Moderato.</h2>
        <p className="lede">
          The live checks below read Tempo&apos;s public Moderato RPC from your browser. Nothing is signed or sent.
        </p>
      </div>
      <Receipt />
    </section>
  );
}

export function WhoVerifies() {
  return (
    <section className="section story-section" aria-labelledby="who-verifies">
      <div className="section-head">
        <p className="eyebrow">The question</p>
        <h2 id="who-verifies">Private ledgers bring back an old question: who verifies?</h2>
      </div>
      <ol className="who-grid" aria-label="Who can verify, chain by chain">
        <li>
          <p className="eyebrow">Bitcoin</p>
          <h3>Anyone can verify, because anyone can see.</h3>
          <p>Every transaction is public. Verification paid for itself with privacy.</p>
        </li>
        <li>
          <p className="eyebrow">Zcash</p>
          <h3>Anyone can verify a shielded transaction without seeing its contents.</h3>
          <p>A zero-knowledge proof shows the transaction is valid.</p>
        </li>
        <li className="who-zone">
          <p className="eyebrow">Tempo Zones</p>
          <h3>Users see their own activity. The public sees none of it.</h3>
          <p>Only the operator&apos;s sequencer set sees every transaction. <b>So who can check a batch?</b></p>
        </li>
      </ol>
      <p className="lede">
        Without a proof, an auditor, a counterparty or a user has two options: trust the operator&apos;s word, or ask to
        see the private ledger. Sworn adds a third: a proof of the batch that anyone can check, which reveals hashes and
        batch metadata, not transactions.
      </p>
    </section>
  );
}

export function ProofFlow() {
  return (
    <section className="section story-section work-band" aria-labelledby="proof-flow">
      <div className="section-head">
        <p className="eyebrow">How it works</p>
        <h2 id="proof-flow">Three steps, from a private batch to a public check.</h2>
      </div>
      <ol className="product-steps" aria-label="How Sworn creates evidence">
        <li>
          <span className="step-number">01</span>
          <h3>The operator supplies a batch</h3>
          <p>The Zone operator, who holds the private ledger, picks a batch to be proven and hands over its witness.</p>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>Sworn re-runs it with Tempo&apos;s own code</h3>
          <p>Tempo&apos;s Zone batch verifier runs inside the SP1 zkVM and produces a Groth16 proof plus a digest of the batch.</p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>Anyone checks it on chain</h3>
          <p>A contract on Tempo verifies the proof against the batch&apos;s public inputs. Change one field and it fails.</p>
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
    <div className="dfx" role="img" aria-label={`Diagram: the batch witness goes from the Zone operator to the Sworn prover and is not sent on chain. Only the proof and public batch data, with the digest ${DIGEST}, cross to Tempo, where SwornZoneVerifier emits ZoneBatchVerified; a reviewer's check returns true, or InvalidProof() if one field changes.`}>
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

export function DataFlow({ diagram = false }: { diagram?: boolean }) {
  return (
    <section className="section story-section" aria-labelledby="data-flow">
      <div className="section-head">
        <p className="eyebrow">Data flow</p>
        <h2 id="data-flow">What stays private, and what becomes public.</h2>
        <p className="lede">
          The batch witness is used by the prover and is not sent on chain. Only the proof, hashes, counters and public batch metadata reach Tempo,
          and that is all a reviewer needs to check the proof: not transaction contents, balances, senders or amounts.
        </p>
      </div>
      {diagram && <FlowDiagram />}
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

export function LiveStatus() {
  return (
    <section className="section story-section" aria-labelledby="live-status">
      <div className="section-head">
        <p className="eyebrow">Stated plainly</p>
        <h2 id="live-status">What is live, and what is not yet.</h2>
      </div>
      <div className="live-grid">
        <div>
          <p className="eyebrow">Live on Moderato testnet</p>
          <ul>
            <li>Tempo&apos;s own Zone batch verifier running inside SP1, matching its native output</li>
            <li>Groth16 proofs of Zone batches verified by a contract on Moderato</li>
            <li>Our own Zone: 3 batches settled only after the proof was verified; a withdrawal paid afterwards</li>
            <li>A forged batch, signed by our own sequencer, rejected on the proof</li>
            <li>67 forge tests, and this page re-checking the proofs from your browser</li>
          </ul>
        </div>
        <div className="not-yet">
          <p className="eyebrow">Not yet</p>
          <ul>
            <li>Tempo-created Zones: unchanged; only our own demonstration Zone calls Sworn</li>
            <li>Mainnet, an audit, customers or revenue</li>
            <li>Fast proving: measured runs took 11–31 minutes per batch on one machine</li>
            <li>Data-availability, liveness or censorship-resistance guarantees: the proof gates settlement, nothing more</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Sworn protect Tempo's Zones today?",
    a: "No. Only our own demonstration Zone's portal calls Sworn's verifier. Tempo's Zones are unchanged; Tempo's design adds an AWS Nitro attestation path, and its docs state that ZK proof generation is not implemented.",
  },
  {
    q: "What becomes public?",
    a: "The proof's public values are hashes, counters and batch metadata; they do not reveal the Zone's transaction contents, and the batch witness is not sent on chain. Deposits and withdrawals that cross the portal emit their own public events, as the payout above shows. Sworn hides nothing from the Zone's operator, which still sees every transaction.",
  },
  {
    q: "Why a zero-knowledge proof and not only a TEE?",
    a: "Tempo's planned Nitro path suits fast withdrawals. A proof can be re-checked by anyone, at any time, without trusting the hardware that produced it. For an off-path audit or counterparty-evidence workflow, a proof can run on the operator's own schedule: for an audit, a counterparty, or after an upgrade. Combining both is a proposal (spec 004), not built.",
  },
  {
    q: "Who would pay for this?",
    a: "A hypothesis, not a result: a Zone business that must give a reviewer evidence pays for per-batch proving plus keeping the prover compatible through Tempo upgrades. There is no customer, price or revenue yet; the first test is one operator-supplied batch.",
  },
];

export function Faq() {
  return (
    <section className="section story-section" aria-labelledby="faq">
      <div className="section-head">
        <p className="eyebrow">Questions</p>
        <h2 id="faq">Answered plainly.</h2>
      </div>
      <div className="faq">
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function UseSworn() {
  return (
    <section className="section use" id="use" aria-labelledby="use-h">
      <div className="section-head">
        <p className="eyebrow">Use Sworn</p>
        <h2 id="use-h">Three ways to start, depending on who you are.</h2>
      </div>
      <div className="use-grid">
        <article className="use-card primary">
          <p className="eyebrow">Run a Tempo Zone?</p>
          <h3>Pilot it on one of your batches.</h3>
          <p>
            Request a testnet pilot: you supply one batch&apos;s witness, Sworn proves it with Tempo&apos;s own Zone code, and your
            reviewer gets the steps to verify it on chain. Hands-on, not a hosted service. Sworn is pinned to one Tempo
            Zones version; yours requires a compatibility review and may need porting first.
          </p>
          <div className="use-actions">
            <a className="btn" href={REQUEST} target="_blank" rel="noreferrer">Request a batch proof ↗</a>
            <a className="btn secondary" href={X_DM} target="_blank" rel="noreferrer">X @psyto ↗</a>
            <a className="btn secondary" href={TELEGRAM} target="_blank" rel="noreferrer">Telegram ↗</a>
          </div>
          <p className="fine">The request form is a public GitHub issue: never paste a witness or private data there.</p>
        </article>
        <article className="use-card">
          <p className="eyebrow">Reviewing a Zone?</p>
          <h3>Verify the proofs yourself.</h3>
          <p>Re-check our own Zone&apos;s three proven batches against the real SP1 Groth16 verifier. About a minute, with Foundry.</p>
          <pre className="use-code"><code>{`git clone ${REPO}
cd sworn/contracts
forge test --match-test OWNZONE`}</code></pre>
          <p className="fine">Or press &ldquo;Re-verify on chain&rdquo; on the <a href="evidence/">evidence page</a>, in your browser.</p>
        </article>
        <article className="use-card">
          <p className="eyebrow">Building on Tempo?</p>
          <h3>Run the prover locally.</h3>
          <p>
            Groth16-prove a fixture batch on your own machine. Needs Rust, SP1&apos;s <code>cargo-prove</code>, Foundry, a RISC-V
            C toolchain and a deployed (or fixed) SwornZoneVerifier address. After setup, the default fixture proof takes
            roughly 12–15 minutes and 18–20 GB RAM; fresh setup takes longer.
          </p>
          <pre className="use-code"><code>{`scripts/zone-prove.sh <verifier-address>`}</code></pre>
          <p className="fine">It writes a local Foundry fixture and sends nothing. <a href={PROVER_DOCS} target="_blank" rel="noreferrer">Setup and scripts ↗</a></p>
        </article>
      </div>
      <div className="use-videos">
        {VIDEOS.pitch && <a href={VIDEOS.pitch} target="_blank" rel="noreferrer">Pitch (1:49) ↗</a>}
        {VIDEOS.demo && <a href={VIDEOS.demo} target="_blank" rel="noreferrer">Demo (1:22) ↗</a>}
        <a href={REPO} target="_blank" rel="noreferrer">Code on GitHub ↗</a>
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
        These pages have no backend and hold no keys. The evidence page reads Tempo's public Moderato RPC from your
        browser and sends no transactions. Apache-2.0.
      </p>
    </footer>
  );
}
