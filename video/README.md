# CWF videos — pitch (≤ 2 min) and demo (≤ 3 min)

The submission videos are **Pitch D** (`PITCH-D.md`, 1:49 narrated; the silent cut is 126 s) and **Demo D** (`DEMO-D.md`, 1:22 narrated; the silent cut is 94 s). The scripts are
the only source of narration; each ends with a claims → source table, and every figure on screen is **read at
record time** (missing or changed source → the recorder throws). Silent 1920×1080 output, scene lengths =
words ÷ 2.2 words/s rounded up to 0.5 s. Look: `slides.css`, Geist / Geist Mono (the recorder refuses a
fallback font); never Tempo's logo, wordmark or Pilat.

**Uploaded (2026-10-09):** pitch https://youtu.be/qTBetXF5SPY (`final/Sworn_Pitch_20261009.mp4` + `.en.srt`), demo
https://youtu.be/GZz52yUDJKo (`final/Sworn_Demo_20261007.mp4` + `.en.srt`), check-in 4 https://youtu.be/Dqipz1hYM04
(`final/Sworn_CheckIn4_20261008.mp4`). Titles, descriptions and chapters: `YOUTUBE.md`. The voiced scripts are final;
later wording changes went to text surfaces only.

```sh
node video/record-pitch-d.mjs            # → video/pitch-d.mp4 + pitch-d.srt + pitch-d.marks.json   (reads only)
node video/record-demo-d.mjs             # → video/demo-d.mp4 + demo-d.srt + frames/demo-d-scene{1..9}.png (reads only)
node video/split-scenes.mjs pitch-d      # → video/scenes/pitch-d/scene-{1..7}.mp4|.txt + NARRATION.md
node video/split-scenes.mjs demo-d       # → video/scenes/demo-d/scene-{1..9}.mp4|.txt + NARRATION.md
```

**Pitch D** (seven scenes, 126 s silent; 1:49 narrated): Sworn is for Tempo Zones → the trust gap before a withdrawal → keep the batch
private, make its execution checkable → why now (Tempo Zones ship no native ZK proof today) and Tempo's own Zone
verifier compiled for SP1, logic unchanged, with a fixture proof verified read-only → a separate run on our own
Zone: three batches settled only after the proof passed, then a withdrawal paid by our sequencer, not the proof; a
forged sequencer-signed batch rejected → the business (first buyer, one batch, Proof Operations; market grows with Zones × batches × upgrades,
if Zones are adopted; later beside Tempo's TEE) → the founder → the honest ask. Its recorder rereads the
deployments against Moderato (bytecode, every receipt, the 0.5 pathUSD payout, the forged batch's status 0), the
README statements it relies on, Tempo's `Cargo.toml`, Fabrknt Dojo, the ETHGlobal showcase and Superteam's winner
record.

**Demo D** (nine scenes, 94 s silent; 1:22 narrated) keeps the two results apart: a real local proof job for Tempo's
integration-test fixture (dev chain 1337, nothing sent; a labelled cut from its start to its verified result),
what stays private, the fixture attest on Tempo's explorer and a live re-verify (true / `InvalidProof()`), then
a separate-run card, our own Zone's settlement and payout, the forged batch's failed trace, and the reproduction
script plus `forge test` against the deployed bytecode. It is cut from clips recorded live by
`record-demo-b.mjs` (the proof job, cached in `takes/demo-b/`) and `record-demo-c.mjs` (page, explorer and
terminal, in `takes/demo-c/`), which verify every value they show; `record-demo-d.mjs` re-reads the receipts and
bytecode before assembling. Neither of those two versions' own videos is kept. Those clips live in `video/takes/`,
which is not committed, so `record-demo-d.mjs` rebuilds Demo D only on the machine that recorded them; from a clone,
re-run `record-demo-b.mjs` (a ~15 min, ~20 GB proof job) and `record-demo-c.mjs` first. Both check the live page's
wording as it was on 2026-10-08, so later page edits need their string lists updated.

---

# video/ — check-in recordings

`record-checkin.mjs` records `checkin-3-<A|B>.mp4` (silent, 1920×1080) and `checkin-3-<A|B>.srt`
from the script `CHECKIN-3.md`.

```sh
pnpm -C video install                                  # once
VARIANT=B node video/record-checkin.mjs                # before the Moderato slash
VARIANT=A SLASH_TX=0x… node video/record-checkin.mjs   # only after it
```

- **Scene holds come from the script**: words per scene ÷ 2.2 words/s, rounded up to 0.5 s. A variant
  without exactly 3 scenes, or over 58 s, is refused. Edit the narration, not the recorder.
- **Every figure on screen is read while recording** — `deployments/moderato.json` checked against
  Moderato by `eth_call`/`eth_getCode` (GUEST_VKEY, SP1_VERIFIER, codehashes), `out/ac2_run.log`,
  `out/e2e/localnet-full-gate.log`, `scripts/check-e2e.sh --log …` (as committed at HEAD; `GATE=worktree`
  for the working copy) and, for B, `forge test` on `RealGroth16.t.sol`. A missing or unexpected
  source throws; `checkin-3.html` holds labels only and refuses to render an empty slot.
- **Variant A requires the real slash.** It refuses unless `SLASH_TX` has a status-1 receipt on Moderato
  with Sworn's `Slashed` event from the deployed Sworn, and a non-dry-run `out/e2e/moderato-*.log`
  (or `MODERATO_LOG`) names that tx under `S-2.challengePays` and passed `S-2.trueAnswerIsDiversion`.
  Never say A's sentence without the transaction.

## Adding the founder's voice

Record the narration from `CHECKIN-3.md` (the `.srt` shows where each line falls), then:

```sh
ffmpeg -i video/checkin-3-B.mp4 -i voice.m4a -c:v copy -c:a aac -shortest video/checkin-3-B-voice.mp4
```

## Adding voice scene by scene (e.g. Google Vids)

```bash
node video/split-scenes.mjs A        # after VARIANT=A … record-checkin.mjs  (or B)
```

Writes `video/scenes/checkin-3-<V>/scene-{1,2,3}.mp4` (silent, frame-accurate cuts at the recorder's
scene boundaries), `scene-{1,2,3}.txt` (the lines for that clip) and `NARRATION.md`. Import the three
clips in order, record each scene's lines over its clip in your own voice, export one video. Each clip's
length was derived from its word count at ≈ 2.2 words/s, so reading at a natural pace fits; if a take
runs long, trim a pause rather than speeding the video.

---

## Earlier versions (history; most of their recorders and videos are removed)

v1 pitch sources: `deployments/moderato.json` ↔ Moderato (codehash, GUEST_VKEY, SP1 verifier VERSION, MAX_AGE,
CHALLENGE_PERIOD); the three first-slash receipts (reserve `0x08f6…0350`, payment `0x65bc…312a` with guard /
R′ balances at block−1 and block, challenge `0xa7b9…ab9b` with the client's balance at block−1 and block);
`out/ac2_run.log`; vendored `tempo/…/tip20/mod.rs`; `tempoxyz/zones` `crates/spf/src/lib.rs` via `gh api`;
`mpp.dev/llms-full.txt` and `mpp.dev/advanced/refunds`; ethglobal.com/showcase/reckn-47t6m ("Uniswap
Foundation … 3rd place", "ETHGlobal Tokyo 2026"); GitHub (repos public); `contracts/scripts/no-owner.sh
src/Sworn.sol` (source scan, run now). Demo scenes 2–5 add: the honest re-check log (`AnswerCorrect`),
`Sworn.sol` (`verifyProof` must be immediately followed by `AnswerCorrect`), the run log's `S-1.sdkVerify` /
`S-1.witness` / `S-3.*` lines, `patches/tempo.patch` (SPIKE-PATCH ids must be exactly 1,2,3), the reserve
receipt `0xb2bf…7529` (fee = gasUsed × effectiveGasPrice / 1e12 base units of the fee token) and the README's
bold line.

## Demo v1 scene 1 — the live take (how `takes/demo-20261003T131156Z` was made; v1 recorder at `d6996a3`)

- **Record before Moderato T12: 2026-10-08 14:00 UTC = 23:00 JST** (`1791468000`). The recorder refuses
  within 45 min of it; after it the answerer refuses until the guest is re-checked.
- Needs the demo running: `scripts/with-keys.sh demo/scripts/moderato.sh` (UI :5173, backend :8790; keys
  stay in that process — the recorder holds none), and **~15 GB free RAM** for the local Groth16 proof
  (~7 min; under load it once took 48 min). Don't run other provers or Chromium-heavy jobs during a take.
- `--live` refuses unless `DEMO_LIVE_OK=1`, the app reports SDK + signer ready, and both providers have
  ≥ 500 free bond (read by `eth_call servers()`).
- What one take sends (through the app): honest provider — MPP charge + `reserve` (500 locked 24 h);
  dishonest-demo provider — MPP charge + `reserve` (500); the agent's real 500 payment to R′ (diverted to
  `ReceivePolicyGuard`); the challenge tx (500 slashed to the agent). **Each take consumes 500 of the
  dishonest server's bond and locks 500 of the honest one's for 24 h — with 2,000 bonded each, about 4
  takes a day.**
- The whole challenge is recorded live. The edit speeds up **only the proving span of this recording**
  (found from the app's phase list, real duration from the backend job clock) to ~10 s (`TIMELAPSE_S`),
  with a burned-in label "time-lapse · this challenge · <real> → 10 s"; the app's own elapsed clock stays
  visible. The app's "recorded run" fast-forward is never used. Raw footage, marks and the honest-card
  screenshot stay in `video/takes/demo-<utc>/`; `--from-take` redoes the edit without another take.
