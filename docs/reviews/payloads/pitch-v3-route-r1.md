# Adversarial review — pitch v3 and a change of business route (investor + honesty lens)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read files.
Read: `video/PITCH.md` (v2, current), `_submission/CRITERIA-MAP.md`, `docs/specs/003-zone-verifier.md` (§1-§7 and the
Results sections), `docs/specs/004-tee-plus-zk.md`, `docs/research/moderato-zone-feasibility-20261004.md`,
`spikes/zone-spf/zones/README.md` (top 40 lines), and grep `spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol`
as needed. Do not read other large trees. Answer in ≤ 900 words.

## Context (fixed)
Colosseum Crypto World's Fair, Tempo track (judged separately; Moderato testnet qualifies). Judges are read as
investors: business potential over completeness. Deadline 2026-10-12. Solo founder (Reth/Revm stack; 15 years of
banking systems). Evidence in hand: Tempo's own Zone batch verifier (`prove_zone_batch`) proven in SP1; a standalone
`SwornZoneVerifier` (T13 `IVerifier` signature, no portal) verified on Moderato a dev-chain integration-test batch
containing 1 withdrawal and 2 user txs (tx 0xa63009fd…f770); a mutated field reverts `InvalidProof`. Moderato's
deployed pre-T13 reference verifier returns true for arbitrary input. Zone creation on Moderato is owner-gated (one
Safe runs all 3 zones); outsiders cannot build a Zone's witness; only the operator can.

## Proposal under review
**Route change.** v2 says: Tempo adopts ZK as a second check inside settlement, then Sworn runs provers and tracks
every upgrade. The founder finds "Tempo adopts Sworn" too high a bar. Proposed v3 route: the customer is **the business
that runs a Zone (operator)**. Sworn proves every batch of that operator's Zone and publishes the proof via a standalone
`attest`, so customers, partners and auditors can check that money leaving the Zone came from correct execution,
without the operator opening its books. The claim: no Tempo protocol change is needed; Tempo-in-settlement (spec 004)
becomes an option.

**Pitch v3 narration draft** (≤ 2 min, founder's voice; the technology appears only as evidence):
1. Tempo Zones let businesses run private payment ledgers on Tempo. Their customers can't see inside — that's the
   point. So when money leaves a Zone, everyone has to trust that the operator ran the ledger correctly. Today that
   trust rests on a hardware attestation — or, on testnet, on a check that checks nothing.
2. Sworn turns that trust into a proof. For each batch, a zero-knowledge proof that the Zone followed Tempo's own
   rules — anyone can check it on chain, and it reveals nothing private.
3. It works. Sworn ran Tempo's own Zone verification code in a zero-knowledge prover, on a batch that contains a
   withdrawal, and a contract on Tempo's testnet verified it. Here is the transaction. Change one field, and the proof
   is rejected. The same engine has already made a lying service pay a user back — three times.
4. Our customers are the businesses that run Zones. A proof for every batch lets them show customers, partners and
   auditors that withdrawals come from correct execution — without opening their books. We run the provers as a
   service and keep them current with every Tempo upgrade. None of this needs Tempo to change anything; if Tempo later
   wants proofs inside settlement, the design is ready.
5. Tempo is built on Reth and Revm, the stack I work in and teach, and my last project won a Uniswap Foundation prize
   at ETHGlobal Tokyo. Fifteen years building banking systems taught me what operators owe their auditors.
6. It's testnet and unaudited, the batch comes from Tempo's own integration tests, and we have no customers yet. Next:
   the first Zone operator. Sworn: Tempo's execution, proven.

## What I want
1. **Route.** Is "Zone operators buy independent per-batch ZK attestations" a real, fundable route, or does it collapse?
   Test hard: (a) Does a standalone attestation that is not in the settlement path actually give customers/auditors
   anything, given the portal still settles on the TEE/stub? What exactly would a customer check, against what
   anchor (the batch's committed fields on the portal? events?), and can the operator present a proof of a batch
   other than the one that settled? (b) Why would an operator pay for a proof that its own TEE attestation already
   claims, and who among operators exists (only Tempo's Safe today)? (c) Is "none of this needs Tempo to change
   anything" true, given the verifier pins a genesis and dev-chain parent id, pre-T13 Moderato vs T13 IVerifier, and
   the operator must supply witnesses? (d) Compare with v2's Tempo route for an investor: which is stronger, or
   should the pitch present both (operators now, Tempo later)?
2. **Honesty.** Line by line, which v3 sentences overclaim, with the exact replacement wording. In particular: "reveals
   nothing private" (what do the public values expose?), "a check that checks nothing", "made a lying service pay a
   user back", "followed Tempo's own rules", "keep them current with every Tempo upgrade", "what operators owe their
   auditors".
3. **Benefit framing.** Does v3 actually communicate customer value better than v2 to a non-specialist investor in
   the first 20 seconds? What single change would most improve it?

BLOCKER / MAJOR / MINOR; separate verified (with file:line) from inferred. End with exactly one line:
`VERDICT: PROCEED` or `VERDICT: RECONSIDER`.
