import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try { adapter = await import('../scripts/sources/calendar-bea.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('calendar-bea.mjs')) throw error; }
function bea() { assert.ok(adapter, 'The BEA calendar source adapter must exist'); return adapter; }
const endpoint = 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics';
function event({ uid = 'gdp-2026-q3', title = 'GDP (Advance Estimate)\\, 3rd Quarter 2026', start = '20261029T123000Z', sequence = '0', stamp = '20250929T114611Z', extra = '' } = {}) {
  return ['BEGIN:VEVENT', `SUMMARY:${title}`, `DTSTART:${start}`, 'DURATION:PT30M', `DTSTAMP:${stamp}`, `UID:${uid}`, `SEQUENCE:${sequence}`, 'DESCRIPTION:www.bea.gov', extra, 'END:VEVENT'].filter(Boolean).join('\r\n');
}
const calendar = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID://BEA-Release-Calendar-Subscription//', 'X-WR-TIMEZONE:America/New_York', ...events, 'END:VCALENDAR'].join('\r\n');

test('BEA preserves official titles, periods, UTC instants and Eastern daylight or standard times', () => {
  const events = bea().parseBeaCalendar(calendar(event(), event({ uid: 'pio-oct', title: 'Personal Income and Outlays\\, October 2026', start: '20261125T133000Z' })));
  assert.equal(events.length, 2);
  assert.deepEqual({ ...events[0], id: undefined }, {
    id: undefined, sourceId: 'bea', program: 'gdp', name: 'GDP (Advance Estimate), 3rd Quarter 2026', agency: 'BEA', seriesId: 'gdp', seriesIds: ['gdp'], topic: 'Growth',
    date: '2026-10-29', time: '08:30', scheduledAt: '2026-10-29T12:30:00.000Z', period: null, periodLabel: '3rd Quarter 2026', sourceUrl: endpoint,
    sourceUid: 'gdp-2026-q3', sequence: 0, sourceUpdatedAt: '2025-09-29T11:46:11.000Z',
  });
  assert.match(events[0].id, /^bea-[a-f\d]+$/);
  assert.equal(events[1].seriesId, 'pce');
  assert.equal(events[1].program, 'personal-income-outlays');
  assert.equal(events[1].topic, 'Inflation');
  assert.equal(events[1].periodLabel, 'October 2026');
  assert.equal(events[1].date, '2026-11-25');
  assert.equal(events[1].time, '08:30');
});

test('BEA unfolds content lines and decodes escaped punctuation without altering the official name', () => {
  const title = 'Gross Domestic Product\\, 4th Quarter and Year 2024 (Advance Estima\r\n te)\\; Notes\\\\example';
  const [row] = bea().parseBeaCalendar(calendar(event({ title, start: '20250130T133000Z' }).replace('DTSTART:', 'DTSTART;VALUE=DATE-TIME:')));
  assert.equal(row.name, 'Gross Domestic Product, 4th Quarter and Year 2024 (Advance Estimate); Notes\\example');
  assert.equal(row.periodLabel, '4th Quarter and Year 2024');
  assert.equal(row.time, '08:30');
});

test('BEA maps only national GDP and Personal Income and Outlays programs', () => {
  const events = bea().parseBeaCalendar(calendar(
    event(),
    event({ uid: 'state', title: 'Gross Domestic Product by State and Personal Income by State\\, 2025' }),
    event({ uid: 'county', title: 'GDP by County and Personal Income by County\\, 2025' }),
    event({ uid: 'state-pce', title: 'Real Personal Consumption Expenditures by State\\, 2025' }),
    event({ uid: 'trade', title: 'U.S. International Trade in Goods and Services\\, September 2026' }),
  ));
  assert.deepEqual(events.map(row => row.sourceUid), ['gdp-2026-q3']);
});

test('BEA leaves unrecognized reference periods unknown instead of inferring them from release dates', () => {
  const [row] = bea().parseBeaCalendar(calendar(event({ title: 'Personal Income and Outlays\\, Special Update' })));
  assert.equal(row.period, null);
  assert.equal(row.periodLabel, null);
  assert.equal(row.name, 'Personal Income and Outlays, Special Update');
});

test('BEA extracts an explicit reference period despite source whitespace while preserving the source title', () => {
  const [row] = bea().parseBeaCalendar(calendar(event({ title: 'Personal Income and Outlays\\, July 2026 ' })));
  assert.equal(row.name, 'Personal Income and Outlays, July 2026 ');
  assert.equal(row.periodLabel, 'July 2026');
  assert.equal(row.period, null);
});

test('BEA revision records replace a UID by sequence while retaining stable identity', () => {
  const original = event();
  const changed = event({ start: '20261030T123000Z', sequence: '2', stamp: '20261020T140000Z' });
  const [prior] = bea().parseBeaCalendar(calendar(original));
  for (const records of [[original, changed], [changed, original]]) {
    const [row] = bea().parseBeaCalendar(calendar(...records));
    assert.equal(row.id, prior.id);
    assert.equal(row.date, '2026-10-30');
    assert.equal(row.sequence, 2);
    assert.equal(row.sourceUpdatedAt, '2026-10-20T14:00:00.000Z');
    assert.equal(row.publishedAt, undefined);
  }
  const [other] = bea().parseBeaCalendar(calendar(event({ uid: 'a-distinct-official-uid' })));
  assert.notEqual(other.id, prior.id);
});

test('BEA rejects ambiguous duplicate UIDs and accepts exact duplicate records once', () => {
  const original = event();
  assert.equal(bea().parseBeaCalendar(calendar(original, original)).length, 1);
  assert.throws(() => bea().parseBeaCalendar(calendar(original, event({ start: '20261030T123000Z' }))), /ambiguous|duplicate/i);
});

test('BEA cancellation tombstones remove a matching UID without recurring or retaining withdrawn events', () => {
  const cancellation = ['BEGIN:VEVENT', 'UID:gdp-2026-q3', 'SEQUENCE:3', 'DTSTAMP:20261020T140000Z', 'STATUS:CANCELLED', 'END:VEVENT'].join('\r\n');
  assert.deepEqual(bea().parseBeaCalendar(calendar(event(), cancellation)), []);
  assert.deepEqual(bea().parseBeaCalendar(calendar(cancellation, event())), []);
  assert.deepEqual(bea().parseBeaCalendar(calendar(event({ extra: 'STATUS:CANCELLED' }))), []);
});

test('BEA rejects malformed matched events instead of inventing dates, IDs or revision metadata', () => {
  const source = bea();
  const valid = event();
  const invalid = [
    valid.replace('20261029T123000Z', '20260230T123000Z'),
    valid.replace('20261029T123000Z', '20261029T083000'),
    valid.replace('20261029T123000Z', '20261029'),
    valid.replace('UID:gdp-2026-q3\r\n', ''),
    valid.replace('SEQUENCE:0', 'SEQUENCE:-1'),
    valid.replace('DTSTAMP:20250929T114611Z', 'DTSTAMP:unknown'),
    valid.replace('DTSTART:', 'DTSTART;TZID=Unknown/Zone:'),
    valid.replace('DTSTART:20261029T123000Z', 'DTSTART:20261029T123000Z\r\nDTSTART:20261030T123000Z'),
    valid.replace('END:VEVENT', 'RRULE:FREQ=MONTHLY\r\nEND:VEVENT'),
    valid.replace('3rd Quarter 2026', '3rd Quarter 2026\\q'),
  ];
  for (const text of invalid) assert.throws(() => source.parseBeaCalendar(calendar(text)), /BEA|calendar|date|schema|UTC|sequence|UID|escape|recurr/i);
});

test('BEA rejects non-calendar responses, broken component framing and oversized payloads', () => {
  const valid = calendar(event());
  for (const text of ['<html>Access denied</html>', valid.replace('VERSION:2.0', 'VERSION:1.0'), valid.replace('END:VEVENT', ''), valid + '\r\nBEGIN:VEVENT', null]) {
    assert.throws(() => bea().parseBeaCalendar(text), /BEA|calendar|schema|response/i);
  }
  assert.throws(() => bea().parseBeaCalendar(' '.repeat(2 * 1024 * 1024) + valid), /limit|size|large/i);
});

test('BEA collector records exact feed provenance and warns on an exhausted schedule', async () => {
  const result = await bea().collectBeaCalendar({
    now: new Date('2026-10-21T12:00:00Z'),
    fetchImpl: async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options.method, 'GET');
      return new Response(calendar(event()), { headers: { 'content-type': 'text/plain', 'last-modified': 'Tue, 20 Oct 2026 14:00:00 GMT' } });
    },
  });
  assert.equal(result.id, 'bea');
  assert.equal(result.agency, 'U.S. Bureau of Economic Analysis');
  assert.equal(result.events.length, 1);
  assert.equal(result.provenance[0].url, endpoint);
  assert.match(result.provenance[0].sha256, /^[a-f\d]{64}$/);
  assert.equal(result.provenance[0].text, undefined);
  assert.equal(result.fetchedAt, result.provenance[0].retrievedAt);
  assert.match(result.coverageNote, /GDP|Personal Income/i);
  assert.match(result.coverageNote, /change|schedule/i);
  assert.deepEqual(result.warnings, []);
  const exhausted = await bea().collectBeaCalendar({ now: new Date('2027-01-01T12:00:00Z'), fetchImpl: async () => new Response(calendar(event())) });
  assert.match(exhausted.warnings.join(' '), /upcoming|future|exhaust/i);
});

test('BEA collector rejects HTTP errors and bounds download bytes before snapshot replacement', async () => {
  await assert.rejects(bea().collectBeaCalendar({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /HTTP.*503/i);
  await assert.rejects(bea().collectBeaCalendar({ fetchImpl: async () => new Response(' '.repeat(2 * 1024 * 1024 + 1)) }), /byte limit|size|limit/i);
});
