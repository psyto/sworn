import { useEffect, useState } from "react";
import deployments from "../../../deployments/moderato.json";
import { MODERATO, txUrl } from "../chain/config.ts";
import { short } from "../chain/format.ts";

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

/** The primary Zone evidence: the attest of the batch with a withdrawal. */
const ZONE_TX = deployments.SwornZoneVerifierWithdrawal.attest.tx;
/** YouTube links for the two submission videos; null until published (then the links appear). */
const VIDEOS: { pitch: string | null; demo: string | null } = { pitch: null, demo: null };
const DOCS = "https://tempo.xyz/developers/docs/protocol/zones/proving";

export function Hero() {
  return (
    <section className="hero">
      <h1>Tempo's execution, proven.</h1>
      <p className="lede">
        Tempo Zones are private blockchains anchored to Tempo, and Tempo's docs say ZK proof generation for Zones{" "}
        <a href={DOCS} target="_blank" rel="noreferrer">
          “is not implemented”
        </a>
        . Sworn runs Tempo's own Zone batch verifier inside a zero-knowledge VM, and a contract on Moderato verified it.
      </p>
      <ul className="chips" aria-label="Results on Moderato">
        <li>
          <a className="chip" href={txUrl(MODERATO, ZONE_TX)} target="_blank" rel="noreferrer">
            <span className="chip-mark" aria-hidden>✓</span>
            <span>
              Zone batch with a withdrawal, verified on Moderato
              <span className="chip-sub mono">tx {short(ZONE_TX)} ↗</span>
            </span>
          </a>
        </li>
        <li>
          <a className="chip" href="#slashes">
            <span className="chip-mark" aria-hidden>3</span>
            <span>
              3 slashes on Moderato
              <span className="chip-sub mono">same engine, Tempo's EVM ↓</span>
            </span>
          </a>
        </li>
      </ul>
      <nav className="fast-path" aria-label="For judges: the fast path">
        <span className="eyebrow">Fast path</span>
        {VIDEOS.pitch && (
          <a href={VIDEOS.pitch} target="_blank" rel="noreferrer">
            Pitch · 2 min ↗
          </a>
        )}
        {VIDEOS.demo && (
          <a href={VIDEOS.demo} target="_blank" rel="noreferrer">
            Demo · 2:35 ↗
          </a>
        )}
        <a href={txUrl(MODERATO, ZONE_TX)} target="_blank" rel="noreferrer">
          The Moderato proof tx ↗
        </a>
        <a href="#zone">Verify it again in your browser ↓</a>
      </nav>
    </section>
  );
}

export function WhyItMatters() {
  return (
    <section className="section" aria-labelledby="why">
      <div className="section-head">
        <p className="eyebrow">The point</p>
        <h2 id="why">Why it matters</h2>
        <p className="lede">
          Zones hold money, and money has to come back out. Withdrawals are only as trustworthy as the check on the batch. Today that check is a hardware attestation, or, in the
          reference contract, nothing at all. A hardware attestation means trusting one vendor's chip; a zero-knowledge proof,
          anyone can check.
        </p>
      </div>
      <ol className="roles steps" aria-label="Next steps">
        <li>
          <span className="role-tag">Step 1</span>
          <b>ZK as a second, independent check</b>
          <span>Tempo decides which verifier its Zones use, so step one is Tempo: a proof next to the attestation.</span>
        </li>
        <li>
          <span className="role-tag">Step 2</span>
          <b>Proving operations</b>
          <span>Running the provers: a proof for every batch, on time, re-verified at every Tempo upgrade.</span>
        </li>
      </ol>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <ul className="disclosures" aria-label="Disclosures">
        <li>Moderato testnet only</li>
        <li>Unaudited</li>
        <li>Zone batches from Tempo's integration tests (dev chain)</li>
        <li>Does not protect withdrawals today</li>
        <li>No revenue, users or mainnet</li>
        <li>A slash pays at most the reserved bond</li>
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
      <p className="fine">
        This page has no backend and holds no keys. It reads Tempo's public Moderato RPC from your browser and sends no
        transactions. Apache-2.0.
      </p>
    </footer>
  );
}
