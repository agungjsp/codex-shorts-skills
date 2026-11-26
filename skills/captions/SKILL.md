---
name: captions
description: Make word-synced captions for a short as a SEPARATE green-screen clip (plus optional ProRes 4444 alpha) for After Effects - white uppercase text, black outline, hard drop shadow, 2-3 words at a time, centred low on the frame, kept clear of the YouTube Shorts UI, timed to the narration voice. Use when the user asks for captions, subtitles, "caption greenscreen", "teks ikut suara", or "captions skill" for any short.
---

# Captions (green screen, voice-synced, Shorts-safe)

The user edits captions further in After Effects, so captions are NEVER burned into the film. Deliver a separate
clip on pure green (#00FF00), same size, fps and frame count as the film, which they key with Keylight.

## Setup from a checkout
The caption scripts need no Remotion project. From the repository root, set the script path:

```bash
CAPTION_TOOLS=skills/cartoon-3d-short/templates/scripts
```

Use Python 3.12 and install the pinned [caption dependency](../../requirements/captions.txt) with
`python -m pip install -r requirements/captions.txt`. Put `ffmpeg` and `ffprobe` on `PATH`.
FFmpeg needs `libx264` and, for `--alpha`, `prores_ks`. Use `--font` if the script cannot find a heavy system font.
In a Claude host project with the template scripts installed, use `CAPTION_TOOLS=scripts` instead.

If you need to make `words.json` from a voice recording, also install the
[alignment dependency](../../requirements/alignment.txt) with `python -m pip install -r requirements/alignment.txt`.
The first alignment run needs the faster-whisper `small` model. It can download the model or use a populated
`HF_CACHE_DIR`. With your own measured word timings, you do not need faster-whisper.

## Look (agreed 2026-11-11, from the user's "LOCKED" reference frame)
- Position: centred horizontally; the middle of the capitals at **71.5 % of the frame height** (under the
  character's chest). The middle of the capitals is the anchor, so a comma or a Q never moves a caption.
- White, UPPERCASE, Arial Black, **3.2 % of frame height** (82 px at 2560). It was 4 % at first, and the user
  asked for smaller so the Shorts UI never covers it. Black outline; **hard** black drop shadow down-right.
  The shadow is solid on purpose: a blurred/semi-transparent shadow keys into a green-grey fringe.
- **Punctuation is kept** as in the script (MONA LISA. / PARIS, / 1911.). The user asked for it.
  `--strip-punct` removes trailing . , ; :
- The script prefers captions of two or three words. It breaks at punctuation or a pause and avoids ending on
  a glue word (the, of, with, yang, di, dengan ...), splitting names (Mona | Lisa), and leaving lone words.
- Each caption appears on the frame its first word is spoken (a 5-frame pop 0.85 -> 1.06 -> 1) and holds until the
  next one. After a pause in the voice it leaves 0.25 s after its last word.

## YouTube Shorts safe zone (must hold for every caption, at the pop's 1.06 peak)
Conservative overlay areas:
- action buttons: right 16 % of the width
- title/channel/music: bottom 25 % of the height
- top bar: top 8 % of the height

The script measures every caption's ink, prints `WARNING outside the Shorts safe zone: <text>` for any that cross a
zone, and prints the reach (should be about "83.8 % of width, 69.8-74.0 % of height"). Chunks are split so they fit
`--max-width 0.68`. A single long word is shrunk to fit. Never deliver with a WARNING: lower `--size`, or raise
`--y` a little.

## Model (Claude workflow, approved 2026-11-12)
In Claude, run captions on Haiku 5.5 (`remotion-renderer` with `model: "haiku"`, or a Haiku session). The script
handles timing, splitting and safe-zone checks. Use Sonnet to judge a new look and Opus to change the
logic in `scripts/captions.py`.

## Steps
1. Use the short's measured `words.json`. It is an array of objects such as `{"w":"HOME","s":0.14,"e":0.20}`.
   `s` and `e` are seconds on the film timeline. If the recording starts later than the film, offset the
   word times before rendering. If you do not have word times, run:

   ```bash
   python "$CAPTION_TOOLS/words_from_voice.py" voice.wav SCRIPT.md words.json en
   ```

   Use `en` for English or `id` for Indonesian. If you omit it, the script uses `id`. Use a numbered
   Markdown table with `#` and `Narration` or `Narasi` columns, a `# | EN | ID` table, or a `.txt` file
   with one spoken beat per nonblank line. The aligner copies measured word timestamps and keeps the script
   spelling. Review any spelling substitutions marked `guess: true`. If the script cannot align the words,
   correct the timing using `words_raw.json` and the voice. The aligner does not invent missing timestamps.
2. Render the 10-second test first:
   ```bash
   python "$CAPTION_TOOLS/captions.py" words.json out/captions-check --start 0 --dur 10 \
     --preview "path/to/film.mp4" --alpha
   ```
   It prints every caption with its times and the safe-zone check, and writes:
   - `captions_green.mp4`
   - `captions_alpha.mov`
   - `captions.json`
   - `captions_preview.mp4` (film + captions + film audio, for checking only)
3. Check:
   - Pull frames of the widest captions from the preview with the Shorts zones drawn in red (ffmpeg `drawbox`:
     x=iw*0.84 from y=ih*0.45, y=ih*0.75 to the bottom, the top ih*0.08), `hstack` them into one sheet, and look.
   - Look at one full-res crop for green fringe.
   - Send the user `captions_preview.mp4`, `captions_green.mp4` and the printed caption list.
4. After the user's approval, render the full clip. Use the same appearance options as in the approved test.

   ```bash
   python "$CAPTION_TOOLS/captions.py" words.json out/captions --film "path/to/film.mp4" --alpha
   ```

   `--film` reads the dimensions, frame rate and decoded frame count of the video with `ffprobe`. Omit
   `--start` and `--dur` to match the full frame count, including any silence after the last caption. If you
   also want a full review composite, use `--preview` in place of `--film`. Use a constant-frame-rate
   export for exact frame timing. If your film uses variable frame rates, export a constant-frame-rate copy
   first. Compare the video streams with `ffprobe -count_frames` before delivery.

If there is no film yet, set `--w`, `--h` and `--fps` for the intended canvas. Their defaults are 1440, 2560
and 30. `--fps` accepts a fraction such as `24000/1001`. Without `--dur`, the clip ends one second after the
last word. Use the actual film for the approved full render.

## Knobs (scripts/captions.py)
- `--y 0.715`: position
- `--size 0.032`: font size
- `--max-width 0.68`: widest caption
- `--font <ttf>`
- `--max-words 3`
- `--gap 0.30`: pause that breaks a phrase
- `--hold 0.25`
- `--lead 0`: frames early
- `--no-pop`
- `--lower`: keep case
- `--strip-punct`
- `--key-color FFD21F`: color words written in all caps in `words.json`. Other words stay white.
- `--alpha`: ProRes 4444
- `--keep "the snail hole"`: keep all matching phrases together, even across a pause. Repeat for each phrase.
  Matching ignores case and punctuation. A kept phrase can exceed `--max-words`, but it still has to fit
  `--max-width`. Read the full caption list after every full render and fix any split names or phrases.

## AE notes for the user
- **Green clip:** use Keylight with Screen Colour = pure green. It is yuv444 crf 8, so edges stay clean.
- **Alpha .mov:** place it on top of the film without a key. With `--key-color`, prefer alpha because green
  despill can shift yellow toward orange. With `--preview film.mp4 --alpha`, the preview composites the alpha
  clip directly without despill.
- **captions.json:** lists each caption's text and in/out seconds, for rebuilding them as text layers.
