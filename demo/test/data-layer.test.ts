// S-5 / AC-10: the UI's data layer, against a real chain (anvil --network tempo, real TIP-20
// precompile, real Sworn bytecode compiled from contracts/src/Sworn.sol). A wrong tx hash must
// produce an error state — never a number.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hex, PublicClient } from "viem";
import type { ChainConfig } from "../src/chain/config.ts";
import { DataError } from "../src/chain/errors.ts";
import { readOwnerFeed } from "../src/chain/feed.ts";
import { load, type Loadable } from "../src/chain/loadable.ts";
import { parsePreflightResponse, verifyPreflight, type Expected } from "../src/chain/preflight.ts";
import { readPayment, readSlash } from "../src/chain/reads.ts";
import { keccak256 } from "viem";
import { anvilAvailable, startAnvil } from "./anvil.ts";
import { AGENT, BLOCKED, PATH_USD, RECEIVER, WRONG_TX, seedChain } from "./fixture.ts";

describe.skipIf(!anvilAvailable)("data layer on anvil --network tempo", () => {
  let stop = () => {};
  let cfg: ChainConfig;
  let client: PublicClient;
  let raw: Record<string, unknown>;
  let expected: Expected;
  let bondTx: Hex;
  let payTx: Hex;
  let blockedTx: Hex | undefined;
  let policyUnsupported: string | undefined;

  beforeAll(async () => {
    const a = await startAnvil();
    stop = a.stop;
    ({ cfg, client, raw, expected, bondTx, payTx, blockedTx, policyUnsupported } = await seedChain(a.url));
  }, 120_000);

  afterAll(() => stop());

  it("verifies a real reservation and reads its numbers from chain", async () => {
    const v = await verifyPreflight(client, cfg, parsePreflightResponse(raw), expected);
    expect(v.receiverDelta).toBe(500_000_000n);
    expect(v.reserved.coverage).toBe(500_000_000n);
    expect(v.reserved.client).toBe(AGENT);
    expect(v.status).toBe("Active");
    expect(v.token.decimals).toBe(6);
  });

  it("wrong reserve tx hash → error state, and the previous number is dropped (S-5)", async () => {
    let state: Loadable<unknown> = { status: "idle" };
    const set = (s: Loadable<unknown>) => (state = s);
    await load(() => verifyPreflight(client, cfg, parsePreflightResponse(raw), expected), set);
    expect(state.status).toBe("ok");

    const seen: string[] = [];
    await load(
      () => verifyPreflight(client, cfg, parsePreflightResponse({ ...raw, reserveTx: WRONG_TX }), expected),
      (s) => {
        seen.push(s.status);
        set(s);
      },
    );
    expect(seen).toEqual(["loading", "error"]);
    expect(state.status).toBe("error");
    expect("value" in state).toBe(false);
    expect((state as unknown as { error: DataError }).error.code).toBe("tx-not-found");
  });

  it("a tx without a Reserved event (the bond tx) is rejected", async () => {
    await expect(verifyPreflight(client, cfg, parsePreflightResponse({ ...raw, reserveTx: bondTx }), expected)).rejects.toMatchObject({
      code: "no-reserved-event",
    });
  });

  it("an answer that differs from the reserved one is rejected (digest)", async () => {
    const a = { ...(raw.answer as object), receiverAfter: "1" };
    await expect(verifyPreflight(client, cfg, parsePreflightResponse({ ...raw, answer: a }), expected)).rejects.toMatchObject({
      code: "digest-mismatch",
    });
  });

  it("a reservation that pays someone else is rejected", async () => {
    await expect(
      verifyPreflight(client, cfg, parsePreflightResponse(raw), { ...expected, client: RECEIVER }),
    ).rejects.toMatchObject({ code: "client-mismatch" });
  });

  it("an unknown guest vkey is rejected", async () => {
    await expect(
      verifyPreflight(client, cfg, parsePreflightResponse({ ...raw, guestVkey: keccak256("0x01") }), expected),
    ).rejects.toMatchObject({ code: "vkey-mismatch" });
  });

  it("another contract is rejected (pinned codehash)", async () => {
    const other = { ...cfg, swornCodehash: keccak256("0x00") as Hex };
    await expect(verifyPreflight(client, other, parsePreflightResponse(raw), expected)).rejects.toMatchObject({
      code: "codehash-mismatch",
    });
  });

  it("reads where a payment went; a wrong payment hash is an error", async () => {
    const p = await readPayment(client, { txHash: payTx, token: PATH_USD, from: AGENT, receiver: RECEIVER });
    expect(p.credited).toBe(500_000_000n);
    expect(p.diverted).toBe(0n);
    expect(p.receiverBalance.after - p.receiverBalance.before).toBe(500_000_000n);
    await expect(readPayment(client, { txHash: WRONG_TX, token: PATH_USD, from: AGENT, receiver: RECEIVER })).rejects.toMatchObject({
      code: "tx-not-found",
    });
  });

  it("a transfer to a receiver whose policy blocks the sender lands in ReceivePolicyGuard", async (ctx) => {
    if (!blockedTx) {
      console.warn(`SKIPPED: this anvil cannot set a receive policy (${policyUnsupported})`);
      return ctx.skip();
    }
    const p = await readPayment(client, { txHash: blockedTx, token: PATH_USD, from: AGENT, receiver: BLOCKED });
    expect(p.success).toBe(true);
    expect(p.credited).toBe(0n);
    expect(p.diverted).toBe(500_000_000n);
    expect(p.blockedByPolicy).toBe(true);
    expect(p.receiverBalance.after).toBe(p.receiverBalance.before);
    expect(p.guardBalance.after - p.guardBalance.before).toBe(500_000_000n);
    const f = await readOwnerFeed(client, cfg, AGENT, PATH_USD);
    expect(f.notices.find((n) => n.kind === "diverted")?.txHash).toBe(blockedTx);
  });

  it("a payout read from a tx with no Slashed event is an error, not a number", async () => {
    await expect(readSlash(client, cfg, { txHash: raw.reserveTx as Hex })).rejects.toMatchObject({ code: "no-slash-event" });
    await expect(readSlash(client, cfg, { txHash: WRONG_TX })).rejects.toMatchObject({ code: "tx-not-found" });
  });

  it("owner feed lists the reservation from logs", async () => {
    const f = await readOwnerFeed(client, cfg, AGENT, PATH_USD);
    const r = f.notices.find((n) => n.kind === "reserved");
    expect(r?.amount).toBe(500_000_000n);
    expect(r?.aboutBlock).toBe(BigInt((raw.question as { blockNumber: string }).blockNumber));
  });
});

describe("parsing the server's JSON", () => {
  it("rejects a malformed response", () => {
    expect(() => parsePreflightResponse({ question: {}, answer: {} })).toThrow(DataError);
    expect(() => parsePreflightResponse(null)).toThrow(/body/);
  });
});
