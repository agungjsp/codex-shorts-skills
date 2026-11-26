import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { frozen, lockFile, mayPromote, phases, projectPath, sealFile, stat, under, validId } from './policy.mjs';

const checkout = fs.realpathSync(process.cwd());
const manifestFile = 'manifest.json';
const buffer = Buffer.allocUnsafe(64 * 1024);
const digest = (text) => createHash('sha256').update(text).digest('hex');
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const read = (file) => {
  const info = stat(file);
  if (!info?.isFile() || info.nlink !== 1) throw new Error(`expected a regular unlinked file: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

// Require the spelling on disk, even on case-insensitive volumes.
function target(root, rel, directory = false) {
  let current = root;
  const parts = rel.split('/');
  for (const [i, part] of parts.entries()) {
    const dir = stat(current);
    if (dir) {
      if (!dir.isDirectory()) throw new Error(`not a real directory: ${current}`);
      for (const name of fs.readdirSync(current)) {
        if (name !== part && name.normalize('NFC').toLowerCase() === part.toLowerCase()) {
          throw new Error(`path case or spelling conflicts with ${name}: ${rel}`);
        }
      }
    }
    current = path.join(current, part);
    const info = stat(current);
    if (info && (directory || i < parts.length - 1 ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) {
      throw new Error(`unsafe file type or link: ${rel}`);
    }
  }
  return current;
}

function fingerprint(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, count));
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function snapshot(project) {
  const files = new Map();
  const entries = [];
  function walk(dir, prefix = '') {
    const seen = new Set();
    for (const name of fs.readdirSync(dir).sort(compare)) {
      const rel = prefix + name;
      const fold = name.normalize('NFC').toLowerCase();
      if (seen.has(fold)) throw new Error(`ambiguous file spelling: ${rel}`);
      seen.add(fold);
      const abs = path.join(dir, name);
      const info = fs.lstatSync(abs);
      if (info.isDirectory()) {
        entries.push([`${rel}/`, info.mode]);
        walk(abs, `${rel}/`);
      } else if (info.isFile() && info.nlink === 1) {
        if (rel === sealFile || rel === lockFile) continue;
        const key = fingerprint(abs);
        entries.push([rel, info.mode, key]);
        files.set(rel, key);
      } else {
        throw new Error(`unsafe file type or link: ${rel}`);
      }
    }
  }
  walk(project);
  return {
    files,
    baseline: digest(JSON.stringify(entries)),
    gate5: digest(JSON.stringify(entries.filter(([rel]) => frozen(rel.replace(/\/$/, ''))))),
  };
}

function jobsFor(project, files, phase, only) {
  if (!phases.has(phase)) throw new Error(`unknown phase: ${phase}`);
  let jobs = [{ id: phase, role: phase }];
  if (phase === 'wave') {
    const layout = read(target(project, 'LAYOUT.json'));
    if (!layout?.sets || typeof layout.sets !== 'object' || Array.isArray(layout.sets)) throw new Error('invalid LAYOUT.json sets');
    const sets = Object.keys(layout.sets).sort(compare);
    if (!sets.length || sets.some((set) => !validId(set))) throw new Error('LAYOUT.json must declare valid lowercase set IDs');
    const bySet = new Map(sets.map((set) => [set, []]));
    const shots = [];
    for (const file of files.keys()) {
      const shot = /^shots\/([^/]+)\/base\.json$/.exec(file)?.[1];
      if (!shot) continue;
      const set = read(target(project, file))?.set;
      if (!validId(shot) || !bySet.has(set)) throw new Error(`invalid shot ID or unknown set: ${file}`);
      bySet.get(set).push(shot);
      shots.push(shot);
    }
    if (!shots.length) throw new Error('Wave needs at least one locked shot base');
    jobs = [
      ...sets.map((set) => ({ id: `set-builder__${set}`, role: 'set-builder', set, shots: bySet.get(set) })),
      { id: 'visual-director', role: 'visual-director', shots },
      { id: 'camera-director', role: 'camera-director', shots },
    ];
  }
  if (only !== undefined) {
    jobs = jobs.filter((job) => job.id === only);
    if (!jobs.length) throw new Error(`job is not assigned to ${phase}: ${only}`);
  }
  return jobs;
}

function currentSeal(project) {
  const file = target(project, sealFile);
  if (!stat(file)) return null;
  const seal = read(file);
  if (typeof seal?.id !== 'string' || !/^[0-9a-f]{64}$/.test(seal?.gate5)) throw new Error('invalid Gate 5 seal');
  return seal;
}

function requireGate(phase, seal, shotState) {
  if (seal && seal.gate5 !== shotState.gate5) throw new Error('Gate 5 inputs changed after sealing; restore or reopen Gate 5 explicitly');
  if (seal && ['formula-analyst', 'script-writer', 'originality-checker', 'storyboard-director'].includes(phase)) {
    throw new Error('Gate 5 is sealed; reopen with user approval before revising upstream work');
  }
  if (!seal && phase === 'packager-qa') throw new Error('packager-qa needs a sealed Gate 5');
}

function externalState(input, starting) {
  const req = path.resolve(input);
  const state = starting ? path.join(fs.realpathSync(path.dirname(req)), path.basename(req)) : fs.realpathSync(req);
  if (under(checkout.toLowerCase(), state.toLowerCase()) || under(state.toLowerCase(), checkout.toLowerCase())) {
    throw new Error('state directory must be separate from the checkout');
  }
  if (starting ? !!stat(state) : !stat(req)?.isDirectory()) {
    throw new Error(starting ? 'state directory already exists; choose a fresh path' : 'state directory must not be a link');
  }
  return state;
}

function start(project, slug, phase, state, only) {
  const shotState = snapshot(project);
  let seal = currentSeal(project);
  requireGate(phase, seal, shotState);
  const jobs = jobsFor(project, shotState.files, phase, only);
  fs.mkdirSync(state, { mode: 0o700 });
  if (phase === 'wave' && !seal) {
    seal = { id: randomUUID(), gate5: shotState.gate5 };
    fs.writeFileSync(target(project, sealFile), JSON.stringify(seal), { flag: 'wx' });
  }
  const manifest = { project, slug, phase, only: only ?? null, seal: seal?.id ?? null, baseline: shotState.baseline, jobs };
  fs.writeFileSync(path.join(state, manifestFile), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ slug, phase, jobs }, null, 2));
}

function changesFor(project, state, jobs, sealed) {
  const changes = [];
  const claimed = new Set();
  const expected = new Set([manifestFile, ...jobs.map((job) => `${job.id}.json`)]);
  for (const file of fs.readdirSync(state)) {
    if (!expected.has(file)) throw new Error(`unexpected proposal in state directory: ${file}`);
  }
  for (const job of jobs) {
    const proposal = read(path.join(state, `${job.id}.json`));
    if (!Array.isArray(proposal?.files) || Object.keys(proposal).length !== 1) throw new Error(`invalid proposal for ${job.id}`);
    for (const edit of proposal.files) {
      const rel = projectPath(edit?.path);
      if (!mayPromote(job, rel, sealed)) throw new Error(`${job.id} does not own ${rel}`);
      const folded = rel.toLowerCase();
      if (claimed.has(folded)) throw new Error(`duplicate destination: ${rel}`);
      claimed.add(folded);
      const dest = target(project, rel);
      const info = stat(dest);
      const deleting = edit.delete === true;
      const text = typeof edit.text === 'string';
      const binary = typeof edit.base64 === 'string';
      if (Number(deleting) + Number(text) + Number(binary) !== 1 || Object.keys(edit).length !== 2) {
        throw new Error(`${rel}: expected exactly one of text, base64, or delete:true`);
      }
      const content = binary ? Buffer.from(edit.base64, 'base64') : edit.text;
      if (binary && content.toString('base64') !== edit.base64) throw new Error(`${rel}: invalid base64`);
      if (deleting && !info) throw new Error(`cannot delete a missing file: ${rel}`);
      if (job.role === 'set-builder' && /^shots\/[^/]+\/world\.json$/.test(rel) && !deleting &&
          JSON.parse(String(content))?.set !== job.set) throw new Error(`${rel}: world layer must name the assigned set ${job.set}`);
      changes.push({ dest, rel, deleting, content, mode: info ? info.mode & 0o777 : 0o644 });
    }
  }
  // Reject collisions in common ancestor names, including those not yet on disk.
  const canonical = new Map();
  for (const { rel } of changes) {
    const names = rel.split('/');
    for (let i = 1; i <= names.length; i++) {
      const partial = names.slice(0, i).join('/');
      const key = partial.toLowerCase();
      const prior = canonical.get(key);
      if (prior && prior !== partial) throw new Error(`ambiguous destination spelling: ${rel}`);
      canonical.set(key, partial);
      if (i < names.length && claimed.has(key)) throw new Error(`file/directory conflict: ${rel}`);
    }
  }
  return changes;
}

function apply(project, slug, state) {
  const manifest = read(path.join(state, manifestFile));
  if (manifest?.project !== project || manifest.slug !== slug) throw new Error('manifest belongs to another project');
  const shotState = snapshot(project);
  const seal = currentSeal(project);
  requireGate(manifest.phase, seal, shotState);
  if (manifest.baseline !== shotState.baseline || manifest.seal !== (seal?.id ?? null)) throw new Error('stale project baseline');
  const jobs = jobsFor(project, shotState.files, manifest.phase, manifest.only ?? undefined);
  if (JSON.stringify(jobs) !== JSON.stringify(manifest.jobs)) throw new Error('assignments do not match the manifest');
  const changes = changesFor(project, state, jobs, seal !== null);
  for (const { dest, deleting, content, mode } of changes) {
    if (deleting) fs.unlinkSync(dest);
    else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = path.join(path.dirname(dest), `.codex-${randomUUID()}.tmp`);
      const fd = fs.openSync(tmp, 'wx', mode);
      try {
        try { fs.writeFileSync(fd, content); } finally { fs.closeSync(fd); }
        fs.renameSync(tmp, dest);
      } finally {
        if (stat(tmp)) fs.unlinkSync(tmp);
      }
    }
  }
  console.log(`Promoted ${changes.length} file change(s) from ${jobs.length} job(s)`);
}

try {
  const [action, slug, ...args] = process.argv.slice(2);
  if (!validId(slug) || !(action === 'start' && [2, 3].includes(args.length) ||
      action === 'apply' && args.length === 1 || action === 'reopen' && !args.length)) {
    throw new Error('usage: promote.mjs start <slug> <phase> <state-dir> [job] | apply <slug> <state-dir> | reopen <slug>');
  }
  const project = target(checkout, `projects/${slug}`, true);
  if (!stat(project)?.isDirectory()) throw new Error(`project does not exist: projects/${slug}`);
  const lock = target(project, lockFile);
  const state = action === 'reopen' ? null : externalState(args[action === 'start' ? 1 : 0], action === 'start');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const fd = fs.openSync(lock, 'wx');
  try {
    if (action === 'start') start(project, slug, args[0], state, args[2]);
    else if (action === 'apply') apply(project, slug, state);
    else {
      const seal = target(project, sealFile);
      if (!stat(seal)) throw new Error('Gate 5 is not sealed');
      fs.unlinkSync(seal);
      console.log(`Gate 5 reopened for ${slug}`);
    }
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
} catch (error) {
  console.error(`[shorts-ownership] ${error.message}`);
  process.exitCode = 1;
}
