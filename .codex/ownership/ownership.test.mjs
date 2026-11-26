import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const promote = fileURLToPath(new URL("./promote.mjs", import.meta.url));
const guard = fileURLToPath(new URL("./guard.mjs", import.meta.url));
const demo = fileURLToPath(new URL("../../skills/minecraft-story/tests/demo/projects/demo/", import.meta.url));
const streetBuild = "sets/street/build/street.mcfunction";
const wellBuild = "sets/well/build/well.mcfunction";
const streetWorld = "shots/s01/world.json";
const wellWorld = "shots/s03/world.json";
const camera = "shots/s01/camera.json";
const visual = "shots/s01/visual.json";
const compiled = "shots/s01.json";
const cast = "CAST.md";
const streetBuilder = "set-builder__street";
const cameraDirector = "camera-director";

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "codex-ownership-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "checkout");
  const project = join(cwd, "projects", "demo");
  mkdirSync(dirname(project), { recursive: true });
  cpSync(demo, project, { recursive: true });
  writeFileSync(join(project, cast), "# Cast\n");
  writeFileSync(join(project, compiled), '{"compiled":true}\n');
  return { cwd, project, root, state: join(root, "state") };
}

function node(script, cwd, args = [], input) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd, input, encoding: "utf8", timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function succeeds({ status, stdout, stderr }) {
  assert.equal(status, 0, stdout + stderr);
}

function refuses({ status, stdout, stderr }, message) {
  assert.notEqual(status, 0, `${message}\n${stdout}${stderr}`);
}

function start({ cwd, state }, phase, job) {
  return node(promote, cwd, ["start", "demo", phase, state, ...(job ? [job] : [])]);
}

function apply({ cwd, state }, slug = "demo") {
  return node(promote, cwd, ["apply", slug, state]);
}

function submit({ state }, job, files) {
  writeFileSync(join(state, `${job}.json`), JSON.stringify({ files }));
}

function read(project, path) {
  return readFileSync(join(project, path), "utf8");
}

function replacement(project, path) {
  return { path, text: `${read(project, path).trimEnd()}\n\n` };
}

function patch(...operations) {
  return ["*** Begin Patch", ...operations, "*** End Patch", ""].join("\n");
}

function add(path) {
  return `*** Add File: ${path}\n+fixture`;
}

function hook({ cwd }, command, patchCwd = cwd) {
  return node(guard, cwd, [], JSON.stringify({
    tool_name: "apply_patch", cwd: patchCwd, tool_input: { command },
  }));
}

function patchDenied({ status, stdout, stderr }) {
  assert.equal(status, 2, stdout + stderr);
}

test("wave promotes a builder's set and shot layers alongside the camera director's layer", (t) => {
  const f = fixture(t);
  const world = replacement(f.project, streetWorld);
  const shotCamera = replacement(f.project, camera);
  const sign = "# Street sign\n";
  const signPath = "sets/street/build/sign.mcfunction";
  succeeds(start(f, "wave"));
  submit(f, streetBuilder, [world, { path: signPath, base64: Buffer.from(sign).toString("base64") }]);
  submit(f, "set-builder__well", []);
  submit(f, "visual-director", []);
  submit(f, cameraDirector, [shotCamera]);
  succeeds(apply(f));
  assert.equal(read(f.project, streetWorld), world.text);
  assert.equal(read(f.project, camera), shotCamera.text);
  assert.equal(read(f.project, signPath), sign);
});

test("a cross-role submission leaves the entire wave unapplied", (t) => {
  const f = fixture(t);
  const before = new Map([streetBuild, camera, visual].map((path) => [path, read(f.project, path)]));
  succeeds(start(f, "wave"));
  submit(f, streetBuilder, [replacement(f.project, streetBuild)]);
  submit(f, "set-builder__well", []);
  submit(f, "visual-director", []);
  submit(f, cameraDirector, [replacement(f.project, camera), replacement(f.project, visual)]);
  refuses(apply(f), "a camera director must not write the visual layer");
  for (const [path, contents] of before) assert.equal(read(f.project, path), contents, path);
});

for (const [name, path] of [
  ["another set's build", wellBuild],
  ["another set's shot", wellWorld],
  ["a compiled shot", compiled],
]) {
  test(`a set builder cannot change ${name}`, (t) => {
    const f = fixture(t);
    const buildBefore = read(f.project, streetBuild);
    const targetBefore = read(f.project, path);
    succeeds(start(f, "wave", streetBuilder));
    submit(f, streetBuilder, [replacement(f.project, streetBuild), replacement(f.project, path)]);
    refuses(apply(f), `the street builder must not write ${path}`);
    assert.equal(read(f.project, streetBuild), buildBefore);
    assert.equal(read(f.project, path), targetBefore);
  });
}

test("a valid submission for one slug cannot be applied to another slug", (t) => {
  const f = fixture(t);
  const other = join(f.cwd, "projects", "other");
  cpSync(f.project, other, { recursive: true });
  const before = read(f.project, camera);
  succeeds(start(f, "wave", cameraDirector));
  succeeds(node(promote, f.cwd, ["start", "other", "wave", join(f.root, "other-state"), cameraDirector]));
  const change = replacement(f.project, camera);
  submit(f, cameraDirector, [change]);
  refuses(apply(f, "other"), "the state must be bound to demo");
  assert.equal(read(other, camera), before);
  assert.equal(read(f.project, camera), before);
  succeeds(apply(f));
  assert.equal(read(f.project, camera), change.text);
});

test("a project-relative path cannot escape into another project", (t) => {
  const f = fixture(t);
  const other = join(f.cwd, "projects", "other");
  cpSync(f.project, other, { recursive: true });
  const before = read(f.project, streetBuild);
  succeeds(start(f, "wave", streetBuilder));
  submit(f, streetBuilder, [
    replacement(f.project, streetBuild),
    { path: `../other/${streetBuild}`, text: "escaped\n" },
  ]);
  refuses(apply(f), "a submission must stay in its assigned project");
  assert.equal(read(other, streetBuild), before);
  assert.equal(read(f.project, streetBuild), before);
});

test("a stale baseline cannot overwrite a newer edit or apply sibling changes", (t) => {
  const f = fixture(t);
  const sibling = "shots/s02/camera.json";
  const siblingBefore = read(f.project, sibling);
  succeeds(start(f, "wave", cameraDirector));
  submit(f, cameraDirector, [replacement(f.project, sibling), replacement(f.project, camera)]);
  const userEdit = "{}\n";
  writeFileSync(join(f.project, camera), userEdit);
  refuses(apply(f), "promotion must refuse a stale baseline");
  assert.equal(read(f.project, camera), userEdit);
  assert.equal(read(f.project, sibling), siblingBefore);
});

test("a symlink blocks promotion at start and when introduced after start", (t) => {
  const f = fixture(t);
  const before = read(f.project, streetBuild);
  const target = join(f.root, "outside.mcfunction");
  const link = "sets/street/build/link.mcfunction";
  writeFileSync(target, "outside\n");
  symlinkSync(target, join(f.project, link));
  const linked = { ...f, state: join(f.root, "linked-state") };
  refuses(start(linked, "wave", streetBuilder), "start must reject a preexisting symlink");
  rmSync(join(f.project, link));
  succeeds(start(f, "wave", streetBuilder));
  submit(f, streetBuilder, [replacement(f.project, streetBuild), { path: link, text: "escaped\n" }]);
  symlinkSync(target, join(f.project, link));
  refuses(apply(f), "apply must reject a newly introduced symlink");
  assert.equal(readFileSync(target, "utf8"), "outside\n");
  assert.equal(read(f.project, streetBuild), before);
  assert.ok(lstatSync(join(f.project, link)).isSymbolicLink());
});

test("a case-only collision under an owned directory is rejected", (t) => {
  const f = fixture(t);
  const before = read(f.project, streetBuild);
  const makeCaseAlias = "sets/street/build/Street.mcfunction";
  succeeds(start(f, "wave", streetBuilder));
  submit(f, streetBuilder, [{ path: makeCaseAlias, text: "wrong case\n" }]);
  refuses(apply(f), "promotion must reject a case-only alias to an existing file");
  assert.equal(read(f.project, streetBuild), before);
  assert.ok(!readdirSync(join(f.project, dirname(streetBuild))).includes("Street.mcfunction"));
});

test("the wave seals Gate 5 inputs until the coordinator explicitly reopens it", (t) => {
  const f = fixture(t);
  const patchCast = patch(`*** Update File: projects/demo/${cast}\n@@\n-# Cast\n+# Revised cast`);
  const sealedStoryboard = { ...f, state: join(f.root, "sealed-storyboard-state") };
  const reopenedStoryboard = { ...f, state: join(f.root, "reopened-storyboard-state") };
  succeeds(hook(f, patchCast));
  succeeds(start(f, "wave", streetBuilder));
  patchDenied(hook(f, patchCast));
  submit(f, streetBuilder, []);
  succeeds(apply(f));
  refuses(start(sealedStoryboard, "storyboard-director"), "a sealed storyboard must not start a new phase");
  assert.equal(read(f.project, cast), "# Cast\n");
  succeeds(node(promote, f.cwd, ["reopen", "demo"]));
  succeeds(hook(f, patchCast));
  succeeds(start(reopenedStoryboard, "storyboard-director"));
});

test("a later wave refuses changes made to a sealed Gate 5 input outside promotion", (t) => {
  const f = fixture(t);
  succeeds(start(f, "wave", streetBuilder));
  submit(f, streetBuilder, []);
  succeeds(apply(f));
  writeFileSync(join(f.project, cast), "# Changed outside promotion\n");
  const retry = { ...f, state: join(f.root, "retry-state") };
  const denied = start(retry, "wave", streetBuilder);
  refuses(denied, "a new assignment cannot silently reseal changed inputs");
  assert.match(denied.stderr, /Gate 5 inputs changed/);
});

test("native apply_patch allows valid unowned paths but protects owned and generated paths", (t) => {
  const f = fixture(t);
  succeeds(hook(f, patch(add("README.md"), add("projects/demo/notes.md"))));
  patchDenied(hook(f, patch(add(`projects/absent/${camera}`))));
  patchDenied(hook(f, patch(add("projects/demo/shots/s99.json"))));
  patchDenied(hook(f, patch(add("projects/demo/shots/s01/CAMERA.json"))));
  const shot = join(f.project, "shots", "s99");
  mkdirSync(shot);
  patchDenied(hook(f, patch(add("camera.json")), shot));
});

test("native apply_patch rejects a mixed patch or a move into a protected path", (t) => {
  const f = fixture(t);
  patchDenied(hook(f, patch(add("notes.md"), add(`projects/absent/${camera}`))));
  writeFileSync(join(f.cwd, "notes.md"), "notes\n");
  patchDenied(hook(f, patch(
    `*** Update File: notes.md\n*** Move to: projects/absent/${camera}\n@@\n-notes\n+revised notes`,
  )));
});
