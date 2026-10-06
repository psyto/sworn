## Verdict: top tier, but not my Tempo-track winner

The live own-Zone run moves this from “clever integration spike” to credible technical execution. It is a top-tier technical submission; I would still rank it below a winner with a native-Tempo integration or real buyer evidence.

The three deciding factors:

1. **[V] Real end-to-end proof-gated settlement exists.** Three successful portal submissions called the deployed verifier and SP1 gateway; then the portal paid 0.5 pathUSD.
2. **[V] It is not deployable to Tempo-created Zones today.** The only live integration is a founder-controlled, outside-factory Zone.
3. **[I] The business case is presently a thesis, not a market.** One effective native operator, no design partner, no buyer requirement, no price, and a prover too slow for continuous operation.

## Chain verdict

**[V] “Proof-gated settlement” is true, narrowly.** `submitBatch` calls `IVerifier.verify` before updating portal state and enqueueing the withdrawal queue; `processWithdrawals` can only pay an already-queued withdrawal. The three traces each show:

`OwnZonePortal → STATICCALL SwornZoneVerifier → STATICCALL SP1 gateway`, with no error.

Verified receipts:

- `0x8f08…472b`: status 1, to portal, block **38,409,298**; anchor 38,406,403; age **2,895**
- `0x334a…84ce`: status 1, block **38,410,336**; anchor 38,406,408; age **3,928**
- `0x4062…83b4`: status 1, block **38,411,547**; anchor 38,406,414; age **5,133**
- payout `0xfc31…e1f1`: status 1, to portal, block **38,411,550**; `WithdrawalProcessed`, user balance increased **500,000** base units / **0.5 pathUSD**.

`portal.verifier()` is `0x15D192…2733`; zone 4242, withdrawal index 3, height 61. Verifier immutables match the record: SP1 gateway `0x2c77…9B18`, parent chain 42431, pinned zone 4242, vkey `0x00ab…5c7b`, genesis hash `0xb31a…4bbf`.

But it is a **necessary condition, not a liveness guarantee**: the single sequencer can withhold proving or `processWithdrawals`, and also decrypts deposits.

## Claims audit

- **MAJOR [V] — Necessary condition is repeatedly phrased as sufficient protection.**  
  Quotes: README 10–14; form 22, 46; pitch 50–51; demo 88–90; interview 15–16, 39–43; site `OwnZone.tsx` 18–22.  
  “Portal pays a withdrawal only after Sworn’s proof passes” is true, but hides the sequencer’s subsequent discretionary `processWithdrawals`.  
  Replace everywhere with:  
  > “In our one-off own-Zone run, `submitBatch` verified Sworn’s proof before queuing each batch. After the proven withdrawal batch settled, our sequencer called `processWithdrawals`, which paid 0.5 pathUSD. This is ZK-gated, not censorship-resistant.”

- **MAJOR [V] — Demo scene 2 blurs Tempo’s generic portal behavior with Sworn.**  
  `video/DEMO.md:44`: “Tempo’s portal pays a withdrawal only after the Zone verifier accepts the batch…”  
  Exact replacement:  
  > “A ZonePortal accepts a batch only after its configured verifier accepts it; that queues its withdrawals. In our own Zone, that configured verifier is Sworn.”

- **MAJOR [V] — Form falsely broadens the execution environment.**  
  `_submission/cwf-form.md:166`: “Built and measured … all on Moderato testnet,” followed by dev-chain fixture results.  
  Replace with:  
  > “Built inside the window, with on-chain verification and the own-Zone settlement run on Moderato testnet. The five verifier fixtures executed on development chain 1337.”

- **MAJOR [V] — “contracts with no owner” is materially imprecise.**  
  `_submission/cwf-form.md:169`. `SwornZoneVerifier` has no privileged surface, but `OwnZonePortal` retains upstream `admin`, sequencer, pause, token, and configuration controls; on chain its admin is the deployer.  
  Replace with:  
  > “The immutable SwornZoneVerifier instances have no owner; the own-Zone portal intentionally retains upstream admin and sequencer controls.”

- **MAJOR [V] — Cost answer omits the live run’s worst case.**  
  `_submission/INTERVIEW.md:85–88` says “per batch” is 701–891 seconds / 19–26M cycles. The own-zone first batch was **1,881 s / 123.8M cycles**.  
  Replace with:  
  > “Fixture batches measured 19–26M cycles and 701–891 seconds. The live own-Zone batches ranged from 26–124M cycles and 664–1,881 seconds, depending on replay length. We have not measured production cost, throughput, or proving-network performance.”

- **MINOR [V] — Public metadata is under-described.**  
  `site/src/ui/sections.tsx:210–18`, demo 56–57: “Only hashes and counters.” The public statement also includes zone ID, block numbers, anchor, verifier/config, genesis hash, and chain.  
  Replace:  
  > “Only a proof digest, hashes, counters, and public batch metadata reach Tempo—not transaction contents, balances, senders, recipients, or amounts.”

- **MINOR [V] — Historical-document contradictions invite doubt.**  
  `deployments/moderato.json:4` says records are from 2026-10-03 despite the 10-06 run. `FEASIBILITY.md:3–6` says no public transaction was sent, before later documenting the live run. Spec 003 §2/§5 still frames portal wiring as a non-goal/D2 globally. Add temporal scope, e.g. “before the 2026-10-06 live run,” and make §5 explicitly fixture-deployment-only.

- **BLOCKER [V] — Required video URLs remain blank.**  
  `_submission/cwf-form.md:122,140`; the checker reports two pending fields. Do not submit until real public URLs replace both placeholders.

The disclosure itself is now strong: README and page disclose “own,” outside-factory, one operator, testnet, unaudited, and native Zones unchanged early. Do **not** make it more apologetic. Add the single liveness qualifier above rather than more caveat cards.

## Technical interview

What is genuinely valuable is not SP1 or `prove_zone_batch` itself. It is the Tempo-specific porting, exact `IVerifier`-shaped binding, genesis/verifier/chain binding, on-chain Groth16 verification, and the demonstrated portal path.

A skeptical engineer will attack:

- authoritative-witness/canonical-state assumptions;
- custom guest and forced T13 zone schedule while Moderato was T11;
- trusted pinned genesis;
- no native factory adoption path;
- replay-size-dependent proving time and inability to run continuously;
- operator withholding and single-key concentration.

Interview Q6 is good. Q8 is weak: “Zones are for businesses” is conjecture. Say: “There is no demonstrated market today. The immediate buyer hypothesis is either a Zone team with a reviewer requirement or Tempo itself; a design-partner conversation is the next falsifiable test.” Q9 should distinguish Moderato’s then-current testnet stub from Tempo production, not imply Tempo’s security design is generally deficient.

## Pitch and demo

The pitch is visually excellent and scene 3 is the winning evidence. It should reach that evidence faster and spend less time on generic GTM.

**[MAJOR V]** The scene estimates total about 122 seconds despite the “under 118” claim. Re-time after narration.

Cut scene 4 to: “No traction yet. Next, one Zone business supplies a batch and its reviewer decides whether repetition has a budget.” Move the saved time to scene 3 and say “our own, one-operator Zone—not Tempo-created” aloud there.

The demo’s scene 4/5 prototype-stub comparison is overlong and risks looking like an attack on Tempo. Keep the “equivalent, not identical ABI” caveat, but cut it to a short contrast. Give scene 6 another 10 seconds to show portal → verifier → payout and say the liveness qualification.

## Ranked remaining actions

1. **BLOCKER — Publish narrated pitch/demo and fill form URLs.** No chain action.
2. **MAJOR — Standardize the precise settlement sentence across all surfaces.** No chain action; re-record both videos.
3. **MAJOR — Fix form’s “all Moderato” and “contracts with no owner” claims; fix stale document dates/scopes.** No chain action.
4. **MAJOR — Recut pitch to foreground the own-Zone evidence by ~25 seconds; shorten GTM and prototype-stub exposition.** No chain action.
5. **MAJOR — Prepare stronger Q8/Q9/Q11 answers, especially authoritative witness, native integration, and 664–1,881 s live proving.** No chain action.
6. **MINOR — Label the local Console’s fixed header as cross-site protection, not operator authorization; prior review’s local-job-auth finding remains unresolved.** No chain action.

No recommended action requires a new transaction or rerun.