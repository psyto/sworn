## BLOCKER

- [DEMO.md:9](/Users/hiroyusai/src/sworn/video/DEMO.md:9) gives T12 as “≈ 2026-10-08 09:00 JST.” Vendored Moderato schedule sets T12 at Unix `1791468000` ([spec.rs:1016-1023](/Users/hiroyusai/src/sworn/tempo/crates/chainspec/src/spec.rs:1016)), which is **2026-10-08 23:00 JST**, not 09:00. Do not record the current time.

- [DEMO.md:35-37](/Users/hiroyusai/src/sworn/video/DEMO.md:35): “Being right costs nothing” is false. A correct server still pays the reserve transaction fee and has its coverage locked for the 24-hour challenge period; only after expiry can it be released ([Sworn.sol:72-79](/Users/hiroyusai/src/sworn/contracts/src/Sworn.sol:72), [332-340](/Users/hiroyusai/src/sworn/contracts/src/Sworn.sol:332)). Replace with “a correct answer is not slashed.”

## MAJOR

- [PITCH.md:17-19](/Users/hiroyusai/src/sworn/video/PITCH.md:17): “Agents are starting…” and “on Tempo, they do it over MPP” have no supplied evidence. The MPP refund quotation is **unverified** because `mpp.dev` was expressly out of scope. Even if true, “the agent has no recourse” does not logically follow from “refund decisions are up to your service”; it excludes other recourse without evidence.

- [PITCH.md:26-28](/Users/hiroyusai/src/sworn/video/PITCH.md:26): The diversion claim is supported for the recorded transaction: guard +500, receiver +0 ([moderato log:46-48](/Users/hiroyusai/src/sworn/out/e2e/moderato-20261003T064745Z.log:46)); the source code also sends blocked inbound funds to the guard ([tip20/mod.rs:1349-1386](/Users/hiroyusai/src/sworn/tempo/crates/precompiles/src/tip20/mod.rs:1349)). But “You only see that by executing the payment” is false: the repo itself calls `validateReceivePolicy` before payment ([moderato log:15-16](/Users/hiroyusai/src/sworn/out/e2e/moderato-20261003T064745Z.log:15)).

- [PITCH.md:44](/Users/hiroyusai/src/sworn/video/PITCH.md:44) and [DEMO.md:58](/Users/hiroyusai/src/sworn/video/DEMO.md:58): “Tempo’s team hasn’t shipped…” / “Tempo’s own code doesn’t…” are too broad. The cited external Zones source is **unverified**; the quoted text, as reproduced locally, only describes `zone-spf` as a normal Rust verifier rather than a `no_std` proving guest ([README.md:90-95](/Users/hiroyusai/src/sworn/README.md:90)). Say “the cited `zone-spf` source describes itself as…” only if you can independently verify it.

- [PITCH.md:44-45](/Users/hiroyusai/src/sworn/video/PITCH.md:44) and [DEMO.md:55-57](/Users/hiroyusai/src/sworn/video/DEMO.md:55): “40 of 40” is real but narrowly scoped: selected first-in-block, top-level TIP-20 transfers; no later sender/receiver touch; 34 type-2, 4 AA, 2 legacy; no reverting real transaction ([README.md:60](/Users/hiroyusai/src/sworn/README.md:60), [README.md:81-88](/Users/hiroyusai/src/sworn/README.md:81), [host/src/main.rs:369-425](/Users/hiroyusai/src/sworn/host/src/main.rs:369)). It compares status, gas, logs, fee token/amount, and selected balances—not “the live chain” generally ([host/src/main.rs:535-598](/Users/hiroyusai/src/sworn/host/src/main.rs:535)). State the scope onscreen.

- [DEMO.md:22](/Users/hiroyusai/src/sworn/video/DEMO.md:22): “500 dollars” is unsupported. The app displays `USD`, but this is Moderato testnet and the recorded evidence is six-decimal PathUSD/AlphaUSD units. Say “500 testnet USD units” unless you can establish redeemability.

- [DEMO.md:26-28](/Users/hiroyusai/src/sworn/video/DEMO.md:26): “Seven minutes on a laptop” overstates the evidence. The Moderato run was 413.7 seconds ([deployments/moderato.json:29-42](/Users/hiroyusai/src/sworn/deployments/moderato.json:29)); no cited source identifies the machine as a laptop. “About seven minutes locally in this run” is supported. “The proof checks out on-chain” should be “the contract verifies the Groth16 proof, then compares its proven answer”: `challenge()` calls `verifyProof` before `AnswerCorrect` comparison ([Sworn.sol:320-324](/Users/hiroyusai/src/sworn/contracts/src/Sworn.sol:320)).

- [DEMO.md:35-36](/Users/hiroyusai/src/sworn/video/DEMO.md:35): The honest result was a **dry-run**, with a real pre-existing proof; nothing was sent ([honest recheck:8-10](/Users/hiroyusai/src/sworn/out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log:8)). Say “a dry-run with a real proof returns `AnswerCorrect`,” not that an on-chain challenge was rejected.

- [DEMO.md:45-48](/Users/hiroyusai/src/sworn/video/DEMO.md:45): The SDK does not unconditionally pin a contract codehash or SP1 verifier address. It checks the configured contract identity and vkey; codehash checking is optional ([sdk/index.ts:128-138](/Users/hiroyusai/src/sworn/sdk/src/index.ts:128)). Witness capture can fail and returns `UNPROTECTED`; it has a 120-second default deadline, not a “within seconds” guarantee ([sdk/index.ts:194-207](/Users/hiroyusai/src/sworn/sdk/src/index.ts:194)). The 8.7 seconds is one measured Moderato run ([moderato log:27-29](/Users/hiroyusai/src/sworn/out/e2e/moderato-20261003T064745Z.log:27)).

- [DEMO.md:65-66](/Users/hiroyusai/src/sworn/video/DEMO.md:65): The arithmetic is correct: `551,714 × 600,000,001 / 10¹²`, rounded as the protocol does, is 331 micro-PathUSD = $0.000331 = 0.0331¢; “about three hundredths of a cent” is fair. But “guaranteed preflight” is not. The answer is expressly about block N, while a later transfer can see changed state; a successful proof compensates a false block-N answer, not guarantees future delivery ([Sworn.sol:21-40](/Users/hiroyusai/src/sworn/contracts/src/Sworn.sol:21)). Also disclose the capital lock.

## Screen / first-60-second risks

- The exact screen note does not match the app: the button is “Send 500 to R′,” not “Pay” ([Wallet.tsx:145-150](/Users/hiroyusai/src/sworn/demo/src/pages/Wallet.tsx:145)). This is minor, but avoid narrating a nonexistent control.

- A live challenge displays real elapsed time and cannot be fast-forwarded ([Wallet.tsx:318-335](/Users/hiroyusai/src/sworn/demo/src/pages/Wallet.tsx:318)). The built-in accelerated playback is a separate recorded run explicitly labeled “not this challenge” ([Wallet.tsx:381-399](/Users/hiroyusai/src/sworn/demo/src/pages/Wallet.tsx:381)). Do not splice it as though it caused the displayed slash.

- The demo defaults to localhost and refuses remote signing unless `DEMO_ALLOW_REMOTE_TX=1` is deliberately configured ([backend/server.ts:23-47](/Users/hiroyusai/src/sworn/demo/backend/server.ts:23)). “Everything on screen is real Moderato” is therefore a recording-time configuration assertion, not guaranteed by the app as built.

## Pitch weakness

The first non-Tempo judge’s question will be: “Why is this useful if the payment is already diverted and proving takes seven minutes?” The current script presents a deliberately dishonest test server, post-payment compensation, and no buyer, seller, traction, or capital-lock economics.

The single highest-value change: state the exact product boundary in the opening minute—“This is testnet-only, block-N answer insurance, not a guarantee that a later payment will arrive”—then immediately explain why an MPP seller would voluntarily stake coverage and what the buyer gains beyond a normal refund. This prevents the judge from inferring a stronger product and then discounting the whole demo.

## Timing

At 2.2 words/s, quoted narration only:

- Pitch: 249 words, 113.2 s. Under 120 s; 3.2 s over its stated 110 s target.
- Demo: 335 words, 152.3 s. Under 180 s; Scene 1 is 110 words / 50.0 s, not the stated ≈130 words. Use the remaining ten seconds for silent, legible proof/payout evidence.

The founder-background claims in [PITCH.md:51-52](/Users/hiroyusai/src/sworn/video/PITCH.md:51) are **unverified** because the cited rethlab/ETHGlobal sources are external and unavailable here.

VERDICT: CHANGES