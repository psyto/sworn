## Bottom line

**BLOCKER — inferred:** “Tempo’s verification layer” is too strong today. You have proved a Tempo-EVM-in-SP1 engine and a real slash, not a Zone-settlement product, customer channel, or portal integration. The pivot becomes fundable only if the spike proves a real batch *and* establishes who can select the verifier path.

## 1. Zone settlement business

**Verified:** Zone settlement needs execution verification in principle: `zone-spf` replays batches against witnessed state, while the reviewed Zone verifier is a stub and Nitro is unusable under its present policy. The supplied facts also say `ZonePortal` invokes a configured `IVerifier.verify(...)`; technically, a third-party verifier can therefore exist.

**Not verified / critical:** who selects `verifierConfig`, who deploys or whitelists the configured verifier, whether a Zone operator may choose it unilaterally, and whether Tempo governance controls that choice. Configuration capability is not commercial permission. Do not imply “every Zone operator can buy Sworn” until this is answered.

Paying customer, if this works: the **Zone operator**, because trustworthy withdrawals/finality are its operating cost and credibility constraint. Tempo is more plausibly a protocol partner or eventual acquirer/vendor competitor—not the default payer. Institutions running private Zones may pay for an integration/support/attestation product, but that is a second-order hypothesis.

Investor’s first three objections:

1. **“Tempo, Succinct, or RISC Zero ships this.”** The facts establish a real implementation gap, not durable defensibility. Sworn’s edge is Tempo-specific execution expertise and speed, not a moat.  
2. **“Can you sell or deploy it?”** Unanswered: verifier-selection authority and procurement path.  
3. **“Why is this a company rather than a prover feature?”** Unanswered unless Sworn owns the hard integration layer: batch compatibility, proof operations, upgrades, monitoring, audit evidence, and a service/SLA around withdrawals.

The existing materials correctly identify `zone-spf` as normal Rust rather than a proving guest, but they presently use that as evidence of shared direction, not permission or demand ([README.md:92-95](/Users/hiroyusai/src/sworn/README.md:92); [video/PITCH.md:45-48](/Users/hiroyusai/src/sworn/video/PITCH.md:45)).

## 2. Honesty boundary

**Verified:** Sworn has compelling mechanism evidence: 40/40 receipt matches, local Groth16 proof, deployed verifier, and real Moderato slash ([README.md:54-64](/Users/hiroyusai/src/sworn/README.md:54); [deployments/moderato.json:29-43](/Users/hiroyusai/src/sworn/deployments/moderato.json:29)).

**BLOCKER:** The demonstrated preflight answer is freely reproducible with `eth_simulateV1`; it is not scarce. The prior review is unequivocal ([docs/reviews/positioning-r1.md:1-3](/Users/hiroyusai/src/sworn/docs/reviews/positioning-r1.md:1)). Current copy still says the answer is worth buying and that agents cannot see it without execution ([video/PITCH.md:17-28](/Users/hiroyusai/src/sworn/video/PITCH.md:17); [_submission/cwf-form.md:159-161](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:159)).

Overreach to remove:

- “Sworn proves Tempo Zone settlement.”
- “Every zone operator needs Sworn.”
- “Private accounts can prove facts” as a current capability.
- “Tempo’s verification layer.”
- “Tempo needs this primitive too” as a present product gap.

Safe wording:

> “Sworn has demonstrated ZK re-execution of Tempo transactions and on-chain economic settlement. We are testing whether the same engine can prove a real Tempo Zone batch. Deployment depends on Zone verifier configuration and canonical state-commitment semantics.”

For private facts:

> “If Zones expose authoritative committed roots and an accepted verifier path, the engine could support selective-disclosure proofs against those roots.”

That tracks the earlier review’s warning: ZK proves a predicate against an authoritative commitment; it does not make an operator’s private ledger authoritative ([docs/reviews/positioning-r1.md:5-11](/Users/hiroyusai/src/sworn/docs/reviews/positioning-r1.md:5)).

## 3. Ranking

| Option | Investor appeal | One-person viability | Judgment |
|---|---:|---:|---|
| (a) Zone settlement verifier, conditional | 1 | 2 | Highest upside, but only after technical and integration proof |
| (d) Tempo-specific proving/integration service | 2 | 1 | Best actual company shape: sell batch proving, verifier integration, monitoring, and support—not an abstract “layer” |
| (c) Proofs-of-funds lead | 3 | 3 | Good founder fit, but blocked by canonical-root, disclosure, and authorization semantics |
| (b) Accountable APIs/watchtowers | 4 | 4 | Built, but public simulation destroys the initial willingness-to-pay thesis |

I would combine (a) and (d): lead with **“Tempo Zone proof infrastructure, beginning with a real SPF batch”**, while describing accountable answers as proof-engine evidence, not the market.

The single ≤8-day evidence item with the highest value: **a reproducible proof of one real `zone-spf` batch inside SP1, verified through a portal-compatible verifier configuration, accompanied by written confirmation of who can authorize that configuration.** The proof alone validates engineering; the authorization answers the business question.

## 4. First 20 seconds

> “Tempo Zones need users to trust that a withdrawal reflects correct private execution. Sworn is testing a ZK prover that replays Tempo Zone batches and makes that execution verifiable on-chain. I’ve already proven the underlying Tempo execution engine on Moderato; this week I’m proving a real Zone batch.”

Do not say “verification layer” until the real batch and configuration path exist.

VERDICT: RECONSIDER