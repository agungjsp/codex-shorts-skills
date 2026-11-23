#!/usr/bin/env node
// Regresi pipeline: node ~/.claude/skills/minecraft-story/tests/run_tests.mjs
// Menyalin tests/demo/projects/demo ke folder temp, lalu merusaknya satu per satu dan mengecek tiap cek menangkapnya.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(SKILL, "tests", "demo", "projects", "demo");
const node = (args, input) => spawnSync(process.execPath, args, { encoding: "utf8", input });
let pass = 0, failN = 0;
const ok = (name, cond, out = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failN++; console.log(`  ✗ ${name}\n${out.split("\n").map((l) => "      " + l).join("\n")}`); }
};

function fresh() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcs-test-"));
  const p = path.join(root, "projects", "demo");
  fs.cpSync(DEMO, p, { recursive: true });
  for (const f of fs.readdirSync(path.join(p, "shots"))) if (f.endsWith(".json")) fs.rmSync(path.join(p, "shots", f));
  fs.rmSync(path.join(p, ".wave"), { recursive: true, force: true });
  return p;
}
const J = (p, rel) => JSON.parse(fs.readFileSync(path.join(p, rel), "utf8"));
const W = (p, rel, obj) => fs.writeFileSync(path.join(p, rel), typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
const compile = (p, ...a) => { const r = node([path.join(SKILL, "scripts/compile_shots.mjs"), p, ...a]); return { code: r.status, out: r.stdout + r.stderr }; };
const own = (p, ...a) => { const r = node([path.join(SKILL, "scripts/check_ownership.mjs"), p, ...a]); return { code: r.status, out: r.stdout + r.stderr }; };

console.log("compile_shots");
{
  const p = fresh(); const r = compile(p);
  ok("fixture bersih lolos", r.code === 0 && /total 4050\/4050/.test(r.out), r.out);
  const s = J(p, "shots/s02.json");
  ok("start_word 'door' memotong s02 di detik 3.0 (frame 90)", s.start_frame === 90 && s.frames === 96, JSON.stringify(s).slice(0, 200));
  ok("key kamera t → frame", s.camera.keys[1].f === 96);
  ok("output ditandai compiled + timing vo", s.compiled === true && s.timing === "vo");
}
const mut = (name, fn, re, extra = []) => {
  const p = fresh(); fn(p); const r = compile(p, ...extra);
  ok(name, r.code === 1 && re.test(r.out), r.out);
};
mut("aktor berdiri di bunga → menembus blok", (p) => { const v = J(p, "shots/s01/visual.json"); v.actors[0].off = [-7.5, 0, 0.5]; W(p, "shots/s01/visual.json", v); }, /actor ruby: blok cornflower di kaki/);
mut("aktor melayang", (p) => { const v = J(p, "shots/s01/visual.json"); v.actors[0].off = [0.5, 2, 0.5]; W(p, "shots/s01/visual.json", v); }, /tidak ada lantai/);
mut("kamera di dalam pintu", (p) => { const c = J(p, "shots/s01/camera.json"); c.keys[0].pos = { anchor: "ruby_door", off: [0.5, 0, 0.5] }; W(p, "shots/s01/camera.json", c); }, /kamera key 0 di dalam blok oak_door/);
mut("kamera di luar bbox", (p) => { const c = J(p, "shots/s02/camera.json"); c.keys[0].pos.off = [0, 0, -14]; W(p, "shots/s02/camera.json", c); }, /kamera key 0 .* di luar bbox/);
mut("key di lapisan yang salah", (p) => { const v = J(p, "shots/s01/visual.json"); v.camera = {}; W(p, "shots/s01/visual.json", v); }, /visual\.json: key "camera" bukan milik lapisan ini/);
mut("jarak set < 256", (p) => { const l = J(p, "LAYOUT.json"); l.sets.well.origin = [100, 64, 0]; W(p, "LAYOUT.json", l); }, /jarak set street ↔ well/);
mut("subject di luar area aman Shorts", (p) => { const c = J(p, "shots/s03/camera.json"); c.keys.forEach((k) => (k.look.off = [2.5, -0.6, 0])); W(p, "shots/s03/camera.json", c); }, /di luar area aman Shorts/);
mut("start_word tidak ada di beat", (p) => { const b = J(p, "shots/s02/base.json"); b.start_word = { word: "dragon", nth: 1 }; W(p, "shots/s02/base.json", b); }, /start_word "dragon"/);
mut("lapisan hilang", (p) => fs.rmSync(path.join(p, "shots/s02/camera.json")), /camera\.json \(camera-director\)/);
mut("anchor tidak dikenal", (p) => { const v = J(p, "shots/s03/visual.json"); v.actors[0].anchor = "ruby_mark"; W(p, "shots/s03/visual.json", v); }, /anchor "ruby_mark" tidak ada di set well/);
mut("delta di luar bbox", (p) => { const w = J(p, "shots/s01/world.json"); w.delta = ["setblock 600 65 5 minecraft:stone"]; W(p, "shots/s01/world.json", w); }, /command di luar bbox set street/);
mut("koordinat relatif (~) ditolak", (p) => { const w = J(p, "shots/s01/world.json"); w.delta = ["setblock ~ ~ ~ minecraft:stone"]; W(p, "shots/s01/world.json", w); }, /koordinat harus absolut/);
{
  const p = fresh(); fs.rmSync(path.join(p, "audio/TIMING.md")); const r = compile(p);
  ok("tanpa TIMING.md → estimasi est_frames", /ESTIMASI/.test(r.out) && J(p, "shots/s01.json").timing === "estimate", r.out);
}

console.log("check_ownership");
{
  const p = fresh(); own(p, "--snapshot");
  const c = J(p, "shots/s01/camera.json"); c.move = "static"; W(p, "shots/s01/camera.json", c);
  fs.mkdirSync(path.join(p, "sets/street/build"), { recursive: true }); W(p, "sets/street/SPEC.md", "# street");
  fs.mkdirSync(path.join(p, "REQUESTS")); W(p, "REQUESTS/set-builder__street.md", "anchor cam_front 1 blok ke kiri");
  const r = own(p, "--verify");
  ok("perubahan di wilayah sendiri → PASS", r.code === 0, r.out);
}
{
  const p = fresh(); own(p, "--snapshot"); const l = J(p, "LAYOUT.json"); l.spacing = 300; W(p, "LAYOUT.json", l);
  const r = own(p, "--verify"); ok("LAYOUT.json diubah → FAIL baca saja", r.code === 1 && /BACA SAJA/.test(r.out), r.out);
}
{
  const p = fresh(); own(p, "--snapshot"); const w = J(p, "shots/s01/world.json"); w.set = "well"; W(p, "shots/s01/world.json", w);
  const r = own(p, "--verify"); ok("world.json set salah → FAIL", r.code === 1 && /set-builder salah shot/.test(r.out), r.out);
}
{
  const p = fresh(); own(p, "--snapshot"); W(p, "NOTES.md", "x");
  const r = own(p, "--verify"); ok("file tanpa pemilik → FAIL", r.code === 1 && /NOTES\.md: bukan milik/.test(r.out), r.out);
}
{
  const p = fresh(); own(p, "--snapshot"); fs.mkdirSync(path.join(p, "sets/castle")); W(p, "sets/castle/SPEC.md", "x");
  const r = own(p, "--verify"); ok("folder set di luar LAYOUT → FAIL", r.code === 1 && /folder set "castle"/.test(r.out), r.out);
}

console.log("guard_paths (hook)");
const guard = (agent, input, bash) => node([path.join(SKILL, "scripts/guard_paths.mjs"), agent, ...(bash ? ["--bash"] : [])], JSON.stringify(input)).status;
const fp = (rel) => ({ tool_name: "Write", tool_input: { file_path: `D:\\work\\projects\\demo\\${rel.replace(/\//g, "\\")}` } });
ok("camera-director → camera.json boleh", guard("camera-director", fp("shots/s01/camera.json")) === 0);
ok("camera-director → visual.json ditolak", guard("camera-director", fp("shots/s01/visual.json")) === 2);
ok("visual-director → LOOK.md boleh", guard("visual-director", fp("LOOK.md")) === 0);
ok("set-builder → LAYOUT.json ditolak", guard("set-builder", fp("LAYOUT.json")) === 2);
ok("set-builder → sets/street/build/x.mcfunction boleh", guard("set-builder", fp("sets/street/build/x.mcfunction")) === 0);
ok("set-builder → REQUESTS/set-builder__street.md boleh", guard("set-builder", fp("REQUESTS/set-builder__street.md")) === 0);
ok("storyboard-director → shots/s01.json (hasil compile) ditolak", guard("storyboard-director", fp("shots/s01.json")) === 2);
ok("tulis di luar projects/ ditolak", guard("visual-director", { tool_name: "Write", tool_input: { file_path: "C:\\tmp\\x.md" } }) === 2);
ok("set-builder Bash rcon ditolak", guard("set-builder", { tool_name: "Bash", tool_input: { command: "node C:/x/scripts/mc/rcon.mjs --file a" } }, true) === 2);
ok("set-builder Bash shot --run ditolak", guard("set-builder", { tool_name: "Bash", tool_input: { command: "node shot.mjs projects/demo/shots/s01.json --run --only prep" } }, true) === 2);
ok("set-builder Bash generator boleh", guard("set-builder", { tool_name: "Bash", tool_input: { command: "node sets/street/street.mjs > sets/street/build/street.mcfunction" } }, true) === 0);

console.log("shot.mjs");
{
  const p = fresh(); compile(p);
  const r = node([path.join(SKILL, "scripts/mc/shot.mjs"), path.join(p, "shots/s03.json"), "--dry", "--no-log"]);
  const lines = r.stdout.split("\n").filter((l) => l.startsWith("["));
  const iU = lines.findIndex((l) => l === "[take] tick unfreeze"), iS = lines.findIndex((l) => l.startsWith("[take] script in crowd run wander("));
  ok("take: unfreeze sebelum scarpet", iU >= 0 && iS > iU, r.stdout);
  ok("script load ada di prep (section load)", lines.some((l) => l === "[load] script load crowd"));
  ok("string scarpet pakai kutip tunggal", lines.some((l) => l.includes("wander('minecraft:villager', 3, [520, 65, 8], 5, 2)")), r.stdout);
  ok("aktor dapat CustomName + Rotation", lines.some((l) => /summon minecraft:villager .*CustomName:'"kid1"',Rotation:\[-101\.31f,0f\]/.test(l)), r.stdout);
  const raw = node([path.join(SKILL, "scripts/mc/shot.mjs"), path.join(p, "shots/s03/base.json"), "--dry", "--no-log"]);
  ok("file bukan hasil compile ditolak", raw.status === 1 && /bukan hasil compile/.test(raw.stderr), raw.stderr);
}

console.log(`\n${pass} lolos, ${failN} gagal`);
process.exit(failN ? 1 : 0);
