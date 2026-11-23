# scripts/mc — helper pipeline

Tanpa dependency Node (≥ 18). Panggil dengan path absolut, jalankan dari root project (`.rcon.json` dibaca dari cwd).
`SKILL` = `~/.claude/skills/minecraft-story`.

| File | Fungsi |
|---|---|
| `rcon.mjs` | Client RCON + CLI. `node SKILL/scripts/mc/rcon.mjs "time set day"`, `--file <x>.mcfunction`, `--check` |
| `shot.mjs` | Eksekusi satu `shots/<shot>.json` **hasil compile**. Default dry-run, `--run` untuk kirim |
| `scarpet/crowd.sc` | Kerumunan mob: `wander` (AI asli, ada radius dalam), `march` (barisan), `stop`, `clear` |
| `scarpet/wall.sc` | Tembok lingkaran bertahap + bibir tembok |
| `scarpet/env.sc` | Api, obor, air, drain |
| `scarpet/actor.sc` | Satu entity jalan lewat waypoint (cari entity lewat nama = id aktor) |

## Setup sekali per project

1. Copy app yang dipakai ke server: `<server>/config/carpet/scripts/`.
2. Isi `.rcon.json` di root project:
   ```json
   { "host": "127.0.0.1", "port": 25575, "password": "ganti-ini" }
   ```
3. Tes: `node SKILL/scripts/mc/rcon.mjs --check` → harus balas daftar player.

## Urutan satu shot

```powershell
node ~/.claude/skills/minecraft-story/scripts/compile_shots.mjs projects/<slug>
node ~/.claude/skills/minecraft-story/scripts/mc/shot.mjs projects/<slug>/shots/s12.json --dry
node ~/.claude/skills/minecraft-story/scripts/mc/shot.mjs projects/<slug>/shots/s12.json --run --only prep
# (inspeksi framing manual — dunia beku)
# mulai rekam ReplayMod, lalu:
node ~/.claude/skills/minecraft-story/scripts/mc/shot.mjs projects/<slug>/shots/s12.json --run --only take
```

`prep` = `pre,build,actors,load`. `take` = `tick unfreeze` lalu semua panggilan scarpet. Tanpa unfreeze, mob dan `__on_tick` diam.

## Satu-satunya cara memanggil scarpet

```
/script load crowd
/script in crowd run wander('minecraft:villager',5,[0,65,0],6,2)
/script in crowd run clear()
```
Isi SEMUA argumen fungsi (scarpet menolak jumlah argumen yang kurang). Kalau ada error, cek log server — scarpet menulis nama file + baris.
Jangan pakai `script run call('app','fn')` (call() tidak bisa memanggil app lain) atau `script run 'app.fn()'` (hanya string, tidak menjalankan apa pun).

## Catatan

- `march` memakai pos+motion, bukan pathfinding. Close-up bisa terlihat sliding → pakai `wander` atau BBS.
- `wall` menaruh 8 blok/tick. Naikkan `global_bpt` untuk build instan, turunkan untuk timelapse lebih lambat.
- Di `shots/<shot>.json` hasil compile semua posisi sudah koordinat world nyata (compile mengubah anchor + offset).
