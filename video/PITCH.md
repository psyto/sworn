# Pitch video: Sworn (≤ 2 min, founder's voice), v2, 2026-10-04

**Form field:** *Pitch video · Public · ≤ 2 min · required.* The page says it is *"one of the first resources
judges review."*
- **Length:** target ≈ 115 s of narration (≈ 2.2 words/s, ≈ 250 words).
- **Order** follows `_submission/CRITERIA-MAP.md`: insight → proof it works → why it matters → business →
  founder → honest limits and next.
- **Every claim maps to the source table at the end.** A sentence without a row there is not said.
- v1 (bonded answers first) is in git history (`8e40a6a`).

---

## Scene 1: the gap · ≈ 17 s

**[Screen 1: "Tempo Zones: private blockchains anchored to Tempo." Below it, Tempo's docs quoted in large type:
"ZK proof generation is not implemented." and "The Zones Solidity reference verifier still returns true without
checking execution."]**

> Tempo Zones are private blockchains anchored to Tempo. Today, the check that a Zone
> batch was executed correctly is a hardware attestation, or, in the reference contract, nothing at all.
> Tempo's own docs say zero-knowledge proving for Zones is not implemented.

## Scene 2: it works · ≈ 25 s

**[Screen 2: Tempo's Zone batch verifier → SP1 zkVM → Groth16 → `SwornZoneVerifier` on Moderato, then the
explorer: `attest` tx `0x9aa9…dfbd`, event `ZoneBatchVerified`. Then a strip: "3 slashes on Moderato".]**

> So I built it. Sworn runs Tempo's own Zone batch verifier inside a zero-knowledge VM, binds the proof to
> the exact inputs Tempo's verifier takes, and a contract on Tempo's testnet verified it. Here
> is the transaction. The same engine re-runs Tempo's EVM, and it has already slashed a lying server three
> times on Moderato.

## Scene 3: why it matters · ≈ 18 s

**[Screen 3: a Zone, money moving out to Tempo; beside it, two checks: "TEE: trust the hardware" and
"ZK: anyone can check".]**

> Zones hold money, and money has to come back out. Withdrawals are only as trustworthy as the check on the
> batch. A hardware attestation means trusting one vendor's chip; a zero-knowledge proof, anyone can
> check.

## Scene 4: the business · ≈ 25 s

**[Screen 4: Step 1, "Tempo adds ZK as a second, independent check". Step 2, "Proving operations: a proof
for every batch, on time, re-verified at every Tempo upgrade".]**

> Tempo decides which verifier its Zones use, so step one is Tempo: ZK as a second, independent check
> next to the attestation. Step two is the business: running the provers, with a proof for every batch,
> on time, re-verified at every Tempo upgrade. Specialist work that grows with every Zone.

## Scene 5: why me · ≈ 17 s

**[Screen 5: Reth · Revm · Alloy · Foundry; rethlab; "ETHGlobal Tokyo 2026: Uniswap Foundation, 3rd place
(Reckn)"; the zkVM patches to Tempo's code.]**

> Tempo is built on Reth and Revm, the stack I work in and teach in rethlab, and my last project
> won a Uniswap Foundation prize at ETHGlobal Tokyo. Getting Tempo's code into a zkVM meant patching it,
> which takes reading it.

## Scene 6: honest, and next · ≈ 13 s

**[Screen 6: "Testnet · unaudited · batch from Tempo's integration tests · no revenue yet". Then
"Next: TEE + ZK together, with Tempo." Then "Sworn: Tempo's execution, proven."]**

> It's testnet and unaudited, the batch comes from Tempo's own integration tests, and there is no revenue
> yet. Next: running both checks together, with Tempo. Sworn: Tempo's execution, proven.

---

## Claims and sources

| claim | source |
|---|---|
| Zones are private blockchains anchored to Tempo | `tempoxyz/zones` README @ `ac49071f`: *"Zones are private blockchains anchored to Tempo"* |
| today the check is a hardware attestation, or nothing in the reference contract | Tempo docs "Tempo Zone proving and settlement": *"The Zones Solidity reference verifier still returns `true` without checking execution. Tempo also implements a native Nitro attestation verifier activated by T13."*; `zones/crates/contracts/src/runtime/tempo/Verifier.sol` (`return true`) |
| ZK proving for Zones is not implemented | Tempo docs, same page: *"ZK proof generation is not implemented"* (checked on the live page 2026-10-04) |
| runs Tempo's own Zone batch verifier inside a zkVM | `spikes/zone-spf/` (zones `ac49071f`, `prove_zone_batch`, five zkVM patches); spec 003 AC-Z1 |
| bound to the exact inputs Tempo's verifier interface takes | `SwornZoneVerifier.sol` has `IVerifier.verify`'s exact signature (`IZone.sol:306-345`); the digest covers every `NitroBatchAttestation` field plus the destination chain and genesis artifact (spec 003 §3) |
| a contract on Tempo's testnet verified it; "here is the transaction" | Moderato tx `0x9aa938e8…dfbd`, block 38071845, `ZoneBatchVerified` (`deployments/moderato.json`) |
| re-runs Tempo's EVM; slashed a lying server three times on Moderato | `firstSlash` `0xa7b9…ab9b`, `demoLiveTakeFirst` `0xbf8e…f046`, `demoLiveTake` `0x69ab…5188` (`deployments/moderato.json`) |
| withdrawals are only as trustworthy as the check on the batch | `IVerifier` NatSpec: the proof validates the state transition, deposits and withdrawal queue (`IZone.sol:308-318`); ZonePortal calls `verify` on `submitBatch` |
| attestation = trusting one vendor's chip | the native verifier is AWS Nitro (Tempo docs, same page) |
| Tempo decides which verifier its Zones use | `zone_factory/mod.rs:110,172` (verifier fixed to `ZONE_VERIFIER_ADDRESS` at creation, factory owner creates zones) |
| re-verified at every Tempo upgrade | T12 activates on Moderato at 2026-10-08 14:00 UTC; the Sworn answerer refuses unknown schedules (README "What is not done") |
| rethlab; Uniswap Foundation prize at ETHGlobal Tokyo (with Reckn) | github.com/psyto/rethlab; ethglobal.com/showcase/reckn-47t6m |
| patching Tempo's code for the zkVM | `patches/tempo.patch` (3), `spikes/zone-spf/patches/` (5) |
| testnet, unaudited, integration-test batch, no revenue | README "What the Zone verifier is, and is not" |

**Not said, on purpose:**
- that a Zone settles with it, that it secures withdrawals, or that the batch is from Moderato;
- "verification layer";
- that Tempo is the only buyer or will pay;
- acquisition;
- other chains;
- any user, customer, partner or revenue;
- "mainnet".

The bonded-answer demo question is self-checkable (`eth_simulateV1`). The pitch does not sell that
answer. It cites the slashes only as proof the engine works on the live chain.
