import type { ReactNode } from "react";
import { addressUrl, MODERATO, txUrl } from "../chain/config.ts";
import type { DataError } from "../chain/errors.ts";
import { short } from "../chain/format.ts";

export function TxLink({ hash, children }: { hash: string; children?: ReactNode }) {
  return (
    <a className="mono" href={txUrl(MODERATO, hash)} target="_blank" rel="noreferrer">
      {children ?? `tx ${short(hash)}`} ↗
    </a>
  );
}

export function AddrLink({ address, label }: { address: string; label?: string }) {
  return (
    <a className="mono" href={addressUrl(MODERATO, address)} target="_blank" rel="noreferrer" title={address}>
      {label ?? short(address)}
    </a>
  );
}

export function ErrorBox({ error, onRetry }: { error: DataError; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      <strong>Could not read this from Moderato — no numbers are shown.</strong>
      <span className="mono">
        {error.code}: {error.message}
      </span>
      {onRetry && (
        <button className="btn secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function utc(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}
