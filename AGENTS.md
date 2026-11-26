# Repository instructions

Launch Codex from this checkout. The four project skills live under `.agents/skills/`. Use `$cartoon-3d-short`, `$captions`, `$minecraft-shorts`, or `$minecraft-story` to select one explicitly. Each adapter points to its source under `skills/`. Do not copy the canonical skill into a second runtime directory or run a Claude installer for Codex.

See [the Codex guide](docs/codex.md) for setup, approvals, and runtime limits. Claude Code still uses its original skills, agents, and installer. Preserve [the repository MIT license](LICENSE) and [the upstream cartoon skill MIT license](skills/cartoon-3d-short/LICENSE).

## Minecraft Story

Use the [Minecraft Story adapter](.agents/skills/minecraft-story/SKILL.md) and the [ownership runbook](docs/codex.md#minecraft-story-ownership). Stop if preflight fails. Spawn story roles only in a dedicated read-only Codex session without worker network access or integrations. Do not spawn production roles from a session that can write the live checkout. Only the coordinator can promote their assigned JSON proposals into `projects/<slug>/` using `.codex/ownership/promote.mjs`.

Do not edit agent-owned files or compiled shots directly. Do not use the shell, another tool, or a different checkout as a shortcut around promotion. Stop at each user gate. After Gate 5 approval, do not change the frozen inputs unless the user approves reopening the gate. Do not send game commands during the production wave.

The documented preflight may deliberately attempt denied writes against its disposable `projects/codex-preflight-*` files. It never modifies an active story.
