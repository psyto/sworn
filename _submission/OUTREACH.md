# Outreach drafts: first demand evidence (2026-10-07)

**Purpose.** The weakest part of the submission is demand: no operator, auditor or Tempo engineer has said whether
this evidence matters (Codex review r1, deciding factor 3). Any reply, positive or negative, turns a hypothesis into
a fact we can cite. **Sent so far (2026-10-09): the public X post in the log; none of the direct messages below.** The founder sends each message; Claude sends nothing.

**Rules for every message**
- Ask a question someone can answer in two lines. Do not pitch.
- Claim only what the repo shows: our own Zone, one operator, testnet, unaudited; Tempo's Zones unchanged.
- Link the evidence, not the deck: the live page, the payout tx, spec 004.
- Record every reply (or no reply after 48 h) in the log at the end, verbatim, with the date.

---

## 1. Tempo Zones team: a GitHub issue on `tempoxyz/zones` (public)

Use only if the repo accepts issues from outsiders; otherwise send it as a DM (section 2). Title:

```
Question: would per-operator ZK evidence of prove_zone_batch be useful alongside Nitro, off the fast-withdrawal path?
```

Body:

```
Hi Zones team,

For a Tempo hackathon I ran zone_spf::prove_zone_batch (zones ac49071f) inside SP1 and bound the Groth16 proof to
exactly the inputs IVerifier.verify receives. Two results on Moderato, all read-only reproducible:

1. A standalone verifier with IVerifier's signature verified proofs of two batches from your integration tests
   (one with a withdrawal).
2. On our own Zone (outside the factory, one operator, testnet), a ZonePortal using its own instance of that
   verifier settled three proven batches only after each proof passed, then our sequencer separately paid the
   withdrawal, and a forged,
   sequencer-signed batch replaying a real proof was rejected on the proof:
   https://explore.testnet.tempo.xyz/tx/0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1
   https://explore.testnet.tempo.xyz/tx/0x3a154e4e0b9dde8531a151ff39d6991af76b264d292eab2b8b0b0b31717b167d

Repo: https://github.com/psyto/sworn (spec 003 = the verifier, spec 004 = a TEE + ZK proposal).

I understand Nitro is the path for fast withdrawals, and a proof here takes 12-15 minutes on one machine, so I am
not suggesting ZK on that path. My question is about a different use: because Zones settle in batches, an operator
could prove batches on its own schedule (for an audit, a counterparty or after an upgrade), where minutes or hours
of proving do not matter, and anyone could check the result without trusting hardware. It does not address data
availability, liveness, censorship or witness access; it is meant as an independent check beside Nitro.

I am not asking you to adopt anything. Three questions, any of which would help:
- Would per-operator ZK evidence like this, off the fast path, be useful for Zones, or is Nitro the intended end
  state for all review needs?
- If yes, would per-Zone config policy belong in the native verifier or in the portal?
- Is there a canonical way for an operator to publish (or escrow) a batch witness, so proving is not
  operator-only?

Thanks, and thanks for open-sourcing zone-spf: it made this possible.
Hiroyuki Saito (@psyto)
```

## 2. Tempo developer relations / Zones engineers (DM, Discord or X)

```
Hi — I built Sworn for the CWF Tempo track. Private execution, checkable validity: Tempo Zones' own batch verifier
runs in SP1, so a Zone batch's correctness can be checked on Moderato without publishing its transactions.
Separately, on our own testnet Zone (one operator, not Tempo-created), the portal settled three proven batches,
then our sequencer separately paid a withdrawal; a forged batch was rejected.

One question, two lines is plenty: is a ZK check next to the Nitro attestation something Tempo would want for
Zones, and if so, who on the Zones team should I ask about the integration path?

Live evidence: https://psyto.github.io/sworn/#own-zone · repo: https://github.com/psyto/sworn
```

## 3. Someone building a Zone or a private payment ledger (DM or email)

Find targets among: teams that announced Zone pilots or private ledgers on Tempo; payment, payroll or treasury
products built on Tempo; stablecoin issuers piloting Zones. One message per team; personalise the first line.

```
Hi <name> — I saw <their Zone / private-ledger work>. Quick question from someone building on Tempo Zones.

If your Zone had to show an auditor or a settlement counterparty that a withdrawal batch was executed correctly,
without handing over the private ledger, how would you do it today? Would a proof anyone can verify on chain,
exposing only hashes and batch metadata, change that conversation, or is the operator's attestation enough?

Context (not a pitch): I proved Tempo's own Zone verifier in SP1 and ran a testnet Zone whose portal settles only
after the proof — https://psyto.github.io/sworn/#own-zone. No customers yet; I'm trying to learn whether this
matters to anyone running a Zone.
```

## 4. An auditor or assurance reviewer (email)

Targets: smart-contract audit firms with a stablecoin or payments practice; financial auditors who review
crypto reserves or payment flows.

```
Subject: Would this count as evidence for a private-ledger withdrawal batch?

Hi <name>,

A short question about evidence, not a sales request.

Tempo "Zones" are private ledgers: users see only their own transactions, and only the operator sees them all. I built a tool that turns one
operator-supplied batch into a zero-knowledge proof that Tempo's own Zone code accepts exactly that batch. Anyone
can verify the proof on chain; it reveals hashes and batch metadata, not transactions or balances.

If a client running such a ledger handed you that proof for a withdrawal batch, would it reduce the work you need
to do, replace some of it, or not matter? A two-line answer would help me a lot.

Live example (testnet): https://psyto.github.io/sworn/#own-zone

Hiroyuki Saito
```

## 5. Public post (X), optional

```
Built for the CWF Tempo track: Tempo Zones' own batch verifier, proven in SP1 and checked on Moderato.

On our own testnet Zone, the portal settled 3 batches only after their proofs passed; our sequencer then paid a withdrawal.
Click "Re-verify on chain" yourself: https://psyto.github.io/sworn/#own-zone

Question for Zone builders: would you want this next to a TEE attestation? Replies welcome.
```

---

## Log (fill in; cite only what is here)

| date | to | channel | message | reply (verbatim) or "no reply after 48 h" |
|---|---|---|---|---|
| 2026-10-09 | public (@tempo, @colosseum mentioned) | X post with the pitch video: https://x.com/psyto/status/2108529502842503352 (links in self-reply https://x.com/psyto/status/2108529680274149860) | "@tempo: would Zone operators want this?" | after ~9 h (2026-10-09 21:00 UTC): post 67 impressions, 1 like, no replies; self-reply 22 impressions. Check again after 48 h (2026-10-11 12:06 UTC) |
| 2026-10-09 | Arena builders (tag: Looking for testers) | Builder Update: https://colosseum.com/arena/projects/confide/updates/1549 | 1-minute "Verify on chain" test; what was unclear; would this change how you review a batch? | (builder feedback, not operator demand; check 2026-10-11) |

**Where a reply goes.** One line in the form's "How do you know people actually need…" (≤ 1000 chars; check with
`scripts/cwf-form.sh`), the README's "The plan", and interview Q8. Template:

```
Early signal (2026-10-xx): asked <role at org> whether <question>; reply: "<quote>". One conversation, not demand.
```

A negative or empty reply is still reported: "Asked N teams; M replied; none needed it yet" is a tested hypothesis,
which is better than an untested one.
