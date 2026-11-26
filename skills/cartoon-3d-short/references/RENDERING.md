---
name: cartoon-3d-short-rendering
description: Remotion rendering pipeline, post-processing, and final export for cartoon 3D shorts
---

# Rendering Pipeline

Run these commands from the [Remotion host](../../../docs/remotion-host.md). This checkout supplies the helper scripts, not the project entry or director.

## Core Files
- `Bridge.tsx` — main composition, composer setup
- `ink.ts` — ink outline pass
- `lensblur.ts` — depth of field
- `grade.ts` — colour grading

## Composer Order (Bridge.tsx, painted look)
Court/diorama and Minecraft use other chains: [PBR mode](../bible/modes/pbr.md), [Minecraft mode](../bible/modes/minecraft.md).
```
ink → lens pre → lens main → bloom → NEUTRAL tone map → grade (MSAA 4)
```
- Every pixel parameter scales with output height / 1920

## Post-Processing Effects
| Effect | Config | Toggle |
|--------|--------|--------|
| Ink lines | #030303, 5.1px near (6m) → 3.3px far (90m) at 1080x1920, creases ×0.8 from 35°, depth jumps 1%, fog tint 0.3 far | `ink` |
| Lens blur | cInf px at 1080: hook/CU 15-16, CU 12-14, MS 10-12, park 7, golden sway 5, wides/aerials 0. Focus on eyes. | `lens` |
| Bloom | thr 1.0, int 0.5, 6 levels, radius 0.6 | `bloom` |
| Colour grade | NEUTRAL tone map → grade | `grade` |
| Zoom blur | only when Bridge.tsx has it (or dim/colour script) | `zoom` |

**Character cards:** on `NOINK` layer (own plum ink)

---

Film grain: OFF (the reference has none; 2.5 % made the 2K file 910 MB vs ~250 MB and turns to mush on YouTube).
For ink color, line weights, and world and character ink rules, see [Painted mode](../bible/modes/painted.md).

---

## Render Scripts
**Draft (10s test):**
```bash
node scripts/render_draft.mjs <Comp> out/<name>/draft.mp4 out/<name>/audio/mix.wav --range 0-299
```
- Use `BRIDGE_ENTRY` to select a sandbox entry.
- The mix WAV is required. `--range a-b` takes the matching audio slice from the full-length mix. The default scale is `0.5` (540×960).

**Final (MUST pass QA gate first):**
```bash
# Test first 5s
node scripts/render_final.mjs <Comp> out/<name>/final/test_5s.mp4 out/<name>/gate --range 0-149 --check <gate frame>

# Full render
node scripts/render_final.mjs <Comp> out/<name>/final/video_silent.mp4 out/<name>/gate --check <gate frame>
```
- h264, CRF 16, scale 4/3 (1440x2560), Chrome + ANGLE

**Final file name = the upload title (user rule, 2026-11-11).** The user uploads straight to YouTube Shorts without
renaming, so the muxed final is named with the video's English title, not `<Comp>_2K.mp4`:
```bash
ffmpeg -y -i "out/<name>/final/video_silent.mp4" -i "out/<name>/audio/mix.wav" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest \
  -movflags +faststart "out/<name>/final/<Video Title>.mp4"
```
- Title: a hooky upload title, ≤ 70 chars, Title Case, Windows-safe (no `\ / : * ? " < > |`, no trailing dot or space).
  Never the reference channel's name. Use the same title in the delivery `--title`, and say it in the hand-off message.
- Example: `The Plumber Who Held the Door for the Mona Lisa Thief.mp4`.
- **NEVER use plain `npx remotion render`** — produced a 2K final with no ink, no lens blur and no grade
- Mux: `-map 0:v:0 -map 1:a:0` (Remotion writes silent audio track)

---

## Pre-Render QA Gate (MANDATORY)
Run `node scripts/fx_gate.mjs <Comp> out/<name>/gate --frames <a,b> [--fx ink,lens,bloom,grade,zoom]`.
Use the same entry, composition, browser, and effects for the gate and the final render. See [Quality Assurance](QUALITY_ASSURANCE.md#script-gates) for the other required gates.

**Checks:**
1. **Duplicate dependencies:** `npm ls --all --parseable three postprocessing @react-three/postprocessing`. Require one installed copy of each package and the [documented pins](lessons-summary.md#dependencies-silent-kill-everything).
2. **A/B test each effect** — render ON vs OFF, compare pixels. If <0.5% pixels change >3/255, effect not running → STOP
3. **Confirmation logs** — each effect prints `[FX] <name> active` first run. No log ON = fail. Log OFF = broken toggle = fail.
4. **Mandatory report** — paste `fx_gate.md` table to user: deps OK, each effect ON/OFF log, A/B result. Only then start final render.
5. **Post-render** — show `<video>_fxcheck.md` (render_final.mjs writes). Checks logs + frame from mp4 closer to gate's ON still than any OFF still.

**Frames to test:** pick where each effect has something to act on (DOF shot for lens, night+lanterns for bloom, zoom move for zoom). Include ≥1 gate frame inside 5s test range.

---

## Disk management

Use a temporary directory on a drive with free space. A Remotion bundle copies `public/` into `remotion-webpack-bundle-*`. The Bridge assets took about 1.3 GB per copy.

In a POSIX shell (macOS/Linux):

```sh
export REMOTION_TMP="$HOME/remotion-tmp"  # Use an absolute path on your chosen drive.
mkdir -p "$REMOTION_TMP"
export TMPDIR="$REMOTION_TMP" TEMP="$REMOTION_TMP" TMP="$REMOTION_TMP"
```

In PowerShell:

```powershell
$env:REMOTION_TMP = "D:/remotion-tmp"
New-Item -ItemType Directory -Force $env:REMOTION_TMP | Out-Null
$env:TEMP = $env:REMOTION_TMP
$env:TMP = $env:REMOTION_TMP
```

Set the OS temp variables before you start any helper. Some stills helpers do not read `REMOTION_TMP`.
Node uses [`TMPDIR` first on POSIX and `TEMP` first on Windows](https://nodejs.org/docs/latest-v20.x/api/os.html#ostmpdir).
When rendering stops, remove only the bundle and `puppeteer_dev_chrome_profile-*` directories from your completed runs.

---

## Performance
- 2K renders ~4 fps (≈10 min for 67s)
- Stills at 0.5 scale: 3-8s each after ~40s bundle
- Sub-agents can't write report files → ask for ≤150-word final message, save to `out/<name>/<n>/REPORT.md` yourself

---

## Delivery (Step 11)
Before naming/uploading: `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,avg_frame_rate,duration -of json "<final>.mp4"`
The final must show 1440×2560, `30/1`, and the planned duration (±1 frame). A default draft is 540×960. Make sure that the delivery file contains an audio stream.
```bash
node scripts/dump_shots.mjs src/videos/<name>/story.ts out/<name>/shots.json
python -I scripts/export_extras.py stories/<slug>/voice/words.json out/<name>/shots.json out/<name>/audio out/<name>/final --title "<Video Title>"
```
The export writes `captions.srt` (one cue per phrase), `shots.edl` (CMX3600), and `stems/`. Put `voice.wav`, `music.wav`, `sfx.wav`, and `mix.wav` in the mix folder first. A missing stem stops the export.
Use approved recordings for SFX. Do not use the historical synthesized SFX examples as delivery audio.