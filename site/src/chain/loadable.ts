import { DataError, asDataError } from "./errors.ts";
// Copied from demo/src/chain/ (read-only parts only).

/**
 * A value read from the chain. Starting a new read DROPS the previous value: the UI never shows a
 * number from an earlier read next to an error or a spinner (S-5).
 */
export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; value: T; readAt: number }
  | { status: "error"; error: DataError };

export const idle: Loadable<never> = { status: "idle" };

export async function load<T>(read: () => Promise<T>, set: (s: Loadable<T>) => void, now = Date.now): Promise<Loadable<T>> {
  set({ status: "loading" });
  let next: Loadable<T>;
  try {
    next = { status: "ok", value: await read(), readAt: now() };
  } catch (e) {
    next = { status: "error", error: asDataError(e) };
  }
  set(next);
  return next;
}

export const valueOf = <T,>(l: Loadable<T>): T | undefined => (l.status === "ok" ? l.value : undefined);
