// The Zone batch proofs on Moderato, read-only against the public RPC.
//  - the primary evidence: the batch with a withdrawal (SwornZoneVerifierWithdrawal, attest 0xa630…);
//  - the three "Verify again" rows, live: Sworn true, Sworn mutated → InvalidProof(), Moderato pre-T13 stub → true;
//  - the secondary "also verified" line (hardfork_t13_recovery, attest 0xb14b…).
import { readFileSync } from "node:fs";
import { getAddress, keccak256 } from "viem";
import { getCode } from "viem/actions";
import { describe, expect, it } from "vitest";
import deployments from "../../deployments/moderato.json";
import wdFixture from "../../contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json";
import hfFixture from "../../contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json";
import { makePublicClient } from "../src/chain/client.ts";
import { MODERATO } from "../src/chain/config.ts";
import {
  BATCH_CONTENTS,
  HARDFORK_BATCH,
  PRE_T13_SELECTOR,
  isNonZero,
  readAttestLine,
  readZoneAttest,
  verifyZoneNow,
} from "../src/chain/zone.ts";

const client = makePublicClient(MODERATO);
const wd = deployments.SwornZoneVerifierWithdrawal;
const hf = deployments.SwornZoneVerifier;

describe("Zone batch with a withdrawal (Moderato, read-only)", () => {
  it("the attest tx's ZoneBatchVerified event decodes to the fixture; the batch has 1 withdrawal, 2 user txs, a non-zero withdrawalQueueHash", async () => {
    const z = await readZoneAttest(client, MODERATO);
    expect(z.txHash).toBe(wd.attest.tx);
    expect(z.txHash.startsWith("0xa63009fd")).toBe(true);
    expect(z.contract).toBe(getAddress(wd.address));
    expect(z.blockNumber).toBe(BigInt(wd.attest.block));
    expect(z.gasUsed).toBe(BigInt(wd.attest.gasUsed));
    expect(z.from).toBe(deployments.roles.deployer_and_challenger);
    expect(z.event.zoneId).toBe(wdFixture.args.zoneId);
    expect(z.event.nextZoneHeight).toBe(BigInt(wdFixture.args.nextZoneHeight));
    expect(z.event.prevBlockHash).toBe(wdFixture.args.prevBlockHash);
    expect(z.event.nextBlockHash).toBe(wdFixture.args.nextBlockHash);
    expect(z.event.digest).toBe(wdFixture.digest);
    expect(z.digestMatchesFixture).toBe(true);
    expect(z.calldataMatchesFixture).toBe(true);
    expect(z.withdrawalQueueHash).toBe(wdFixture.args.withdrawalQueueHash);
    expect(isNonZero(z.withdrawalQueueHash)).toBe(true);
    expect(z.immutablesMatch).toBe(true);
    expect(z.immutables.parentChainId).toBe(1337n);
    expect(z.immutables.pinnedGenesisArtifactHash).toBe(wdFixture.genesisArtifactHash);
    expect(z.codehash).toBe(wd.codehash);
    expect(z.codehashMatches).toBe(true);
    // counts come from deployments/moderato.json's record of the batch, which must agree with the fixture
    expect(BATCH_CONTENTS.withdrawals).toBe(1);
    expect(BATCH_CONTENTS.userTransactions).toBe(2);
    expect(BATCH_CONTENTS.recordAgrees).toBe(true);
    expect(BATCH_CONTENTS.integrationTest).toBe("l1_e2e::test_deposit_and_withdrawal");
  }, 120_000);

  it("Verify again, live: Sworn true; Sworn height+1 → InvalidProof(); Moderato pre-T13 stub with a malformed batch → true", async () => {
    const v = await verifyZoneNow(client, MODERATO);
    expect(v.real).toBe(true);
    expect(v.mutatedHeight).toBe(BigInt(wdFixture.args.nextZoneHeight) + 1n);
    expect(v.mutatedError).toBe("InvalidProof");
    expect(v.preT13.selector).toBe("0x7106a43e");
    expect(v.preT13.result).toBe("true");
  }, 120_000);

  it("the code at 0x5A56… is tempo's pre-T13 ZONE_VERIFIER_RUNTIME, which dispatches only the selector the page calls", async () => {
    const src = readFileSync(new URL("../../tempo/crates/contracts/src/zones.rs", import.meta.url), "utf8");
    const m = src.match(/pub const ZONE_VERIFIER_RUNTIME: Bytes = bytes!\(([\s\S]*?)\);/);
    expect(m).not.toBeNull();
    const runtime = "0x" + [...m![1].matchAll(/"([^"]*)"/g)].map((x) => x[1].replace(/^0x/, "")).join("");
    expect(runtime).toContain(`63${PRE_T13_SELECTOR.slice(2)}`);
    const code = await getCode(client, { address: MODERATO.preT13Verifier });
    expect(code?.toLowerCase()).toBe(runtime.toLowerCase());
    expect(keccak256(code!)).toBe(keccak256(runtime as `0x${string}`));
  }, 120_000);
});

describe("Also verified: hardfork_t13_recovery (Moderato, read-only)", () => {
  it("its attest tx still reads, and its event decodes to its fixture", async () => {
    const l = await readAttestLine(client, MODERATO, HARDFORK_BATCH);
    expect(l.txHash).toBe(hf.attest.tx);
    expect(l.contract).toBe(getAddress(hf.address));
    expect(l.blockNumber).toBe(BigInt(hf.attest.block));
    expect(l.event.zoneId).toBe(hfFixture.args.zoneId);
    expect(l.event.nextZoneHeight).toBe(BigInt(hfFixture.args.nextZoneHeight));
    expect(l.event.digest).toBe(hfFixture.digest);
    expect(l.digestMatchesFixture).toBe(true);
    expect(l.calldataMatchesFixture).toBe(true);
  }, 120_000);
});
