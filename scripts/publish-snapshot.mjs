import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const snapshotPath = 'src/official-snapshot.js';

export async function publishSnapshot({ cwd = process.cwd(), expectedHead } = {}) {
  if (typeof expectedHead !== 'string' || expectedHead.length !== 40 || !/^[a-f0-9]{40}$/i.test(expectedHead)) throw new Error('Expected HEAD must be a complete 40-character commit SHA.');
  expectedHead = expectedHead.toLowerCase();
  const git = async (...args) => (await exec('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout;
  const head = (await git('rev-parse', 'HEAD')).trim();
  if (head !== expectedHead) throw new Error('The checkout HEAD differs from the expected commit; refusing to publish.');
  if ((await git('diff', '--cached', '--name-only', '-z')).length) throw new Error('The index contains pre-staged changes; refusing to publish.');
  const changedPaths = (await git('diff', '--name-only', '-z')).split('\0').filter(Boolean);
  if (changedPaths.some(file => file !== snapshotPath)) throw new Error('Unrelated tracked changes exist outside the official snapshot; refusing to publish.');

  // Workflow concurrency does not prevent a developer from pushing to main.
  const remote = (await git('ls-remote', '--exit-code', 'origin', 'refs/heads/main')).trim();
  if (remote !== `${expectedHead}\trefs/heads/main`) throw new Error('Remote main has changed since this run started; refusing to publish a stale refresh.');
  if (!changedPaths.length) return { commitSha: expectedHead, changed: false };

  await git('add', '--', snapshotPath);
  await git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', 'data: refresh official data and release calendars');
  const commitSha = (await git('rev-parse', 'HEAD')).trim();
  // A concurrent remote update after ls-remote is rejected by this normal push.
  await git('push', 'origin', 'HEAD:refs/heads/main');
  return { commitSha, changed: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await publishSnapshot({ expectedHead: process.env.EXPECTED_HEAD || process.env.GITHUB_SHA });
    const message = result.changed ? 'Refreshed official snapshot published' : 'Official snapshot unchanged';
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Official data refresh\n\n${message}: \`${result.commitSha}\`.\n`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `commit_sha=${result.commitSha}\n`);
    console.log(`${message}: ${result.commitSha}`);
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}
