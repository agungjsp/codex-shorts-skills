import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { stat } from './policy.mjs';

const checkout = fs.realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const projects = path.join(checkout, 'projects');
let fixture;
let createdProjects = false;

const codexOptions = [
  '--ask-for-approval', 'never', '--disable', 'apps', '--disable', 'plugins',
  '-c', 'features.code_mode.enabled=false', '-c', 'web_search="disabled"',
  '-c', 'shell_environment_policy.inherit="core"',
];

async function runShellProbe(note) {
  const server = spawn('codex', [...codexOptions, 'app-server', '--listen', 'stdio://'], {
    cwd: checkout,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const lines = createInterface({ input: server.stdout, crlfDelay: Infinity });
  const send = (message) => server.stdin.write(`${JSON.stringify(message)}\n`);
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('timed out waiting for Codex command/exec')), 15_000);
      server.once('error', reject);
      server.stdin.on('error', reject);
      server.once('close', (code) => reject(new Error(`Codex app-server exited before the shell result (${code})`)));
      lines.on('line', (line) => {
        try {
          const reply = JSON.parse(line);
          if ('method' in reply || (reply.id !== 0 && reply.id !== 1)) return;
          if (reply.error) throw new Error(`Codex ${reply.id === 0 ? 'initialize' : 'command/exec'}: ${reply.error.message}`);
          if (!reply.result) throw new Error('Codex app-server returned no result');
          if (reply.id === 1) {
            resolve(reply.result);
            return;
          }
          send({ method: 'initialized' });
          send({
            id: 1,
            method: 'command/exec',
            params: {
              command: ['/bin/sh', '-c', 'printf "%s\\n" "sandbox write unexpectedly allowed" >> "$1"', 'ownership-preflight', note],
              cwd: checkout,
              sandboxPolicy: { type: 'readOnly' },
              timeoutMs: 5_000,
            },
          });
        } catch (error) {
          reject(error);
        }
      });
      send({
        id: 0,
        method: 'initialize',
        params: { clientInfo: { name: 'shorts-ownership-preflight', version: '1.0.0' } },
      });
    });
  } finally {
    clearTimeout(timer);
    lines.close();
    server.stdin.end();
    server.kill();
  }
}

try {
  const version = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0) throw new Error(version.error?.message ?? version.stderr.trim());
  console.log(version.stdout.trim());
  const existing = stat(projects);
  if (existing && !existing.isDirectory()) throw new Error('projects must be a real directory');
  if (!existing) {
    fs.mkdirSync(projects);
    createdProjects = true;
  }
  fixture = fs.mkdtempSync(path.join(projects, 'codex-preflight-'));
  const slug = path.basename(fixture);
  const script = `projects/${slug}/SCRIPT.md`;
  const note = `projects/${slug}/note.txt`;
  const initial = 'ownership preflight\n';
  fs.writeFileSync(path.join(checkout, script), initial);
  fs.writeFileSync(path.join(checkout, note), initial);

  // The fixture is disposable; the shell denial and hook receipt must both be observed.
  const prompt = `This is the documented ownership preflight, using a disposable fixture file only. Call the native apply_patch tool directly with this exact argument (not a shell invocation):
*** Begin Patch
*** Update File: ${script}
@@
-ownership preflight
+protected patch unexpectedly allowed
*** End Patch
Do not request permission, retry, or use any other tool. Report the result after actually attempting the patch.`;
  const run = spawnSync('codex', [...codexOptions, 'exec', '--sandbox', 'read-only', '--ephemeral', prompt], {
    cwd: checkout,
    env: { ...process.env, CODEX_SHORTS_OWNERSHIP_PROBE: slug },
    encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (run.error || run.status !== 0) throw new Error(run.error?.message ?? (run.stderr.trim() || run.stdout.trim()));
  if (fs.readFileSync(path.join(checkout, script), 'utf8') !== initial) {
    throw new Error('live apply_patch write was allowed; review project trust and /hooks; do not run production jobs');
  }
  const hookObserved = stat(path.join(fixture, '.hook-observed'))?.isFile() === true;
  if (!hookObserved) throw new Error('no live apply_patch denial observed; review and trust the project hook in /hooks');
  const { exitCode, stderr } = await runShellProbe(note);
  if (fs.readFileSync(path.join(checkout, note), 'utf8') !== initial) {
    throw new Error('live shell write was allowed; do not run production jobs');
  }
  if (!Number.isInteger(exitCode) || exitCode <= 0 || typeof stderr !== 'string' || !stderr.includes(note) ||
      !/permission denied|operation not permitted|read-only file system/i.test(stderr)) {
    throw new Error(`no read-only shell denial confirmed by command/exec (exit ${exitCode ?? 'unknown'})`);
  }
  console.log('PASS: live Codex ownership hook and read-only shell both denied writes');
} catch (error) {
  console.error(`[shorts-ownership] ${error.message}`);
  process.exitCode = 1;
} finally {
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
  if (createdProjects && !fs.readdirSync(projects).length) fs.rmdirSync(projects);
}
