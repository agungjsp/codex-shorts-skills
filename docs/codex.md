# Run the shorts skills in Codex

Use Node.js 20 or later and a recent [Codex CLI](https://developers.openai.com/codex/cli/) with project skills, subagents, and hooks. Open Codex from this checkout. Trust the project only after you review its configuration and hooks. Do not copy the adapters into your home directory. Their links point to the original skills in this checkout.

Call a skill by name in chat:

| Skill | Use it for |
| --- | --- |
| `$cartoon-3d-short` | Vertical cartoon story shorts in a configured Remotion project |
| `$captions` | A separate word-synced caption clip |
| `$minecraft-shorts` | English and Indonesian Minecraft short scripts and recording plans |
| `$minecraft-story` | Story development and the Minecraft Story production wave |

Codex discovers the adapters in `.agents/skills/` and the nine Minecraft Story roles in `.codex/agents/`. Start a new Codex session if you change the skill or role files. Claude Code still uses `skills/` and its own installation steps. No Claude installation is required for Codex.

## Runtime setup

Use native binaries on Apple Silicon. The Minecraft Story Node helpers support Node.js 20 or later. Use the Node version required by your Remotion host, or Node.js 22.18 or later to run `mc-direct.mts` directly. Use Python 3.12 for the pinned Python tools.

```bash
brew install node python@3.12 ffmpeg
python3.12 -m venv .venv
source .venv/bin/activate
```

Run the commands from this checkout. On Linux or Windows, install equivalent native tools. Make sure that `python`, `ffmpeg`, and `ffprobe` resolve inside your production shell. If a GUI renderer cannot find FFmpeg, set its executable path directly.

| Task | Install into the active Python environment |
| --- | --- |
| Green-screen and alpha captions | `python -m pip install -r requirements/captions.txt` |
| Word alignment when you do not have `words.json` | `python -m pip install -r requirements/alignment.txt` |
| Cartoon media checks and audio tooling | `python -m pip install -r requirements/cartoon.txt` |
| Optional ElevenLabs voice | `python -m pip install -r requirements/elevenlabs.txt` |
| Minecraft Shorts novelty search | `python -m pip install -r requirements/minecraft-shorts.txt` |
| Optional Minecraft Story `.schem` export | `python -m pip install -r requirements/minecraft-schematic.txt` |

These files pin direct dependencies. Voice alignment uses the `small` faster-whisper model with CPU/int8. Its first run needs network access or a populated `HF_CACHE_DIR`. Request approval before using paid voice credits. The faster-whisper install is not needed if you already have measured word timings.

- [Standalone captions](../skills/captions/SKILL.md): use the checkout script with a film path and word timings. Verify `libx264` with `ffmpeg -h encoder=libx264`. For alpha, verify `prores_ks` the same way.
- [Cartoon host](remotion-host.md): supply the original director and, for voxel mode, the renderer and extractor. A generic Remotion starter does not provide them. Leave the director and FX gates in place.
- [Minecraft Shorts](../skills/minecraft-shorts/SKILL.md): novelty search and game tests must pass before you call the script final. Report unverified results if a tool or game version is unavailable.
- [Minecraft Story](../skills/minecraft-story/TOOLS.md#8-urutan-install-minimum): install the Java client and server stack separately. Ownership preflight does not send game commands or verify recording.

## Minecraft Story ownership

A *coordinator* is the trusted operator or Codex session that runs the ownership commands. It handles user approvals, intake, cast, report summaries, deterministic checks, and approved server work. It does not author role-owned files. Only the [ownership policy](../skills/minecraft-story/ownership.json) and the `start` command determine which files each role can propose.

A *worker* is a native Codex subagent in a separate, read-only Codex session. Worker output is data. The coordinator stages that output and *promotes* it, which means applying the checked proposal to the live project. The compiler writes `shots/<shot>.json` and `.wave/compile.json`. Never edit compiled outputs by hand.

### Preflight

From a trusted macOS or Linux checkout and the clean Codex setup described below, run this command yourself before the first ownership run:

```bash
node .codex/ownership/preflight.mjs
```

The preflight uses an authenticated Codex CLI and disposable files. It checks the live `apply_patch` hook receipt, then runs a shell write through Codex App Server's `command/exec` with an explicit read-only sandbox. The shell check requires a nonzero exit code, a permission error for the probe file, and unchanged file contents. It needs no Minecraft server. Continue only if it reports `PASS`. Review project trust and the exact hook in `/hooks`, then rerun preflight in the same Codex home. Treat a successful patch as an enforcement failure even when the session was launched with `--sandbox read-only`. Do not use that session against the live checkout.

Rerun preflight after changing the CLI, checkout trust, or ownership policy and hooks. If the worker uses a separate checkout or Codex home, preflight that setup too. Do not force trust or substitute the Claude `doctor.mjs` result.

The `apply_patch` guard rejects direct edits to role-owned and compiled paths in the checkout. It also protects the coordinator-owned cast and skins while Gate 5 is sealed. This hook does not restrict every shell command or connector. Keep the worker sandbox and promotion even when the hook passes.

### Launch the worker session

1. Use an isolated Codex home or an audited clean profile. Authenticate Codex there as required for model access. Do not load MCP servers, apps, plugins, web search, browser, computer use, or other integrations that operate outside the worker shell sandbox. If the local Codex policy cannot be verified, isolate workers in a separate account or VM with only a sanitized input checkout, no access to the live story or coordinator state, and repeat the preflight there before use.
2. Keep game, voice, and other application credentials out of the worker environment and all files it can read. A read-only sandbox prevents writes, not reads. If needed, use an isolated OS account or VM with a sanitized working copy that contains only the input files and project configuration needed for the job.
3. From that checkout, start a separate worker session. Keep model-generated shell network access disabled. For a clean Codex home in a POSIX shell, use:

   ```bash
   CODEX_HOME="$STORY_CODEX_HOME" codex --sandbox read-only --ask-for-approval never \
     --disable apps --disable plugins -c 'web_search="disabled"' \
     -c 'features.code_mode.enabled=false' -c 'shell_environment_policy.inherit="core"'
   ```

   Set `STORY_CODEX_HOME` to the isolated, authenticated Codex home first. The ownership hook uses a POSIX shell; on Windows use WSL and verify the same preflight. If any setting or integration cannot be established, stop. Do not grant temporary write access or use `--add-dir` to expose the coordinator's state.
4. In this read-only session, ask Codex to spawn the named custom roles from the assignments that `start` printed. For each role, supply the slug, job ID, assigned paths, and any gate or revision notes. For `set-builder`, put `SET: <set>` on the first line. Ask the session to show each response with its originating spawn handle. Keep the mapping of handles to assigned jobs outside worker control.

   For example, a worker session prompt can start with: “Spawn one custom agent per assignment below. Return each proposal with its original spawn handle. Do not write files.” Paste the trusted assignment list beneath that prompt.

Do not spawn these roles from the write-capable coordinator. Codex subagents inherit permissions from their parent session. The role TOMLs define tasks, not separate sandboxes. See [Codex subagent permissions](https://developers.openai.com/codex/subagents/).

### Start and apply a phase

Run commands from the live checkout. Put each project in `projects/<slug>/` and use a fresh state directory outside the checkout. Only the coordinator can write that directory. `start` creates it and prints the assignments for the phase.

```bash
slug=first-story
state_root=$(mktemp -d)
state="$state_root/formula"
node .codex/ownership/promote.mjs start "$slug" formula-analyst "$state"
```

Run the assigned roles in the worker session. Once every assigned result arrives, map it by spawn handle to the assigned job ID. Save the JSON as `$state/<job>.json`. Do not trust a worker-supplied role, slug, job name, or destination. Then run:

```bash
node .codex/ownership/promote.mjs apply "$slug" "$state"
```

`apply` checks the results against the manifest before it writes any proposed file. It rejects unassigned or frozen files, compiled outputs, wrong projects, stale project state, unsafe paths, and links. If a result fails, ask the assigned owner to fix it. If the project changed after `start`, start a new assignment in a fresh state directory and rerun the affected work against current inputs. Do not force a stale proposal through or edit the live output by hand.

Do not edit or run generators in the live project during `apply`. The command serializes coordinator promotions; it is not a lock against other applications writing files. Proposal validation happens before file writes; a filesystem error during promotion can leave previously written files in place. Inspect the project and establish a new baseline before retrying.

### Worker contract

Follow the body of the assigned role in [`skills/minecraft-story/agents/`](../skills/minecraft-story/agents/). Resolve `SKILL` to `skills/minecraft-story`. Ignore the Claude-specific frontmatter, model names, installer, and write commands. Read the assigned inputs from `projects/<slug>/`. Run only trusted checks that do not write files or contact the game server. If a check needs proposed files on disk, ask the coordinator to run it after promotion. Do not write to the live project or the state directory.

Return exactly one JSON object for a file proposal. Each operation uses exactly one of `text` (entire UTF-8 file), `base64` (entire binary file), or `delete: true` (remove a file). For example:

```json
{
  "files": [
    { "path": "sets/town_street/SPEC.md", "text": "Complete file contents\n" },
    { "path": "sets/town_street/town_street.schem", "base64": "AA==" },
    { "path": "sets/town_street/old.mjs", "delete": true }
  ]
}
```

Use paths relative to `projects/<slug>/`. Separate components with `/`. Use only ASCII letters, digits, dots, underscores, and hyphens in a component. Do not use absolute paths, `.` or `..` components, or links. Use `{"files":[]}` for an assigned job with no file changes. Put cross-owner requests only in your assigned `REQUESTS/` paths. A set builder uses exactly `REQUESTS/set-builder__<set>.md`. Report the file, reason, and proposed change. Concept brainstorming and continuity review return findings in chat, without a file proposal.

If an artifact does not fit in a role response, run a separate network-disabled Codex CLI job in a disposable workspace. Give it only the inputs and instructions it needs. Do not mount the live checkout or state directory or use `--add-dir`. The coordinator checks each artifact, converts approved files into the same proposal format, and uses the same `apply` command. Do not copy artifacts straight into `projects/<slug>/` or execute worker-generated scripts in the coordinator session.

### Gates 1 to 5

Follow the [canonical workflow](../skills/minecraft-story/SKILL.md) for the story criteria and approval order. Stop at every gate. Show the output and wait for the user to approve or request changes.

1. Collect the reference scripts and setup details as coordinator. Promote `formula-analyst` output and present it at Gate 1.
2. Ask `script-writer` for concepts without a file proposal. At Gate 2a, wait for the user to pick a concept. Start the `script-writer` phase with the selected concept. Promote `SCRIPT.md`, run `node skills/minecraft-story/scripts/word_count.mjs projects/<slug>/SCRIPT.md`, and show the script and titles.
3. Run the `originality-checker` phase. Check phrase overlap with `node skills/minecraft-story/scripts/overlap_check.mjs projects/<slug>/SCRIPT.md projects/<slug>/refs/`. If originality fails, rerun `script-writer` for the flagged beats and repeat the review within the canonical limit. Ask for script approval at Gate 3.
4. As coordinator, collect and validate skins and produce `CAST.md`. Ask for approval at Gate 4.
5. Run the `storyboard-director` phase and promote its shot list, layout, and base layers. Run the partial compile:

   ```bash
   node skills/minecraft-story/scripts/compile_shots.mjs "projects/$slug" --partial --dry
   ```

   Fix `LAYOUT` failures through the assigned owner. Show the shot table, sets and anchors, and the three hardest shots. Wait for the user to approve Gate 5. Starting the first `wave` seals the current `SCRIPT.md`, `CAST.md`, `SHOTLIST.md`, `LAYOUT.json`, `shots/*/base.json`, and `assets/skins/`. Do not start the wave until the user approves these inputs.

### Run the production wave

1. After Gate 5 approval, take the legacy snapshot and start the wave with a new state directory:

   ```bash
   state="$state_root/wave"
   node skills/minecraft-story/scripts/check_ownership.mjs "projects/$slug" --snapshot
   node .codex/ownership/promote.mjs start "$slug" wave "$state"
   ```

2. Ask the dedicated read-only session to spawn all assigned roles together: one `set-builder` for each `set-builder__<set>` job, one `visual-director`, and one `camera-director`. Give each set builder only its own assigned set and paths. No one, including the coordinator, sends commands to the game server during the wave.
3. Collect all results with their handle-to-job mapping. Stage each proposal in the state directory. Apply, audit, and compile in this order. Stop if either of the first two commands fails.

   ```bash
   node .codex/ownership/promote.mjs apply "$slug" "$state" &&
   node skills/minecraft-story/scripts/check_ownership.mjs "projects/$slug" --verify &&
   node skills/minecraft-story/scripts/compile_shots.mjs "projects/$slug"
   ```

4. Summarize `REQUESTS/` in `REQUESTS.md`. Ask the user which requests to approve. Route approved changes and compile failures to the owners of the affected files, not the roles that reported them.
5. After a successful compile, ask `continuity-checker` to read the compiled shots in the read-only session. It returns its table and owner-specific findings without editing any file. As coordinator, record the findings in `CONTINUITY.md`. Route fixes to their owners. Show compile results, continuity findings, set specs, and open requests for Gate 6 approval.

### Retry an owner or reopen Gate 5

For a wave retry, take a new legacy snapshot and ask `start` for just the failing job. For example, the role for `set-builder__town_street` remains `set-builder`:

```bash
state="$state_root/retry-town-street"
node skills/minecraft-story/scripts/check_ownership.mjs "projects/$slug" --snapshot
node .codex/ownership/promote.mjs start "$slug" wave "$state" set-builder__town_street
```

Spawn only the assigned owner. Stage and apply the retry, then repeat the audit and compile. Repeat continuity review when the compiled result changes. Follow the retry limits in the canonical workflow.

If a change needs a sealed input, do not retry it in the wave. Ask the user to authorize reopening Gate 5. If the user approves, run `node .codex/ownership/promote.mjs reopen "$slug"` as coordinator. Return to the earliest affected gate and run the required owner phase or coordinator work. Repeat the partial compile and Gate 5 approval before another wave. Use a fresh snapshot and state directory. Do not reuse results from the old assignments.

### After Gate 6

The coordinator handles voice approval, timing, recompile, recording, and assembly as in the canonical workflow. Run `assemble.mjs --check` as coordinator because it writes `.wave/assemble.json`. If a canonical tool is unavailable, report the blocked step.

After assembly, start a `packager-qa` phase with a fresh state directory. The worker proposes publishing notes, subtitles, and a QA report. The coordinator runs `$captions` with `projects/<slug>/audio/words.json` and the assembled film. Render the first 10 seconds with `--preview <film> --dur 10`. After approval, use `--film <film>` without `--dur` for the exact 1080×1920, 30 fps, 4,050-frame caption clip. Keep the SRT as a separate output.

Use the [operator handoffs](../skills/minecraft-story/PIPELINE.md#4b-serah-terima-ke-operator-p1p4) for ReplayMod, Blender, or Mine-imator. For WorldEdit builds, follow the [schematic staging and manual checks](../skills/minecraft-story/PIPELINE.md#4c-staging-schematic-dan-cek-fisik) before the take.
