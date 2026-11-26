---
name: minecraft-story
description: Plan an original 2:15 Minecraft story in the In This World or In This Town format. Use for script and originality review, storyboard, or the parallel set, visual, and camera production wave.
---

Read the [canonical story workflow](../../../skills/minecraft-story/SKILL.md), [rules](../../../skills/minecraft-story/RULES.md), and [Codex runbook](../../../docs/codex.md). Read [PIPELINE.md](../../../skills/minecraft-story/PIPELINE.md) before storyboarding. Run commands from the checkout, with `SKILL` meaning `skills/minecraft-story` and the live project at `projects/<slug>/`. Use native Codex subagents and chat approvals. Do not run Claude's installer or treat its `doctor.mjs` as proof of Codex enforcement.

### Coordinate the story

1. Run the [Codex preflight](../../../docs/codex.md#preflight) before role work. Stop if the sandbox, integrations, or active policy cannot be established.
2. Use the `formula-analyst`, `script-writer`, `originality-checker`, and `storyboard-director` phases in canonical gate order. Ask `script-writer` for concepts in chat first. Wait for the user to pick one before the script phase. The coordinator owns intake, `CAST.md`, skins, approval, and deterministic checks. Stop at each gate for the user's decision.
3. For every writing phase, run `node .codex/ownership/promote.mjs start <slug> <phase> <state-dir> [job]` in the coordinator session. Use a new state directory outside the checkout. Give each native role in the dedicated read-only session the slug, its assigned job and paths, and relevant notes. Wait for each role's JSON result: `{"files":[{"path":"relative/to/project","text":"full file content"}]}`. See the [worker contract](../../../docs/codex.md#worker-contract) for base64 and deletions. Map each result to its assigned `<state-dir>/<job>.json` by the spawn handle. Only the coordinator runs `node .codex/ownership/promote.mjs apply <slug> <state-dir>`. Never write an agent-owned file through any other route.
4. Before Gate 5, run `node skills/minecraft-story/scripts/compile_shots.mjs projects/<slug> --partial --dry`. Present the shot table, set list and anchors, and hardest three shots. Wait for explicit user approval. The first `start <slug> wave <state-dir>` seals the Gate 5 inputs.

### Run the production wave

1. After approval, take the legacy snapshot with `node skills/minecraft-story/scripts/check_ownership.mjs projects/<slug> --snapshot`. Start the `wave` phase. Spawn one `set-builder` per `set-builder__<set>` assignment with `SET: <set>` on the first line, plus `visual-director` and `camera-director`. Start the roles together in a dedicated `codex --sandbox read-only --ask-for-approval never` session with worker network access and integrations disabled. No one sends game commands during the wave.
2. Collect all results and apply the wave as above. Run `node skills/minecraft-story/scripts/check_ownership.mjs projects/<slug> --verify` before `node skills/minecraft-story/scripts/compile_shots.mjs projects/<slug>`. Stop on an ownership failure. Summarize `REQUESTS/` in `REQUESTS.md` and ask the user which changes to make.
3. Retry only the owner of a failed or approved change. For wave owners, use `start <slug> wave <fresh-state-dir> <job>` and repeat snapshot, promotion, audit, and compile. If changes touch a frozen input, get approval to `reopen <slug>` through `promote.mjs`. Return to the applicable gates in order and get new Gate 5 approval before starting another wave.
4. After compile, spawn `continuity-checker` in the read-only session. It returns findings only. The coordinator writes `CONTINUITY.md` and routes fixes back to owners. Respect the canonical retry limits. Show the compile and continuity reports, set specs, and open requests at Gate 6.

### Serah terima ke operator

Coordinator tetap menangani timing VO, take, render, assembly, dan operasi server di luar wave. Setelah Gate 7, ikuti [serah terima P1–P4](../../../skills/minecraft-story/PIPELINE.md#4b-serah-terima-ke-operator-p1p4). Untuk shot schematic, ikuti [staging dan cek fisik](../../../skills/minecraft-story/PIPELINE.md#4c-staging-schematic-dan-cek-fisik). Simpan versi alat dan paket di `projects/<slug>/MODLIST.txt` sesuai [panduan setup](../../../skills/minecraft-story/TOOLS.md#8-urutan-install-minimum).

Semua jalur menyerahkan satu `captures/<shot>/render.mp4` vertikal 1080×1920 pada 30 fps dengan timing VO terkunci. Ikuti [cek assembly](../../../skills/minecraft-story/PIPELINE.md#8-render--assembly), lalu gunakan `packager-qa` lewat promotion. Laporkan dependensi yang belum siap; jangan lewati gate.
