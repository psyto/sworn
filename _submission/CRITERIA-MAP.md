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

## The one message

**Sworn proves Tempo's own execution in zero knowledge.** Tempo's docs say ZK proving for Zones "is not
implemented". Sworn runs Tempo's Zone batch verifier inside SP1, and a contract on Moderato verified the
proof (tx `0x9aa9…dfbd`). The same engine has slashed a lying server three times on Moderato.

## Matrix

| criterion (web / §8) | evidence we have | weakest point, stated honestly | where it must appear |
|---|---|---|---|
| **Founder + Market Fit** | Reth/Revm/Alloy/Foundry depth: rethlab (Reth source-reading courses), rdk; Reckn took a Uniswap Foundation prize at ETHGlobal Tokyo; the zkVM patches to Tempo's own code | solo; pre-revenue | pitch 1:25–1:45; README "Who"; form "why now" |
| **Insight** | Zone verification today is a TEE attestation or a stub returning `true`; Tempo's docs say ZK "is not implemented"; Tempo's factory fixes each Zone's verifier, so adoption runs through Tempo | — | pitch 0:00–0:15; README top; site hero |
| **Product + Execution / Functionality** | Zone proof verified on Moderato; three real slashes; 40/40 replay; 64 forge tests incl. real Groth16; every claim re-checkable from chain | batch from Tempo's integration tests, not a Moderato Zone | pitch 0:15–0:40; demo 0:00–1:00; site "Verify again" |
| **Novelty** | no public zkVM proof of `tempo-revm` or `zone-spf` found | Succinct could do it (Paradigm led its round) | pitch 0:15; README prior art |
| **Potential Market Size / Impact** | every Zone holding money needs withdrawals the parent chain can trust; ecosystem impact: a second, independent check beside the TEE | no TAM number we can source for Zones yet | pitch 0:40–1:00; form "market" |
| **Viability / Business Plan** | Stage 1: Tempo adopts ZK as a second check (contract or grant). Stage 2: proving operations, i.e. a proof per batch on an SLA, re-verified every hardfork (T12 10-08, T13 next) | Tempo is the adoption gate; the first payer is open | pitch 1:00–1:25; form GTM |
| **UX for downstream users** | a public page re-verifies everything from chain in the browser; a slash pays the client automatically | the page is not published yet | demo; site |
| **Open-source / composability** | Apache-2.0; `SwornZoneVerifier` has `IVerifier`'s exact signature (drop-in); answers sold over MPP; `fetch.sh` reproduces everything from pinned commits | — | README; form "repo context" |
| **Founder Communication** | one message everywhere; honest limits stated once, clearly | — | all |
| **Traction** | zero, said plainly; next step named (design for TEE + ZK, talk to Tempo) | zero | pitch close; form |

## Rules for every surface

- **Order:** insight → proof it works (tx links) → why it matters → business → founder → honest limits → next.
- **Never claim:**
  - that a Zone settles with it;
  - that it secures withdrawals;
  - that the batch is from Moderato;
  - "verification layer";
  - that Tempo is the only buyer;
  - acquisition;
  - other chains by name.
- **Always attach once:** testnet, unaudited, the batch comes from Tempo's integration tests, no revenue.
- The demo question (bonded answers) is self-checkable with `eth_simulateV1`. Say so once, framed as
  "that's why it's a good demo".
