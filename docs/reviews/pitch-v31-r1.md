**BLOCKER — partly resolved.** The pitch now says “evidence—not yet a guarantee,” correctly retreating from withdrawal security. But “a proof for each batch they settle” still implies a settlement binding Sworn does not enforce; `attest` writes no state and has no portal/caller binding. [docs/specs/003-zone-verifier.md:99-110]

**BLOCKER — partly resolved.** The dev-chain/integration-test caveat is explicit. But the near-term service still reads more deployable than it is: current Moderato portals are pre-T13, fixed to the stub verifier, and cannot use this contract. [docs/research/moderato-zone-feasibility-20261004.md:195-215,254-257]

**MAJOR — not resolved.** “Our customers are businesses that run Zones” overstates today’s addressable market: Moderato has three native Zones, all created and run by one party; creation is owner-gated. [docs/research/moderato-zone-feasibility-20261004.md:12-17,50-60]

**MAJOR — not resolved (inferred).** A paid off-path audit-evidence service remains a hypothesis. “No customers yet” is honest, but neither operator demand nor auditor-required evidence has been demonstrated.

Verified wording issues and exact replacements:

- “only the operator sees inside” → “The operator has full visibility; authenticated users can access their own balances and transaction history.” The following customer/auditor point is fair only if narrowed: “They cannot independently verify the operator’s full batch execution from public data.” [spikes/zone-spf/zones/README.md:24]

- “Today a Zone batch is accepted on a hardware attestation” → “Tempo’s T13 design uses Nitro hardware attestation; current Moderato native Zones instead use a stub verifier.”

- “a reference verifier that accepts anything” → “On current Moderato native Zones, the reference verifier returns true for arbitrary inputs.” Verified by source and arbitrary-input call. [docs/research/moderato-zone-feasibility-20261004.md:87-97]

- “for each batch, a zero-knowledge proof” → “For a batch an operator supplies, Sworn can produce a zero-knowledge proof…” Only dev-chain batches have been proved; it is not demonstrated for every batch of a live Zone. [docs/specs/003-zone-verifier.md:115-121,148-156]

- “it shows commitments, not transactions” → “It exposes public batch metadata and cryptographic hashes, not transaction contents.” The public digest includes block hashes, counters, and withdrawal-queue hash. [docs/specs/003-zone-verifier.md:33-70]

- “a proof for each batch they settle” → “an off-path attestation for each batch an operator supplies and matches to its settlement record.” This matching remains operator/auditor work, not on-chain enforcement.

- “that design is written” → “The protocol-integration design is written, but its portal changes, payout checks, and new proof statements are not built.” [docs/specs/004-tee-plus-zk.md:154-165]

- “update them at every Tempo upgrade” → “For each execution-changing Tempo hardfork, the service would need a new guest and vkey.” [docs/specs/004-tee-plus-zk.md:145-152]

- “That’s our service” → “That is the service we intend to validate with a design partner.”

- “Sworn: Tempo’s execution, proven.” → “Sworn: a Tempo Zone batch verifier, independently proven.” The deployed withdrawal proof is a dev-chain integration-test batch, not a Moderato settlement. [deployments/moderato.json: SwornZoneVerifierWithdrawal]

**Investor lens — inferred.** The ordering is credible as a validation sequence, not as a near-term market claim: one controlled operator and owner-gated creation make “operators now” a design-partner thesis, not traction.

Best credibility sentence: “Today Moderato has one Zone operator and no external customers; our immediate milestone is a design-partner commitment and proof for an operator-supplied batch.”

**Timing — verified.** 247 words / 2.2 words per second = **112.3 seconds**: under two minutes.

VERDICT: RECONSIDER