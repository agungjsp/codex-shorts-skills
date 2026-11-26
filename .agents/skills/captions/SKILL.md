---
name: captions
description: Make word-synced captions for a vertical short as a separate green-screen clip, with optional ProRes 4444 alpha. Use for subtitles, caption greenscreen, or teks ikut suara.
---

Read the [canonical captions workflow](../../../skills/captions/SKILL.md) and the [runtime setup](../../../docs/codex.md#runtime-setup).
Run the [bundled caption and alignment scripts](../../../skills/cartoon-3d-short/templates/scripts/) from the checkout with paths to the film, word timings and output folder. No Remotion project is required.

Use local shell tools for alignment, render, and media checks. If you delegate, use a Codex model or agent available in the session. Do not depend on Claude's `remotion-renderer` agent or model names. Show the test clip and wait for approval before the full caption render. Keep captions separate from the film.
