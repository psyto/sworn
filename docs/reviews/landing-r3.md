## Verdict: ship NEW with two copy changes

NEW is the better CWF landing page. After the pitch, it explains the product faster: private Zone batch → re-execution with Tempo code → public proof check. The FlowDiagram makes the mechanism legible before technical detail, and the “who verifies?” framing is a stronger founder/market insight than OLD’s generic review-gap framing.

It is also more credible in structure: the own-Zone receipt, live reads, forged-batch rejection, limitations, and FAQ are still present, just correctly positioned as evidence rather than headline decoration. The demo still matches: it demonstrates the deeper evidence area, which the new page explicitly leads visitors toward.

The cost is that OLD made the three settled batches / payout / forged rejection visible immediately. NEW’s first viewport is better product communication, but slightly weaker immediate traction signaling. I would not restore the old hero panel; the receipt appears early enough and the pitch supplies context.

No BLOCKER found. Do not merge until these two MAJOR claims are fixed.

- **MAJOR [V] — unsupported witness-retention guarantee.** [sections.tsx:92](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:92) says “The witness stays with the prover”; r2 correctly required avoiding “stays/stops there.” The implementation proves it is not submitted on chain, not that a prover/operator cannot retain, copy, or disclose it. The same claim remains in accessible diagram text [line 211](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:211) and DataFlow [line 267](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:267).

  Minimal fix everywhere: “The batch witness is used by the prover and is not sent on chain. Only the proof and public batch data are submitted to the verifier on Moderato.” This preserves the important privacy boundary without inventing an off-chain custody guarantee.

- **MAJOR [V] — “Everything below reads … RPC” is false.** [sections.tsx:133](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:133) sits above a static receipt compiled from `deployments/moderato.json`, static explanatory content, and later static status/FAQ content. Only the interactive own-Zone and fixture evidence reads invoke the public RPC. A technical judge will notice that distinction.

  Minimal fix: “The live checks below read Tempo’s public Moderato RPC from your browser. Nothing is signed or sent.” That is both accurate and stronger.

Claims check:

- **Hero figcaption [V]:** “real digest of a fixture batch from Tempo’s integration tests (dev chain 1337)” is supported by `FIXTURE.digest`; the problem is only “stays.”
- **EvidenceIntro [V]:** false as written for the static receipt and surrounding static sections; fix above.
- **DataFlow note [V]:** now correct. The FlowDiagram is at the top, and `OwnZoneSection` precedes `ZoneSection` and `DataFlow` in [main.tsx:50-54](/Users/hiroyusai/src/sworn/site/src/main.tsx:50). Its distinction between the standalone fixture verifier and the separate proof-gated own-Zone portal is materially useful and accurate from the local implementation/records.

The two changes are credibility safeguards, not cosmetic polish. With them, merge NEW.