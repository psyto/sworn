Verdict: the r4 fixes are locally sound. No new local BLOCKER. One X-reply scope omission and one attribution line should be fixed before posting. Network is restricted here, so current live-page, RPC, YouTube playback, and X-handle checks remain [I].

## r4 fixes

| Status | Finding |
|---|---|
| Resolved [V] | Confide’s pre-window origin is now explicit in the repo-context field: separate Sep. 12 repo; no product code in Sworn. [form:116](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:116) |
| Resolved [V] | “4 integration-test batches” matches the four named batches. [spec 003:190](/Users/hiroyusai/src/sworn/docs/specs/003-zone-verifier.md:190) |
| Resolved [V] | The payout is correctly described as a separate sequencer `processWithdrawals` action. [form:167](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:167) |
| Resolved [V] | Bonded answers is clearly labelled a separate experiment. [form:58](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:58) |
| Resolved [V] | Fixture and own-Zone verifier instances are distinguished. [form:52](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:52) |
| Resolved [V] | Metadata now says the operator’s “sequencer set,” matching the visible page. [index.html:7](/Users/hiroyusai/src/sworn/site/index.html:7) |

No form-limit regression [V]: 28 fields/28 headings; all bodies fit. Tightest are Why `998/1000`, demand `996/1000`, and context `498/500`. `cwf-form.sh` itself could not run because this read-only sandbox denies Bash’s temporary here-doc file, but an equivalent read-only parse found no over-limit field or pending marker inside a field.

The earlier hours discrepancy is also resolved [V]: the later founder-labelled commit changes the field to “about 20 hours a week.”

## Thesis lead

- **MINOR [V] — “private ledgers that settle in batches” is slightly loose.** Zones process transactions continuously and submit *batches of withdrawals* to Tempo; “ledger settles in batches” can imply all execution is batched. [Zones README:32](/Users/hiroyusai/src/sworn/spikes/zone-spf/zones/README.md:32)

  Minimal replacement everywhere it leads: “private ledgers that batch withdrawals for settlement.” This affects [Hero:70](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:70), [README:3](/Users/hiroyusai/src/sworn/README.md:3), and [YouTube:21](/Users/hiroyusai/src/sworn/video/YOUTUBE.md:21).

- **No finding [V] — “essential for businesses.”** The form correctly attributes this as the founder’s belief. [form:44](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:44) It is a thesis, not a factual claim of demand.

- **No finding [V] — “But then who can check a private batch?”** It works as a rhetorical question. The following copy narrows the actual claim to an operator-supplied batch and on-chain verification.

- **MINOR [V] — residual voiced shorthand, not a re-voice request.** The finished pitch/demo still say “only the operator sees every transaction,” while the new lead accurately says “operator’s sequencer set.” [Pitch script:12](/Users/hiroyusai/src/sworn/video/PITCH-D.md:12) Read as “the operator organization,” it is not materially contradictory; leave voiced media alone under the stated constraint.

## X post

- **MINOR [V] — Zcash line:** Narrow it one word: “Zcash uses zero knowledge to prove a **shielded** transaction is valid without revealing it.” That tracks the permitted comparison and avoids implying every Zcash transaction is shielded.

- **MINOR [V] — mechanism wording:** “puts … inside a ZK proof” is technically imprecise. The verifier runs in SP1; the proof proves that execution.

  Replace: “Sworn runs Tempo’s own Zone verifier in SP1; the resulting proof is checkable on chain.”

- **MINOR [V] — mutation claim:** “Change one field → rejected” is demonstrated for proof-bound batch inputs, not a blanket statement about every arbitrary field.

  Replace: “Change one proof-bound input → rejected.”

- **MINOR [V] — testnet:** “Live on testnet” is supportable locally, but “Testnet only.” better preserves the project boundary.

- **MAJOR [V] — the reply does not actually state that the fixture is dev-chain evidence.** It says “our own Zone” only in the third bullet; readers can still infer the earlier proof was from a Tempo-created live Zone. Add the missing split directly:

  “For a Tempo integration-test fixture (dev chain 1337), `zone_spf::prove_zone_batch` ran in SP1; its Groth16 proof is bound to IVerifier-shaped inputs and verified on Moderato.”

  Then retain: “Separately, on our own one-operator Zone…”

- **MAJOR [V] — do not say it was “compiled for SP1 by @succinctlabs.”** The repo establishes Sworn compiled/ported it; Succinct supplies SP1. The wording attributes Sworn’s work to a third party and invites an endorsement inference. Remove the handle and use “compiled for SP1, with verification logic unchanged.”

- **MINOR [I] — mentions/hashtags:** `@tempo` as a direct product question and `@colosseum` as the event reference do not assert endorsement. `@succinctlabs` is unnecessary after the attribution fix. I would remove it and all three hashtags, or retain only `#ZK`; the current three mentions plus three tags risks looking promotional. I could not recheck handle ownership.

## Remaining gate

- **MAJOR [I] — founder must perform final external QA before submitting:** logged-out playback for both YouTube links, live-page load and on-chain re-verification, and exact X handles. This was not verifiable here because network access is restricted.

With the two X corrections above and that external QA, I see no remaining local BLOCKER or MAJOR in the form.