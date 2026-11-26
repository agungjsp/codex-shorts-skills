# Claude Animated Shorts

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill entry: pipeline, user rules, pointers to the files below |
| `bible/` | Style, characters, environment, camera, and one file per look mode (painted, PBR/diorama, Minecraft) |
| `references/` | Workflow, rendering, audio, QA, director, lessons |
| `presets/` | Motion presets and the review rubric (pass = 8.5) |
| `templates/` | rail (default), bridge, palace, court, diorama, audio, scripts |
| `templates/audio/` | Historical bridge audio tooling. Use recorded SFX for new shorts. |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `bible/style.md` | The script and visual formula measured from 20 reference shorts |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |

## Install
1. Copy this folder to `~/.claude/skills/cartoon-3d-short/` (clone it there, or download the ZIP).
2. Use a [compatible Remotion host](../../docs/remotion-host.md) with the original director. Follow the [runtime setup](../../docs/codex.md#runtime-setup) for the media tools. A blank Remotion starter cannot run the director gate.
3. In Claude Code, say: *"Use the cartoon short skill and make a short about …"*.

Follow `SKILL.md` and `references/WORKFLOW.md` for script, voice, storyboarding and rendering. Run the director, review, and FX gates before delivery.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). Reference frames from third-party videos are not included in this copy; measure your own references.
