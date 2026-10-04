**BLOCKER — verified.** v3’s customer promise is false as stated. `attest` only verifies and emits an event; it writes no state and has no canonical-portal caller check. The spec explicitly says it must not be generalized to settlement. A portal still accepts its own verifier result, updates state, and enqueues withdrawals independently. [`docs/specs/003-zone-verifier.md:99-110`] [`spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol:1412-1455`]

A customer could check an attestation transaction’s full calldata against the portal’s `submitBatch` calldata/event and canonical zone/portal mapping. The digest binds the relevant batch fields, parent chain, pinned genesis, verifier address, and destination chain, so—assuming hash security—a valid proof cannot be substituted for a *different matching field set*. But Sworn currently does not store that correlation, bind the portal address/caller, or prevent payout without it. It is audit evidence after the fact, not withdrawal protection. Some required fields are only calldata or overwritten portal state. [`docs/specs/003-zone-verifier.md:33-71, 89-110`] [`docs/specs/004-tee-plus-zk.md:16-21`]

**BLOCKER — verified.** The demonstrated verifier is not a deployable “no Tempo change” product for a current Moderato Zone: it pins parent chain `1337`, one integration-test genesis and T13 `IVerifier`; Moderato portals are pre-T13. A real Zone needs a new deployment, operator-supplied witness/genesis, and likely fork/version work; whether the prover accepts a current pre-T13 batch is untested. [`docs/specs/003-zone-verifier.md:103-110, 146-158, 318-327`] [`docs/research/moderato-zone-feasibility-20261004.md:195-215, 243-257`]

**MAJOR — verified.** There is no addressable operator market demonstrated today: Moderato has three native Zones, all effectively controlled by one party; creation is owner-gated; outsiders cannot obtain witnesses. The payer is explicitly open. [`docs/research/moderato-zone-feasibility-20261004.md:43-60, 114-160`] [`docs/specs/004-tee-plus-zk.md:143-152`]

**MAJOR — inferred.** An independent evidence product could be fundable for a regulated operator with auditors/partners who demand cryptographic reconciliation beyond its TEE claim. But it has two unproven dependencies: Zones must gain independent operators, and those operators must believe off-path evidence changes sales/compliance outcomes enough to pay. The current single operator has little reason to buy evidence about itself. Get an operator design partner or auditor requirement before making this the route.

**Route comparison.** v2 is stronger on ultimate value because protocol wiring can actually gate payouts, but it is a slow platform sale and requires Tempo migration. v3 is a plausible wedge only if described as “off-path audit evidence,” not security. Do not pitch both as coequal routes: say operator evidence is the near-term validation path; protocol-integrated payout safety is the longer-term Tempo option.

**Sentence replacements**

- “Tempo Zones let businesses run private payment ledgers…” → “Tempo Zones are private blockchains, currently on testnet, where access to state is restricted and operators retain visibility.” [`zones/README.md:13-16, 22-26`]
- “when money leaves… everyone has to trust…” → “Portal payouts rely on the submitted batch and its configured verification path.”
- “hardware attestation — or… a check that checks nothing” → “Tempo’s T13 design uses Nitro attestation; current Moderato native portals use a reference verifier that returns true for arbitrary inputs.” [`moderato…md:87-97`]
- “Sworn turns that trust into a proof… followed Tempo’s own rules” → “Sworn can produce independent proof evidence that pinned Tempo Zone verifier code accepted a supplied batch under a pinned genesis artifact.”
- “anyone can check it on chain, and it reveals nothing private” → “Anyone can verify the proof on chain; the attestation exposes batch metadata and cryptographic commitments, not transaction contents.” Public fields include IDs, block numbers/hashes, state-transition hashes, counters, and withdrawal-queue hash. [`spec 003:37-71`]
- “It works.” → “In a testnet demonstration, it worked.”
- “made a lying service pay a user back” → “Separately, Sworn’s bonded-answer demo paid three successful challenges on Moderato; that is not Zone evidence.”
- “proof for every batch lets them show… money leaving…” → “If an operator supplies witnesses and publishes matching attestations, it can offer auditors independently verifiable evidence for specific submitted batches; this does not control settlement or payouts.”
- “keep them current with every Tempo upgrade” → “A production service would need to update and redeploy guest/verifier versions for execution-changing hardforks.” [`spec 004:151-152`]
- “None… needs Tempo to change anything” → “Publishing an off-path attestation needs no portal change, but deployment for a real Zone requires operator cooperation, its witness/genesis, and version-compatible verifier work.”
- “what operators owe their auditors” → “Fifteen years in banking taught me why auditability matters.”

v3 communicates a business outcome faster than v2, but its opening overstates what the product secures. The single best change: open with “independent audit evidence matched to a settled batch,” then immediately state that it is off-path today—not a withdrawal guarantee.

VERDICT: RECONSIDER