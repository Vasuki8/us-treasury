import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

let source;
try { source = await import('../scripts/sources/cleveland-cpi-availability.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('cleveland-cpi-availability.mjs')) throw error; }
const parse = (text, options) => { assert.ok(source, 'The availability-only Cleveland CPI parser must exist'); return source.parseClevelandCpiCsv(text, options); };
const collect = options => { assert.ok(source, 'The bounded Cleveland CPI collector must exist'); return source.collectClevelandCpiAvailability(options); };
const headlineUrl = 'https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/cpi.csv?sc_lang=en';
const coreUrl = 'https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/core.csv?sc_lang=en';
const landingUrl = 'https://www.clevelandfed.org/indicators-and-data/median-cpi';
const now = new Date('2026-10-24T12:00:00Z');
const headline = 'date,cpi_index,ann_monthly_chg\r\n08/01/2026,334.1,4.9\r\n09/01/2026,336.3,8.1\r\n';
const core = 'date,core_index,ann_monthly_chg\n08/01/2026,337.8,3.5\n09/01/2026,338.9,4.1\n';
const options = {series: 'headline', through: '2026-10-24'};
const okFetch = async url => new Response(url === headlineUrl ? headline : core);
function assertAvailabilityOnly(value) {
  const prices = new Set([336.3, 338.9, 8.1]);
  const restricted = /ann_monthly_chg|cpi_index|core_index|cpi_10142026/;
  function visit(item, path = '$') {
    if (Array.isArray(item)) { item.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        assert.doesNotMatch(key, restricted, `Restricted native field or release filename leak at ${path}`);
        visit(child, `${path}.${key}`);
      }
      return;
    }
    if (typeof item === 'string') {
      assert.doesNotMatch(item, restricted, `Restricted native field or release filename leak at ${path}`);
      const receiptClock = path.endsWith('.retrievedAt') && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item)
        && Number.isFinite(Date.parse(item)) && new Date(item).toISOString() === item;
      if (!receiptClock) assert.doesNotMatch(item, /336\.3|338\.9|8\.1/, `Restricted CPI price text leak at ${path}`);
      const numeric = item.trim();
      if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numeric)) {
        assert.equal(prices.has(Number(numeric)), false, `Restricted CPI price leak at ${path}`);
      }
    } else if (typeof item === 'number') assert.equal(prices.has(item), false, `Restricted CPI price leak at ${path}`);
  }
  visit(value);
}

test('availability leak checks accept receipt clock substrings but reject price leaves and restricted fields', () => {
  const metadata = {provenance: [{retrievedAt: '2026-11-01T17:59:08.164Z'}], latestReferencePeriod: '2026-09-01', availablePeriodCount: 2};
  assert.doesNotThrow(() => assertAvailabilityOnly(metadata));
  for (const price of [336.3, 338.9, 8.1, '336.3', '338.9', '8.1', '8.10', ' 336.30 ', '8.1e0']) {
    assert.throws(() => assertAvailabilityOnly({...metadata, nested: {values: [price]}}), /price|leak/i);
  }
  for (const leak of [{ann_monthly_chg: null}, {cpi_index: null}, {core_index: null}, {debug: 'date,cpi_index,ann_monthly_chg'}, {release: 'cpi_10142026.htm'}]) {
    assert.throws(() => assertAvailabilityOnly({...metadata, nested: leak}), /field|release|leak/i);
  }
  for (const text of ['Index value: 336.3', 'Source said 338.9', 'Annualized change 8.1%', '{"value":8.1}']) {
    assert.throws(() => assertAvailabilityOnly({...metadata, note: text}), /price|leak/i);
  }
});

test('parser retains only availability metadata and excludes the known missing October 2025 even if later numeric', () => {
  const result = parse('\ufeffdate,cpi_index,ann_monthly_chg\r\n"09/01/2025","324.7",\r\n10/01/2025,325.1,1.5\r\n11/01/2025,,\r\n09/01/2026,336.3,8.1\r\n', options);
  assert.deepEqual(result, {
    series: 'headline', latestReferencePeriod: '2026-09-01', latestAvailablePeriod: '2026-09-01', latestAvailable: true,
    referencePeriodCount: 4, availablePeriodCount: 2, missingPeriods: ['2025-11-01'], excludedPeriods: ['2025-10-01'],
  });
  assert.doesNotMatch(JSON.stringify(result), /324\.7|325\.1|336\.3|8\.1|ann_monthly_chg|cpi_index/);
});

test('parser accepts missing and zero annualized changes without converting them into rates', () => {
  const result = parse('date,core_index,ann_monthly_chg\n08/01/2026,337.8,0\n09/01/2026,338.9,\n', {series: 'core', through: '2026-10-24'});
  assert.equal(result.latestAvailablePeriod, '2026-09-01');
  assert.equal(result.availablePeriodCount, 2);
  assert.doesNotMatch(JSON.stringify(result), /337\.8|338\.9|rate|change|index/);
});

test('parser rejects wrong series, malformed quoting, dates, duplicates, order and invalid numbers', () => {
  for (const csv of [
    core, '<html>Access Denied</html>', 'date,cpi_index,ann_monthly_chg,extra\n09/01/2026,336.3,8.1,x',
    'date,cpi_index,ann_monthly_chg\n09/01/2026,"336.3"oops,8.1',
    'date,cpi_index,ann_monthly_chg\n09/01/2026,336".3,8.1',
    'date,cpi_index,ann_monthly_chg\n"09/01/2026,336.3,8.1',
    'date,cpi_index,ann_monthly_chg\n02/30/2026,336.3,8.1',
    'date,cpi_index,ann_monthly_chg\n09/02/2026,336.3,8.1',
    'date,cpi_index,ann_monthly_chg\n9/01/2026,336.3,8.1',
    headline + '09/01/2026,336.3,8.1\n',
    headline + ',,\n',
    'date,cpi_index,ann_monthly_chg\n09/01/2026,336.3,8.1\n08/01/2026,334.1,4.9\n',
    ...['0', '-1', 'Infinity', 'NaN', '1e3', ' 336.3', '336.3 '].map(value => `date,cpi_index,ann_monthly_chg\n09/01/2026,${value},8.1\n`),
    'date,cpi_index,ann_monthly_chg\n09/01/2026,336.3,not-a-number\n',
    'date,cpi_index,ann_monthly_chg\n',
    'date,cpi_index,ann_monthly_chg\n09/01/2026,336.3\n',
  ]) assert.throws(() => parse(csv, options), /CSV|schema|date|period|number|index|header|order|duplicate/i);
  assert.throws(() => parse(headline, {series: 'other', through: '2026-10-24'}), /series/i);
  assert.throws(() => parse(headline, {series: 'headline', through: '2026-02-30'}), /date/i);
});

test('future usable periods are rejected and a missing latest row stays explicitly unavailable', () => {
  assert.throws(() => parse(headline + '11/01/2026,339.7,1\n', options), /future/i);
  const result = parse(headline + '10/01/2026,,\n', options);
  assert.equal(result.latestReferencePeriod, '2026-10-01');
  assert.equal(result.latestAvailablePeriod, '2026-09-01');
  assert.equal(result.latestAvailable, false);
  assert.deepEqual(result.missingPeriods, ['2026-10-01']);
});

test('available observations must belong to a completed reference month', () => {
  assert.throws(() => parse(headline + '10/01/2026,339.2,4\n', options), /future|incomplete|completed/i);
  assert.equal(parse(headline + '10/01/2026,339.2,\n', {...options, through: '2026-11-01'}).latestAvailablePeriod, '2026-10-01');
});

test('availability survives a missing annual baseline and a repeated positive index', () => {
  const result = parse('date,cpi_index,ann_monthly_chg\n09/01/2025,324.7,2\n10/01/2025,,\n11/01/2025,324.7,\n10/01/2026,339.2,\n', {...options, through: '2026-11-24'});
  assert.equal(result.latestAvailablePeriod, '2026-10-01');
  assert.equal(result.availablePeriodCount, 3);
  assert.deepEqual(result.excludedPeriods, ['2025-10-01']);
});

test('aligned observations produce only a reference-period review candidate with rights and real receipts', async () => {
  const requests = [], pauses = [];
  const result = await collect({now, pause: async ms => pauses.push(ms), fetchImpl: async (url, init) => {
    requests.push(url);
    assert.equal(init.headers['User-Agent'], 'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');
    assert.match(init.headers.Accept, /text\/csv/);
    assert.equal(init.redirect, 'manual');
    assert.equal(init.signal.aborted, false);
    return new Response(url === headlineUrl ? headline : core, {headers: {'last-modified': 'Fri, 23 Oct 2026 12:00:00 GMT'}});
  }});
  assert.deepEqual(requests, [headlineUrl, coreUrl]);
  assert.deepEqual(pauses, [1000]);
  assert.equal(result.source, 'cleveland-fed-cpi');
  assert.equal(result.status, 'checked');
  assert.equal(result.error, null);
  assert.equal(result.latestPeriod, '2026-09-01');
  assert.deepEqual(result.candidates, [{sourceUrl: landingUrl, matchBy: 'referencePeriod', period: '2026-09-01', publicationDate: null, evidenceType: 'secondary-data-availability', seriesIds: ['cpiMonthly', 'cpiCoreMonthly']}]);
  assert.deepEqual(result.coverage, {kind: 'latest-reference-period', through: '2026-10-24', anchorReferencePeriod: '2026-09-01'});
  assert.equal(result.availability.headline.latestAvailable, true);
  assert.equal(result.availability.core.latestReferencePeriod, '2026-09-01');
  assert.equal(result.provenance.length, 2);
  for (const [index, csv] of [headline, core].entries()) {
    assert.equal(result.provenance[index].url, requests[index]);
    assert.equal(result.provenance[index].sha256, createHash('sha256').update(csv).digest('hex'));
    assert.equal(result.provenance[index].bytes, Buffer.byteLength(csv));
    assert.equal(result.provenance[index].lastModified, 'Fri, 23 Oct 2026 12:00:00 GMT');
    assert.ok(Number.isFinite(Date.parse(result.provenance[index].retrievedAt)));
  }
  assert.deepEqual(result.attempts, [
    {url: headlineUrl, attempt: 1, httpStatus: 200, outcome: 'accepted', errorCode: null},
    {url: coreUrl, attempt: 1, httpStatus: 200, outcome: 'accepted', errorCode: null},
  ]);
  assert.match(result.sourceNotice, /Cleveland|secondary/i);
  assert.match(result.attribution, /Bureau of Labor Statistics|BLS/);
  assert.match(result.attribution, /BLS\.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS\.gov\./);
  assert.equal(result.license.url, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.match(result.changesNotice, /availability/i);
  assert.match(result.note, /publication|release/i);
  assertAvailabilityOnly(result);
});

test('a newly available month queues its reference period without inventing a release date', async () => {
  const result = await collect({now: new Date('2026-11-24T12:00:00Z'), pause: async () => {}, fetchImpl: async url => new Response(url === headlineUrl ? headline + '10/01/2026,339.2,\n' : core + '10/01/2026,339.4,\n')});
  assert.equal(result.status, 'checked');
  assert.equal(result.candidates[0].period, '2026-10-01');
  assert.equal(result.candidates[0].publicationDate, null);
  assert.equal(result.candidates[0].sourceUrl, landingUrl);
});

test('collector uses the Eastern date at a UTC month boundary to reject the still incomplete month', async () => {
  const result = await collect({now: new Date('2026-11-01T02:00:00Z'), pause: async () => {}, fetchImpl: async url => new Response(url === headlineUrl ? headline + '10/01/2026,339.2,\n' : core + '10/01/2026,339.4,\n')});
  assert.equal(result.coverage.through, '2026-10-31');
  assert.equal(result.status, 'error');
  assert.deepEqual(result.candidates, []);
});

test('stale, missing and misaligned latest observations fail without falling back to an older common month', async () => {
  for (const [headlineCsv, coreCsv, reason] of [
    [headline.replace('09/01/2026,336.3,8.1\r\n', ''), core.replace('09/01/2026,338.9,4.1\n', ''), /stale|trail/i],
    [headline + '10/01/2026,,\n', core + '10/01/2026,339.4,2\n', /unavailable|missing|usable/i],
    [headline, core + '10/01/2026,339.4,2\n', /align/i],
    [headline + '10/01/2026,,\n', core + '10/01/2026,,\n', /unavailable|missing|usable/i],
  ]) {
    const result = await collect({now: new Date('2026-11-24T12:00:00Z'), pause: async () => {}, fetchImpl: async url => new Response(url === headlineUrl ? headlineCsv : coreCsv)});
    assert.equal(result.status, 'error');
    assert.deepEqual(result.candidates, []);
    assert.equal(result.latestPeriod, null);
    assert.match(result.error, reason);
    assert.equal(result.provenance.length, 2);
    assert.equal(result.attempts.length, 2);
  }
});

test('one rejected document keeps the successful peer receipt but cannot establish CPI availability', async () => {
  const result = await collect({now, pause: async () => {}, fetchImpl: async url => new Response(url === headlineUrl ? headline : '<html>private access denial text</html>')});
  assert.equal(result.status, 'error');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.provenance.length, 1);
  assert.equal(result.provenance[0].url, headlineUrl);
  assert.equal(result.availability.headline.latestAvailablePeriod, '2026-09-01');
  assert.equal(result.availability.core, null);
  assert.equal(result.attempts[1].errorCode, 'INVALID_SOURCE');
  assert.match(result.error, /core/i);
  assert.doesNotMatch(JSON.stringify(result), /private access denial/);
});

test('denials, redirects, partial responses, wrong content types and invalid UTF-8 are not retried', async () => {
  for (const response of [
    () => new Response('private body', {status: 403}),
    () => new Response('', {status: 302, headers: {location: 'https://vendor.example/cpi'}}),
    () => new Response(headline, {status: 206}),
    () => { const value = new Response(headline); Object.defineProperty(value, 'url', {value: 'https://vendor.example/cpi'}); return value; },
    () => { const value = new Response(headline); Object.defineProperty(value, 'redirected', {value: true}); return value; },
    () => new Response(headline, {headers: {'content-type': 'text/html'}}),
    () => new Response(Buffer.from([0xff])),
  ]) {
    const requests = [];
    const result = await collect({now, pause: async () => {}, fetchImpl: async url => { requests.push(url); return response(); }});
    assert.equal(result.status, 'error');
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(requests, [headlineUrl, coreUrl]);
    assert.equal(result.attempts.length, 2);
    assert.doesNotMatch(JSON.stringify(result), /private body|vendor\.example/);
  }
});

test('oversized Content-Length and streamed bodies are canceled without retry or disclosure', async () => {
  for (const declared of [true, false]) {
    let canceled = 0;
    const result = await collect({now, pause: async () => {}, fetchImpl: async () => new Response(new ReadableStream({
      start(controller) { if (!declared) controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
      cancel() { canceled++; },
    }), {headers: declared ? {'content-length': String(2 * 1024 * 1024 + 1)} : {}})});
    assert.equal(result.status, 'error');
    assert.deepEqual(result.attempts.map(row => row.errorCode), ['RESPONSE_TOO_LARGE', 'RESPONSE_TOO_LARGE']);
    assert.equal(canceled, 2);
    assert.equal(result.provenance.length, 0);
  }
});

test('transient transport and HTTP failures retry once with awaited backoff and preserve each attempt', async () => {
  for (const failure of [() => { throw new Error('private transport details'); }, () => new Response('', {status: 503})]) {
    const order = [];
    let first = true;
    const result = await collect({now, pause: async ms => { order.push(ms); await Promise.resolve(); order.push('paused'); }, fetchImpl: async url => {
      order.push(url);
      if (first) { first = false; return failure(); }
      return new Response(url === headlineUrl ? headline : core);
    }});
    assert.equal(result.status, 'checked');
    assert.deepEqual(order, [headlineUrl, 1000, 'paused', headlineUrl, 1000, 'paused', coreUrl]);
    assert.deepEqual(result.attempts.map(row => row.attempt), [1, 2, 1]);
    assert.equal(result.attempts[1].outcome, 'accepted');
    assert.doesNotMatch(JSON.stringify(result), /private transport/);
  }
});

test('bounded Retry-After is honored and persistent 429 defers the remaining host collection', async () => {
  const waits = [], requests = [];
  const result = await collect({now, pause: async ms => waits.push(ms), fetchImpl: async url => { requests.push(url); return new Response('', {status: 429, headers: {'retry-after': '3'}}); }});
  assert.deepEqual(requests, [headlineUrl, headlineUrl]);
  assert.deepEqual(waits, [3000]);
  assert.equal(result.status, 'error');
  assert.match(result.error, /defer|429/i);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.attempts.length, 2);
});

test('a final transient response with a fresh Retry-After defers the peer request instead of bypassing its cooldown', async () => {
  const waits = [], requests = [];
  const result = await collect({now, pause: async ms => waits.push(ms), fetchImpl: async url => { requests.push(url); return new Response('', {status: 503, headers: {'retry-after': '3'}}); }});
  assert.deepEqual(requests, [headlineUrl, headlineUrl]);
  assert.deepEqual(waits, [3000]);
  assert.equal(result.status, 'error');
  assert.match(result.error, /defer/i);
  assert.deepEqual(result.candidates, []);
});

test('Retry-After beyond five seconds, including HTTP date or overflow, defers all remaining requests', async () => {
  for (const retryAfter of ['6', '9999999999999999999999999999999999999999', 'Sat, 24 Oct 2026 12:00:06 GMT']) {
    const requests = [], waits = [];
    const result = await collect({now, pause: async ms => waits.push(ms), fetchImpl: async url => { requests.push(url); return new Response('', {status: 503, headers: {'retry-after': retryAfter}}); }});
    assert.deepEqual(requests, [headlineUrl]);
    assert.deepEqual(waits, []);
    assert.equal(result.status, 'error');
    assert.equal(result.attempts[0].errorCode, 'RETRY_AFTER_EXCEEDS_BUDGET');
    assert.match(result.error, /defer/i);
    assert.equal(result.license.url, 'https://creativecommons.org/licenses/by-sa/4.0/');
  }
});

test('the full-body deadline terminates an uncooperative reader and limits timeout retries', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let calls = 0, canceled = 0;
  const pending = collect({now, pause: async () => {}, fetchImpl: async url => {
    calls++;
    if (url === coreUrl) return new Response(core);
    return new Response(new ReadableStream({cancel() { canceled++; return new Promise(() => {}); }}));
  }});
  for (let index = 0; index < 10; index++) await Promise.resolve();
  t.mock.timers.tick(12000);
  for (let index = 0; index < 20; index++) await Promise.resolve();
  t.mock.timers.tick(12000);
  const result = await pending;
  assert.equal(calls, 3);
  assert.equal(canceled, 2);
  assert.equal(result.status, 'error');
  assert.deepEqual(result.attempts.map(row => row.errorCode), ['REQUEST_TIMEOUT', 'REQUEST_TIMEOUT', null]);
  assert.equal(result.provenance.length, 1);
});

test('invalid check time fails before networking', async () => {
  await assert.rejects(async () => collect({now: new Date('invalid'), fetchImpl: async () => assert.fail('No request for invalid time')}), /date|time/i);
});
