// Our own Zone on Moderato (2026-10-06), read-only against the public RPC: the portal calls the recorded
// verifier, three batches settled through it, and the payout is the demo user's 0.5 pathUSD.
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import deployments from "../../deployments/moderato.json";
import { makePublicClient } from "../src/chain/client.ts";
import { MODERATO } from "../src/chain/config.ts";
import { decodePayout, readOwnZone, OWN_ZONE } from "../src/chain/ownZone.ts";

const client = makePublicClient(MODERATO);
const oz = deployments.OwnZone;

describe("Own Zone live run (Moderato, read-only)", () => {
  it("the portal calls the recorded verifier; 3 batches settled through it; the payout is +0.5 pathUSD to the user", async () => {
    const z = await readOwnZone(client, MODERATO);
    expect(z.portal).toBe(getAddress(oz.OwnZonePortal.address));
    expect(z.portalVerifier).toBe(getAddress(oz.SwornZoneVerifier.address));
    expect(z.zoneId).toBe(oz.zoneId);
    expect(z.parentChainId).toBe(BigInt(MODERATO.chainId));
    expect(z.pinnedZoneId).toBe(oz.zoneId);
    expect(z.withdrawalBatchIndex).toBe(3n);
    expect(z.zoneHeight).toBe(61n);
    expect(z.batches.map((b) => b.blockNumber)).toEqual(oz.batches.map((b) => BigInt(b.submitBlock)));
    expect(z.batches.map((b) => Number(b.anchorAge))).toEqual(oz.batches.map((b) => b.anchorAgeAtSubmit));
    expect(z.batches.every((b) => b.anchorAge < 8190n)).toBe(true);
    expect(z.payout.blockNumber).toBe(BigInt(oz.payout.block));
    expect(z.payout.to).toBe(OWN_ZONE.user);
    expect(z.payout.amount).toBe(500000n);
  }, 120_000);

  it("decodePayout refuses a receipt without the portal's WithdrawalProcessed event", () => {
    expect(() => decodePayout([], OWN_ZONE.portal)).toThrow(/no WithdrawalProcessed/);
  });
});
