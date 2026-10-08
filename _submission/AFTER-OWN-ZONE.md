# Drafts to apply only if the own-Zone live run on Moderato succeeds (2026-10-07)

> **Superseded (2026-10-08).** Kept as history. The submission videos are `video/PITCH-D.md` and `video/DEMO-D.md`;
> files named below (`PITCH.md`, `DEMO.md`, their recorders and videos) were removed.

**Applied 2026-10-06** (the run succeeded a day early): README, the live page, the form draft, INTERVIEW.md and
CRITERIA-MAP.md. The pitch (v5.4) and demo (v5.5) narration were applied and the silent videos
re-recorded the same day (`video/OWN-ZONE-DRAFTS.md`); the founder's voice is still to be added.

`⟨…⟩` marks a value to fill from the run's receipts (`spikes/own-zone/runs/moderato-20261007/`), never from memory.

## What becomes true, and what stays a limit

**Newly true:** on Moderato, our own Zone (zone ⟨4242⟩, portal ⟨0x…⟩) settled ⟨3⟩ batches, each through
`submitBatch` → `SwornZoneVerifier` → the SP1 Groth16 verifier, and paid a withdrawal only after that
(`WithdrawalProcessed` tx ⟨0x…⟩).

**Still true, and still said:**
- It is our own Zone: one operator, a Solidity `ZonePortal` deployed outside Tempo's factory. It is not a
  Tempo-created Zone.
- Callback withdrawals bounce, because Moderato's messenger checks the factory.
- Testnet, unaudited, no customers.
- Tempo's own Zones still use their current verifier; spec 004 (TEE + ZK) is still a proposal.

**No longer said:** "test batch from a dev chain", "no ZonePortal calls this contract", "does not protect
withdrawals today". For our Zone, withdrawals now wait for the proof. Still never say "Tempo's Zones are
protected".

## Pitch v5.1 → v5.2 (narration; keep ≤ 116 s; the founder approves before recording)

- **Scene 3, now:** "We have done this on Moderato: a test batch with one withdrawal and two user transactions
  verified by a contract. Change one input, and verification fails. This is a working proof pipeline, not a mockup."
- **Scene 3, draft:** "On Moderato, we ran our own Zone: its portal pays a withdrawal only after Sworn's proof
  passes. Three batches, each proven and checked on chain. Change one input, and it is rejected. This is a working
  pipeline, not a mockup." (≈ same length)
- **Scene 6, now:** "Today: testnet, unaudited, Tempo integration-test batch. No customer claimed."
- **Scene 6, draft:** "Today: testnet, unaudited, our own Zone with one operator. No customer claimed."
- **Picture, scene 3:** the live-run settlement and payout txs; "our own Zone · portal calls Sworn".

## Demo v5.4 → v5.5

- **Scene 6 ("said plainly"), draft:** "To be clear: this is our own Zone on Moderato, run by us, not a Tempo-created
  Zone. Tempo's own Zones still use their current verifier."
- **New evidence, inserted after scene 5:** the live-run portal's `submitBatch` → verifier trace and the payout
  tx on the explorer. Keep the integration-test fixture as the "Verify again" source if it is simpler, and say so.

## Page

- **Hero boundary line, draft:** "Testnet. On Moderato, our own Zone's portal pays a withdrawal only after Sworn's
  proof passes. It is not a Tempo-created Zone, and it is unaudited."
- **Data-flow disclosure, draft:** "On our own Zone, the portal calls this verifier before it queues a withdrawal.
  Tempo's own Zones are unchanged; spec 004 is a proposal."
- **New card:** "Our own Zone on Moderato", with the portal, the 3 settlement txs and the payout tx (read live,
  like the attest card).

## README

- **"Is not, yet":** replace "The batches are not from Moderato" and "No Zone settles with it" with "Our own Zone,
  not a Tempo-created one" plus the callback-withdrawal limit.
- **"What is measured":** add a row with the live run (batches, cycles, Groth16 times, anchor ages, payout tx).
- **Diagram 1:** "Tempo's ZonePortal ·· not connected" becomes "Our ZonePortal → SwornZoneVerifier (live, our
  Zone)", with a dashed "Tempo's own Zones: unchanged".
- **Diagram 3:** add "portal pays the withdrawal" after the verifier step.

## Form (paste after success)

- **Brief description, last sentence, draft:** "On Moderato, our own Zone's portal pays a withdrawal only after
  Sworn's proof passes."
- **How far along, draft first bullet:** "Our own Zone on Moderato: ⟨3⟩ batches proven and settled through a portal
  that calls Sworn's verifier; a withdrawal paid after the proof (tx ⟨0x…⟩)."
- **Interview Q2/Q3/Q6:** update the answers. Withdrawals on our Zone wait for the proof; Tempo's Zones are
  unchanged.
