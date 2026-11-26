# TOOLS — Stack produksi (code-first)

## 0. VERSI TERKUNCI
Baseline untuk shot in-game P1/P2: Minecraft Java **1.20.1** + **Fabric** + **Fabric API**, dengan Java 17. Siapkan RAM 8 GB. Baseline ini bukan daftar versi yang sudah diuji bersama. Jangan ganti versi Minecraft di tengah produksi.

Aturan:
- Untuk setiap mod yang dipakai, pilih rilis **Fabric untuk Minecraft 1.20.1** dari sumber resmi pembuatnya (misalnya Modrinth atau CurseForge). Periksa dependensi dan konflik sebelum memasang.
- **Dua instance**, jangan digabung:
  - `MC-Story Server` — dedicated server lokal (automation, RCON, WorldEdit, Carpet)
  - `MC-Story Client` — client yang connect ke `localhost`, isinya semua mod visual + BBS + ReplayMod + Iris
- Kunci versi dan sumber paket di `projects/<slug>/MODLIST.txt` sesuai §8. Jangan update di tengah project.
- Schematic & build dibuat dari world 1.20.1 yang sama.
- World server: **superflat** (`level-type=minecraft\:flat`, `generate-structures=false`). Terrain asli di dalam bbox set mengacaukan cek blok compile dan memperlambat build.

### Kenapa harus dedicated server lokal
RCON digunakan oleh server dedicated, bukan singleplayer. P1 dan shot in-game P2 memakai server lokal untuk command dan client terpisah untuk rekam dan render. Shot di luar game mengikuti [serah terima P1–P4](PIPELINE.md#4b-serah-terima-ke-operator-p1p4); alat render tidak menjalankan command Minecraft.

---

## 1. Control plane — cara kode menyuruh game
| Tool | Fungsi | Catatan |
|---|---|---|
| **RCON** (vanilla) | Kirim command dari Node/Python | `server.properties`: `enable-rcon=true`, `rcon.port=25575`, `rcon.password=...` |
| **Carpet** | `/tick freeze`, `/tick step`, `/player <nama> spawn` | Wajib. Di 1.20.1 `/tick` belum ada di vanilla. `/tick freeze` polos = **toggle**; `tick unfreeze` adalah command vanilla 1.20.3+. Pakai bentuk eksplisit yang ada di servermu dan tulis ke `.rcon.json` (`tick_freeze`, `tick_unfreeze`) |
| **Scarpet** (di dalam Carpet) | Scripting in-game: spawn/modify entity, set block, event `__on_tick` | File `.sc` di `config/carpet/scripts/`; `/script load <app>` lalu `/script in <app> run <fn>(<args>)` (satu-satunya bentuk panggilan) |
| **Mineflayer** (Node) | Bot player: pathfinding, dig, place, chat | Untuk "pemain" massal / aktor bot |
| **Minecraft MCP server** | Bungkus Mineflayer jadi tool MCP → agent bisa `place_block`, `dig_block`, `move_to` | Opsional; bagus untuk improvisasi, bukan untuk shot final |
| **Custom Fabric mod** | Kalau butuh render hook / HTTP endpoint sendiri | Last resort |

Helper di skill ini (path absolut `~/.claude/skills/minecraft-story/scripts/mc/`):
- `rcon.mjs` = client RCON tanpa dependency.
- `shot.mjs` = eksekusi satu shot hasil `compile_shots.mjs`, section `prep` lalu `take`.

---

## 2. World building
| Tool | Fungsi | Catatan |
|---|---|---|
| **WorldEdit** (Fabric, server-side) | `//schem load`, `//paste`, `//set`, `//replace`, mask | Staging file ke folder WorldEdit server, lalu paste dengan konteks player online; lihat [staging dan cek fisik](PIPELINE.md#4c-staging-schematic-dan-cek-fisik) |
| **Axiom** | Editor build tercepat, brush, stamp, import `.schem`, **Lua Script Brush**, Animated Rebuild | 1.20.1 tersedia; lisensi ARR/komersial untuk kerja profesional |
| **Litematica** | Hologram preview schematic sebelum paste | Client-side |
| **Python `mcschematic`** | Generate `.schem` dari kode (dipakai `set-builder`) | Opsional, butuh Python; default-nya mode `file` (`.mcfunction`) |
| **Terra / WorldPainter** | Terrain prosedural, heightmap | Untuk vista luas / aerial |

**Prinsip:** build besar jangan diklik. `set-builder` menghasilkan salah satu dari:
- `sets/<set>/build/<set>.mcfunction` — daftar `setblock`/`fill` (default; dikirim `shot.mjs` saat prep, dan dibaca compile untuk cek blok)
- `sets/<set>/<set>.schem` — untuk paste WorldEdit atau impor yang kompatibel. Compile tidak membaca isi schematic; cek ukuran, origin, dan ruang aktor/kamera secara manual.

---

## 3. Blok, prop, animasi build
| Tool | Fungsi |
|---|---|
| `/setblock`, `/fill`, Scarpet `set(pos, block)` | Break/place programatik, frame-perfect |
| **Display entities + Armor Statues** | Prop, item display, pose armor stand, transform |
| **Animated Java** (plugin Blockbench, v0.4.8 untuk 1.20.1) | Model ber-keyframe → diekspor jadi datapack function; summon + play animation via command |
| **Blockbench** | Sumber semua model: prop, mob, avatar BBS |
| **BBS model blocks** | Model statis/animasi di dalam scene BBS |

---

## 4. Karakter
| Tool | Fungsi | Catatan |
|---|---|---|
| **BBS actors/forms** | Aktor ber-skin, pose, replay, model block, sequencer morph | Tulang punggung akting |
| **Figura** | Avatar custom + **Lua API** (tick/render event, animasi Blockbench, particle) | 1.20.1 ✅ — lisensi **noncommercial**, hati-hati untuk channel monetized |
| **Carpet fake player** | "Pemain" yang digerakkan command, bisa jadi aktor | Skin perlu skin server / CustomSkinLoader |
| **Emotecraft + Player Animator** | Emote & animasi tambahan | Client-side |
| **CustomSkinLoader** | Load skin PNG lokal dari `assets/skins/` | Wajib untuk aktor |

---

## 5. Mob massal (50 villager, barisan pillager)
- **Scarpet**: `spawn()` dalam loop, atur pos/rotasi, `__on_tick` untuk gerak. Ini cara utama.
- **BBS replay**: rekam sekali gerakan kerumunan → loop berkali-kali.
- **GeckoLib**: kalau butuh mob custom beranimasi (perlu bikin mod sendiri).
- **Mineflayer**: untuk kerumunan *player*, bukan mob.

Catatan determinisme: `gamerule doMobSpawning false`, `randomTickSpeed 0`, dan `modify(e,'persistence',true)` supaya mob tidak despawn saat take panjang.

---

## 6. Kamera
| Tool | Fungsi | 1.20.1 |
|---|---|---|
| **ReplayMod camera path** | Keyframe kamera di replay, re-editable, render langsung | ✅ **pilihan utama** |
| **BBS camera** | Kamera in-game + hermite + shader curves, aktif saat merekam | ✅ |
| **ReplayStudio** (Java lib/CLI) | Baca/tulis `.mcpr`: cut, concat, buang paket, inject path | ✅ |
| **Blender → ReplayMod bridge** | Animasi kamera di Blender → `timelines.json` | ✅ (opsional) |
| **Flashback** | UI export terbaik (MP4/EXR/depth) | ❌ 1.21+ saja — jangan dipakai |

Kamera default: **ReplayMod** (deterministik, bisa diubah tanpa rekam ulang). BBS camera hanya kalau butuh gerak yang tidak bisa diekspresikan path ReplayMod.

---

## 7. Look & render
- **Iris + Sodium + Indium** → shader. Rekomendasi: Complementary Reimagined, Photon, BSL.
- **Distant Horizons** → LOD/vista untuk shot aerial.
- **Physics Mod (Lite/Pro)** → block fracture, ragdoll, cloth, smoke (1.20.x tersedia). ⚠️ jangan dipakai bareng `/tick freeze` — tidak deterministik.
- **Effective / Particular / Wakes** → particle, kabut, air terjun, riak air.
- **Sound Physics Remastered** → audio spasial (opsional).
- Render in-game: **ReplayMod** memakai FFmpeg. Atur lokasi executable FFmpeg jika tidak terdeteksi.
- Post: **FFmpeg** untuk gabung dan potong, lalu skill `captions` untuk klip terpisah. Gunakan Remotion hanya bila perlu overlay tambahan.

---

## 8. Urutan install minimum
Daftar ini menunjukkan komponen dan urutan setup, bukan kombinasi versi yang sudah diuji.

### macOS Apple Silicon (ARM64)

- Pilih build macOS AArch64/ARM64 untuk Java 17, Node.js 20 atau lebih baru, FFmpeg/ffprobe, dan Blender bila diperlukan. Gunakan Python 3.12 ARM64 untuk schematic. Pasang paket dari [`requirements/minecraft-schematic.txt`](../../requirements/minecraft-schematic.txt) di virtual environment. Cek arsitektur dan versi alat dengan `uname -m`, `java -version`, `node -p process.arch`, `ffmpeg -version`, dan `ffprobe -version`.
- Pilih Java 17 ARM64 di pengaturan launcher client. Untuk server, jalankan dengan executable Java 17 yang sama, misalnya `JAVA_HOME=$(/usr/libexec/java_home -v 17 -a arm64)` lalu `"$JAVA_HOME/bin/java" -version`. Cek arsitektur executable dengan `file "$JAVA_HOME/bin/java"` dan `file "$(command -v ffmpeg)"`. Arahkan ReplayMod ke executable FFmpeg ini bila PATH launcher berbeda dari terminal.
- Untuk P2/P3, pin Blender, MCprep, dan importir yang dipakai. Untuk P4, cek platform yang didukung rilis Mine-imator yang dipilih. Jika tidak ada build yang cocok untuk macOS ARM64, siapkan host yang didukung; jangan menganggap Rosetta atau VM akan bekerja.

### Server dan client

Untuk P1 dan shot in-game P2, buat profil client Fabric dan direktori server Fabric terpisah. Pada installer Fabric, pilih versi Minecraft **1.20.1** dan nomor rilis Loader yang tercatat. Fabric API adalah mod terpisah, bukan bagian dari installer. Jalankan setup dan cek Step 0.5 sebelum produksi; jangan gunakan server saat wave.

**Server** (`MC-Story Server`):
1. Fabric Loader yang mendukung Minecraft 1.20.1 + Fabric API untuk 1.20.1
2. Carpet
3. WorldEdit
4. (opsional) Chunky untuk pre-render chunk

**Client** (`MC-Story Client`):
1. Fabric API → Sodium → Iris → Indium
2. Carpet (versi sama dengan server)
3. WorldEdit (biar CUI/selection sinkron)
4. **BBS** + plugin Blockbench "BBS Model Ex/importer"
5. **ReplayMod**
6. CustomSkinLoader + Figura + Emotecraft
7. Animated Java v0.4.8 (Blockbench plugin)
8. Physics Mod, Distant Horizons, Effective, Wakes, Armor Statues

**Tooling** (di luar game):
9. Node.js 20 (versi yang dipakai CI) → `SKILL/scripts/compile_shots.mjs`, `SKILL/scripts/mc/rcon.mjs`, `shot.mjs`; `npm i mineflayer` kalau perlu bot
10. FFmpeg dan ffprobe di PATH
11. Java 17, termasuk untuk ReplayStudio jika dipakai

### Catatan versi per produksi

Orchestrator menyimpan `projects/<slug>/MODLIST.txt` sebagai daftar paket untuk mengulang setup. Jangan isi dengan `latest` atau rentang versi. Catat nilai persis dari paket yang dipilih:

| Bagian | Yang dicatat |
|---|---|
| Host dan alat | OS/arsitektur, vendor dan build Java 17, Node, FFmpeg/ffprobe; jika dipakai: Python dan dependensinya, Blender, MCprep, importir, Mine-imator |
| Server dan client | Minecraft **1.20.1**, versi Fabric Installer dan Loader untuk tiap profil, versi dan nama file setiap JAR (termasuk Fabric API, Carpet, WorldEdit, BBS, ReplayMod, Iris, Sodium, dependensi) |
| Shader dan konfigurasi | Nama paket shader, versi/nama ZIP, preset dan opsi yang diubah, resource pack, seed/dimensi world, difficulty, dan bentuk command freeze/unfreeze yang dipakai; jangan simpan password RCON |
| Sumber dan bukti | URL rilis dan SHA-256 tiap paket jika tersedia atau dihitung dari file lokal (`shasum -a 256 <file>`). Simpan snapshot konfigurasi tanpa rahasia atau catat lokasinya. Pisahkan status `belum diuji` dari hasil cek operator (tanggal, host, cakupan, hasil). |

Untuk komponen yang tidak dipakai, catat `tidak dipakai`. Simpan daftar bersama project; bila harus mengganti paket setelah lock, simpan revisi sebelumnya dan catat ulang bukti untuk kombinasi baru. Bukti lama yang tersedia hanya mencakup cek Carpet/Scarpet dan freeze di server lokal pada 24 November 2026 (Carpet `1.20-1.4.112`, 14/14 pada cakupan saat itu); lihat [catatan uji](scripts/mc/README.md#status-uji-app-scarpet). Itu bukan bukti Java, Loader, client, shader, atau alat render tertentu sudah bekerja bersama.

---

## 9. Yang tetap manual (jujur, jangan dipaksa)
- Look-dev shader & color grade.
- Timing & feel kamera di BBS / ReplayMod editor.
- Brush seni di Axiom (detail dekoratif).
- Polish animasi karakter di close-up.

Target realistis: **±75% shot bisa disiapkan lewat file/command**, sisanya tangan.

---

## 10. Konflik & jebakan
| Masalah | Solusi |
|---|---|
| BBS konflik dengan OptiFabric, Dynamic FPS, TaCZ, Effective (beberapa versi) | Baca daftar konflik di halaman Modrinth BBS sebelum install |
| Physics Mod + `/tick freeze` | Jangan digabung; matikan Physics untuk shot yang butuh freeze |
| RCON tidak connect | Cek `enable-rcon`, port 25575, firewall, server sudah fully started |
| Command "jalan" tapi tidak ada efek | RCON membalas error sebagai teks. `shot.mjs`/`rcon.mjs` menandainya `ERR`; baca barisnya |
| `fill`/`summon` gagal "not loaded" | Chunk set belum dimuat → `forceload add` (otomatis di section `pre`) |
| `//paste` dari console gagal | Cek izin, player online, dimensi, dan folder schematic server; lihat [staging dan cek fisik](PIPELINE.md#4c-staging-schematic-dan-cek-fisik) |
| `/tick freeze` bikin partikel/air diam | Benar; unfreeze saat take, freeze hanya untuk build & inspeksi |
| `/tick freeze` dua kali = dunia jalan lagi | Toggle. Pakai bentuk eksplisit lewat `.rcon.json` |
| Fake player memakai skin akun orang lain | Nama fake player = nama akun Mojang. Pakai nama yang tidak dipakai akun mana pun + skin lokal |
| ReplayMod render 1080×1920 dobel/tipis | Set resolution di render settings, jangan andalkan window size |
| Mob despawn di tengah take | `persistence=true`, `doMobSpawning false` |
