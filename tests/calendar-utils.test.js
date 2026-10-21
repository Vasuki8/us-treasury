import test from 'node:test';
import assert from 'node:assert/strict';

let helpers;
try { helpers = await import('../scripts/sources/calendar-utils.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('calendar-utils.mjs')) throw error; }
function calendar() { assert.ok(helpers, 'Calendar time/text helpers must exist'); return helpers; }

test('calendar UTC conversion retains Eastern calendar dates in winter and summer', () => {
  assert.deepEqual(calendar().easternFields('2026-01-09T13:30:00.000Z'), {date:'2026-01-09',time:'08:30'});
  assert.deepEqual(calendar().easternFields('2026-07-02T12:30:00Z'), {date:'2026-07-02',time:'08:30'});
  assert.deepEqual(calendar().easternFields('2027-01-01T01:00:00Z'), {date:'2026-12-31',time:'20:00'});
});

test('calendar Eastern wall times convert with the actual daylight saving offset', () => {
  assert.equal(calendar().easternInstant('2026-01-09','08:30'),'2026-01-09T13:30:00.000Z');
  assert.equal(calendar().easternInstant('2026-07-02','08:30'),'2026-07-02T12:30:00.000Z');
  assert.equal(calendar().easternInstant('2026-11-03','10:00'),'2026-11-03T15:00:00.000Z');
  assert.equal(calendar().easternInstant('2026-03-08','03:30'),'2026-03-08T07:30:00.000Z');
});

test('calendar time helpers reject impossible dates, ambiguous clocks and non-UTC instants', () => {
  for (const value of ['not a date','2026-02-30T13:30:00Z','2026-01-09T08:30:00','2026-01-09','2026-01-09T13:30:00+00:00',null]) {
    assert.throws(()=>calendar().easternFields(value), /UTC|instant|date/i);
  }
  for (const [date,time] of [['2026-02-30','08:30'],['2026-01-09','24:00'],['2026-01-09','8:30'],['2026-03-08','02:30'],['2026-11-01','01:30']]) {
    assert.throws(()=>calendar().easternInstant(date,time), /date|time|ambiguous|nonexistent/i);
  }
});

test('calendar text normalization decodes source entities and never executes markup', () => {
  const html='<p>Personal Income &amp; Outlays&nbsp; <strong>&#40;September&#x29;</strong></p><script>hidden()</script><style>hidden{}</style>';
  assert.equal(calendar().decodeHtmlText(html),'Personal Income & Outlays (September)');
  assert.equal(calendar().decodeHtmlText('&#x1F4C5; &quot;Release&quot; &#39;time&#39; &ndash; &mdash;'),'📅 "Release" \'time\' – —');
  assert.equal(calendar().decodeHtmlText('&lt;img src=x onerror=alert(1)&gt;'),' <img src=x onerror=alert(1)>'.trim());
  assert.equal(calendar().decodeHtmlText('&unrecognized;'),'&unrecognized;');
});
