import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-doc-links.mjs', import.meta.url));

function fixture(t, files) {
  const temporaryRoot=path.resolve(os.tmpdir());
  const root = mkdtempSync(path.join(temporaryRoot, 'meridian-doc-links-'));
  t.after(() => {
    assert.equal(path.dirname(root),temporaryRoot);
    rmSync(root, {recursive: true, force: true});
  });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    writeFileSync(path.join(root, name), text);
  }
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', 'add', '.']);
  return root;
}

function check(root) {
  const result = spawnSync(process.execPath, [checker, root], {encoding: 'utf8'});
  return {status: result.status, output: result.stdout + result.stderr};
}

test('moved documents resolve relative, reference, image, escaped and HTML links with real anchors', t => {
  const root = fixture(t, {
    'README.md': '# Workspace\n\n## Run locally\n',
    'docs/guide.md': '# A & B: `checks`!\n\n## Repeat\n\n## Repeat\n\n<a id="explicit-anchor"></a>\n',
    'docs/note(copy).md': '# Note\n',
    'docs/image space.svg': '<svg/>',
    'docs/page.html': '<h1 id="hello">Hello</h1>',
    'docs/sources/review.md': [
      '[Run](../../README.md#run-locally)',
      '[Heading](../guide.md#a--b-checks)',
      '[Duplicate](../guide.md#repeat-1)',
      '[Explicit](../guide.md#explicit-anchor)',
      '[Review][guide] and [guide][] and [guide]',
      '[guide]: ../guide.md "A guide"',
      '![Image](<../image space.svg>)',
      '[Escaped](../note\\(copy\\).md)',
      '<a href="../guide.md#repeat">Guide</a>',
      '<img src="../image%20space.svg" alt="">',
      "<a href='../page.html#hello'>HTML</a>",
      '[Root](/README.md#workspace)',
    ].join('\n'),
  });
  const result = check(root);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Checked 4 Markdown files/);
});

test('code examples, escaped syntax, link titles and external URLs do not become local links', t => {
  const root = fixture(t, {
    'README.md': [
      '# Workspace',
      '`[example](missing.md)` and ``<a href="missing.md">example</a>``',
      '```md',
      '[fenced](missing.md)',
      '```',
      '~~~html',
      '<img src="missing.png">',
      '~~~',
      '    [indented](missing.md)',
      '\\[escaped](missing.md)',
      '[title](#workspace "missing.md")',
      '[title with syntax](#workspace "Example [label](missing.md)")',
      '<a data-href="missing.md" href="#workspace">Local</a>',
      '[remote](https://example.test/missing.md)',
      '[email](mailto:somebody@example.test)',
      '<a href="//example.test/missing.md">remote</a>',
      '<!-- [comment](missing.md) -->',
      '[unbound text] and [unbound][reference]',
    ].join('\n'),
  });
  const result = check(root);
  assert.equal(result.status, 0, result.output);
});

test('missing files and missing heading fragments fail with their document and line', t => {
  const root = fixture(t, {
    'README.md': '# Workspace\n\n[Missing](docs/absent.md)\n[Fragment](docs/guide.md#absent)\n[Data](docs/guide.md#fake)\n',
    'docs/guide.md': '# Present\n<span data-id="fake">Not an anchor</span>\n',
  });
  const result = check(root);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /README\.md:3:.*docs\/absent\.md.*missing file/);
  assert.match(result.output, /README\.md:4:.*docs\/guide\.md#absent.*missing anchor/);
  assert.match(result.output, /README\.md:5:.*docs\/guide\.md#fake.*missing anchor/);
});

test('tracked discovery excludes user notes but includes a newly staged Markdown document', t => {
  const root = fixture(t, {'README.md': '# Workspace\n'});
  writeFileSync(path.join(root, 'user-note.md'), '[Ignore](missing.md)\n');
  assert.equal(check(root).status, 0);
  writeFileSync(path.join(root, 'new-guide.md'), '[New](missing.md)\n');
  execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', 'add', 'new-guide.md']);
  const result = check(root);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /new-guide\.md:1:.*missing file/);
  assert.doesNotMatch(result.output, /user-note/);
});

test('all tracked repository Markdown links resolve', () => {
  const result = check(fileURLToPath(new URL('..', import.meta.url)));
  assert.equal(result.status, 0, result.output);
});
