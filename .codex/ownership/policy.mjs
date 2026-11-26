import { lstatSync } from 'node:fs';
import path from 'node:path';
import { globRe, OWNERSHIP, ownGlobs } from '../../skills/minecraft-story/scripts/lib/ownership.mjs';

export const sealFile = '.wave/codex-gate5.json';
export const lockFile = '.wave/codex-promotion.lock';
export const phases = new Set(['formula-analyst', 'script-writer', 'originality-checker', 'storyboard-director', 'wave', 'packager-qa']);
export const validId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(value);

const component = /^[A-Za-z0-9._-]+$/;
const device = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
export function projectPath(value) {
  if (typeof value !== 'string' || !value.split('/').every((part) =>
    component.test(part) && !part.endsWith('.') && !device.test(part))) {
    throw new Error(`expected a portable project-relative file path: ${JSON.stringify(value)}`);
  }
  return value;
}

export function stat(file) {
  try { return lstatSync(file); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function under(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
}

const match = (file, globs, exact = false) => globs.some((glob) => {
  const re = globRe(glob);
  return (exact ? new RegExp(re.source) : re).test(file);
});

export const frozen = (file) => match(file, OWNERSHIP.readonly_after_gate5);

export function mayPromote(job, file, sealed) {
  if ((sealed && frozen(file)) || !match(file, ownGlobs(job.role), true)) return false;
  if (job.role === 'set-builder') {
    return file.startsWith(`sets/${job.set}/`) || file === `REQUESTS/${job.id}.md` ||
      job.shots.some((shot) => file === `shots/${shot}/world.json`);
  }
  if (job.role === 'visual-director' || job.role === 'camera-director') {
    const shot = /^shots\/([^/]+)\//.exec(file);
    if (shot && !job.shots.includes(shot[1])) return false;
  }
  return true;
}

const authored = Object.keys(OWNERSHIP.agents).flatMap(ownGlobs);
const related = (file, glob) => {
  const parts = glob.split('/');
  const full = globRe(glob);
  return parts.some((_, i) => globRe(parts.slice(0, i + 1).join('/')).test(file)) ||
    file.split('/').some((_, i, names) => full.test(names.slice(0, i + 1).join('/')));
};

export function protectedPath(file, sealed) {
  return [...authored, sealFile, lockFile, ...(sealed ? OWNERSHIP.readonly_after_gate5 : [])]
    .some((glob) => related(file, glob));
}
