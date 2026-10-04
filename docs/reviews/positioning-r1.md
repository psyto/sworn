**BLOCKER — verified:** `eth_simulateV1` reproduces the stated TIP-20 outcome, including fee-token charging and rejection of the forbidden fee token. For a public, pinned state and fully specified transaction, Sworn’s current answer is not scarce information: the buyer can obtain it independently, cheaply, and before paying. The old contrast with `eth_call` was materially misleading.

**MAJOR — inferred:** Sworn still has narrow value as accountable delegation: normalized simulation, availability for RPC-constrained agents, and a bonded counterparty. But that is operational convenience, not an information oracle. A contract consumer is the weakest case: it cannot call RPC, but it also cannot safely treat an off-chain answer as equivalent to execution unless Sworn’s settlement/dispute path is itself enforceable on-chain. A bond is a signal, but the answer is instantly independently checkable, so it does not justify a “paid answer” thesis.

**BLOCKER — Zones pivot:** The target is coherent only conditionally. The natural answerer is the Zone operator, or an explicitly authorized party with the relevant private witness. A generic third party cannot both see the state and be independently accountable unless the Zone exposes a committed canonical state root plus a proving interface.

A challenger cannot refute “account holds 500” merely by lacking the state. They need either a contradictory witness, an authorized disclosure route, or a ZK proof of falsehood against the same public root. Today’s described architecture supplies operator-run private ledgers and signed settlement commitments, not evidence that Tempo has a canonical, publicly challengeable Zone-state root with data availability and finality semantics. Settlement commitments may constrain net movements without committing every account balance or cross-zone-credit status.

Therefore “ZK makes it trustworthy without revealing state” overclaims. ZK can prove: *given an authoritative committed root and specified Zone transition semantics, this predicate is true*. It cannot establish that an operator-selected private ledger is the authoritative ledger, nor make a private-state dispute permissionless, absent those missing anchors. The sandbox limitation, T13 ZoneVerifier timing, and current normal-Rust verifier reinforce that this is a future integration thesis, not the present product.

“Tempo needs this too” is only honest as: “if Tempo Zones gain canonical commitments and proof verification, privacy-preserving attestations could be useful.” It is not honest as a present Tempo gap Sworn has solved.

**MAJOR — prize strategy:** Choose **(c)**: frame the existing demo as a deliberately reproducible proof of Sworn’s bonded adjudication mechanism, while saying its demonstrated question is self-simulatable. Do not lead with the Zones pivot as the product claim; it is unbuilt and currently lacks the dispute substrate. Present Zones as a gated roadmap application.

Keeping the current framing and merely pre-empting the objection invites judges to ask why anyone pays. The proposal as written replaces a working but weak use case with speculative infrastructure. The defensible core is: “Sworn makes answers economically accountable when parties agree on an objective verifier; public simulation is the transparent demonstration case.” That is less grand, but survives scrutiny.

**Required content changes:**

- `video/PITCH.md`: remove any claim that agents need Sworn to learn the demonstrated public transfer outcome; replace “Next” with a conditional Zones roadmap, explicitly gated on canonical committed roots and verifier support.
- `video/DEMO.md`: state that the shown result is independently reproducible with `eth_simulateV1`; remove any implication that `eth_call` establishes RPC incapacity or that fee-token behavior cannot be simulated.
- `README.md`: distinguish demonstrated mechanism from current commercial necessity; label Zones as research/roadmap, not supported capability.
- `_submission/cwf-form.md`: remove “Tempo needs this” present-tense language and claims of non-self-verifiability for public TIP-20 simulation; describe the demo as testnet-qualified mechanism evidence.
- `sdk/src/index.ts:300–350`: ensure public API/docs do not characterize the simulated answer as unavailable to the client or imply `eth_call` equivalence.

I cannot truthfully provide the requested exact narration sentence/line list: the scope prohibits commands and browsing, and no direct file-reading interface was supplied. I will not invent file:line citations.

VERDICT: CHANGES