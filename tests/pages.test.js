import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../src/pages.js';
import * as ui from '../src/ui.js';
import { escapeHtml, chart } from '../src/ui.js';
import { getSeries, latest, formatValue, transformSeries } from '../src/model.js';
import { releases, yieldCurve, dataStatus } from '../src/data.js';
import { renderCharts } from '../src/charts.js';
import { refreshSnapshot } from '../scripts/sources/refresh.mjs';
import { parseRoute, routeFor } from '../src/router.js';

const base = {
  page: 'overview', seriesId: 'unrate', range: 12, transform: 'level', tab: 'data',
  query: '', topic: 'All topics', frequency: 'All frequencies', selected: ['unrate', 'cpi'],
  exploreMode: 'catalog', comparison: 'native', day: 'all', calendarTopic: 'All topics',
  watchOnly: false, eventId: 'cpi', saved: [], density: 'compact',
};
const render = (state = {}, historyContext = {}) => renderPage({ ...base, ...state }, historyContext);

test('Labor links directly to its next retained employment schedule with honest cached context',()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const next=releases.filter(event=>event.sourceId==='bls'&&event.program==='employment-situation'&&event.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 assert.ok(next,'retained employment schedule covers the test date');
 const html=render({page:'labor'});
 assert.ok(html.includes(encodeURIComponent(next.id)));assert.ok(html.includes(next.date));
 assert.match(html,/Next employment release/);assert.match(html,/Schedule only/);
});

test('Overview keeps a compact followed-measure monitor with checkpoint-specific update semantics',()=>{
 const html=render({saved:['unrate']},{checkpoint:{enabled:true},changes:{status:'ready',rows:[{seriesId:'unrate',kind:'value-change',period:'2026-09-01',capturedAt:'2026-10-22T12:00:00Z'}]}});
 assert.match(html,/data-overview-disclosure="my-research"/);assert.match(html,/Following 1/);assert.match(html,/Observed value change between retrievals/);assert.match(html,/Next related schedule/);
 assert.ok(html.includes('#/watchlist'));
});

function withCalendar(events, calendar, run) {
  const savedEvents = releases.splice(0), savedCalendar = dataStatus.calendar;
  releases.push(...events);
  dataStatus.calendar = calendar;
  try { run(); }
  finally { releases.splice(0, releases.length, ...savedEvents); dataStatus.calendar = savedCalendar; }
}

const calendarEvent = (changes = {}) => ({
  id: 'bls-employment-2026-11-06', sourceId: 'bls', program: 'employment', name: 'Employment Situation', agency: 'BLS',
  seriesId: 'unrate', seriesIds: ['unrate', 'payroll', 'participation', 'wages'], topic: 'Labor', date: '2026-11-06', time: '08:30',
  scheduledAt: '2026-11-06T13:30:00Z', period: null, periodLabel: null, sourceUrl: 'https://www.bls.gov/schedule/news_release/bls.ics', ...changes,
});
const calendarFixture = { status: 'partial', message: 'BLS retained; BEA unavailable.', sources: {
  bls: { id: 'bls', agency: 'BLS', status: 'error', fetchedAt: '2026-10-20T12:00:00Z', lastAttemptAt: '2026-10-21T12:00:00Z', error: 'HTTP 503', warnings: [] },
  bea: { id: 'bea', agency: 'BEA', status: 'unavailable', lastAttemptAt: '2026-10-21T12:00:00Z', error: 'No response', warnings: [] },
}, links: [{ name: 'BLS release schedule', url: 'https://www.bls.gov/schedule/' }, { name: 'BEA release schedule', url: 'https://www.bea.gov/news/schedule' }] };

const yieldTimingSource = (changes = {}) => ({
  id: 'treasury-yield-timing', agency: 'U.S. Department of the Treasury, Office of Debt Management', status: 'ok',
  events: [], fetchedAt: '2026-10-21T12:05:00Z', lastAttemptAt: '2026-10-21T12:06:00Z', error: null, warnings: [],
  timing: { program: 'daily-par-yields', seriesIds: ['yield'], topic: 'Rates', scheduleBasis: 'usual-availability', frequency: 'each-trading-day', availableBy: '18:00', timeZone: 'America/New_York', delaysPossible: true, sourceUrl: 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology' },
  ...changes,
});
const timingPanel = html => html.match(/<section class="panel yield-timing">[^]*?<\/section>/)?.[0] ?? '';

test('Treasury yield guidance stays ongoing without adding dated releases or inheriting month and day filters', () => {
  const events = [calendarEvent(), calendarEvent({ id: 'another-day', date: '2026-12-04', scheduledAt: '2026-12-04T13:30:00Z' })];
  withCalendar(events, { status: 'ok', sources: { 'treasury-yield-timing': yieldTimingSource() } }, () => {
    const november = render({ page: 'calendar', calendarView:'all', calendarMonth: '2026-11', day: '2026-11-06' });
    const december = render({ page: 'calendar', calendarView:'all', calendarMonth: '2026-12', day: '2026-12-04' });
    const panel = timingPanel(november);
    assert.ok(panel, 'ongoing timing has its own visible panel');
    assert.equal(timingPanel(december), panel, 'dated filters must not turn general guidance into a dated promise');
    assert.match(panel, /Ongoing timing/);
    assert.match(panel, /usually available by <strong[^>]*>18:00 Eastern Time/);
    assert.match(panel, /each trading day/);
    assert.match(panel, /Publication can be delayed/);
    assert.match(panel, /Office of Debt Management/);
    assert.match(panel, /8:05 am ET, 21 Oct/);
    assert.match(panel, /href="#\/series\/yield"/);
    assert.doesNotMatch(panel, /SCHEDULED|RELEASED|2026-11-06|2026-12-04|data-event=|15:30/);
    assert.equal((november.match(/class="calendar-event/g) || []).length, 1);
    assert.match(november, /1 events/);
    assert.match(november, /<dt>Captured events<\/dt><dd>2<\/dd>/);
  });
});

test('Treasury ongoing timing follows Rates and yield watchlist filters even when no dated Rates events exist', () => {
  withCalendar([calendarEvent()], { status: 'ok', sources: { 'treasury-yield-timing': yieldTimingSource() } }, () => {
    for (const filters of [{ calendarTopic: 'All topics' }, { calendarTopic: 'Rates' }, { calendarTopic: 'Rates', watchOnly: true, saved: ['yield'] }]) {
      const html = render({ page: 'calendar', calendarView:'all', calendarMonth: '2026-11', ...filters });
      assert.ok(timingPanel(html));
      assert.match(html, /<option value="Rates"/);
      if (filters.calendarTopic === 'Rates') {
        assert.match(html, /0 events/);
        assert.doesNotMatch(html, /class="calendar-event/);
      }
    }
    for (const filters of [{ calendarTopic: 'Labor' }, { calendarTopic: 'Fiscal' }, { watchOnly: true, saved: ['debt'] }, { watchOnly: true, saved: [] }]) {
      assert.equal(timingPanel(render({ page: 'calendar', calendarView:'all', calendarMonth: '2026-11', ...filters })), '');
    }
  });
});

test('yield detail shows independently cached timing beside unchanged observation retrieval and escapes source errors', () => {
  const source = yieldTimingSource({ status: 'error', error: 'HTTP 503 <retry>', coverageNote: 'Timing <guidance> only.', warnings: ['Delay <possible>'] });
  withCalendar([], { status: 'partial', sources: { 'treasury-yield-timing': source } }, () => {
    const html = render({ page: 'indicator', seriesId: 'yield', tab: 'data' });
    const panel = timingPanel(html);
    assert.ok(panel, 'timing is visible without opening methodology');
    assert.match(panel, /Cached timing/);
    assert.match(panel, /usually available by/);
    assert.match(panel, /HTTP 503 &lt;retry&gt;/);
    assert.match(panel, /Timing &lt;guidance&gt; only/);
    assert.match(panel, /Delay &lt;possible&gt;/);
    assert.match(panel, /Timing source retrieved/);
    assert.match(panel, /8:05 am ET, 21 Oct/);
    assert.ok(html.includes(getSeries('yield').fetchedAt));
    assert.ok(html.includes(formatValue(getSeries('yield'), latest(getSeries('yield'))?.value)));
    assert.doesNotMatch(html, /<retry>|<guidance>|<possible>/);
    assert.equal(timingPanel(render({ page: 'indicator', seriesId: 'debt' })), '');
  });
});

test('initial timing failure stays unavailable without presenting an uncaptured usual deadline', async () => {
  const source = yieldTimingSource({ status: 'unavailable', fetchedAt: null, timing: undefined, error: 'Methodology unavailable' });
  // Deliberately use the usual-deadline clock for collection: retrieval time is separate from guidance.
  const failed = await refreshSnapshot({ now:new Date('2026-10-28T18:00:00.000Z'),calendarCollectors: { 'treasury-yield-timing': async () => { throw Error('Methodology unavailable'); } } });
  for (const calendar of [{ status: 'unavailable', sources: { 'treasury-yield-timing': source } }, { status: 'unavailable', sources: {} }, failed.calendar]) {
    withCalendar([], calendar, () => {
      for (const state of [{ page: 'calendar',calendarView:'treasury' }, { page: 'indicator', seriesId: 'yield' }]) {
        const html = render(state), panel = timingPanel(html);
        assert.ok(panel);
        assert.match(panel, /Timing unavailable/);
        assert.match(panel, /No successful retrieval/);
        assert.doesNotMatch(html,/18:00 Eastern Time|usually available|Cached timing|Captured timing/,
          'An attempted-retrieval clock does not establish an availability deadline');
        if(calendar===failed.calendar)assert.match(panel,/Last attempt[\s\S]*2:00 pm ET, 28 Oct/,
          'The real failed-attempt timestamp stays visible even when its clock reads 18:00');
      }
    });
  }
});

test('HTML helpers escape untrusted values and expose declarative chart controls', () => {
  assert.equal(escapeHtml('<a title="x">&\'test\'</a>'), '&lt;a title=&quot;x&quot;&gt;&amp;&#39;test&#39;&lt;/a&gt;');
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-series="unrate"/);
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-range="6"/);
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-transform="change"/);
});

test('overview leads with eight dated readings and keeps momentum, catalysts and publication evidence reachable', () => {
 const html=render(),current=getSeries('unrate');
 assert.equal((html.match(/class="oh-topic"/g)||[]).length,8);
 assert.equal((html.match(/data-overview-reading=/g)||[]).length,8);
 assert.ok(html.includes(formatValue(current,latest(current)?.value)));
 assert.match(html,/data-series="pceMonthly,pceCoreMonthly"/);
 assert.match(html,/data-series="payrollAverage3m"/);
 assert.doesNotMatch(html,/data-chart[^>]*data-series="(?:pceMonthly|payroll),unrate"/);
 assert.match(html,/data-overview-disclosure="publications"/);assert.match(html,/Next catalysts/);
 assert.ok(html.indexOf('class="oh-topic-grid"')<html.indexOf('Next catalysts'));
 assert.ok(html.indexOf('class="oh-topic-grid"')<html.indexOf('class="oh-momentum"'));
 assert.ok(html.indexOf('class="oh-momentum"')<html.indexOf('Next catalysts'));
 assert.doesNotMatch(html,/Source health, coverage and methodology/);
 assert.match(html,/Collection failures and retained-source status are in Refresh details above/);
 assert.doesNotMatch(html,/synthetic|sample week|sample observations/i);
});

test('indicator data table uses the same transformed observations as its chart', () => {
  const html = render({ page: 'indicator', transform: 'change', range: 6 });
  const transformed = transformSeries(getSeries('unrate'), 'change', 6);
  assert.match(html, /data-transform="change"/);
  assert.match(html, /Percentage points|percentage points|pp/);
  for (const observation of transformed.observations) {
    assert.ok(html.includes(observation.date));
  }
  assert.match(html, /id="transform-select"/);
  assert.match(html, /data-tab="methodology"/);
  assert.match(html, /href="https:\/\//);
});

test('calendar empty filters remove any release preview and keep a clear recovery action', () => {
  withCalendar([calendarEvent()], calendarFixture, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-11', watchOnly: true, saved: [] });
    assert.match(html, /No releases match/i);
    assert.match(html, /data-reset-calendar/);
    assert.doesNotMatch(html, /class="detail-title"/);
    assert.match(html, /bls\.gov[^\"]*schedule/);
    assert.match(html, /bea\.gov[^\"]*schedule/);
  });
});

test('one employment release matches every related watchlist series and links their details', () => {
  withCalendar([calendarEvent()], calendarFixture, () => {
    for (const id of ['unrate', 'payroll', 'participation', 'wages']) {
      const html = render({ page: 'calendar', calendarMonth: '2026-11', watchOnly: true, saved: [id] });
      assert.equal((html.match(/class="calendar-event/g) || []).length, 1);
      assert.doesNotMatch(html, /Observation period not supplied/i);
      assert.match(html, /8:30 am ET/);
      for (const related of ['unrate', 'payroll', 'participation', 'wages']) assert.ok(html.includes(`href="#/series/${related}?`));
      assert.match(html, /href="https:\/\/www\.bls\.gov\/schedule\/news_release\/bls\.ics"/);
    }
  });
});

test('cached calendar capture and partial agency failures stay distinct from observation retrievals', () => {
  withCalendar([calendarEvent()], calendarFixture, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-11' });
    assert.match(html, /Cached schedule/);
    assert.match(html, /BLS retained; BEA unavailable\./);
    assert.match(html, /8:00 am ET, 20 Oct/);
    assert.match(html, /8:00 am ET, 21 Oct/);
    assert.match(html, /HTTP 503/);
    assert.match(html, /No response/);
    assert.doesNotMatch(html, />OUT<|>NEXT<|>Released</i);
  });
});

test('calendar groups only the selected month and uses bounded month and day selectors', () => {
  const events = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
    return calendarEvent({ id: `release-${date}`, date, scheduledAt: `${date}T13:30:00Z` });
  });
  withCalendar(events, calendarFixture, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-11' });
    assert.equal((html.match(/class="calendar-event/g) || []).length, 30);
    assert.match(html, /id="calendar-month"/);
    assert.match(html, /id="calendar-day"/);
    assert.doesNotMatch(html, /data-day=/);
    assert.match(html, /1 Nov 2026/);
    assert.doesNotMatch(html, /class="calendar-day"[^]*31 Oct 2026/);
    const selectedDay = render({ page: 'calendar', calendarMonth: '2026-11', day: '2026-11-06' });
    assert.equal((selectedDay.match(/class="calendar-event/g) || []).length, 1);
  });
});

test('overview release watch selects upcoming ET dates rather than old schedule entries', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dateAfter = days => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const events = [calendarEvent({ id: 'past', name: 'Past release', date: dateAfter(-1) }), calendarEvent({ id: 'elapsed', name: 'Elapsed today', date: today, scheduledAt: new Date(Date.now() - 60000).toISOString() }), ...[1, 2, 3, 4, 5, 40].map(days => calendarEvent({ id: `future-${days}`, name: `Future release ${days}`, program:`program-${days}`, date: dateAfter(days), scheduledAt: `${dateAfter(days)}T13:30:00Z` }))];
  withCalendar(events, calendarFixture, () => {
    const html = render();
    assert.doesNotMatch(html, /Past release|Elapsed today|Future release 5|Future release 40/);
    for (const days of [1, 2, 3, 4]) assert.ok(html.includes(`Future release ${days}`));
    assert.match(html, /Cached schedule/);
    assert.doesNotMatch(html, />OUT<|>NEXT</);
  });
});

test('calendar preserves an authoritative period label and shows daylight saving time from the event instant', () => {
  const calendar = { ...calendarFixture, sources: { bea: { id: 'bea', agency: 'BEA', status: 'ok', fetchedAt: '2026-10-21T12:00:00Z' } } };
  withCalendar([calendarEvent({ id: 'bea-pio', sourceId: 'bea', agency: 'BEA', name: 'Personal Income and Outlays, September 2026', seriesId: 'pce', seriesIds: ['pce'], topic: 'Prices', date: '2026-10-15', scheduledAt: '2026-10-15T12:30:00Z', periodLabel: 'September 2026', sourceUrl: 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics' })], calendar, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-10' });
    assert.match(html, /September 2026/);
    assert.match(html, /8:30 am ET/);
    assert.match(html, /Bureau of Economic Analysis/);
    assert.doesNotMatch(html, /Observation period not supplied/);
  });
});

test('Census retail schedule events match the retail watchlist and retain the originating program credit', () => {
  const event = calendarEvent({ id: 'census-retail-nov', sourceId: 'census', program: 'retail-sales', name: 'Advance Monthly Sales for Retail and Food Services', agency: 'Census', seriesId: 'retail', seriesIds: ['retail'], topic: 'Growth', scheduleBasis: 'listed-date', date: '2026-11-17', scheduledAt: '2026-11-17T13:30:00Z', periodLabel: 'October 2026', sourceUrl: 'https://www.census.gov/economic-indicators/calendar-listview.html' });
  withCalendar([event], { status: 'ok', sources: { census: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', warnings: [] } } }, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-11', watchOnly: true, saved: ['retail'], calendarTopic: 'Growth' });
    assert.equal((html.match(/class="calendar-event/g) || []).length, 1);
    assert.match(html, /href="#\/series\/retail\?[^"]*return=/);
    assert.match(html, /U\.S\. Census Bureau, Advance Monthly Retail Trade Survey/);
    assert.match(html, /Individually listed date on the official agency schedule/);
    assert.match(html, /October 2026/);
    assert.doesNotMatch(html, /Agency rule/);
  });
});

test('DOL agency-rule dates match claims watchlists and explain their basis without inventing an observation week', () => {
  const events = [
    calendarEvent({ id: 'dol-oct22', sourceId: 'dol', program: 'weekly-claims', name: 'Unemployment Insurance Weekly Claims', agency: 'DOL', seriesId: 'claims', seriesIds: ['claims'], topic: 'Labor', scheduleBasis: 'recurring-rule', nominalDate: '2026-10-22', date: '2026-10-22', scheduledAt: '2026-10-22T12:30:00Z', sourceUrl: 'https://oui.doleta.gov/unemploy/claims_arch.asp' }),
    calendarEvent({ id: 'dol-nov05', sourceId: 'dol', program: 'weekly-claims', name: 'Unemployment Insurance Weekly Claims', agency: 'DOL', seriesId: 'claims', seriesIds: ['claims'], topic: 'Labor', scheduleBasis: 'recurring-rule', nominalDate: '2026-11-05', date: '2026-11-05', scheduledAt: '2026-11-05T13:30:00Z', sourceUrl: 'https://oui.doleta.gov/unemploy/claims_arch.asp' }),
  ];
  const calendar = { status: 'ok', sources: { dol: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', coverageNote: 'Future dates follow the agency <rule>; schedules may change.', warnings: [] } } };
  withCalendar(events, calendar, () => {
    for (const [month, timezone] of [['2026-10', 'EDT'], ['2026-11', 'EST']]) {
      const html = render({ page: 'calendar', calendarMonth: month, watchOnly: true, saved: ['claims'], calendarTopic: 'Labor' });
      assert.equal((html.match(/class="calendar-event/g) || []).length, 1);
      assert.match(html, /Agency rule/);
      assert.match(html, /data-event="dol-/);
      assert.doesNotMatch(html, /Observation period not supplied/);
      assert.match(html, /Thursday at 08:30 Eastern Time/);
      assert.match(html, /8:30 am ET/);
      assert.doesNotMatch(html, /Observation period not supplied/);
      assert.match(html, /Department of Labor, Employment and Training Administration/);
      assert.match(html, /href="#\/series\/claims\?[^"]*return=/);
      assert.match(html, /agency &lt;rule&gt;/);
      assert.doesNotMatch(html, /Week ending|<rule>/);
    }
  });
});

test('DOL individually posted exceptions identify the nominal Thursday while cached failures retain basis disclosure', () => {
  const event = calendarEvent({ id: 'dol-thanksgiving', sourceId: 'dol', program: 'weekly-claims', name: 'Unemployment Insurance Weekly Claims', agency: 'DOL', seriesId: 'claims', seriesIds: ['claims'], topic: 'Labor', scheduleBasis: 'published-exception', nominalDate: '2026-11-26', date: '2026-11-25', scheduledAt: '2026-11-25T13:30:00Z', sourceUrl: 'https://oui.doleta.gov/unemploy/claims_arch.asp' });
  const source = { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', warnings: [] };
  withCalendar([event], { status: 'ok', sources: { dol: source } }, () => {
    const html = render({ page: 'calendar', calendarMonth: '2026-11' });
    assert.match(html, /Agency exception/);
    assert.match(html, /data-event="dol-thanksgiving"/);
    assert.doesNotMatch(html, /Observation period not supplied/);
    assert.match(html, /official DOL schedule lists this exception/i);
    assert.match(html, /Nominal Thursday: 26 Nov 2026/);
    assert.match(html, /25 Nov 2026/);
    source.status = 'error'; source.error = 'HTTP 503';
    const cached = render({ page: 'calendar', calendarMonth: '2026-11' });
    assert.match(cached, /Cached schedule/);
    assert.match(cached, /official DOL schedule lists this exception/i);
    assert.match(cached, /Nominal Thursday: 26 Nov 2026/);
    assert.match(cached, /HTTP 503/);
  });
});

test('overview catalysts retain schedule basis and avoid repeated programs while full calendar retains every date', () => {
 const dateAfter=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
 const events=['recurring-rule','published-exception'].map((scheduleBasis,index)=>calendarEvent({id:`dol-${index}`,sourceId:'dol',program:'weekly-claims',name:`Claims ${index}`,agency:'DOL',seriesId:'claims',seriesIds:['claims'],topic:'Labor',scheduleBasis,nominalDate:dateAfter(index+2),date:dateAfter(index+1),scheduledAt:`${dateAfter(index+1)}T13:30:00Z`,sourceUrl:'https://oui.doleta.gov/unemploy/claims_arch.asp'}));
 const calendar={status:'ok',sources:{dol:{status:'ok',fetchedAt:'2026-10-21T12:00:00Z'}}};
 withCalendar(events,calendar,()=>{const html=render();assert.match(html,/Agency rule/);assert.doesNotMatch(html,/Claims 1/);});
 withCalendar([events[1]],calendar,()=>{assert.match(render(),/Agency exception/);});
});

test('Treasury calendar estimates disclose their basis on debt watchlists with Eastern seasonal times and full source credit', () => {
  const events = [
    calendarEvent({ id: 'treasury-debt-oct22', sourceId: 'treasury', program: 'debt-to-the-penny', name: 'Debt to the Penny', agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal', scheduleBasis: 'calendar-estimate', date: '2026-10-22', time: '16:00', scheduledAt: '2026-10-22T20:00:00Z', sourceUrl: 'https://api.fiscaldata.treasury.gov/services/calendar/release' }),
    calendarEvent({ id: 'treasury-debt-nov02', sourceId: 'treasury', program: 'debt-to-the-penny', name: 'Debt to the Penny', agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal', scheduleBasis: 'calendar-estimate', date: '2026-11-02', time: '15:00', scheduledAt: '2026-11-02T20:00:00Z', sourceUrl: 'https://api.fiscaldata.treasury.gov/services/calendar/release' }),
  ];
  const calendar = { status: 'ok', sources: { treasury: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', coverageNote: 'Treasury dates are <estimates>.', warnings: [] } } };
  withCalendar(events, calendar, () => {
    for (const [month, time] of [['2026-10', '4:00 pm ET'], ['2026-11', '3:00 pm ET']]) {
      const html = render({ page: 'calendar', calendarView:'treasury', calendarMonth: month, watchOnly: true, saved: ['debt'], calendarTopic: 'Fiscal' });
      assert.equal((html.match(/class="calendar-event/g) || []).length, 1);
      assert.match(html, /data-event="treasury-debt-/);
      assert.doesNotMatch(html, /Observation period not supplied/);
      assert.match(html, /<span class="pill">Estimated<\/span>/);
      assert.ok(html.includes(time));
      assert.match(html, /U\.S\. Department of the Treasury, Bureau of the Fiscal Service/);
      assert.match(html, /href="#\/series\/debt\?[^"]*return=/);
      assert.match(html, /Individually listed estimate on the official Fiscal Data calendar/);
      assert.match(html, /date and time may change/i);
      assert.match(html, /Treasury dates are &lt;estimates&gt;/);
      assert.doesNotMatch(html, /<estimates>|Observation period:|Period ending/);
    }
    for (const filters of [{ saved: ['cpi'], calendarTopic: 'Fiscal' }, { saved: ['debt'], calendarTopic: 'Labor' }]) {
      const html = render({ page: 'calendar', calendarView:'treasury', calendarMonth: '2026-10', watchOnly: true, ...filters });
      assert.match(html, /No releases match these filters/);
      assert.doesNotMatch(html, /class="calendar-event|class="detail-title"/);
    }
  });
});

test('Treasury estimate deep links select the captured event and cached schedules retain estimate disclosure', () => {
  const events = ['2026-10-22', '2026-10-23'].map(date => calendarEvent({ id: `treasury-debt-${date}`, sourceId: 'treasury', program: 'debt-to-the-penny', name: 'Debt to the Penny', agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal', scheduleBasis: 'calendar-estimate', date, time: '16:00', scheduledAt: `${date}T20:00:00Z`, sourceUrl: 'https://api.fiscaldata.treasury.gov/services/calendar/release' }));
  const source = { status: 'error', fetchedAt: '2026-10-21T12:00:00Z', error: 'HTTP 503 <retry>', warnings: [] };
  withCalendar(events, { status: 'partial', sources: { treasury: source } }, () => {
    const route = parseRoute(routeFor({ page: 'calendar', calendarMonth: '2026-10', day: '2026-10-23', eventId: 'treasury-debt-2026-10-23', calendarTopic: 'Fiscal' }));
    const html = render(route);
    assert.equal((html.match(/class="calendar-event/g) || []).length, 1);
    assert.match(html, /data-event="treasury-debt-2026-10-23" aria-pressed="true"/);
    assert.match(html, /23 Oct 2026/);
    assert.match(html, /Cached schedule/);
    assert.match(html, /Estimated/);
    assert.doesNotMatch(html, /Observation period not supplied/);
    assert.match(html, /Individually listed estimate on the official Fiscal Data calendar/);
    assert.match(html, /HTTP 503 &lt;retry&gt;/);
    assert.doesNotMatch(html, /<retry>/);
  });
});

test('Treasury estimates remain estimated after scheduled time has elapsed', () => {
  const event = calendarEvent({ id: 'treasury-debt-elapsed', sourceId: 'treasury', program: 'debt-to-the-penny', name: 'Debt to the Penny', agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal', scheduleBasis: 'calendar-estimate', date: '2000-01-03', time: '15:00', scheduledAt: '2000-01-03T20:00:00Z', sourceUrl: 'https://api.fiscaldata.treasury.gov/services/calendar/release' });
  withCalendar([event], { status: 'ok', sources: { treasury: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z' } } }, () => {
    const html = render({ page: 'calendar', calendarView:'treasury', calendarMonth: '2000-01' });
    assert.match(html, /<span class="pill">Estimated<\/span>/);
    assert.match(html, /past scheduled time does not establish that a result was published/);
    assert.doesNotMatch(html, />RELEASED<|>PUBLISHED<|>ACTUAL<|>OUT<|>NEXT</i);
  });
});

test('Overview leaves routine debt estimates in the full chronological calendar', () => {
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const event=calendarEvent({id:'treasury-debt-upcoming',sourceId:'treasury',program:'debt-to-the-penny',name:'Debt to the Penny',agency:'Treasury Fiscal Data',seriesId:'debt',seriesIds:['debt'],topic:'Fiscal',scheduleBasis:'calendar-estimate',date,time:'16:00',scheduledAt:`${date}T20:00:00Z`,sourceUrl:'https://api.fiscaldata.treasury.gov/services/calendar/release'});
 withCalendar([event],{status:'ok',sources:{treasury:{status:'ok',fetchedAt:'2026-10-21T12:00:00Z'}}},()=>{
  assert.doesNotMatch(render(),/data-event="treasury-debt-upcoming"/);
  assert.doesNotMatch(render({page:'calendar',calendarMonth:date.slice(0,7)}),/data-event="treasury-debt-upcoming"/);
  const html=render({page:'calendar',calendarView:'all',calendarMonth:date.slice(0,7)});
  assert.match(html,/data-event="treasury-debt-upcoming"/);assert.match(html,/Estimated/);
 });
});

test('catalog escapes search input and renders a useful no-results state', () => {
  const html = render({ page: 'explore', query: '"><script>bad</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&quot;&gt;&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /No series match/i);
  assert.match(html, /data-reset-filters/);
  assert.match(html, /data-select|data-remove/);
});

test('compare preserves native units in separate panels and handles an empty selection', () => {
  const html = render({ page: 'explore', exploreMode: 'compare' });
  assert.match(html, /data-panel-id="unrate"/);
  assert.match(html, /data-panel-id="cpi"/);
  assert.equal((html.match(/data-series="unrate,cpi"/g)??[]).length,2,'each separate panel resolves the same comparison calendar');
  assert.match(html, /id="comparison-select"/);
  assert.match(render({ page: 'explore', exploreMode: 'compare', selected: [] }), /No series selected/i);
});

test('indexed comparisons describe their shared baseline and export units accurately', () => {
  const html = render({ page: 'explore', exploreMode: 'compare', comparison: 'indexed',selected:['receipts','outlays'] });
  assert.match(html, /common baseline = 100/i);
  assert.match(html, /original observation dates thereafter/i);
  assert.match(html, /VALUES <b class="mono">INDEXED/);
  assert.doesNotMatch(html, /retain each series’ native units/i);
  const unsupported=render({page:'explore',exploreMode:'compare',comparison:'indexed'});
  assert.match(unsupported,/Indexed comparison is unsupported/,'rates and growth measures cannot be ratio indexed');
  assert.match(unsupported,/cannot be ratio-indexed/);assert.match(unsupported,/data-comparison-mode="native"/);assert.match(unsupported,/data-comparison-mode="difference"/);assert.match(unsupported,/data-export[^>]*disabled/);
});

test('an unconnected calendar has no invented release results or fixed displayed week', () => {
  const saved = releases.splice(0);
  try {
    const html = render({ page: 'calendar' });
    assert.match(html, /No verified releases have been ingested/i);
    assert.match(html, /release schedules|secondary calendars/i);
    assert.doesNotMatch(html, /2026-10-19|October 19|ACTUAL|CONSENSUS|PRIOR REVISED|class="detail-title"/);
    assert.match(html, /data-reset-calendar/);
  } finally { releases.push(...saved); }
});

test('indicator preserves unknown publication dates and exposes official retrieval and calculation metadata', () => {
  const current = getSeries('unrate');
  const saved = { ...current };
  Object.assign(current, {
    dataStatus: 'official', fetchedAt: '2026-10-21T16:00:00Z', error: null,
    calculation: 'Official unemployment rate, unchanged.', publicationNote: 'Historical publication dates are not supplied by this feed.',
    source: { name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov/', seriesIds: ['LNS14000000'] },
    observations: [{ date: '2025-01-01', value: 4.0, publishedAt: null, footnotes: ['Preliminary <estimate>'] }], revisions: [],
  });
  try {
    const html = render({ page: 'indicator' });
    assert.match(html, /2026-10-21T16:00:00Z/);
    assert.match(html, /LNS14000000/);
    assert.match(html, /Preliminary &lt;estimate&gt;/);
    assert.match(html, /publication dates are not supplied/i);
    assert.doesNotMatch(html, /2025-02-02/);
    const methodology = render({ page: 'indicator', tab: 'methodology' });
    assert.match(methodology, /Official unemployment rate, unchanged\./);
    const historyContext={historyState:{status:'ready',history:{version:1,captures:[]}},revisions:[]};
    assert.match(render({ page: 'indicator', tab: 'revisions' },historyContext), /No observed value changes have been captured/i);
    assert.match(render({page:'indicator',tab:'revisions'},historyContext),/First captured and first released are distinct/);
  } finally { Object.assign(current, saved); }
});

test('unavailable indicators show missing values and the source explanation', () => {
  const current = getSeries('claims');
  const saved = { ...current };
  Object.assign(current, { dataStatus: 'unavailable', fetchedAt: null, error: 'DOL is outside the configured agency coverage.', observations: [], revisions: [] });
  try {
    const html = render({ page: 'indicator', seriesId: 'claims' });
    assert.match(html, /Unavailable/);
    assert.match(html, /DOL is outside the configured agency coverage\./);
    assert.match(html, /big-value">—</);
    assert.match(html, /No observations available/);
    assert.doesNotMatch(html, /OFFICIAL SNAPSHOT<\/span><\/div>/);
  } finally { Object.assign(current, saved); }
});

test('missing latest retained curve spread stays unavailable in Overview', () => {
 const point=getSeries('spread2s10s').observations.at(-1),saved=point.value;point.value=null;
 try {
  const reading=render().match(/<a[^>]*data-overview-reading="spread2s10s"[^]*?<\/a>/)?.[0];
  assert.ok(reading,'curve spread has its own Overview reading');
  assert.match(reading,/href="#\/series\/spread2s10s\?/);
  assert.match(reading,/<strong class="reading-value">—<\/strong>/);
 }
 finally {point.value=saved;}
});

test('source status distinguishes cached retrievals from a failed refresh attempt', () => {
  const html = ui.sourceStatusList({
    bls: { status: 'error', fetchedAt: '2026-10-20T12:00:00Z', lastAttemptAt: '2026-10-21T16:00:00Z', error: 'HTTP 503', warnings: [] },
    bea: { status: 'unavailable', fetchedAt: null, lastAttemptAt: '2026-10-21T16:00:00Z', error: 'No response', warnings: [] },
  });
  assert.match(html, /BLS/);
  assert.match(html, /cached/i);
  assert.match(html, /2026-10-20T12:00:00Z/);
  assert.match(html, /2026-10-21T16:00:00Z/);
  assert.match(html, /HTTP 503/);
  assert.match(html, /unavailable/i);
});

test('global source notice credits agencies and ties the BLS disclaimer to the retained retrieval', () => {
  assert.equal(typeof ui.sourceNotice, 'function', 'source notice renderer is available');
  const html = ui.sourceNotice({
    bls: { status: 'error', fetchedAt: '2026-10-20T12:00:00Z', lastAttemptAt: '2026-10-21T16:00:00Z' },
  });
  assert.ok(html.includes('BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.'));
  assert.match(html, /datetime="2026-10-20T12:00:00Z"/);
  assert.doesNotMatch(html, /2026-10-21T16:00:00Z/);
  assert.match(html, /href="https:\/\/www\.bls\.gov\/developers\/termsOfService\.htm"/);
  assert.match(html, /U\.S\. Treasury/);
  assert.match(html, /Bureau of Labor Statistics/);
  assert.match(html, /Bureau of Economic Analysis/);
  assert.match(html, /Department of Labor/);
  assert.match(html, /Employment and Training Administration/);
  assert.match(html, /U\.S\. Census Bureau/);
  assert.match(html, /Advance Monthly Retail Trade Survey/);
  assert.match(html, /independent site/i);
  assert.match(html, /not endorsed/i);
});

test('historical claims coverage stays visible on headline, monitor, catalog, comparison and detail views', () => {
  const current = getSeries('claims');
  const saved = { ...current };
  Object.assign(current, {
    dataStatus: 'official', error: null,
    coverageNote: 'Historical feed <may lag> the latest advance release.',
    observations: [{ date: '2026-09-19', value: 225, publishedAt: null }],
  });
  try {
    for (const html of [ui.metrics(['claims']), ui.seriesTable(['claims']), render({ page: 'explore', query: 'claims' }), render({ page: 'explore', exploreMode: 'compare', selected: ['claims', 'retail'] })]) {
      assert.match(html, /Historical feed/i);
      assert.match(html, /&lt;may lag&gt;/);
      assert.doesNotMatch(html, /<may lag>/);
    }
    const detail = render({ page: 'indicator', seriesId: 'claims' });
    assert.match(detail, /Historical feed &lt;may lag&gt; the latest advance release\./);
    assert.match(detail, /Week ending 19 Sep 2026/);
    assert.match(render({ page: 'indicator', seriesId: 'claims', tab: 'methodology' }), /<strong>Coverage\.<\/strong> Historical feed &lt;may lag&gt;/);
    assert.doesNotMatch(render({ page: 'labor' }), /DOL claims are unavailable/);
  } finally { Object.assign(current, saved); }
});

test('source warnings and historical coverage remain escaped in compact and expanded source status', () => {
  const sources = { dol: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', coverageNote: 'Historical <feed>', warnings: ['Advance release <newer>'] } };
  for (const compact of [false, true]) {
    const html = ui.sourceStatusList(sources, { compact });
    assert.match(html, /DOL ETA/);
    assert.match(html, /Historical &lt;feed&gt;/);
    assert.match(html, /Advance release &lt;newer&gt;/);
    assert.doesNotMatch(html, /<feed>|<newer>/);
  }
});

test('compact source warnings are closed disclosures while coverage and refresh failures stay visible', () => {
  const source = { status: 'error', fetchedAt: '2026-10-21T12:00:00Z', error: 'HTTP 503', coverageNote: 'Historical feed through September.', warnings: ['First <note>', 'Second note'] };
  const compact = ui.sourceStatusList({ dol: source }, { compact: true });
  assert.match(compact, /<details[^>]*><summary>Source notes \(2\)<\/summary><p class="muted">First &lt;note&gt;<\/p><p class="muted">Second note<\/p><\/details>/);
  assert.doesNotMatch(compact, /<details[^>]*\bopen\b/);
  const visible = compact.replace(/<details[\s\S]*?<\/details>/g, '');
  assert.match(visible, /Historical feed through September\./);
  assert.match(visible, /HTTP 503/);
  const expanded = ui.sourceStatusList({ dol: source });
  assert.doesNotMatch(expanded, /<details/);
  assert.match(expanded, /First &lt;note&gt;/);
  assert.doesNotMatch(ui.sourceStatusList({ census: { status: 'ok' } }, { compact: true }), /<details/);
});

test('source notice does not invent a retrieval timestamp when BLS is unavailable', () => {
  assert.equal(typeof ui.sourceNotice, 'function', 'source notice renderer is available');
  const html = ui.sourceNotice({ bls: { status: 'unavailable', fetchedAt: null } });
  assert.match(html, /BLS retrieval unavailable/);
  assert.doesNotMatch(html, /<time/);
  const escaped = ui.sourceNotice({ bls: { fetchedAt: '<script>unsafe</script>' } });
  assert.doesNotMatch(escaped, /<script>/);
});

// A small DOM boundary keeps the real SVG renderer and interaction handlers in use.
function withChartDocument(run) {
  class Element {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; this.listeners = {}; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    set textContent(value) { this.children = [String(value)]; }
    get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  }
  const saved = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new Element(tag), createElement: tag => new Element(tag) };
  const nodes = element => [element, ...element.children.filter(child => typeof child !== 'string').flatMap(nodes)];
  try { run({ Element, nodes }); }
  finally { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
}

test('a narrow quantitative curve uses elapsed maturity and retains every tenor through keyboard inspection', () => {
  const point = yieldCurve.find(item => item.years === 2);
  const saved = point.value;
  point.value = null;
  try {
    withChartDocument(({ Element, nodes }) => {
      const container = new Element('div');
      container.clientWidth = 300;
      container.dataset = { kind: 'curve', height: '254' };
      renderCharts({ querySelectorAll: () => [container] });
      const rendered = nodes(container);
      const svg = rendered.find(node => node.tag === 'svg');
      assert.match(svg.attributes['aria-label'], /Official snapshot/);
      const labels = rendered.filter(node => node.tag === 'text' && yieldCurve.some(item => item.tenor === node.textContent));
      assert.ok(labels.length>=3&&labels.length<yieldCurve.length,'sparse numeric axis labels keep elapsed-maturity text readable');
      assert.match(svg.attributes['aria-label'],/elapsed maturity/);
      const label=tenor=>Number(labels.find(node=>node.textContent===tenor)?.attributes.x);
      assert.ok(Math.abs((label('30Y')-label('20Y'))/(label('20Y')-label('10Y'))-1)<1e-8,'equal ten-year gaps have equal chart widths');
      for (const row of new Set(labels.map(node => node.attributes.y))) {
        const bounds = labels.filter(node => node.attributes.y === row).map(node => {
          const x = Number(node.attributes.x), width = node.textContent.length * 7;
          return { left: x - (node.attributes['text-anchor'] === 'end' ? width : node.attributes['text-anchor'] === 'middle' ? width / 2 : 0), width };
        });
        for (let index = 1; index < bounds.length; index++) assert.ok(bounds[index].left >= bounds[index - 1].left + bounds[index - 1].width, 'tenor labels must not overlap');
      }
      const index = yieldCurve.indexOf(point);
      svg.listeners.keydown({ key: 'Home', preventDefault() {} });
      for (let step = 0; step < index; step++) svg.listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
      const dots = nodes(container).filter(node => node.tag === 'circle');
      assert.equal(dots[0].attributes.visibility, 'hidden');
      assert.match(container.textContent, /Latest \([^)]*\) —/);
      assert.doesNotMatch(container.textContent, /Synthetic/);
    });
  } finally { point.value = saved; }
});
