import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

let adapter;
try { adapter = await import('../scripts/sources/timing-treasury-yields.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('timing-treasury-yields.mjs')) throw error; }
function treasury() { assert.ok(adapter, 'The Treasury yield timing adapter must exist'); return adapter; }

const endpoint = 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
const path = '/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology/';
const rule = "<a href=/rates>Yield curve rates</a>are usually available at<a href=/statistics>Treasury's interest rate website</a>by 6:00 PM Eastern Time each trading day, but may be delayed due to system problems or other issues. Every attempt is made to make this data available as soon as possible.";
const page = (publication = rule) => `<!doctype html><html><head><title>Treasury Yield Curve Methodology | U.S. Department of the Treasury</title></head><body><main><article about="${path}" class=entity--type-node><div><div class="clearfix field field--name-field-page-body field__item"><h3>Treasury Yield Curve Methodology</h3><p>2/18/2025</p><p>Inputs are indicative bid-side quotations obtained at or near 3:30 PM each trading day.</p><p>${publication}</p><p>Office of Debt Management<br>Department of the Treasury</p></div></div></article></main></body></html>`;
const parse = html => treasury().parseTreasuryYieldTiming(html);
const expected = {
  program: 'daily-par-yields', seriesIds: ['yield'], topic: 'Rates', scheduleBasis: 'usual-availability',
  frequency: 'each-trading-day', availableBy: '18:00', timeZone: 'America/New_York', delaysPossible: true, sourceUrl: endpoint,
};

test('Treasury yield timing preserves the qualified 6 PM trading-day window without producing dated releases', () => {
  const result = parse(page());
  assert.deepEqual(result, expected);
  assert.ok(!('date' in result) && !('scheduledAt' in result) && !('time' in result));
  assert.ok(!JSON.stringify(result).includes('15:30'));
});

test('Treasury yield timing reads visible agency article content and normalizes markup whitespace', () => {
  const html = page().replace('6:00 PM', '6:00&nbsp;PM').replace('each trading day,', 'each\n trading day,')
    .replace('<body>', `<body><!-- <p>Yield curve rates available by 7:00 PM.</p> --><script>${rule}</script><style>.timing{content:"7:00 PM"}</style>`);
  assert.deepEqual(parse(html), expected);
  assert.deepEqual(parse(page().replace(`about="${path}"`, `about=${path}`)), expected);
});

test('Treasury yield timing scopes article identity to main content rather than navigation panels', () => {
  const html = page().replace('<main>', '<nav><article class="node node--type-mega_menu_panel"><p>Unrelated navigation</p></article></nav><main id=main-content>');
  assert.deepEqual(parse(html), expected);
});

test('Treasury yield timing rejects changed clocks, cadence, timezone and missing usual or delay qualifications', () => {
  for (const changed of [
    rule.replace('6:00 PM', '3:30 PM'), rule.replace('6:00 PM', '7:00 PM'), rule.replace('Eastern Time', 'UTC'),
    rule.replace('each trading day', 'each business day'), rule.replace('usually available', 'available'),
    rule.replace(', but may be delayed due to system problems or other issues.', '.'),
    rule.replace('may be delayed', 'will not be delayed'), rule.replace('Yield curve rates', 'Corporate bond rates'),
  ]) assert.throws(() => parse(page(changed)), /Treasury|timing|schema|rule/i);
});

test('Treasury yield timing rejects missing or unrelated article identities and malformed source scope', () => {
  for (const html of [
    null, '<html>Access Denied</html>', page().replace(path, '/unrelated/'),
    page().replace('field--name-field-page-body', 'field--name-other'),
    page().replace('<h3>Treasury Yield Curve Methodology</h3>', '<h3>Other publication</h3>'),
    page().replace('</article>', ''), page().replace('</p><p>Office', '<p>Office'),
    page().replace('<p>' + rule + '</p>', '').replace('</article>', `</article><p>${rule}</p>`),
    page().replace('</article>', `</article><article about="${path}"><p>${rule}</p></article>`),
  ]) assert.throws(() => parse(html), /Treasury|timing|schema|article|body/i);
});

test('Treasury yield timing rejects duplicate or conflicting visible publication rules', () => {
  for (const duplicate of [rule, rule.replace('6:00 PM', '7:00 PM'), 'Rates will instead be published at 7:00 PM Eastern Time.']) {
    assert.throws(() => parse(page().replace('</article>', `<p>${duplicate}</p></article>`)), /duplicate|conflict|timing|rule|schema/i);
  }
});

test('Treasury yield timing enforces byte limits and rejects control characters or hidden rule content', () => {
  assert.throws(() => parse(' '.repeat(2 * 1024 * 1024) + page()), /limit|size/i);
  assert.throws(() => parse(page().replace('6:00', '\x006:00')), /control|invalid/i);
  assert.throws(() => parse(page().replace(`<p>${rule}</p>`, `<p hidden>${rule}</p>`)), /hidden|visible|timing|schema/i);
});

test('Treasury yield timing collector captures reviewed source provenance without raw HTML or narrative', async () => {
  let requested;
  const result = await treasury().collectTreasuryYieldTiming({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: async (url, options) => {
    requested = { url, options };
    return new Response(page(), { headers: { 'last-modified': 'Wed, 21 Oct 2026 12:00:00 GMT' } });
  } });
  assert.equal(requested.url, endpoint);
  assert.equal(requested.options.headers.Accept, 'text/html');
  assert.equal(result.id, 'treasury-yield-timing');
  assert.equal(result.agency, 'U.S. Department of the Treasury, Office of Debt Management');
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.timing, expected);
  assert.deepEqual(result.warnings, []);
  assert.match(result.coverageNote, /trading day/i);
  assert.match(result.coverageNote, /delay/i);
  assert.match(result.coverageNote, /not.*(?:exact|dated)|no.*dated/i);
  assert.equal(result.provenance.length, 1);
  assert.equal(result.provenance[0].url, endpoint);
  assert.equal(result.provenance[0].sha256, createHash('sha256').update(page()).digest('hex'));
  assert.equal(result.provenance[0].lastModified, 'Wed, 21 Oct 2026 12:00:00 GMT');
  assert.equal(result.fetchedAt, result.provenance[0].retrievedAt);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  for (const key of ['text', 'html', 'rawScheduleRule', 'description', 'content']) assert.ok(!(key in result) && !(key in result.provenance[0]));
  assert.ok(!JSON.stringify(result).includes('system problems or other issues'));
});

test('Treasury yield timing collector rejects fetch failures, redirects and unreviewed successful responses', async () => {
  const collect = fetchImpl => treasury().collectTreasuryYieldTiming({ fetchImpl });
  await assert.rejects(collect(async () => new Response('Unavailable', { status: 503 })), /HTTP.*503/i);
  await assert.rejects(collect(async () => new Response('<html>Missing key</html>')), /Treasury|timing|schema/i);
  for (const url of [`${endpoint}/`, 'https://vendor.example/methodology']) {
    await assert.rejects(collect(async () => {
      const response = new Response(page());
      Object.defineProperty(response, 'url', { value: url });
      return response;
    }), /URL|source|redirect/i);
  }
  await assert.rejects(collect(async () => new Response(' '.repeat(2 * 1024 * 1024 + 1))), /limit/i);
});
