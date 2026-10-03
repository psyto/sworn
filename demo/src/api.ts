// The browser ↔ local demo backend contract. The backend holds the keys; the browser holds none.
// Nothing the backend says is shown as a fact until the data layer has read it back from chain.

export type ScenarioId = "honest" | "dishonest";

export interface Scenario {
  id: ScenarioId;
  receiver: `0x${string}`;
  /** Human amount, e.g. "500" — an input to the demo, not a chain fact. */
  amount: string;
  serverUrl: string;
  mode: "honest" | "dishonest-demo";
}

export interface Readiness {
  ready: boolean;
  reason?: string;
}

export interface DemoConfig {
  agent: `0x${string}` | null;
  token: `0x${string}`;
  feeToken: `0x${string}`;
  scenarios: Scenario[];
  sdk: Readiness;
  signer: Readiness;
  recording: { available: boolean; source?: string };
}

export interface PreflightResult {
  /** The server's 002 §2 JSON, untouched. */
  response: unknown;
  /** Amount in token base units the backend asked about (decimals read from chain by the backend). */
  amountUnits: string;
  /** What the SDK reported about its own checks and witness capture, verbatim; may be absent. */
  sdk?: { protected?: boolean; note?: string };
  /** MPP payment for the answer, if the SDK exposes it. */
  payment?: { txHash?: `0x${string}`; amount?: string };
}

export type ChallengePhase = "witness" | "proving" | "submitting" | "done" | "failed";

export interface ChallengeJob {
  id: string;
  phase: ChallengePhase;
  /** Wall-clock ms (backend clock) when each phase began. */
  startedAt: number;
  phaseStartedAt: Partial<Record<ChallengePhase, number>>;
  txHash?: `0x${string}`;
  error?: string;
  log: string[];
  now: number;
}

export interface Recording {
  source: string;
  /** Each step's real measured duration, parsed from the log. */
  steps: { label: string; seconds: number }[];
  cycles?: number;
}

export class BackendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new BackendError(0, "the local demo backend is not running (pnpm backend)");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new BackendError(res.status, body.error ?? `backend ${res.status}`);
  return body as T;
}

export const api = {
  config: () => call<DemoConfig>("/config"),
  preflight: (scenario: ScenarioId) => call<PreflightResult>("/preflight", { method: "POST", body: JSON.stringify({ scenario }) }),
  pay: (scenario: ScenarioId) => call<{ txHash: `0x${string}` }>("/pay", { method: "POST", body: JSON.stringify({ scenario }) }),
  challenge: (scenario: ScenarioId, response: unknown) =>
    call<ChallengeJob>("/challenge", { method: "POST", body: JSON.stringify({ scenario, response }) }),
  job: (id: string) => call<ChallengeJob>(`/challenge/${encodeURIComponent(id)}`),
  recording: () => call<Recording>("/recording"),
};
