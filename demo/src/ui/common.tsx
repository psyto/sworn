import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PublicClient } from "viem";
import { addressUrl, txUrl, type ChainConfig } from "../chain/config.ts";
import type { DataError } from "../chain/errors.ts";
import { short } from "../chain/format.ts";
import { load, type Loadable } from "../chain/loadable.ts";

export interface ChainCtx {
  cfg: ChainConfig;
  client: PublicClient;
}
export const Chain = createContext<ChainCtx | null>(null);
export function useChain(): ChainCtx {
  const c = useContext(Chain);
  if (!c) throw new Error("no chain context");
  return c;
}

/** Re-reads `read` whenever `deps` change (and every `pollMs` if given). Never keeps a stale value. */
export function useRead<T>(read: (() => Promise<T>) | null, deps: unknown[], pollMs?: number): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: "idle" });
  useEffect(() => {
    if (!read) {
      setState({ status: "idle" });
      return;
    }
    let live = true;
    const set = (s: Loadable<T>) => live && setState(s);
    let first = true;
    const run = () => {
      // Polls after the first read refresh in place only on success; an error replaces the value.
      if (first) {
        first = false;
        void load(read, set);
      } else {
        read().then(
          (value) => set({ status: "ok", value, readAt: Date.now() }),
          (e) => void load(() => Promise.reject(e), set),
        );
      }
    };
    run();
    const t = pollMs ? setInterval(run, pollMs) : undefined;
    return () => {
      live = false;
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function TxLink({ hash, children }: { hash: string; children?: ReactNode }) {
  const { cfg } = useChain();
  return (
    <a href={txUrl(cfg, hash)} target="_blank" rel="noreferrer" title={hash}>
      {children ?? <span className="mono">{short(hash)}</span>} ↗
    </a>
  );
}

export function AddrLink({ address, label }: { address: string; label?: string }) {
  const { cfg } = useChain();
  return (
    <a href={addressUrl(cfg, address)} target="_blank" rel="noreferrer" title={address}>
      {label ?? <span className="mono">{short(address)}</span>} ↗
    </a>
  );
}

export function ErrorBox({ error, title }: { error: DataError | Error; title?: string }) {
  const code = (error as DataError).code;
  return (
    <div className="error" role="alert" data-testid="error">
      <strong>{title ?? "Could not read this from the chain"}</strong>
      {error.message}
      {code ? <span className="mono"> [{code}]</span> : null}
    </div>
  );
}

export function TestnetBadge() {
  const { cfg } = useChain();
  return (
    <span className="badge testnet" title="Every transaction here is on a test network; nothing has monetary value.">
      testnet · {cfg.networkLabel}
    </span>
  );
}

type Theme = "system" | "light" | "dark";
function readTheme(): Theme {
  try {
    const t = localStorage.getItem("sworn-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sworn-theme", theme);
    } catch {
      /* private mode */
    }
  }, [theme]);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  return (
    <button className="btn ghost" onClick={() => setTheme(next[theme])} aria-label={`Theme: ${theme}. Switch to ${next[theme]}`}>
      {theme === "system" ? "◐ auto" : theme === "light" ? "☀ light" : "☾ dark"}
    </button>
  );
}

export function TopBar({ page }: { page: "wallet" | "phone" }) {
  const { client, cfg } = useChain();
  const block = useRead(() => client.getBlockNumber({ cacheTime: 0 }), [client], 2000);
  return (
    <header className="topbar">
      <a className="brand" href="/">
        Sworn
      </a>
      <span className="built-on">built on Tempo</span>
      <nav aria-label="Views">
        <a href="/" aria-current={page === "wallet" ? "page" : undefined}>
          Agent wallet
        </a>
        <a href="/phone" aria-current={page === "phone" ? "page" : undefined}>
          Owner's phone
        </a>
      </nav>
      <span className="spacer" />
      <span className="chainline">
        <TestnetBadge />
        <span>
          chain {cfg.chainId} · block{" "}
          <span className="num" data-testid="head">
            {block.status === "ok" ? block.value.toString() : block.status === "error" ? "unreachable" : "…"}
          </span>
        </span>
      </span>
      <ThemeToggle />
    </header>
  );
}
