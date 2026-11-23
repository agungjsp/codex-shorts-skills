# Install (Windows)

1. Folder skill: `~/.claude/skills/minecraft-story`. Semua script dipanggil dengan path absolut `~/.claude/skills/minecraft-story/scripts/...` (disebut `SKILL/` di dokumen lain).
2. **Pasang ke-9 agent**: copy `agents\*.md` ke `~/.claude/agents/`, lalu mulai sesi Claude Code baru.
   - Agentnya: formula-analyst, script-writer, originality-checker, storyboard-director, set-builder, visual-director, camera-director, continuity-checker, packager-qa.
   - Hook kepemilikan (`scripts/guard_paths.mjs`) ada di frontmatter tiap agent, jadi hanya aktif kalau agent dipanggil sebagai subagent terpasang.
   - Setelah mengubah `agents\*.md`, salin ulang.
3. Node 18+ (semua script), `ffmpeg/ffprobe` di PATH.
4. Python + `pip install mcschematic pillow` hanya untuk mode `.schem` (opsional).
5. Minecraft: dua instance **Java 1.20.1 + Fabric** (`TOOLS.md` §0).
   - `MC-Story Server`: dedicated server lokal + Carpet + WorldEdit, `enable-rcon=true`.
   - `MC-Story Client`: Sodium + Iris + BBS + ReplayMod + skin loader, connect ke `localhost`.
6. Per project:
   - copy `scripts/mc/scarpet/*.sc` ke `<server>/config/carpet/scripts/`,
   - isi `.rcon.json` di root repo.

**Tes pipeline (tanpa server):**
```
node ~/.claude/skills/minecraft-story/tests/run_tests.mjs
```
Hasil harus `0 gagal`. Tes memakai fixture `tests/demo/projects/demo` (2 set, 3 shot).

# Prompt pembuka

```
/minecraft-story
Mulai project baru: <slug-project>.
Ide: <ide cerita / "bebas, kasih 5 konsep">.
Path produksi: P1 (code-driven in-game: Scarpet + BBS + ReplayMod).
Script referensi aku taruh di projects/<slug-project>/refs/ (atau aku paste di bawah).
Jalankan step by step sesuai SKILL.md, berhenti di setiap GATE.
Durasi wajib 2:15. Transformative, jangan mirip referensi.
```

Lanjut tiap gate cukup: `lanjut` / `revisi: ...`

# File penting

| File | Isi |
|---|---|
| `SKILL.md` | alur step + gate, Wave Produksi paralel |
| `RULES.md` | durasi, struktur, gaya script, set & LAYOUT, kepemilikan file, kamera |
| `PIPELINE.md` | arsitektur, skema lapisan + hasil compile, alur take, scarpet, framing |
| `TOOLS.md` | daftar mod/tool + pembagian server/client + konflik |
| `ownership.json` | wilayah tulis tiap agent (sumber tunggal untuk hook + audit) |
| `scripts/compile_shots.mjs` | gabung lapisan → `shots/<shot>.json`, timing VO, cek clipping/bbox/framing |
| `scripts/check_ownership.mjs` | snapshot + audit kepemilikan sesudah wave |
| `scripts/guard_paths.mjs` | hook PreToolUse: tolak tulisan di luar wilayah agent |
| `scripts/mc/` | RCON client, shot runner (prep/take), app scarpet |
| `scripts/word_count.mjs` | hitung kata & durasi VO |
| `tests/run_tests.mjs` | regresi pipeline |
