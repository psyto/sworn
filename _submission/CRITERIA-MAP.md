# CWF judging criteria → Sworn evidence → where it appears

Sources:
- the web page (`colosseum.com/hackathon`), fetched 2026-10-04: seven criteria, in the page's order,
  with no weights;
- the Official Rules §8: six criteria, read from the PDF for the previous entry
  (`../confide/docs/cwf-2026/CRITERIA.md`).

The page says the **presentation video is "one of the first resources judges review"**, so every
surface follows the pitch's order and wording.

**Tempo track:** a dedicated $100K pool, judged separately from the general prizes (Colosseum's answer,
10-03). The track's own criteria are not published.

## The one message (pitch v3.2)

**Tempo Zones are private: the operator sees everything, each user only their own account, so no one
outside can check the operator ran the ledger correctly. Sworn makes that checkable.** For a batch the
operator supplies, Sworn produces a zero-knowledge proof that Tempo's own Zone code accepts it; anyone can
verify it on chain, and it exposes hashes and batch metadata, not transaction contents. On testnet, a
contract on Moderato verified one for a test batch with a withdrawal (tx `0xa630…f770`); change one field
and it is rejected.

**Route:** near term, businesses that run Zones and answer to auditors (off-path, independent evidence they
can match to each batch they settle; evidence, not yet a guarantee). Later, Tempo builds proofs into
settlement (spec 004: written, not built). Either way, the service is running provers on time and rebuilding
them at each Tempo upgrade, still to be validated. Today Moderato has one Zone operator and we have no
customers; next, one design partner and a proof of a batch they supply.

## Matrix

| criterion (web / §8) | evidence we have | weakest point, stated honestly | where it must appear |
|---|---|---|---|
| **Founder + Market Fit** | Reth/Revm/Alloy/Foundry depth: rethlab (Reth source-reading courses), rdk; Reckn took a Uniswap Foundation prize at ETHGlobal Tokyo; the zkVM patches to Tempo's own code | solo; pre-revenue | pitch 1:24–1:40; README "Who"; form "why now" |
| **Insight** | Zones are private: the operator sees everything, each user only their own account, so no outsider can check the ledger; Tempo's design (T13) checks batches with a hardware attestation, and Moderato today (pre-T13) uses a reference stub returning `true`; Tempo's docs say ZK "is not implemented" | — | pitch 0:00–0:22; README top; site hero |
| **Product + Execution / Functionality** | Zone proof verified on Moderato; three real slashes; 40/40 replay; 64 forge tests incl. real Groth16; every claim re-checkable from chain | batch from Tempo's integration tests, not a Moderato Zone | pitch 0:22–0:53; demo 0:12–1:14; site "Verify again" (three rows, incl. Moderato's pre-T13 stub) |
| **Novelty** | no public zkVM proof of `tempo-revm` or `zone-spf` found | Succinct could do it (Paradigm led its round) | pitch 0:22–0:38; README prior art |
| **Potential Market Size / Impact** | near term: businesses that run Zones and answer to auditors, which need evidence an outsider can re-check; later, every Zone if Tempo builds proofs into settlement (spec 004) | Moderato has one Zone operator today and Zone creation is owner-gated; no TAM number we can source | pitch scene 4 (0:53–1:24); form "what / for whom", "need" |
| **Viability / Business Plan** | near term: Zone operators pay for proving the batches they supply, on time, plus rebuilding the prover at each Tempo upgrade (T12 10-08, T13 next); later: the same service for Tempo's design, if built | no customers; the service is a hypothesis; evidence, not yet a guarantee (no portal calls the verifier, it stores nothing); a real Zone needs its own deployment and version work (Moderato is pre-T13) | pitch scenes 4 and 6; form "make money"; README "The plan" |
| **UX for downstream users** | a public page re-verifies everything from chain in the browser; a slash pays the client automatically | the page is not published yet | demo; site |
| **Open-source / composability** | Apache-2.0; `SwornZoneVerifier` has `IVerifier`'s exact signature (drop-in); answers sold over MPP; `fetch.sh` reproduces everything from pinned commits | — | README; form "repo context" |
| **Founder Communication** | one message everywhere; honest limits stated once, clearly | — | all |
| **Traction** | zero, said plainly: no customers, one Zone operator on Moderato today; next step named (one design partner, and a proof of a batch they supply) | zero | pitch scene 6; form; README; site |

## Rules for every surface

- **Order (pitch v3.2):** the problem (who cannot check what) → what Sworn does → it worked, on testnet (tx, live rejection) → who it is for (near term, later, the service) → founder → honest limits → next.
- **Never claim:**
  - that a Zone settles with it;
  - that it secures or protects withdrawals (never in the present tense; "later, if Tempo builds it" only);
  - "a proof for every batch", or "every batch of a live Zone";
  - "our customers are…", or any customer, user, partner or pilot as if it exists;
  - that the batch is from Moderato;
  - "the same input" for Moderato's verifier (say "an equivalent malformed batch");
  - that Tempo or Moderato is broken (Moderato's verifier is the pre-T13 reference stub; "hardware
    attestation" is Tempo's T13 design);
  - that the proof reveals nothing (its public values are hashes and batch metadata, not transaction contents);
  - "verification layer";
  - that Tempo is the only buyer, or will pay;
  - acquisition;
  - other chains by name.
- **Always attach once:** testnet, unaudited, the batches come from Tempo's integration tests, Moderato has one Zone operator today, no customers or revenue.
- The demo question (bonded answers) is self-checkable with `eth_simulateV1`. Say so once, framed as
  "that's why it's a good demo".
