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
        . Sworn runs Tempo's own Zone batch verifier inside a zero-knowledge VM, and a contract on Moderato verified the proof of a test batch.
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
            Demo · 2:32 ↗
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
          Tempo Zones are private: the operator sees everything, and each user sees only their own account. So no one
          outside can check that the operator ran the ledger correctly. Sworn makes that checkable: for a batch the
          operator supplies, a zero-knowledge proof that Tempo's own Zone code accepts it, which anyone can verify on
          chain. The proof exposes hashes and batch metadata, not transaction contents.
        </p>
      </div>
      <ol className="roles steps" aria-label="Who it is for">
        <li>
          <span className="role-tag">Near term</span>
          <b>Businesses that run Zones and answer to auditors</b>
          <span>
            Independent evidence they can match to each batch they settle. Evidence, not yet a guarantee: no Zone's portal
            calls this contract, and it stores nothing.
          </span>
        </li>
        <li>
          <span className="role-tag">Later</span>
          <b>Tempo builds proofs into settlement</b>
          <span>
            Withdrawals could wait for a proof.{" "}
            <a href={SPEC4} target="_blank" rel="noreferrer">
              Spec 004
            </a>
            : written, not built.
          </span>
        </li>
        <li>
          <span className="role-tag">Either way</span>
          <b>The service</b>
          <span>Running the provers on time, and rebuilding them at each Tempo upgrade. Still to be validated.</span>
        </li>
      </ol>
      <p className="note">
        <b>Today:</b> Moderato has one Zone operator, and we have no customers. <b>Next:</b> one design partner, and a proof
        of a batch they supply.
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
        <li>Zone batches from Tempo's integration tests (dev chain)</li>
        <li>Does not protect withdrawals today</li>
        <li>No customers, revenue or mainnet</li>
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
