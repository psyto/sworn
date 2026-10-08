## Verdict

Use the **partial rewrite of scenes 1–2**. It improves immediate comprehension without sacrificing the unusually strong proof/evidence arc in scenes 3–7. A full rebuild spends four days on presentation while the decisive weakness—external demand validation—remains untouched. Leaving it unchanged preserves accuracy but undersells the intuitive privacy-to-verifiability gap.

Make privacy the problem context, not Sworn’s product category: Sworn is still **developer infrastructure for independently verifiable private execution**.

## Accuracy audit

| Proposed line | Severity | Recommended replacement |
|---|---:|---|
| “Payments are going private.” | MAJOR | It is broad, unsourced, and invites an avoidable trend debate. Use: “Private payment ledgers create a verification gap.” |
| “Tempo Zones keep every transaction hidden: only the operator sees them.” | BLOCKER | The spec says account holders see their own activity; sequencer nodes see full activity; privacy is from public observers, not sequencers. Use: “Tempo Zones keep transaction activity private from the public. Account holders see their own activity; sequencer nodes see the full batch.” |
| “Nobody else can check the batch.” | MAJOR | Too broad: observers can inspect public portal data, proofs/attestations, and possibly their own withdrawal. Use: “An outside reviewer cannot independently reconstruct or verify the complete private batch from public data.” |
| “Private shouldn’t mean ‘trust me’.” | MAJOR in this opening | A good instinct, but it can imply Sworn removes reliance on the operator. It does not solve data availability, liveness, forced inclusion, censorship, or witness access. Use: “Private execution needs independent validity evidence.” |
| “Zcash showed zero-knowledge can prove what stays hidden.” | MINOR | Fair at a high level, but vague enough to blur very different privacy models. Make the distinction explicit. |
| “Sworn brings that idea to Tempo Zones.” | MAJOR | Avoid “same idea” without saying what is and is not shared. It risks “Zcash-level privacy” inference. Use “uses zero knowledge differently” and name the proven claim: batch execution validity. |
| “Private, but checkable.” | MINOR | Usable, but vague. Prefer **“Private execution. Checkable validity.”** It says exactly what the proof establishes. |

Zcash is the best recognizable **privacy hook**, provided it is a narrow analogy: both use ZK to verify a claim without revealing the underlying private data. It is not the best systems analogy. Contra remains the closer comparison for the Zone model—operator-run private execution backed by public escrow—but is less likely to click in 15 seconds. A validity-rollup analogy is technically nearer to Sworn’s mechanism, but risks implying public data availability or a rollup architecture. Proof of reserves is too different: it proves an asset-position claim, not correct execution.

Never say or visually imply:

- “Zcash for Tempo”
- “Zcash-level privacy”
- “the same privacy model”
- “only the proof crosses” (public batch hashes/metadata cross too)

## Recommended exact scenes

### Scene 1 — narration (30 words)

> Tempo Zones keep payment activity private from the public. Users see their own activity; sequencer nodes see the full batch. Before withdrawal, an outside reviewer cannot independently verify the operator’s complete private batch.

On-screen:

- Headline: **Private execution needs independent evidence.**
- Cards:
  - **Public observers** — transactions stay private
  - **Account holder** — sees own activity
  - **Sequencer nodes** — see full Zone activity
  - **Outside reviewer** — cannot independently verify the complete batch

This replaces the misleading “only the operator” card while retaining the visual tension.

### Scene 2 — narration (30 words)

> Zcash uses zero knowledge to prove a transaction is valid without revealing its details. Sworn uses zero knowledge differently: it proves a private Tempo Zone batch executed correctly, without publishing transactions.

On-screen:

- Headline: **Private execution. Checkable validity.**
- Left:
  - **Zcash**
  - ZK proves shielded transaction validity
  - Details stay hidden
- Right:
  - **Sworn**
  - ZK proves Zone-batch execution validity
  - Transactions stay private from public observers
- Boundary label: **PROOF + PUBLIC BATCH METADATA CROSS**
- Small qualifier: **Sequencers still see Zone activity.**

That final qualifier is important: it prevents the audience from hearing “Sworn creates Zcash-style shielding.” If the qualifier makes the slide crowded, say it in the post-pitch Q&A, but retain “uses zero knowledge differently” in narration.

## Fit with scenes 3–7

The transition to Scene 3 works well:

> “Tempo Zones ship no native ZK proof today…”

It now follows naturally: the problem is missing independent batch-validity evidence, and the technical answer is compiling Tempo’s verifier into SP1. The fixture/own-Zone distinction remains fully intact because it begins only in Scene 3 and is reinforced in Scene 4.

The main risk is category drift: leading with privacy can make Sworn sound like a consumer privacy protocol. Prevent that by having Scene 2 immediately say **“batch executed correctly”**, then Scene 3 say **“Tempo’s own Zone verifier.”** The buyer remains exactly right: a Zone business whose reviewer cannot reconstruct the private witness.

## README / live page / GitHub About line

> **Sworn gives private Tempo Zone execution a public validity check: Tempo’s own Zone verifier runs in SP1, producing proof plus public batch metadata that anyone can verify without publishing transactions.**

## Tempo outreach

Do not call it “a working example of ZK validity for Tempo’s own Zones.” That could sound like an integration with Tempo-created Zones or a live Tempo deployment.

Use:

> **A working example of ZK batch-validity evidence using Tempo’s own Zone verifier—plus proof-gated settlement demonstrated separately on our own testnet Zone.**

For the Tempo team, the useful question is not “do you like privacy?” It is: would an independently verifiable ZK evidence path be useful **beside** Nitro, given that it does not solve operator-held data availability, liveness, censorship, or witness access? That frames Sworn as a credible complementary verification path rather than a claim to replace Tempo’s trust model.