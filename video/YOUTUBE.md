# YouTube titles and descriptions — Sworn CWF videos

Pitch: `video/final/Sworn_Pitch_20261009.mp4` (1:49) with `video/final/Sworn_Pitch_20261009.en.srt`; **do not upload
the older `Sworn_Pitch_20261007.mp4`** (old scenes 1, 2 and 4). Demo: `video/final/Sworn_Demo_20261007.mp4` with `video/final/Sworn_Demo_20261007.en.srt` (Subtitles → English → Upload file → With timing). Visibility: **Unlisted** is enough (the form requires that judges can watch without requesting
access; check the link in a logged-out window).
Audience: not made for kids. Language: English. Chapters below follow the narrated cuts (each ≥ 10 s, first at 0:00).

---

## Pitch

**Title** (≤ 100 characters)

```
Sworn: make private Tempo Zone execution checkable — Pitch (CWF, Tempo track)
```

**Description**

```
Private execution. Checkable validity. Privacy and batch processing matter to everyone; for businesses they are essential. Tempo Zones give them both: private ledgers that settle in batches, where users see only their own activity and the operator's sequencer set sees every transaction. But then who can check a private batch? Before a withdrawal, no outside reviewer can verify it. Zcash uses zero knowledge to prove a transaction is valid without revealing it; Sworn uses zero knowledge differently: Tempo's own Zone verifier runs in SP1 and proves a private Zone batch executed correctly, without publishing transactions. (It does not hide anything from the operator.)

Built on Moderato testnet, two separate results:
• A test-fixture proof (Tempo integration test, dev chain 1337) verified on Moderato.
• Separately, on our own Zone (one operator, not Tempo-created): the portal verified each proof before settling three batches; our sequencer then separately paid a withdrawal. A forged batch, even signed by our own sequencer, was rejected on chain.

Product hypothesis: Proof Operations for a Zone business whose reviewer cannot reconstruct the witness. Testnet, unaudited, no customers yet.

Demo video: https://youtu.be/GZz52yUDJKo
Live page (reads Moderato from your browser): https://psyto.github.io/sworn/
Code and specs: https://github.com/psyto/sworn
Payout tx: https://explore.testnet.tempo.xyz/tx/0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1
Rejected forged batch: https://explore.testnet.tempo.xyz/tx/0x3a154e4e0b9dde8531a151ff39d6991af76b264d292eab2b8b0b0b31717b167d

0:00 Private execution needs independent evidence
0:12 Private execution. Checkable validity. (Zcash vs Sworn)
0:25 Why now: not a generic proof wrapper
0:39 Our own Zone: the proof is the control
0:56 The business: one batch, then Proof Operations
1:16 Why me
1:33 What is true today, and the next step

Submission to Colosseum's Crypto World's Fair, Tempo track.
#Tempo #ZeroKnowledge #SP1
```

---

## Demo

**Title** (≤ 100 characters)

```
Sworn demo: a real ZK proof job, and proof-gated settlement on our non-factory Zone
```

**Description**

```
Every screen is a real recording; the recording only reads. Two separate demonstrations, deliberately kept apart:

1. A real local proof job for Tempo's integration-test fixture (deposit and withdrawal, dev chain 1337): Tempo's own Zone verifier runs in SP1, and the proof is verified read-only on Moderato. Nothing is sent. Then the page re-verifies the attested batch live: the real batch passes; change one field and it reverts with InvalidProof().

2. Separately, our own non-factory Zone on Moderato (zone 4242, one operator): the portal verified each proof before settling three batches; then our sequencer, not the proof, separately paid a withdrawal of 0.5 pathUSD. A forged batch, signed by our own sequencer, replayed a real proof for a different batch and was rejected on chain. Anyone can re-run the three live proofs with forge test against the deployed bytecode.

Testnet, unaudited, no customers yet. The proof is a necessary condition for a payout, not a guarantee (not censorship-resistant).

Pitch video: https://youtu.be/qTBetXF5SPY
Live page: https://psyto.github.io/sworn/
Code, specs and reproduction: https://github.com/psyto/sworn
Fixture attest tx: https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770
Payout tx: https://explore.testnet.tempo.xyz/tx/0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1
Rejected forged batch: https://explore.testnet.tempo.xyz/tx/0x3a154e4e0b9dde8531a151ff39d6991af76b264d292eab2b8b0b0b31717b167d

0:00 Two separate demonstrations
0:10 A real proof job, and what stays private
0:33 The fixture proof, re-verified live
0:46 Our own Zone: settled, then paid
0:59 A forged batch rejected; re-run the tests

Submission to Colosseum's Crypto World's Fair, Tempo track.
#Tempo #ZeroKnowledge #SP1
```

Uploaded 2026-10-09: pitch https://youtu.be/qTBetXF5SPY, demo https://youtu.be/GZz52yUDJKo; each description links the other video.

---

## Check-in 4 (week 4)

Upload the narrated `checkin-4` with its captions the same way; the weekly form also requires that judges can watch
without requesting access. Chapter times match the narrated `video/final/Sworn_CheckIn4_20261008.mp4` (51.7 s); captions:
`video/final/Sworn_CheckIn4_20261008.en.srt`. Submit between Oct 9 08:00 PDT and Oct 12 08:00 PDT;
the link cannot be changed afterwards.
Uploaded 2026-10-09: https://youtu.be/Dqipz1hYM04 (submit this link in the check-in 4 form).

**Title** (≤ 100 characters)

```
Sworn — CWF week 4 check-in: settlement on our own Tempo Zone, a forged batch rejected
```

**Description**

```
Week 4 progress report for Sworn, which makes private Tempo Zone execution checkable.

Last check-in (Oct 3–5): a test batch's proof (Tempo integration-test fixture, dev chain 1337) was verified on Moderato.
This week (Oct 6–8), on our own Zone on Moderato (zone 4242, one operator, not Tempo-created):
• Oct 6: the portal settled three proven batches, then our sequencer paid a withdrawal (0.5 pathUSD).
• Oct 7: a forged batch, signed by our own sequencer, was rejected on chain.
• Oct 7–8: the live proofs are re-checkable by anyone with one forge test command (3/3 pass).

What I learned: on a live Zone, proving takes up to about half an hour per batch, so the proof sits on the settlement path; and the proof is necessary, not sufficient: the sequencer still pays.

Next: Oct 9–12, ask Zone builders and reviewers whether they need this; Oct 13, submit; then look for one design partner's batch. Testnet, unaudited, no customers yet.

Payout tx: https://explore.testnet.tempo.xyz/tx/0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1
Rejected forged batch: https://explore.testnet.tempo.xyz/tx/0x3a154e4e0b9dde8531a151ff39d6991af76b264d292eab2b8b0b0b31717b167d
Live page: https://psyto.github.io/sworn/
Code: https://github.com/psyto/sworn

0:00 Last check-in → this week
0:11 Oct 6–8: on chain, and re-checkable
0:31 What I learned
0:41 Next, with dates

Colosseum Crypto World's Fair, Tempo track.
#Tempo #ZeroKnowledge #SP1
```
