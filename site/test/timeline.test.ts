// The page's data layer against the public Moderato RPC. Bounded: each test has a hard timeout and viem
// retries rate-limited calls (retryCount 6). A wrong hash must give an error state, never a number.
import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import deployments from "../../deployments/moderato.json";
import { makePublicClient } from "../src/chain/client.ts";
import { MODERATO, TAKES, type Take } from "../src/chain/config.ts";
import { load, type Loadable } from "../src/chain/loadable.ts";
import { readProofPins, readTimeline, type Timeline } from "../src/chain/timeline.ts";

const client = makePublicClient(MODERATO);
const take = TAKES.find((t) => t.id === "demoLiveTake")!;

describe("timeline data layer (Moderato, read-only)", () => {
  it("a wrong tx hash gives an error state and no value", async () => {
    const wrong: Take = { ...take, reserveTx: ("0x" + "ab".repeat(32)) as Hex };
    const states: Loadable<Timeline>[] = [];
    const final = await load(() => readTimeline(client, MODERATO, wrong), (s) => states.push(s));
    expect(states.map((s) => s.status)).toEqual(["loading", "error"]);
    expect(final.status).toBe("error");
    if (final.status !== "error") return;
    expect(final.error.code).toBe("tx-not-found");
    expect("value" in final).toBe(false);
  }, 60_000);

  it("demoLiveTake read from chain matches deployments/moderato.json", async () => {
    const r = await load(() => readTimeline(client, MODERATO, take), () => {});
    if (r.status === "error") throw r.error;
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    const t = r.value;
    const d = deployments.demoLiveTake;
    expect(t.payment.success).toBe(true);
    expect(t.payment.blockNumber).toBe(BigInt(d.paymentBlock));
    expect((t.payment.guardAfter - t.payment.guardBefore).toString()).toBe(d.guardDelta); // guard +500
    expect((t.payment.receiverAfter - t.payment.receiverBefore).toString()).toBe(d.receiverDelta); // receiver +0
    expect(t.slash.blockNumber).toBe(BigInt(d.challengeBlock));
    expect((t.slash.clientAfter - t.slash.clientBefore).toString()).toBe(d.clientPathUSDDelta); // client +500
    expect(t.slash.coverage.toString()).toBe(d.clientPathUSDDelta);
    expect(t.reservation.claimedDelta).toBe(500_000_000n); // the lie: "+500"
    expect(t.reservation.coverage).toBe(500_000_000n);
    expect(t.reservation.client).toBe(deployments.roles.client);
    expect(t.reservation.server).toBe(deployments.roles.dishonest_demo_server);
  }, 120_000);

  it("proof pins read from chain match deployments/moderato.json", async () => {
    const p = await readProofPins(client, MODERATO);
    expect(p.verifier).toBe(deployments.SP1VerifierGroth16.address);
    expect(p.verifierVersion).toBe(deployments.SP1VerifierGroth16.VERSION);
    expect(p.guestVkey).toBe(deployments.Sworn.GUEST_VKEY);
    expect(p.guestVersionIsV1).toBe(true);
  }, 60_000);
});

describe("the other two slashes read cleanly too", () => {
  for (const t of TAKES.filter((t) => t.id !== "demoLiveTake")) {
    it(t.id, async () => {
      const v = await readTimeline(client, MODERATO, t);
      expect(v.payment.success).toBe(true);
      expect(v.payment.receiverAfter - v.payment.receiverBefore).toBe(0n);
      expect(v.payment.guardAfter - v.payment.guardBefore).toBe(v.reservation.amount);
      expect(v.slash.clientAfter - v.slash.clientBefore).toBe(v.slash.coverage);
    }, 120_000);
  }
});
