import {execFileSync} from 'node:child_process';
import {readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const blank = text => text.replace(/[^\r\n]/g, ' ');
const escaped = (text, index) => {
  let slashes = 0;
  while (text[--index] === '\\') slashes++;
  return slashes % 2 === 1;
};

function withoutCode(source, inline = true) {
  let fence;
  let visible = source.replace(/<!--[\s\S]*?-->/g, blank).split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) {
        fence = null;
      }
      return blank(line);
    }
    if (marker) {
      fence = marker[1];
      return blank(line);
    }
    return /^(?: {4}|\t)/.test(line) ? blank(line) : line;
  }).join('');
  if (!inline) return visible;
  for (let index = 0; index < visible.length; index++) {
    if (visible[index] !== '`' || escaped(visible, index)) continue;
    const run = visible.slice(index).match(/^`+/)[0];
    let close = index + run.length;
    while ((close = visible.indexOf(run, close)) !== -1) {
      if (visible[close - 1] !== '`' && visible[close + run.length] !== '`') break;
      close += run.length;
    }
    if (close === -1) continue;
    const end = close + run.length;
    visible = visible.slice(0, index) + blank(visible.slice(index, end)) + visible.slice(end);
    index = end - 1;
  }
  return visible;
}

function destination(text, offset) {
  while (/\s/.test(text[offset] || '') && offset < text.length) offset++;
  const angle = text[offset] === '<';
  const start = angle ? offset + 1 : offset;
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    if (text[index] === '\\') { index++; continue; }
    if (angle && text[index] === '>') return {start, end: index, after: index + 1};
    if (angle && /[\r\n]/.test(text[index])) return null;
    if (!angle) {
      if (text[index] === '(') depth++;
      else if (text[index] === ')') {
        if (!depth) return {start, end: index, after: index};
        depth--;
      } else if (/\s/.test(text[index]) && !depth) return {start, end: index, after: index};
    }
  }
  return !angle && !depth ? {start, end: text.length, after: text.length} : null;
}

const labelKey = text => text.replace(/\\([\p{P}\p{S}])/gu, '$1').trim().replace(/\s+/g, ' ').toLowerCase();

export function markdownLinks(source) {
  const visible = withoutCode(source);
  const definitions = new Map();
  const tags = [...visible.matchAll(/<[A-Za-z][^>]*>/g)];
  const excluded = tags.map(tag => [tag.index, tag.index + tag[0].length]);
  for (const match of visible.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:\r?\n[ \t]*)?/gm)) {
    const target = destination(visible, match.index + match[0].length);
    if (!target) continue;
    const key = labelKey(match[1]);
    if (!definitions.has(key)) definitions.set(key, target);
    const newline = visible.indexOf('\n', target.after);
    excluded.push([match.index, newline === -1 ? visible.length : newline]);
  }
  const targets = new Map();
  const add = target => targets.set(target.start, {
    target: source.slice(target.start, target.end), start: target.start, end: target.end,
    line: source.slice(0, target.start).split('\n').length,
  });
  for (let index = 0; index < visible.length; index++) {
    if (visible[index] !== '[' || escaped(visible, index) || excluded.some(([start, end]) => index >= start && index < end)) continue;
    let close = index + 1;
    let depth = 1;
    for (; close < visible.length; close++) {
      if (escaped(visible, close)) continue;
      if (visible[close] === '[') depth++;
      if (visible[close] === ']' && --depth === 0) break;
    }
    if (close === visible.length) continue;
    if (visible[close + 1] === '(') {
      const target = destination(visible, close + 2);
      const tail = target && visible.slice(target.after).match(/^\s*(?:(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\))\s*)?\)/);
      if (tail) {
        add(target);
        excluded.push([close + 1, target.after + tail[0].length]);
      }
    } else {
      const reference = visible.slice(close + 1).match(/^\[([^\]\n]*)\]/);
      const key = labelKey(reference?.[1] || visible.slice(index + 1, close));
      if (definitions.has(key)) add(definitions.get(key));
    }
  }
  for (const tag of tags) {
    for (const attr of tag[0].matchAll(/\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const value = attr[1] ?? attr[2] ?? attr[3];
      const start = tag.index + attr.index + attr[0].indexOf(value, attr[0].indexOf('=') + 1);
      add({start, end: start + value.length});
    }
  }
  return [...targets.values()].sort((a, b) => a.start - b.start);
}

function decode(text) {
  return text.replace(/\\([\p{P}\p{S}])/gu, '$1').replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([\da-f]+));/gi, (entity, decimal, hex) => {
    if (decimal || hex) return String.fromCodePoint(parseInt(decimal || hex, hex ? 16 : 10));
    return {'&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>'}[entity.toLowerCase()];
  });
}

export function localTarget(origin, target) {
  const decoded = decode(target);
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(decoded)) return null;
  const hash = decoded.indexOf('#');
  const fragment = hash === -1 ? '' : decodeURIComponent(decoded.slice(hash + 1));
  const name = decodeURIComponent((hash === -1 ? decoded : decoded.slice(0, hash)).split('?')[0]);
  const file = name ? path.posix.normalize(name.startsWith('/') ? name.slice(1) : path.posix.join(path.posix.dirname(origin), name)) : origin;
  return {file, fragment};
}

function anchors(source, markdown) {
  const visible = withoutCode(source, false);
  const result = new Set([...visible.matchAll(/<[A-Za-z][^>]*>/g)].flatMap(tag =>
    [...tag[0].matchAll(/\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map(match => decode(match[1]))));
  if (!markdown) return result;
  const used = new Set();
  const lines = visible.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1]
      ?? (index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1]) ? lines[index].trim() : null);
    if (!heading) continue;
    const text = decode(heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, ''));
    const slug = text.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    let unique = slug;
    for (let suffix = 1; used.has(unique); suffix++) unique = `${slug}-${suffix}`;
    used.add(unique);
    result.add(unique);
  }
  return result;
}

export function checkMarkdownLinks(root, files) {
  files ??= execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.MD'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean);
  const issues = [];
  const anchorCache = new Map();
  let links = 0;
  for (const file of files) {
    let source;
    try { source = readFileSync(path.join(root, file), 'utf8'); }
    catch { issues.push({file, line: 1, target: file, reason: 'missing tracked Markdown file'}); continue; }
    for (const link of markdownLinks(source)) {
      let target;
      try { target = localTarget(file, link.target); }
      catch { issues.push({file, ...link, reason: 'invalid URL encoding'}); continue; }
      if (!target) continue;
      links++;
      const absolute = path.join(root, target.file);
      let stat;
      try { stat = statSync(absolute); }
      catch { issues.push({file, ...link, reason: 'missing file'}); continue; }
      if (!target.fragment || stat.isDirectory() || !/\.(?:md|html?)$/i.test(target.file)) continue;
      if (!anchorCache.has(target.file)) {
        anchorCache.set(target.file, anchors(readFileSync(absolute, 'utf8'), /\.md$/i.test(target.file)));
      }
      if (!anchorCache.get(target.file).has(target.fragment)) issues.push({file, ...link, reason: 'missing anchor'});
    }
  }
  return {files: files.length, links, issues};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkMarkdownLinks(path.resolve(process.argv[2] || '.'));
  for (const issue of result.issues) console.error(`${issue.file}:${issue.line}: ${issue.target}: ${issue.reason}`);
  console.log(`Checked ${result.files} Markdown files and ${result.links} local links; ${result.issues.length} issue(s).`);
  process.exitCode = result.issues.length ? 1 : 0;
}
