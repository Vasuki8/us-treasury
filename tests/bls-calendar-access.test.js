import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

let diagnostic;
try { diagnostic = await import('../scripts/check-bls-calendar-access.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('check-bls-calendar-access.mjs')) throw error; }
const probe = options => { assert.ok(diagnostic, 'The bounded BLS access diagnostic must exist'); return diagnostic.probeBlsCalendarAccess(options); };
const now = new Date('2026-10-21T12:00:00Z');
const annual = year => `https://www.bls.gov/schedule/${year}/home.htm`;
const feed = 'https://www.bls.gov/schedule/news_release/bls.ics';
const html = '<html><head><title>Schedule of Selected Releases 2026</title></head><body><table class="release-list"><thead><tr><th>Date</th><th>Time</th><th>Release</th></tr></thead><tbody><tr><td class="date-cell">Friday, November 6, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Employment Situation</strong> for October 2026</td></tr></tbody></table><p>All times on calendar are Eastern Time.</p></body></html>';
const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:official-fixture\r\nBEGIN:VEVENT\r\nSUMMARY:Employment Situation\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const sha256 = value => createHash('sha256').update(value).digest('hex');

test('access diagnostic uses only two official documents, honest identification and one awaited pause', async () => {
  const order = [];
  const report = await probe({now, pause: async milliseconds => { assert.equal(milliseconds, 1000); order.push('pause'); await Promise.resolve(); order.push('paused'); }, fetchImpl: async (url, options) => {
    order.push(url);
    assert.equal(options.headers['User-Agent'], 'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');
    assert.equal(options.redirect, 'manual');
    return new Response(url === annual(2026) ? html : ics);
  }});
  assert.deepEqual(order, [annual(2026), 'pause', 'paused', feed]);
  assert.equal(report.checkedAt, now.toISOString());
  assert.deepEqual(report.sources, [
    {url: annual(2026), format: 'annual-calendar', outcome: 'ok', httpStatus: 200, sha256: sha256(html), bytes: Buffer.byteLength(html), error: null},
    {url: feed, format: 'icalendar-document', outcome: 'ok', httpStatus: 200, sha256: sha256(ics), bytes: Buffer.byteLength(ics), error: null},
  ]);
});

test('access diagnostic records HTTP403 as denied without interpreting the response body', async () => {
  const requests = [], pauses = [];
  const report = await probe({now, pause: async ms => pauses.push(ms), fetchImpl: async url => { requests.push(url); return new Response(html + ics, {status: 403}); }});
  assert.deepEqual(requests, [annual(2026), feed]);
  assert.deepEqual(pauses, [1000]);
  for (const source of report.sources) {
    assert.equal(source.outcome, 'denied');
    assert.equal(source.httpStatus, 403);
    assert.equal(source.sha256, null);
    assert.equal(source.bytes, null);
    assert.match(source.error, /HTTP 403/);
  }
});

test('a denied annual calendar still permits one documented calendar-feed check', async () => {
  const report = await probe({now, pause: async () => {}, fetchImpl: async url => new Response(url === feed ? ics : '<html>Denied secret</html>', {status: url === feed ? 200 : 403})});
  assert.deepEqual(report.sources.map(source => source.outcome), ['denied', 'ok']);
  assert.equal(report.sources[1].format, 'icalendar-document');
  assert.doesNotMatch(JSON.stringify(report), /Denied secret|BEGIN:VCALENDAR|SUMMARY/);
});

test('access metadata measures and hashes original bytes even when irrelevant text has invalid UTF-8', async () => {
  const raw = Buffer.concat([Buffer.from(html), Buffer.from([0xff])]);
  const report = await probe({now, pause: async () => {}, fetchImpl: async url => new Response(url === feed ? ics : raw)});
  assert.equal(report.sources[0].outcome, 'ok');
  assert.equal(report.sources[0].bytes, raw.length);
  assert.equal(report.sources[0].sha256, sha256(raw));
});

test('calendar documents must pass the existing annual parser or strict feed framing checks', async () => {
  for (const invalid of [
    '<html>Access Denied</html>', ics.replace('VERSION:2.0', 'VERSION:1.0'),
    ics.replace('BEGIN:VCALENDAR\r\n', ''), ics.replace('END:VCALENDAR\r\n', ''),
    ics.replace('BEGIN:VEVENT', 'BEGIN:VTODO'), `prefix\n${ics}`, `${ics}suffix`,
  ]) {
    const report = await probe({now, pause: async () => {}, fetchImpl: async () => new Response(invalid)});
    assert.deepEqual(report.sources.map(source => source.outcome), ['error', 'error']);
    assert.doesNotMatch(JSON.stringify(report), /<html>|BEGIN:VCALENDAR|prefix|suffix/);
  }
});

test('access diagnostic rejects redirects, non-200 successful responses and oversized documents', async () => {
  for (const response of [
    () => new Response('', {status: 302, headers: {location: 'https://vendor.example/calendar'}}),
    () => new Response(ics, {status: 206}),
    () => { const value = new Response(ics); Object.defineProperty(value, 'url', {value: 'https://vendor.example/calendar'}); return value; },
    () => { const value = new Response(ics); Object.defineProperty(value, 'redirected', {value: true}); return value; },
    () => new Response('x'.repeat(2 * 1024 * 1024 + 1)),
  ]) {
    const report = await probe({now, pause: async () => {}, fetchImpl: async () => response()});
    assert.deepEqual(report.sources.map(source => source.outcome), ['error', 'error']);
    assert.doesNotMatch(JSON.stringify(report), /vendor\.example|x{20}/);
  }
});

test('access diagnostic uses the Eastern source year and prevents raw error disclosure', async () => {
  const requests = [];
  const report = await probe({now: new Date('2027-01-01T01:00:00Z'), pause: async () => {}, fetchImpl: async url => { requests.push(url); throw new Error('<html>private-body-and-secret</html>'); }});
  assert.deepEqual(requests, [annual(2026), feed]);
  assert.deepEqual(report.sources.map(source => source.outcome), ['error', 'error']);
  assert.doesNotMatch(JSON.stringify(report), /private|secret|html/);
  await assert.rejects(probe({now: new Date('invalid'), fetchImpl: async () => assert.fail('No fetch for invalid time')}), /date|time/i);
});

test('diagnostic CLI rejects unknown options before attempting any network request', () => {
  const result = spawnSync(process.execPath, ['scripts/check-bls-calendar-access.mjs', '--url', 'https://vendor.example/'], {encoding: 'utf8', timeout: 5000});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option/);
  assert.doesNotMatch(result.stdout, /checkedAt/);
});
