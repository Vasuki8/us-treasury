import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {getSeries,toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {defaults,parseRoute} from '../src/router.js';
import {claimsFact} from './helpers/claims-publications-fixture.js';

const state = overrides => ({...defaults, saved:[], selected:[], ...overrides});
const indicator = (overrides={}, context={}) => indicatorPage(state(overrides),context);
const ordered = (html, labels) => {
  let previous = -1;
  for (const label of labels) {
    const position = html.indexOf(label);
    assert.ok(position > previous, `${label} must follow the preceding research section`);
    previous = position;
  }
};

test('Overview keeps primary readings and supporting measurements individually inspectable in the hierarchy', () => {
  const html = overviewPage(state());
  assert.match(html, /class="radar-page radar-overview overview-hierarchy"/);
  for (const id of ['gdp','pceCore','payroll','unrate','yield','spread2s10s','interestRevenueRatio']) {
    const reading = html.match(new RegExp('data-overview-reading="'+id+'"([^]*?)</a>'));
    assert.ok(reading, id+' remains individually inspectable');
    assert.match(reading[1], /class="reading-value">[^<]+<\/strong>/);
    assert.match(reading[1], /class="reading-unit">[^<]+ · [^<]+<\/span>/);
    assert.match(reading[1], /class="reading-change"/);
  }
  assert.equal((html.match(/class="oh-topic"/g)||[]).length,6);
  for(const id of ['realSpendingMonthly','pceCoreMonthly','effr','policyTargetLower','policyTargetUpper','publicDebt','claimsAdvance','continuedClaimsAdvance'])assert.ok(html.includes('#/series/'+id),id);
  for (const href of ['#/economy?family=activity','#/economy?family=prices','#/economy/labor','#/economy?family=policy','#/yields','#/fiscal','#/explore']) assert.ok(html.includes(href));
  assert.match(html,/Fed funds target range/);assert.match(html,/Effective rates and target bounds can refer to different days/);
});

test('Overview leads with conditions, then catalysts and momentum, with research exceptions in supporting disclosures', () => {
  const html=overviewPage(state({saved:['unrate']}), {checkpoint:{enabled:true,since:'2026-10-20'},changes:{status:'ready',rows:[{seriesId:'unrate',kind:'value-change',period:'2026-09-01',capturedAt:'2026-10-22T12:00:00Z'}]}});
  ordered(html,['ECONOMIC CONDITIONS','NEXT CATALYSTS','Published results · GDP &amp; claims','PCE INFLATION · MONTHLY','PAYROLL GAINS · 3-MONTH AVERAGE','Activity &amp; income','Weekly claims','My research','Following 1','Captured changes 1','Collection attention 0','Data &amp; methods','Source health, coverage and methodology']);
  assert.match(html,/retrieval update is not itself an official publication or market surprise/);
  assert.match(html,/Routine debt dates remain in the full calendar; schedules do not confirm results/);
  assert.match(html,/Observed value change between retrievals/);
  for(const href of ['#/watchlist','#/research?view=changes']) assert.ok(html.includes(href));
  for(const ids of ['pceMonthly,pceCoreMonthly','unrate,underemployment,participation','realDisposableIncomeMonthly,realSpendingMonthly']) assert.ok(html.includes('data-compare="'+ids+'"'));
  assert.match(overviewPage(state()),/Follow measurements from their detail pages/);
  assert.match(overviewPage(state()),/Publication evidence not loaded/);
  assert.match(overviewPage(state()),/Historical publications captured recently are not new releases today/);
  assert.match(html,/DATA FRESHNESS &amp; RELEASE COVERAGE/);
});

test('Overview renders a retained historical publication through reviewed archive context with separate clocks',()=>{
  const row=claimsFact({period:'2026-03-14',publicationDate:'2026-03-19'});
  row.id=`dol-${row.seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`;
  const html=overviewPage(state(),{publicationContexts:{claims:{status:'ready',archive:{releases:[row]}},gdp:{status:'error',error:'Archive unavailable'}}});
  const publications=html.slice(html.indexOf('data-overview-disclosure="publications"'),html.indexOf('class="oh-momentum"'));
  assert.match(publications,/Initial claims/);assert.match(publications,/Published 2026-03-19 · day precision/);
  assert.match(publications,/Captured 2026-10-22T22:00:00\.000Z/);assert.match(publications,/reference 2026-03-14/);
  assert.match(publications,/GDP: Publication evidence unavailable/);
  assert.match(publications,/Historical publications captured recently are not new releases today/);
  assert.doesNotMatch(publications,/new publication today|Released today/);
});

test('Indicator latest native snapshot stays separate from a transformed historical window', async () => {
  const current=getSeries('unrate'), saved=current.observations;
  current.observations=[{date:'2025-01-01',value:3.8},{date:'2025-02-01',value:3.9},{date:'2026-09-01',value:4.2,publishedAt:'2026-10-02'}];
  try {
    const html=await indicator({seriesId:'unrate',transform:'change',window:'custom',startDate:'2025-02-01',endDate:'2025-02-01'});
    assert.match(html,/class="radar-page radar-indicator"/);
    assert.match(html,/Latest retained reading[^]*?independent of the selected history window/);
    const snapshot=html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0];
    assert.ok(snapshot);
    assert.match(snapshot,/>4\.2%<\/strong>/);
    assert.match(snapshot,/Native unit[^]*?Percent/);
    assert.match(snapshot,/Sep 2026/);
    assert.match(snapshot,/Feb 2025/);
    assert.match(snapshot,/Official observation/);
    assert.match(html,/Percentage-point change/);
    assert.match(html,/Displayed: 1 observations · 2025-02-01 to 2025-02-01/);
    assert.match(html,/0\.1 Percentage points/);
    ordered(html,['indicator-snapshot','indicator-chart','Indicator detail sections','Related indicators','Full source identifiers']);
    for(const action of ['data-save="unrate"','data-add-compare="unrate"','data-export','id="transform-select"','id="window-start"','id="window-end"','data-window="all"']) assert.ok(html.includes(action));
  } finally {current.observations=saved;}
});

test('Indicator empty and invalid windows never substitute latest observations into the evidence table', async () => {
  const empty=await indicator({seriesId:'unrate',window:'custom',startDate:'1900-01-01',endDate:'1900-02-01'});
  assert.match(empty,/No observations available/);
  assert.match(empty,/data-export disabled/);
  assert.match(empty,/Displayed: 0 observations/);
  const invalid=await indicator({seriesId:'unrate',window:'custom',startDate:'2026-10-01',endDate:'2026-01-01'});
  assert.match(invalid,/Date window unavailable/);
  assert.match(invalid,/data-export disabled/);
  assert.match(invalid,/role="alert"/);
});

test('Indicator separates calculated or modeled measurement kind from captured or cached freshness', () => {
  const current=getSeries('unrate'), saved={observationType:current.observationType,dataStatus:current.dataStatus};
  try {
    for(const [observationType,kind] of [['calculated','Calculated metric'],['modeled','Model estimate']]) {
      current.observationType=observationType;
      for(const [dataStatus,freshness] of [['official','Captured'],['cached','Cached'],['unavailable','Unavailable']]) {
        current.dataStatus=dataStatus;
        const html=indicator({seriesId:'unrate'});
        assert.ok(html.includes(`<dt>Measurement</dt><dd>${kind}</dd>`));
        assert.ok(html.includes(`<dt>Source freshness</dt><dd>${freshness}</dd>`),`${kind} keeps ${freshness} as a separate property`);
      }
    }
  } finally {Object.assign(current,saved);}
});

test('Indicator exports retained missing changes and suppressed rows with exact-window provenance', () => {
  const current=getSeries('unrate'), saved=current.observations;
  const range={preset:'custom',startDate:'2017-01-01',endDate:'2017-01-01'};
  try {
    for(const [transform,observation] of [
      ['change',{date:'2017-01-01',value:4.8,publishedAt:'2017-02-03',footnotes:['First retained observation']}],
      ['level',{date:'2017-01-01',value:null,publishedAt:'2017-02-03',suppressed:true,footnotes:['Withheld by source']}],
    ]) {
      current.observations=[observation];
      const html=indicator({seriesId:'unrate',transform,window:'custom',startDate:range.startDate,endDate:range.endDate});
      assert.match(html,/time datetime="2017-01-01"/);
      assert.doesNotMatch(html,/data-export disabled/,'retained missing rows remain exportable');
      const [headers,...rows]=parseCsv(toCsv(['unrate'],{transform,range}));
      assert.equal(rows.length,1);
      const exported=Object.fromEntries(headers.map((key,index)=>[key,rows[0][index]]));
      assert.equal(exported.date,'2017-01-01');
      assert.equal(exported.value,'');
      assert.equal(exported.publication_date,'2017-02-03');
      assert.equal(exported.source_notes,observation.footnotes[0]);
      if(observation.suppressed) assert.equal(exported.suppressed,'true');
    }
  } finally {current.observations=saved;}
});

test('Indicator keeps claims and GDP publication evidence prominent and workspace returns bounded', async () => {
  const html=await indicator({seriesId:'claimsAdvance',returnTo:'#/explore?mode=compare&selected=claims,unrate'});
  ordered(html,['Return to workspace','indicator-snapshot','Claims history and latest release','VERIFIED RELEASE &amp; PUBLICATION EVIDENCE','indicator-chart']);
  assert.match(html,/BACK TO COMPARISON/);
  assert.match(html,/VIEW REVISED HISTORY/);
  assert.match(html,/ARCHIVED PUBLICATIONS/);
  assert.match(html,/LATEST RELEASE CONTEXT/);
  assert.match(html,/separate captures and can show different reference weeks/);
  const gdp=await indicator({seriesId:'gdp'});
  const evidenceHref=gdp.match(/href="([^"]+)">VERIFIED RELEASE &amp; PUBLICATION EVIDENCE/)?.[1];
  assert.ok(evidenceHref);
  assert.equal(parseRoute(evidenceHref.replaceAll('&amp;','&')).publicationSeries,'gdp');
  assert.doesNotMatch(await indicator({seriesId:'unrate',returnTo:'https://example.com'}),/Return to workspace|example\.com/);
});

test('Indicator evidence tabs preserve source notes, measurement methodology and capture limitations', async () => {
  const current=getSeries('unrate'), saved=current.observations;
  current.observations=[{date:'2026-09-01',value:null,publishedAt:'2026-10-02',footnotes:['Preliminary <estimate>'],suppressed:true,revisionIndicator:'Y'}];
  try {
    const html=await indicator({seriesId:'unrate',window:'all'});
    for(const marker of ['DATA TABLE','METHODOLOGY','RETRIEVAL HISTORY','Preliminary &lt;estimate&gt;','SUPPRESSED · withheld by source','SOURCE REVISION FLAG · reason unknown','2026-10-02']) assert.ok(html.includes(marker),marker);
    assert.match(html,/data-copy-link/);
    const method=await indicator({seriesId:'unrate',tab:'methodology'});
    assert.match(method,/Missing observations remain missing; no values are filled/);
    assert.match(method,/retrieval captures; release dates are shown only when independently verified/);
    const revisions=await indicator({seriesId:'unrate',tab:'revisions'},{historyState:{status:'ready'},revisions:[]});
    assert.match(revisions,/First captured and first released are distinct/);
  } finally {current.observations=saved;}
});
