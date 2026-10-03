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
