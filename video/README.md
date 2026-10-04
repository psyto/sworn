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

# CWF videos — pitch (≤ 2 min) and demo (≤ 3 min)

Scripts: `PITCH.md`, `DEMO.md` (+ the founder's `CLAUDE-CODE-DEMO-BRIEF.md`). They are the only source of
narration; each ends with a claims → source table, and every figure on screen comes from one of those
sources, **read at record time** (missing or changed source → the recorder throws). Silent 1920×1080 output,
scene lengths = words ÷ 2.2 words/s rounded up to 0.5 s. Look: `slides.css` uses the demo app's
"Tempo-adjacent design language" tokens (Geist / Geist Mono from Google Fonts — the recorder refuses to
record with a fallback font; never Tempo's logo, wordmark or Pilat).

```sh
node video/record-pitch.mjs              # → video/pitch.mp4 + pitch.srt + pitch.marks.json   (reads only)
node video/split-scenes.mjs pitch        # → video/scenes/pitch/scene-{1..6}.mp4|.txt + NARRATION.md

node video/record-demo.mjs               # demo v2 → video/demo.mp4 + demo.srt + demo.marks.json + frames/demo-scene{1..4}.png (reads only)
PREVIEW=<dir> node video/record-demo.mjs # the four authored slides as PNGs + all source checks; records nothing
node video/split-scenes.mjs demo         # → video/scenes/demo/scene-{1..4}.mp4|.txt + NARRATION.md
```

Pitch **v2** (six scenes, Zone proof first) sources: Tempo's docs page `zones/proving.md` (both quoted sentences), `tempoxyz/zones` @ `ac49071f` via `gh api` (README, reference `Verifier.sol` `return true`), the pinned checkout `spikes/zone-spf/zones` (`IVerifier.verify` selector = `SwornZoneVerifier`'s), Moderato (SwornZoneVerifier codehash, the attest receipt and decoded `ZoneBatchVerified`, the three `Slashed` receipts), the explorer page of the attest tx (screenshot cropped to its transaction card, never the header with Tempo's wordmark; its Events tab must show the event's topic0), the proving log, vendored `zone_factory`, README (T12, "is / is not"), the patch files, GitHub, ethglobal.com. `PREVIEW=<dir> node video/record-pitch.mjs` writes one PNG per scene instead of recording. `DEMO.md` is the **v2 demo, recorded 2026-10-04** (2:35, four scenes, Zone proof first).

Demo **v2** sources, all read at record time (any mismatch throws): the **published page**
(`DEMO_PAGE_URL`, default https://psyto.github.io/sworn/) recorded in a real browser — every value its Zone
section shows (attest tx, block, gas, contract, decoded `ZoneBatchVerified`, the ✓ lines, immutables,
codehash, proof size, `verify(…)` ✓ true / ✗ `InvalidProof()`) is compared with `deployments/moderato.json`
↔ Moderato, the fixture and the recorder's own two `eth_call`s; "Verify again" is clicked and its "Called
at" must change. Nothing on the page, the explorer, `DEMO.md` or any slide may name the superseded verifier
or its attest tx. The page's pipeline caption must match the proving log, else it is hidden and the log's
figure burned in (today it says 816 s, the superseded proof; the log says 701 s). The explorer page of the
attest tx is cropped to its transaction card and event row (no header). Scene 2 re-cuts the 10-03 take
(`takes/demo-20261003T131156Z`, gitignored — keep it): take.json ↔ `demoLiveTake` ↔ Moderato (reserve 500,
payment with guard +500 / R′ +0 at block−1/block, `Slashed` 500 with client +500); one speed-up (MPP charge +
reserve, ×6.3) labelled with its real 18.8 s from the take's marks; the proving time-lapse is the take's own.
Scene 3 adds an `eth_simulateV1` of the agent's same transfer at the question's block (→ `ReceivePolicyGuard`,
whose address is read from vendored `tempo/…/precompiles/mod.rs`). Scene 4: README limits, the repo (public),
the page (HTTP 200). v1 (five scenes, `--live` / `--no-live` / `--from-take`) is `d6996a3:video/record-demo.mjs`.

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
