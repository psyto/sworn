import { formatUnits } from "viem";

/** 500000000 (6 dp) → "500.00"; keeps more precision if the value has it. */
export function money(v: bigint, decimals: number): string {
  const s = formatUnits(v < 0n ? -v : v, decimals);
  const [i, f = ""] = s.split(".");
  const frac = f.length <= 2 ? f.padEnd(2, "0") : f.replace(/0+$/, "").padEnd(2, "0");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${v < 0n ? "−" : ""}${int}.${frac}`;
}

export function signed(v: bigint, decimals: number): string {
  return (v >= 0n ? "+" : "") + money(v, decimals);
}

export const short = (h: string, n = 4) => (h.length > 2 + 2 * n ? `${h.slice(0, 2 + n)}…${h.slice(-n)}` : h);

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
