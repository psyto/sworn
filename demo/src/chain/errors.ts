export type DataErrorCode =
  | "config"
  | "bad-response"
  | "rpc"
  | "tx-not-found"
  | "tx-reverted"
  | "wrong-contract"
  | "codehash-mismatch"
  | "no-reserved-event"
  | "digest-mismatch"
  | "client-mismatch"
  | "coverage-mismatch"
  | "block-mismatch"
  | "vkey-mismatch"
  | "version-mismatch"
  | "question-mismatch"
  | "no-transfer"
  | "no-slash-event"
  | "backend";

/** Every failure the data layer reports. The UI shows it instead of any number. */
export class DataError extends Error {
  readonly code: DataErrorCode;
  constructor(code: DataErrorCode, message: string) {
    super(message);
    this.name = "DataError";
    this.code = code;
  }
}

export function asDataError(e: unknown): DataError {
  if (e instanceof DataError) return e;
  const msg = e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e);
  return new DataError("rpc", msg);
}
