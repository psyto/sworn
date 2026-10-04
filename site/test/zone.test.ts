// The Zone batch proof on Moderato, read-only against the public RPC.
import { describe, expect, it } from "vitest";
import deployments from "../../deployments/moderato.json";
import fixture from "../../contracts/test/vectors/zone-hardfork.json";
import { makePublicClient } from "../src/chain/client.ts";
import { MODERATO } from "../src/chain/config.ts";
import { readZoneAttest, verifyZoneNow } from "../src/chain/zone.ts";

const client = makePublicClient(MODERATO);
const rec = deployments.SwornZoneVerifier;

describe("Zone batch verifier (Moderato, read-only)", () => {
  it("the attest tx's ZoneBatchVerified event decodes to the recorded values", async () => {
    const z = await readZoneAttest(client, MODERATO);
    expect(z.blockNumber).toBe(BigInt(rec.attest.block));
    expect(z.gasUsed).toBe(BigInt(rec.attest.gasUsed));
    expect(z.from).toBe(deployments.roles.deployer_and_challenger);
    expect(z.event.zoneId).toBe(fixture.args.zoneId);
    expect(z.event.nextZoneHeight).toBe(BigInt(fixture.args.nextZoneHeight));
    expect(z.event.prevBlockHash).toBe(fixture.args.prevBlockHash);
    expect(z.event.nextBlockHash).toBe(fixture.args.nextBlockHash);
    expect(z.event.digest).toBe(fixture.digest);
    expect(z.digestMatchesFixture).toBe(true);
    expect(z.calldataMatchesFixture).toBe(true);
    expect(z.immutablesMatch).toBe(true);
    expect(z.immutables.parentChainId).toBe(1337n);
    expect(z.codehash).toBe(rec.codehash);
    expect(z.codehashMatches).toBe(true);
  }, 120_000);

  it("verify(real proof) returns true live, and nextZoneHeight + 1 reverts InvalidProof()", async () => {
    const v = await verifyZoneNow(client, MODERATO);
    expect(v.real).toBe(true);
    expect(v.mutatedHeight).toBe(BigInt(fixture.args.nextZoneHeight) + 1n);
    expect(v.mutatedError).toBe("InvalidProof");
  }, 120_000);
});
