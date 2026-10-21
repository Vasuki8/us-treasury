import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try { adapter = await import('../scripts/sources/calendar-dol.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('calendar-dol.mjs')) throw error; }
function dol() { assert.ok(adapter, 'The DOL calendar adapter must exist'); return adapter; }

const endpoint = 'https://oui.doleta.gov/unemploy/claims_arch.asp';
const rule = 'Publication Schedule: The UI Weekly Claims News Release is published each week on Thursday morning at 8:30am EST. Exceptions to this schedule occur when a Thursday falls on a Federal Holiday. The following is a list of dates when the weekly news release will be published on a day other than Thursday:';
const exception = (date, time = '8:30 AM EST') => `<tr><td>${date}</td><td>${time}</td></tr>`;
const exceptions = [exception('Wednesday, November 25, 2026'), exception('Wednesday, November 10, 2027'), exception('Wednesday, November 24, 2027')];
const page = (rows = exceptions) => `<!doctype html><html><head><title>Office of Unemployment Insurance</title></head><body><p>${rule}</p><table><thead><tr><th>Release Date</th><th>Release Time</th></tr></thead><tbody>${rows.join('\n')}</tbody></table><h2>UI Weekly Claims: Latest News Release</h2><p>Updated: September 11, 2026</p></body></html>`;
const parse = (date, html = page()) => dol().parseDolCalendar(html, { now: new Date(date) });

test('DOL expands only a bounded upcoming official recurring schedule and applies Thanksgiving exception', () => {
  const result = parse('2026-10-21T18:00:00Z');
  assert.equal(result.coverageStart, '2026-10-21');
  assert.equal(result.coverageEnd, '2027-01-18');
  assert.equal(result.scheduleMethod, 'recurring-rule-with-exceptions');
  assert.equal(result.rawScheduleRule, rule);
  assert.equal(result.events.length, 13);
  assert.equal(result.events[0].date, '2026-10-22');
  assert.equal(result.events.at(-1).date, '2027-01-14');
  assert.ok(!result.events.some(event => event.date === '2026-11-26'));
  assert.deepEqual(result.events.find(event => event.date === '2026-11-25'), {
    id: 'dol-claims-2026-11-26', sourceId: 'dol', program: 'weekly-claims',
    name: 'Unemployment Insurance Weekly Claims', agency: 'DOL ETA', seriesId: 'claims', seriesIds: ['claims'], topic: 'Labor',
    date: '2026-11-25', time: '08:30', scheduledAt: '2026-11-25T13:30:00.000Z', period: null, periodLabel: null,
    sourceUrl: endpoint, sourceUid: null, scheduleBasis: 'published-exception', nominalDate: '2026-11-26',
  });
  assert.equal(result.events[0].scheduleBasis, 'recurring-rule');
  assert.deepEqual(result.publishedExceptions, [
    { date: '2026-11-25', time: '08:30', nominalDate: '2026-11-26' },
    { date: '2027-11-10', time: '08:30', nominalDate: '2027-11-11' },
    { date: '2027-11-24', time: '08:30', nominalDate: '2027-11-25' },
  ]);
  assert.match(result.coverageNote, /90.*day/i);
  assert.match(result.coverageNote, /recurring|recurrence/i);
  assert.match(result.coverageNote, /Eastern|America\/New_York/i);
});

test('DOL applies the distinct 2027 Veterans Day and Thanksgiving exceptions', () => {
  const result = parse('2027-10-20T12:00:00Z');
  assert.equal(result.coverageEnd, '2027-12-31');
  for (const date of ['2027-11-10', '2027-11-24']) assert.equal(result.events.find(event => event.date === date)?.scheduleBasis, 'published-exception');
  for (const date of ['2027-11-11', '2027-11-25']) assert.ok(!result.events.some(event => event.date === date));
  assert.ok(result.events.every(event => event.date <= '2027-12-31'));
  assert.match(result.warnings.join(' '), /2027-12-31|published.*horizon|horizon.*published/i);
});

test('DOL normalizes the source generic EST wording to Eastern daylight and standard time', () => {
  const spring = parse('2027-03-01T12:00:00Z').events;
  assert.equal(spring.find(event => event.date === '2027-03-11')?.scheduledAt, '2027-03-11T13:30:00.000Z');
  assert.equal(spring.find(event => event.date === '2027-03-18')?.scheduledAt, '2027-03-18T12:30:00.000Z');
  const summer = parse('2027-07-01T00:00:00Z').events;
  assert.equal(summer.find(event => event.date === '2027-07-01')?.scheduledAt, '2027-07-01T12:30:00.000Z');
  const autumn = parse('2026-10-21T12:00:00Z').events;
  assert.equal(autumn.find(event => event.date === '2026-10-29')?.scheduledAt, '2026-10-29T12:30:00.000Z');
  assert.equal(autumn.find(event => event.date === '2026-11-05')?.scheduledAt, '2026-11-05T13:30:00.000Z');
});

test('DOL drops elapsed instants on capture day and never backfills earlier dates', () => {
  assert.equal(parse('2026-10-22T12:29:59Z').events[0].date, '2026-10-22');
  assert.equal(parse('2026-10-22T12:30:00Z').events[0].date, '2026-10-22');
  assert.equal(parse('2026-10-22T12:30:01Z').events[0].date, '2026-10-29');
  const result = parse('2026-10-21T18:00:00Z');
  assert.ok(result.events.every(event => event.scheduledAt >= '2026-10-21T18:00:00.000Z'));
  assert.ok(!result.events.some(event => event.date === '2026-01-01'));
  assert.ok(result.events.every(event => event.period === null && event.periodLabel === null));
});

test('DOL event identity stays attached to the nominal Thursday when an exception changes the date', () => {
  const regular = parse('2026-10-21T12:00:00Z', page(exceptions.slice(1))).events.find(event => event.date === '2026-11-26');
  const moved = parse('2026-10-21T12:00:00Z').events.find(event => event.date === '2026-11-25');
  assert.equal(regular.id, moved.id);
  assert.equal(regular.nominalDate, moved.nominalDate);
  assert.equal(regular.scheduleBasis, 'recurring-rule');
});

test('DOL includes a Wednesday exception at the window end and excludes its elapsed nominal Thursday at the window start', () => {
  const ending = parse('2026-08-28T12:00:00Z');
  assert.equal(ending.coverageEnd, '2026-11-25');
  assert.equal(ending.events.at(-1).date, '2026-11-25');
  assert.equal(ending.events.at(-1).nominalDate, '2026-11-26');
  const starting = parse('2026-11-26T12:00:00Z');
  assert.equal(starting.events[0].date, '2026-12-03');
});

test('DOL refuses stale posted exception horizons and invalid capture dates', () => {
  assert.throws(() => parse('2028-01-01T12:00:00Z'), /horizon|coverage|stale/i);
  assert.throws(() => parse('2026-10-21T12:00:00Z', page([exception('Wednesday, November 26, 2025')])), /horizon|coverage|stale/i);
  assert.throws(() => dol().parseDolCalendar(page(), { now: new Date('invalid') }), /capture|date|time/i);
  assert.throws(() => dol().parseDolCalendar(page(), { now: '2026-10-21' }), /capture|date|time/i);
});

test('DOL rejects unrelated successful HTML, source rule drift and malformed exception tables', () => {
  const invalid = [
    null, '<html>Access Denied</html>', page().replace('Thursday morning', 'Friday morning'),
    page().replace('8:30am EST', '9:00am EST'), page().replace('Release Date', 'Other Date'),
    page().replace('<tbody>', ''), page().replace('</tbody>', ''), page([]),
    page().replace('</table>', ''), page().replace('</p><table>', '</p><p>Extra</p><table>'),
    page().replace('<h2>', '<p>There will be no publication of the weekly claims release.</p><h2>'),
  ];
  for (const html of invalid) assert.throws(() => parse('2026-10-21T12:00:00Z', html), /DOL|schema|schedule|table|publication|exception/i);
  assert.throws(() => parse('2026-10-21T12:00:00Z', ' '.repeat(2 * 1024 * 1024) + page()), /size|limit/i);
});

test('DOL validates exception dates, weekdays, release times and duplicate nominal weeks', () => {
  const invalid = [
    exception('Wednesday, February 30, 2027'), exception('Tuesday, November 25, 2026'),
    exception('Tuesday, November 24, 2026'), exception('Thursday, November 26, 2026'),
    exception('Wednesday, November 25, 2026', '9:00 AM EST'), exception('Wednesday, November 25, 2026', '8:30 AM PST'),
    exception('November 25, 2026'), exception('Wednesday, November 25, 2026') + exception('Wednesday, November 25, 2026'),
    '<tr><td>Wednesday, November 25, 2026</td></tr>',
  ];
  for (const row of invalid) assert.throws(() => parse('2026-10-21T12:00:00Z', page([row])), /date|weekday|time|duplicate|schema/i);
});

test('DOL ignores commented or scripted content instead of treating it as a schedule change', () => {
  const html = page().replace('<body>', '<body><!-- There will be no publication. --><script>"Thursday morning at 9:00am"</script>');
  assert.equal(parse('2026-10-21T12:00:00Z', html).events[0].date, '2026-10-22');
});

test('DOL collector captures the exact reviewed source provenance without retaining response HTML', async () => {
  let requested;
  const result = await dol().collectDolCalendar({ now: new Date('2026-10-21T18:00:00Z'), fetchImpl: async (url, options) => {
    requested = { url, options };
    return new Response(page(), { headers: { 'last-modified': 'Wed, 21 Oct 2026 12:00:00 GMT' } });
  } });
  assert.equal(requested.url, endpoint);
  assert.equal(requested.options.headers.Accept, 'text/html');
  assert.equal(result.id, 'dol');
  assert.equal(result.agency, 'U.S. Department of Labor, Employment and Training Administration');
  assert.equal(result.events.length, 13);
  assert.equal(result.coverageStart, '2026-10-21');
  assert.equal(result.coverageEnd, '2027-01-18');
  assert.equal(result.provenance.length, 1);
  const provenance = result.provenance[0];
  assert.equal(provenance.url, endpoint);
  assert.match(provenance.sha256, /^[a-f\d]{64}$/);
  assert.equal(provenance.lastModified, 'Wed, 21 Oct 2026 12:00:00 GMT');
  assert.equal(result.fetchedAt, provenance.retrievedAt);
  assert.ok(!('text' in provenance));
  assert.equal(result.rawScheduleRule, rule);
  assert.equal(result.publishedExceptions.length, 3);
});

test('DOL collector rejects network failures, redirects, unexpected HTML and over-limit bodies', async () => {
  const collect = fetchImpl => dol().collectDolCalendar({ now: new Date('2026-10-21T18:00:00Z'), fetchImpl });
  await assert.rejects(collect(async () => new Response('Unavailable', { status: 503 })), /HTTP.*503/i);
  await assert.rejects(collect(async () => new Response('<html>Missing Key</html>')), /DOL|schema|schedule/i);
  await assert.rejects(collect(async () => {
    const response = new Response(page());
    Object.defineProperty(response, 'url', { value: 'https://vendor.example/calendar' });
    return response;
  }), /URL|source|redirect/i);
  await assert.rejects(collect(async () => new Response(' '.repeat(2 * 1024 * 1024 + 1))), /limit/i);
});
