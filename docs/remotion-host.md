# Configure a Remotion host for cartoon shorts

A host is the separate Remotion project that plans and renders the short. This checkout supplies skill instructions, templates, and helper scripts. It does not supply the host's package files, director, or Minecraft renderer. The [public upstream](https://github.com/fahniazz/claude-shorts-skills) and the [earlier MIT skill](https://github.com/mromidev/claude-animated-shorts) also publish templates, not that host. No public copy of the original host was identified. A blank Remotion starter is not a replacement.

Use a trusted host that you can inspect and reproduce. If it lacks the director, stop before thumbnail storyboards or 3D work. If its renderer or fixtures are missing, report the affected gate as blocked. Do not replace a gate with a generated plan, a blank animation, or a visual inspection alone.

## Install from the host lockfile

Use Node.js 20 or later, subject to the host's requirements. Use Node.js 22.18 or later if you run `mc-direct.mts` directly with Node. Record the exact Node and npm versions used. Keep `package.json` and `package-lock.json` together at the same host revision. Run these commands in the host root:

```sh
node --version
npm --version
npm ci
npm pkg get scripts.director
npm ls --all remotion @remotion/cli @remotion/three @remotion/bundler @remotion/renderer react react-dom @react-three/fiber esbuild
npm ls --all --parseable three postprocessing @react-three/postprocessing
```

`npm ci` uses the [host's existing lockfile](https://docs.npmjs.com/cli/v10/commands/npm-ci/). The director entry must be a real script, not `{}`. The last command must report one installed directory per package, even if npm lists references to it in several places. Stop on missing or invalid dependencies.

| Package | Requirement |
|---|---|
| `three`, `postprocessing`, `@react-three/postprocessing` | Exact pins from the [production lessons](../skills/cartoon-3d-short/references/lessons-summary.md#dependencies-silent-kill-everything): `0.170.0`, `6.36.6`, `3.0.4`, respectively. |
| `react`, `react-dom`, `@react-three/fiber` | Use matching React and React DOM 19 versions and Fiber 9. Use exact versions from the host. |
| `remotion`, `@remotion/cli`, `@remotion/three`, `@remotion/bundler`, `@remotion/renderer` | Use the [same exact release](https://www.remotion.dev/docs/version-mismatch) for all Remotion packages. Use the release from the host. |
| `esbuild` | Use the host's exact version. Camera helpers import it, and `dump_shots.mjs` uses its local executable. |
| TypeScript and the director's script runner | Use the host's exact versions and commands. Node 20 alone does not run the TypeScript in `mc-direct.mts`. |

The [compositor manifest](https://registry.npmjs.org/@react-three%2fpostprocessing/3.0.4) requires React `^19.0`, Fiber `^9.0.0`, and `postprocessing` `^6.36.6`. The [effects manifest](https://registry.npmjs.org/postprocessing/6.36.6) accepts Three `>=0.157.0 <0.173.0`. The [Fiber 9 manifest](https://registry.npmjs.org/@react-three%2ffiber/9.0.0) and [N8AO manifest](https://registry.npmjs.org/n8ao/1.9.4) show how their peers fit these pins. The original host's exact versions outside the documented trio are unknown. A successful dependency install does not prove a compatible renderer.

If you maintain a candidate host, apply the documented trio in that host:

```sh
npm install --save-exact three@0.170.0 postprocessing@6.36.6 @react-three/postprocessing@3.0.4
```

Resolve peer conflicts before you save the lockfile. Do not force npm to ignore them. Record the remaining exact direct dependencies and lockfile with the host. Use `npm ci` for subsequent installs. A nested copy of `postprocessing` can silently drop custom effects, even if the scene still renders.

## Host files and tools

| Stage | What the host must supply |
|---|---|
| Director | An npm `director` script that implements `plan`, `validate`, and `preview`. Supply `src/director/`, `src/director/director/prompt.md`, the schemas and configuration, and the [motion preset library](../skills/cartoon-3d-short/presets/README.md). Set `CARTOON_PRESETS` to the absolute path of that library if the host uses that variable. |
| Plan input | An approved `stories/<slug>/SCRIPT.md` with the structure expected by the host parser and its `sources.md`. For the timed pass, use `stories/<slug>/voice/words.json`, an array of `{ "w": "word", "s": 0.0, "e": 0.2 }` records with times in seconds. |
| Plan output | `out/director/<slug>/director/request.json` before drafting. The main session writes `director/draft.json`. The host supplies `director/feedback.json` for errors and writes `review.md`, `preview.md`, `animation-plan.json`, `gap-report.json`, and `constraints.json` for the accepted plan. |
| Picture | `src/index.ts` (or an explicit `BRIDGE_ENTRY`) and a registered 1080×1920 composition at 30 fps. Register production compositions in `src/Root.tsx`. Put the local assets used by `staticFile()` in `public/`. Register `src/videos/<name>/story.ts` in `src/director/config/stories.json` under the story slug. |
| Render gates | Copy the needed files from [`templates/scripts/`](../skills/cartoon-3d-short/templates/scripts/) into the host's `scripts/`, including `fx_diff.py`. Use ffmpeg, ffprobe, and the Python environment from the [Codex setup guide](codex.md). The gate starts `python -I` as a child process, so activate that environment before running Node. |
| Audio and delivery | Supply a full-length `mix.wav` with the current timing, and preserve `voice.wav`, `music.wav`, and `sfx.wav` alongside it for export. Use approved recordings for sound effects. The synthesized SFX examples in `templates/audio/` are historical timing and level references, not production render commands. |

Use the host's Studio command for previews. For gates and renders, the templates use ANGLE. Set `CHROME_PATH` to a compatible local browser when needed. If it is unset, the helpers look for the standard Windows Chrome path, then let Remotion select its browser. Do not assume that the browser is installed already. Use the [temporary directory setup](../skills/cartoon-3d-short/references/RENDERING.md#disk-management) before running helpers.

### Local assets

For the painted templates, read the model paths in `world.ts`. Bridge and Palace refer to `public/bridge/kenney/`. Rail refers to the kit directories under `public/airbrake/kenney/` and imports `stories/air-brake/voice/words.json` until you change the import for your short. Missing model files can be skipped by the loader. A still alone is not proof that the asset set is complete.

[Court](../skills/cartoon-3d-short/templates/court/README.md) and [Diorama](../skills/cartoon-3d-short/templates/diorama/README.md) use `public/court/sky8k.jpg` and `public/court/src/kloofendal_48d_partly_cloudy_puresky_2k.hdr` by default. Use licensed local copies or change both `staticFile()` paths for your project. The sandbox entries test the look. They do not implement the production frame checks or report the production `[FX]` logs. Do not treat their stills as a gate pass.

For a voxel short, also supply `src/minecraft/`, the `McPreview` composition, the host's Minecraft extractor and validator, and a matching manifest from the user's local game assets. Use the [voxel input and fixture contract](../skills/cartoon-3d-short/bible/modes/minecraft.md). Do not download or redistribute Mojang files.

## Accept a supplied host

Use copies of known-good fixtures in a disposable host checkout. A fixture is a small input with known results. Do not create a production story or spend voice credits for these checks. Record the host revision, tool versions, commands, and results. None of these host checks ran in this skills checkout.

1. Use a host-supplied painted director fixture: its `SCRIPT.md`, valid lean draft, word timings, and matching `story.ts` takes. Copy the script into `stories/<fixture-slug>/SCRIPT.md`. Start with no output directory for that slug.
2. Run `npm run director -- plan stories/<fixture-slug>/SCRIPT.md --lean`. Expect `DIRECTOR_PENDING` (exit 1) and a request for a draft. Use the host's prompt and request to supply the matching fixture draft. Do not use [`SCRIPT_example.md`](../skills/cartoon-3d-short/templates/SCRIPT_example.md) as proof of parser support. It is a narration example, not a validated director fixture.
3. Run `plan` again for the same script. Expect exit 0 and the plan and reports above. First run without word times to exercise provisional timing, then repeat with the fixture's timed narration. Review word anchors in `review.md`.
4. Register the fixture in `src/director/config/stories.json`. Run `npm run director -- validate out/director/<fixture-slug>` and `npm run director -- preview out/director/<fixture-slug>`. Expect a valid plan and a preview. On disposable copies, change the script, the word timings, and the takes one at a time. Make sure that validation rejects each stale plan. Also make sure that `plan` rejects a stale draft with `DRAFT_SCRIPT_CHANGED`.
5. Use a short registered composition from the host that implements `frameCheck` and logs active effects. Use a local `mix.wav` and a known frame where the configured effects are visible. Run the [frame and FX gates](../skills/cartoon-3d-short/references/QUALITY_ASSURANCE.md#script-gates), then a ranged draft. Make sure that its video dimensions match the scale, that it runs at 30 fps, and that it contains the right audio slice. If the gate is green, run the [ranged final helper](../skills/cartoon-3d-short/references/RENDERING.md#render-scripts) on the same composition and inspect its FX report. Check that final rendering refuses a gate that is not green. This check does not approve a production video.
6. If the host claims voxel support, use its `src/director/__fixtures__/minecraft/village-yard.voxel.json` and `src/director/__fixtures__/minecraft-story/` with the supplied local assets. Run `npm run director -- mc-validate <set.voxel.json>`, `npm run director -- mc-stage <set.voxel.json>`, and `npm run director -- mc-preview <set.voxel.json> --scale 0.5 --frame 0`. Expect `world.json` and `tex/` under `public/mc-preview/<id>/`, plus a PNG under `out/mc-preview/<id>/`. Repeat the director plan and validation with the host's voxel story fixture. Keep the voxel safe-zone check for mobs and props.

A missing fixture blocks verification. A review or render failure blocks the corresponding stage. Follow the [director loop](../skills/cartoon-3d-short/references/DIRECTOR.md) and [production quality gates](../skills/cartoon-3d-short/references/QUALITY_ASSURANCE.md) before delivering a short.
