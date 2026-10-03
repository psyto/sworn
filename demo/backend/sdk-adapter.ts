// The only place the demo touches the Sworn SDK (sdk/, built by another agent; 002 §1, §3).
//
// The SDK's API is specified only as `preflight(serverUrl, params)` and `challenge(...)`. Until its
// documented signature lands, this adapter loads the module dynamically and maps it through the
// interface below. If the module is missing or does not export those functions, every SDK-backed
// endpoint answers 501 with the reason — the demo never invents an answer, a reservation or a proof.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { LocalAccount } from "viem";

export interface PreflightParams {
  from: `0x${string}`;
  token: `0x${string}`;
  receiver: `0x${string}`;
  amount: bigint;
  memo?: `0x${string}`;
  feeToken: `0x${string}`;
  client: `0x${string}`;
}

export interface SdkContext {
  account: LocalAccount;
  rpcUrl: string;
  sworn: `0x${string}`;
}

export interface PreflightOutcome {
  response: unknown;
  protected?: boolean;
  note?: string;
  payment?: { txHash?: `0x${string}`; amount?: string };
}

export type ChallengeEvent =
  | { phase: "witness" | "proving" | "submitting"; line?: string }
  | { phase: "log"; line: string };

export interface SwornSdkAdapter {
  readonly ready: boolean;
  readonly reason?: string;
  preflight(serverUrl: string, params: PreflightParams, ctx: SdkContext): Promise<PreflightOutcome>;
  challenge(response: unknown, ctx: SdkContext, on: (e: ChallengeEvent) => void): Promise<{ txHash: `0x${string}` }>;
}

class NotReady implements SwornSdkAdapter {
  readonly ready = false;
  readonly reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }
  preflight(): Promise<PreflightOutcome> {
    return Promise.reject(new HttpError(501, `Sworn SDK not available: ${this.reason}`));
  }
  challenge(): Promise<{ txHash: `0x${string}` }> {
    return Promise.reject(new HttpError(501, `Sworn SDK not available: ${this.reason}`));
  }
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type AnyFn = (...a: unknown[]) => Promise<unknown>;

export async function loadSdk(path: string | undefined): Promise<SwornSdkAdapter> {
  // sdk/package.json exports ./src/index.ts (run under Node type stripping); dist/ as fallback.
  const candidates = path ? [path] : ["../../sdk/src/index.ts", "../../sdk/dist/index.js"];
  let mod: Record<string, unknown> | undefined;
  let target = "";
  const errors: string[] = [];
  for (const c of candidates) {
    target = resolve(import.meta.dirname, c);
    try {
      mod = (await import(pathToFileURL(target).href)) as Record<string, unknown>;
      break;
    } catch (e) {
      errors.push(`${target}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  if (!mod) return new NotReady(`cannot load the SDK (${errors.join("; ")})`);
  const preflight = mod.preflight as AnyFn | undefined;
  const challenge = mod.challenge as AnyFn | undefined;
  if (typeof preflight !== "function" || typeof challenge !== "function") {
    return new NotReady(`${target} does not export preflight() and challenge()`);
  }
  return {
    ready: true,
    async preflight(serverUrl, params, ctx) {
      // sdk/src/abi.ts PreflightParams takes amount as a decimal string.
      const out = (await preflight(serverUrl, { ...params, amount: params.amount.toString() }, ctx)) as Record<string, unknown>;
      // Accept either the bare 002 §2 response or { response, protected, ... }.
      if (out && typeof out === "object" && "question" in out) return { response: out };
      return {
        response: out?.response,
        protected: typeof out?.protected === "boolean" ? (out.protected as boolean) : undefined,
        note: typeof out?.note === "string" ? (out.note as string) : undefined,
        payment: out?.payment as PreflightOutcome["payment"],
      };
    },
    async challenge(response, ctx, on) {
      const out = (await challenge(response, { ...ctx, onProgress: on })) as Record<string, unknown> | string;
      const txHash = typeof out === "string" ? out : (out?.txHash as string | undefined);
      if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error("SDK challenge() returned no tx hash");
      return { txHash: txHash as `0x${string}` };
    },
  };
}
