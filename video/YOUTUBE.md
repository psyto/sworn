# YouTube titles and descriptions — Sworn CWF videos

Upload `video/final/Sworn_Pitch_20261007.mp4` and `video/final/Sworn_Demo_20261007.mp4` with the captions
`video/final/*.en.srt` (Subtitles → English → Upload file → With timing). Visibility: **Unlisted** is enough
(the form requires that judges can watch without requesting access; check the link in a logged-out window).
Audience: not made for kids. Language: English. Chapters below follow the narrated cuts (each ≥ 10 s, first at 0:00).

---

## Pitch

**Title** (≤ 100 characters)

```
Sworn: make private Tempo Zone execution checkable — Pitch (CWF, Tempo track)
```

**Description**

```
Sworn is for Tempo Zones: private ledgers where only the operator sees every transaction. Before a withdrawal moves, a reviewer cannot verify the private batch. Sworn runs Tempo's own Zone verifier in a zero-knowledge VM (SP1) and turns an operator-supplied batch into evidence anyone can verify on chain, without publishing customer transactions.

Built on Moderato testnet, two separate results:
• A test-fixture proof (Tempo integration test, dev chain 1337) verified on Moderato.
• Separately, on our own Zone (one operator, not Tempo-created): the portal settled three batches only after the proof passed, then our sequencer paid a withdrawal. A forged batch, even signed by our own sequencer, was rejected on chain.

Product hypothesis: Proof Operations for a Zone business whose reviewer cannot reconstruct the witness. Testnet, unaudited, no customers yet.

Demo video: [DEMO VIDEO URL]
Live page (reads Moderato from your browser): https://psyto.github.io/sworn/
Code and specs: https://github.com/psyto/sworn
Payout tx: https://explore.testnet.tempo.xyz/tx/0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1
Rejected forged batch: https://explore.testnet.tempo.xyz/tx/0x3a154e4e0b9dde8531a151ff39d6991af76b264d292eab2b8b0b0b31717b167d

0:00 Sworn is for Tempo Zones
0:14 Keep the batch private, make its execution checkable
0:29 Why now: not a generic proof wrapper
0:45 Our own Zone: the proof is the control
1:01 The business: one batch, then Proof Operations
1:19 Why me
1:37 What is true today, and the next step

Submission to Colosseum's Crypto World's Fair, Tempo track.
#Tempo #ZeroKnowledge #SP1
```

---

## Demo

**Title** (≤ 100 characters)

```
Sworn demo: a real ZK proof job, and proof-gated settlement on our own Tempo Zone (Moderato)
```

**Description**

```
Every screen is a real recording; the recording only reads. Two separate demonstrations, deliberately kept apart:

1. A real local proof job for Tempo's integration-test fixture (deposit and withdrawal, dev chain 1337): Tempo's own Zone verifier runs in SP1, and the proof is verified read-only on Moderato. Nothing is sent. Then the page re-verifies the attested batch live: the real batch passes; change one field and it reverts with InvalidProof().

2. Separately, our own Zone on Moderato (zone 4242, one operator, not Tempo-created): the portal settled three batches only after the proof passed, then our sequencer, not the proof, paid a withdrawal of 0.5 pathUSD. A forged batch, signed by our own sequencer, replayed a real proof for a different batch and was rejected on chain. Anyone can re-run the three live proofs with forge test against the deployed bytecode.

Testnet, unaudited, no customers yet. The proof is a necessary condition for a payout, not a guarantee (not censorship-resistant).

Pitch video: [PITCH VIDEO URL]
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

After uploading, replace `[DEMO VIDEO URL]` / `[PITCH VIDEO URL]` in each description with the other video's link.
