import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const FILE_LIMIT = 20 * 1024 ** 2;
const DELTA_LIMIT = 8 * 1024 ** 2;
const SHA = /^[a-f0-9]{40}$/i;
const ZERO = '0'.repeat(40);

function assertSha(value, name) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(`${name} must be a complete 40-character Git SHA.`);
}

async function git(cwd, ...args) {
  try {
    return (await exec('git', args, {
      cwd, maxBuffer: 64 * 1024 ** 2,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1' },
    })).stdout;
  } catch (error) {
    throw new Error(`Repository budget cannot read Git objects: ${error.stderr?.trim() || error.message}`, { cause: error });
  }
}

/** Count complete new blobs, with no path exceptions and no credit for deletions. null explicitly means a root tree. */
export async function assertTreeBudget({ cwd = process.cwd(), tree, parent } = {}) {
  assertSha(tree, 'tree');
  if (parent !== null) assertSha(parent, 'parent');
  if (parent !== null) await git(cwd, 'cat-file', '-e', `${parent}^{tree}`);
  const files = (await git(cwd, 'ls-tree', '-r', '-l', '-z', tree)).split('\0').filter(Boolean).flatMap(entry => {
    const tab = entry.indexOf('\t'), header = entry.slice(0, tab), filename = entry.slice(tab + 1);
    const match = header.match(/^\d+ (blob|commit) [a-f0-9]{40}\s+(\d+|-)$/);
    if (tab < 0 || !match) throw new Error('Repository budget received invalid Git tree metadata.');
    return match[1] === 'blob' ? [{ path: filename, bytes: Number(match[2]) }] : [];
  });
  const oversized = files.find(file => file.bytes > FILE_LIMIT);
  if (oversized) {
    throw new Error(`Repository budget exceeded: tracked file ${JSON.stringify(oversized.path)} is ${oversized.bytes} bytes > ${FILE_LIMIT}.`);
  }
  let changedFiles = files;
  if (parent !== null) {
    const byPath = new Map(files.map(file => [file.path, file]));
    const diff = (await git(cwd, 'diff-tree', '--raw', '--no-commit-id', '--no-abbrev', '-r', '--no-renames', '-z', parent, tree))
      .split('\0').filter(Boolean);
    changedFiles = [];
    for (let i = 0; i < diff.length; i += 2) {
      const entry = diff[i].match(/^:\d+ \d+ ([a-f0-9]{40}) ([a-f0-9]{40}) ([A-Z])$/);
      if (!entry || diff[i + 1] === undefined) throw new Error('Repository budget received invalid Git change metadata.');
      const file = byPath.get(diff[i + 1]);
      if (file && entry[1] !== entry[2]) changedFiles.push(file);
    }
  }
  const deltaBytes = changedFiles.reduce((total, file) => total + file.bytes, 0);
  if (deltaBytes > DELTA_LIMIT) {
    const contributors = [...changedFiles].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
    throw new Error(`Repository budget exceeded: commit delta ${deltaBytes} bytes > ${DELTA_LIMIT}; largest blobs: ${JSON.stringify(contributors)}.`);
  }
  return {
    tree, parent, trackedFiles: files.length, trackedBytes: files.reduce((total, file) => total + file.bytes, 0),
    largestFile: files.reduce((largest, file) => !largest || file.bytes > largest.bytes ? file : largest, null),
    deltaBytes, changedFiles,
  };
}

async function checkCommit(cwd, commit) {
  try {
    const header = (await git(cwd, 'cat-file', '-p', commit)).split('\n\n', 1)[0];
    const parents = [...header.matchAll(/^parent ([a-f0-9]{40})$/gm)].map(match => match[1]);
    // Read the actual commit headers, since rev-list hides parents at shallow boundaries.
    for (const parent of parents) await git(cwd, 'cat-file', '-e', `${parent}^{commit}`);
    return { commit, ...await assertTreeBudget({ cwd, tree: commit, parent: parents[0] ?? null }) };
  } catch (error) {
    throw new Error(`Commit ${commit}: ${error.message}`, { cause: error });
  }
}

/** Audit newly introduced commits and the checkout, including a synthetic PR merge. Never scan old ancestors by default. */
export async function auditRepositoryBudget({ cwd = process.cwd(), base, head } = {}) {
  if (base !== undefined) assertSha(base, 'base');
  if (head !== undefined) assertSha(head, 'head');
  if ((await git(cwd, 'rev-parse', '--is-shallow-repository')).trim() === 'true') {
    throw new Error('Repository budget requires complete commit history; shallow checkout detected.');
  }
  const checkout = (await git(cwd, 'rev-parse', 'HEAD')).trim();
  head ??= checkout;
  await git(cwd, 'cat-file', '-e', `${head}^{commit}`);
  if (base !== undefined && base !== ZERO) await git(cwd, 'cat-file', '-e', `${base}^{commit}`);
  await git(cwd, 'merge-base', '--is-ancestor', head, checkout);
  const incoming = base === undefined ? [head] : (await git(
    cwd, 'rev-list', '--reverse', '--topo-order', head, ...(base === ZERO ? [] : ['--not', base]),
  )).trim().split('\n').filter(Boolean);
  const commits = [];
  for (const commit of incoming) commits.push(await checkCommit(cwd, commit));
  const checkoutMetrics = commits.find(entry => entry.commit === checkout) ?? await checkCommit(cwd, checkout);
  return { base: base ?? null, head, checkout, commits, checkoutMetrics };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    for (const argument of process.argv.slice(2)) {
      const match = argument.match(/^--(base|head)=(.+)$/);
      if (!match || Object.hasOwn(options, match[1])) throw new Error('Use only --base=<SHA> and --head=<SHA>, once each.');
      options[match[1]] = match[2];
    }
    options.base ??= process.env.REPOSITORY_BUDGET_BASE || undefined;
    options.head ??= process.env.REPOSITORY_BUDGET_HEAD || undefined;
    console.log(JSON.stringify(await auditRepositoryBudget(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
