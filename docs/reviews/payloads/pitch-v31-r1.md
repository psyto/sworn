# Adversarial review — pitch v3.1 (after your RECONSIDER on v3)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read files.
Read: `docs/reviews/pitch-v3-route-r1.md` (your v3 findings — check each is resolved or honestly left open),
`docs/specs/003-zone-verifier.md` (§3-§7 and all Results sections), `docs/specs/004-tee-plus-zk.md`,
`docs/research/moderato-zone-feasibility-20261004.md`, `spikes/zone-spf/zones/README.md` (top 40 lines),
`deployments/moderato.json` (SwornZoneVerifierWithdrawal, SwornZoneVerifier). Answer in ≤ 700 words.

## Context (unchanged from v3 review)
CWF Tempo track; judges read as investors; ≤ 2 min founder-voiced pitch; solo founder. Founder's decision: route =
**operators now (off-path audit evidence), Tempo later (proofs in settlement, spec 004)**, presented in that order, not
as equals. The bonded-answer slash is left out of the pitch (the demo still shows it).

## Pitch v3.1 narration (≈ 250 words target)
1. Tempo Zones are private blockchains on Tempo: balances and payments stay private, and only the operator sees
   inside. That's the point — but it means customers and auditors can't check the operator's work. Today a Zone batch
   is accepted on a hardware attestation — and on testnet, by a reference verifier that accepts anything.
2. Sworn gives them independent evidence: for each batch, a zero-knowledge proof that Tempo's own Zone code accepts
   it. Anyone can verify it on chain, and it shows commitments, not transactions.
3. In a testnet demonstration, it worked: Tempo's own Zone verification code, on a batch that contains a withdrawal,
   verified by a contract on Tempo's testnet. Here is the transaction. Change one field, and it's rejected.
4. Near term, our customers are businesses that run Zones and answer to auditors: a proof for each batch they settle,
   as evidence — not yet a guarantee. Longer term, if Tempo puts proofs into settlement, withdrawals wait for them;
   that design is written. Either way, someone has to run the provers on time and update them at every Tempo upgrade.
   That's our service.
5. Tempo is built on Reth and Revm, the stack I work in and teach, and my last project won a Uniswap Foundation prize
   at ETHGlobal Tokyo. Fifteen years in banking taught me why auditability matters.
6. It's testnet and unaudited, the batch comes from Tempo's own integration tests, and we have no customers yet. Next:
   one Zone operator as a design partner. Sworn: Tempo's execution, proven.

## What I want
1. For each of your v3 BLOCKER/MAJOR findings: resolved, partly, or not — with the reason.
2. Line by line: any remaining overclaim, with exact replacement wording. In particular check: "only the operator sees
   inside" (Zones README says users access their own state via authenticated RPC — is "customers and auditors can't
   check the operator's work" fair?); "accepted on a hardware attestation" (T13 design vs today's Moderato, where the
   Nitro measurements are unset and zones submit NoProof against the stub); "a reference verifier that accepts
   anything"; "for each batch" (we proved two dev-chain batches, not every batch of a live Zone); "shows commitments,
   not transactions"; "a proof for each batch they settle" (no binding to the settled batch is enforced); "that design
   is written"; "update them at every Tempo upgrade".
3. Investor lens: is the operators-now / Tempo-later ordering credible given only one party runs Zones today and
   creation is owner-gated? What one sentence would most raise credibility without overclaiming?
4. Is it under 2 minutes at ~2.2 words/s (count the words)?

BLOCKER / MAJOR / MINOR; separate verified (file:line) from inferred. End with exactly one line:
`VERDICT: PROCEED` or `VERDICT: RECONSIDER`.
