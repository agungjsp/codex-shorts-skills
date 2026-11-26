import fs from 'node:fs';
import path from 'node:path';
import { protectedPath, sealFile, stat, under } from './policy.mjs';

function destinations(patch) {
  if (typeof patch !== 'string') throw new Error('missing apply_patch command');
  const lines = patch.trimEnd().split(/\r?\n/);
  if (lines.shift() !== '*** Begin Patch' || lines.pop() !== '*** End Patch') throw new Error('unrecognized apply_patch envelope');
  const files = [];
  let mode;
  let movable = false;
  for (const line of lines) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header) {
      mode = header[1];
      files.push(header[2]);
      movable = mode === 'Update';
      continue;
    }
    const move = /^\*\*\* Move to: (.+)$/.exec(line);
    if (move && movable) files.push(move[1]);
    else if (!(mode === 'Add' && line.startsWith('+') || mode === 'Update' &&
      (!line || /^[ +\-]/.test(line) || /^@@(?: |$)/.test(line) || line === '*** End of File'))) {
      throw new Error('unrecognized apply_patch operation');
    }
    movable = false;
  }
  if (!files.length) throw new Error('no paths in apply_patch command');
  return files;
}

function physical(abs) {
  const info = stat(abs);
  if (info) return fs.realpathSync(abs);
  const parent = path.dirname(abs);
  return parent === abs ? abs : path.join(physical(parent), path.basename(abs));
}

function blocked(root, abs) {
  const rel = path.relative(root, abs).split(path.sep);
  if (!under(root, abs) || rel[0].toLowerCase() !== 'projects') return false;
  if (rel.length < 3) return true;
  const [projects, slug, ...rest] = rel;
  // Look for the seal even if a patch spells a parent differently on a case-sensitive filesystem.
  const actual = path.join(root, 'projects');
  const sealedSlug = stat(actual)?.isDirectory()
    ? fs.readdirSync(actual).find((name) => name.toLowerCase() === slug.toLowerCase()) ?? slug : slug;
  const hasSeal = !!stat(path.join(root, projects, slug, sealFile)) || !!stat(path.join(actual, sealedSlug, sealFile));
  return protectedPath(rest.join('/'), hasSeal);
}

try {
  const event = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (event?.tool_name !== 'apply_patch') throw new Error('invalid apply_patch hook event');
  const root = fs.realpathSync(process.argv[2] ?? process.cwd());
  const cwd = fs.realpathSync(event.cwd);
  for (const file of destinations(event.tool_input?.command)) {
    if (file !== file.trim() || /[\u0000-\u001f\\]/.test(file) || file.split('/').includes('..')) {
      throw new Error(`ambiguous apply_patch path: ${JSON.stringify(file)}`);
    }
    const abs = path.resolve(cwd, file);
    if (blocked(root, abs) || blocked(root, physical(abs))) {
      const probe = process.env.CODEX_SHORTS_OWNERSHIP_PROBE;
      if (/^codex-preflight-[A-Za-z0-9]+$/.test(probe ?? '') && abs === path.join(root, 'projects', probe, 'SCRIPT.md')) {
        fs.writeFileSync(path.join(root, 'projects', probe, '.hook-observed'), 'denied\n', { flag: 'wx' });
      }
      throw new Error(`${file} is protected; promote output from its assigned owner instead`);
    }
  }
} catch (error) {
  console.error(`[shorts-ownership] ${error.message}`);
  process.exitCode = 2;
}
