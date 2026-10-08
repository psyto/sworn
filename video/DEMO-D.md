# Demo video D: Sworn (90 seconds, founder voice), v6-D, 2026-10-08

**The idea.** A concise edit of demo C that keeps two facts separate. First, a local job proves Tempo's
integration-test fixture (dev chain 1337) and is checked read-only against `SwornZoneVerifierWithdrawal`.
Second, a different, earlier OwnZone run (zone 4242, blocks 56–61, different verifier) settled batches and
then paid a withdrawal. A dedicated in-video cut makes that boundary explicit.

**Status.** Silent picture + narration script + subtitles: `video/demo-d.mp4`, built by
`record-demo-d.mjs`. Every chain figure shown by the retained clips is checked by the original demo-C
recorder; demo D re-reads the relevant receipts, bytecode hashes and transaction destinations before it
assembles. The final card and persistent footer keep the testnet scope visible.

| scene | target | picture |
|---|---:|---|
| 1 Two demonstrations | 10 s | title card with the boundary stated upfront |
| 2 Fixture proof job | 15 s | local Operator Console |
| 3 Privacy boundary | 8 s | what remains private / what becomes public |
| 4 Fixture verified read-only | 14 s | evidence page, explorer, and re-verification |
| 5 Separate OwnZone run | 5 s | explicit factual cut card |
| 6 OwnZone settlement and payout | 10 s | own Zone and payout explorer |
| 7 Forged batch rejected | 10 s | failed forged batch trace |
| 8 Re-run the evidence | 8 s | vector export and Forge test |
| 9 The outcome | 10 s | conclusion, links, and scope |

## Scene 1 — two demonstrations · ≈ 10 s

> Sworn is for Tempo Zones, where only the operator sees every transaction. It makes that private execution checkable. Two separate demonstrations follow.

## Scene 2 — fixture proof job · ≈ 15 s

> An operator runs a real proof job for Tempo's integration-test fixture: deposit and withdrawal blocks five through six, on dev chain 1337. Nothing is sent.

## Scene 3 — privacy boundary · ≈ 8 s

> The witness stays private. The verifier learns the batch is valid, not balances, senders, recipients or amounts.

## Scene 4 — fixture verified read-only · ≈ 14 s

> This fixture batch was attested on Moderato earlier. Re-verify it live: the real batch passes; change one field, and it reverts.

## Scene 5 — separate OwnZone run · ≈ 5 s

> Separately, on our own Zone: a different batch and verifier.

## Scene 6 — OwnZone settlement and payout · ≈ 10 s

> There, the portal settled three batches only after the proof passed. Then our sequencer paid a withdrawal.

## Scene 7 — forged batch rejected · ≈ 10 s

> A forged batch, even signed by our own sequencer, was rejected: a real proof cannot authorize a different batch.

## Scene 8 — re-run the evidence · ≈ 8 s

> Export the live verify calls. Re-run the tests against deployed bytecode.

## Scene 9 — the outcome · ≈ 10 s

> Sworn turns private execution into verifiable evidence. On our own Zone, a withdrawal was paid only after the proof passed.

## Claims and sources

Fixture result: `deployments/moderato.json` → `SwornZoneVerifierWithdrawal`, and
`docs/specs/003-zone-verifier.md` → the withdrawal-fixture result. The proof job is job
`2026-10-07T21-52-51-659Z-53a247da`, with fixture
`deposit_and_withdrawal_blocks5-6` from Tempo integration tests (dev chain 1337); it is read-only against
`0xF2e1…BA11` and sends nothing.

OwnZone result: `deployments/moderato.json` → `OwnZone`, and the spec's **Results (own Zone live run on
Moderato)**. It is our own Zone (zone 4242), outside Tempo's factory, with one operator and one sequencer;
it is not Tempo-created. Its zone-blocks-56–61 proof was proven earlier by the founder's own prover for
`0x15D1…2733`. The portal settles only after verification; its sequencer separately called
`processWithdrawals` to pay the withdrawal. It is a testnet, unaudited, non-censorship-resistant prototype.

Rejection result: the forged transaction `0x3a154e4e…167d` contains a valid sequencer certificate and a
replayed real proof of blocks 56–61, but a made-up withdrawal queue and other forged batch inputs. The proof
was not tampered with: it does not match the forged batch, so `SwornZoneVerifier` reverts `InvalidProof()`
and the portal state is unchanged. This is distinct from the read-only `nextZoneHeight + 1` field-change
check in scene 4.
