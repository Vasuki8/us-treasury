import test from 'node:test';
import assert from 'node:assert/strict';
import { vintagesPage, vintagesCsv } from '../src/vintages-page.js';
import { recordVintages, revisionHistory } from '../src/vintages.js';
import { parseCsv } from '../scripts/sources/http.mjs';
import { registry } from '../src/registry.js';
import { BLS_DATA_NOTICE } from '../src/model.js';
import { renderPage } from '../src/pages.js';
import {treasuryParYieldUrl} from '../scripts/sources/yields.mjs';

const t1 = '2026-10-20T12:00:00.123Z', t2 = '2026-10-21T12:00:00.456Z';
const source = (fetchedAt, value) => ({ id: 'bea', fetchedAt, coverageNote: 'Only captured GDP values; no historical first releases.', provenance: [{ url: 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt', sha256: 'b'.repeat(64), retrievedAt: fetchedAt }], series: { gdp: { sourceIds: ['A191RL'], sourceUrl: 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt', calculation: 'Published real GDP annualized growth', dataStatus: 'official', observations: [{ date: '2026-04-01', value, publishedAt: null }] } } });
const fixture = () => recordVintages(null, { bea: source(t1, 2.2) }, { bea: source(t2, 2.4) }, { checkedAt: '2026-10-21T13:00:00.000Z' });

test('source-partition history retains the global default cutoff before and after loading and honors an explicit cutoff',()=>{
 const globalCutoff='2026-10-22T03:49:37.148Z',history=fixture();
 for(const status of ['loading','ready']){
  const context={status,history:status==='ready'?history:null,latestCaptureAt:globalCutoff,sourceIds:['bea']};
  const html=vintagesPage({vintageSeries:'gdp'},context.history,context);
  assert.match(html,/id="vintage-cutoff"[^>]*value="2026-10-22T03:49:37.148"/);
  assert.match(html,/Selected series history.*1 source archive/is);
  assert.match(html,/default cutoff.*all sources/is);
 }
 const explicit=vintagesPage({vintageSeries:'gdp',vintageCutoff:t1},history,{status:'ready',history,latestCaptureAt:globalCutoff,sourceIds:['bea']});
 assert.ok(explicit.includes(`Exact retrieval cutoff: ${t1}.`));assert.ok(!explicit.includes('2.4%'));
});

test('vintage views and CSV keep first and previous values in their captured units after rescaling', () => {
  const first = source(t1, 2000), next = source(t2, 2);
  Object.assign(first.series.gdp, { unit: 'USD millions', format: 'millions', precision: 2, definition: 'Captured Treasury exposure' });
  Object.assign(next.series.gdp, { unit: 'USD billions', format: 'billions', precision: 2, definition: 'Captured Treasury exposure' });
  const history = recordVintages(null, { bea: first }, { bea: next }, { checkedAt: t2 });
  const html = vintagesPage({ vintageSeries: 'gdp', vintageCutoff: t2 }, history);
  assert.ok(html.includes('2,000.00M'));
  assert.ok(html.includes('$2.00B'));
  assert.ok(!html.includes('$2,000.00B'));
  assert.match(html, /not directly comparable.*measurement|measurement.*not directly comparable/is);
  const [header, ...data] = parseCsv(vintagesCsv(history, { cutoff: t2, seriesId: 'gdp' }));
  const rows = data.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
  const known = rows.find(row => row.row_type === 'as-known-observation');
  assert.equal(known.first_captured_unit, 'USD millions');
  assert.equal(known.latest_captured_unit, 'USD billions');
  assert.equal(known.first_captured_value, '2000');
  assert.equal(known.latest_captured_value, '2');
  assert.equal(known.measurement_comparable, 'false');
  assert.equal(JSON.parse(known.first_captured_metadata_json).definition, 'Captured Treasury exposure');
  const change = rows.find(row => row.row_type === 'observed-value-change');
  assert.equal(change.previous_value_unit, 'USD millions');
  assert.equal(change.unit, 'USD billions');
  assert.equal(change.previous_captured_at, t1);
  assert.equal(change.change_reason, 'unknown');
  assert.equal(JSON.parse(change.previous_value_metadata_json).unit, 'USD millions');

    const detail = renderPage({ page: 'indicator', seriesId: 'gdp', tab: 'revisions', saved: [] }, {historyState:{status:'ready',history},revisions:revisionHistory(history,'gdp')});
    assert.ok(detail.includes('2,000.00M'));
    assert.ok(detail.includes('$2.00B'));
    assert.match(detail, /not directly comparable/is);
});

test('definition-only changes disclose a non-comparable first/latest measurement without inventing a value revision', () => {
  const first = source(t1, 2.2), next = source(t2, 2.2);
  first.series.gdp.definition = 'Original coverage';
  next.series.gdp.definition = 'Changed coverage';
  const history = recordVintages(null, { bea: first }, { bea: next }, { checkedAt: t2 });
  const html = vintagesPage({ vintageSeries: 'gdp', vintageCutoff: t2 }, history);
  assert.match(html, /No observed value changes/i);
  assert.match(html, /not directly comparable/is);
  const [header, value] = parseCsv(vintagesCsv(history, { cutoff: t2, seriesId: 'gdp' }));
  const row = Object.fromEntries(header.map((key, index) => [key, value[index]]));
  assert.equal(row.measurement_comparable, 'false');
  assert.equal(JSON.parse(row.first_captured_metadata_json).definition, 'Original coverage');
  assert.equal(JSON.parse(row.latest_captured_metadata_json).definition, 'Changed coverage');
});

test('vintage page exposes labeled UTC controls with exact default retrieval precision and registered series', () => {
  const html = vintagesPage({}, fixture());
  assert.match(html, /for="vintage-cutoff"/); assert.match(html, /id="vintage-cutoff"/); assert.match(html, /type="datetime-local"/); assert.match(html, /step="0.001"/);
  assert.ok(html.includes('2026-10-21T12:00:00.456'));
  assert.match(html, /for="vintage-series"/); assert.match(html, /id="vintage-series"/); assert.match(html, /value="gdp" selected/);
  assert.match(html, /data-export-vintages/); assert.match(html, /UTC/);
  for (const text of ['First captured', 'Latest captured', 'Unknown', 'benchmark', 'release', 'Supplemental', 'calendars', 'retrieval provenance']) assert.ok(html.includes(text), text);
});

test('as-known page honors exact UTC cutoff and does not show later revisions in an earlier view', () => {
  const html = vintagesPage({ vintageCutoff: '2026-10-20T12:00:00.123', vintageSeries: 'gdp' }, fixture());
  assert.ok(html.includes('2.2%'));
  assert.ok(!html.includes('2.4%'));
  assert.match(html, /No observed value changes/i);
  assert.match(vintagesPage({ vintageCutoff: '2026-02-30T12:00', vintageSeries: 'gdp' }, fixture()), /invalid.*cutoff/i);
  assert.match(vintagesPage({}, { version: 1, captures: [] }), /No capture history/i);
});

test('Captured by controls describe an inclusive retrieval cutoff with exact UTC precision', () => {
  const html = vintagesPage({ vintageSeries: 'gdp', vintageCutoff: t1 }, fixture());
  assert.match(html, /<label for="vintage-cutoff">Captured by \(UTC\)/);
  assert.match(html, /<h1>Retrieval history<\/h1>[\s\S]*Revision history at a UTC retrieval cutoff/);
  assert.ok(html.includes(`Exact retrieval cutoff: ${t1}.`));
  assert.match(html, /Captures at the exact cutoff are included/);
  assert.match(html, /retrieval cutoff.*release date|release date.*retrieval cutoff/is);
});

test('selected-series boundary uses its first observation upsert instead of an unrelated or empty source baseline', () => {
  const unrelatedAt = '2026-10-18T12:00:00.000Z', emptyAt = '2026-10-19T12:00:00.000Z';
  const unrelated = { ...source(unrelatedAt, 1.1), id: 'bls', series: { cpi: source(unrelatedAt, 1.1).series.gdp } };
  const empty = source(emptyAt, 2.2); empty.series.gdp.observations = [];
  const history = recordVintages(null, { bls: unrelated, bea: empty }, { bea: source(t1, 2.2) }, { checkedAt: t2 });
  const before = vintagesPage({ vintageSeries: 'gdp', vintageCutoff: emptyAt }, history);
  assert.match(before, /First retained capture for this series: <time datetime="2026-10-20T12:00:00.123Z">[^<]+<\/time>/);
  assert.match(before, /Unavailable before the first retained capture for this series/i);
  assert.match(before, /Later values are not substituted/);
  assert.ok(!before.includes('2.2%'));
  assert.equal(parseCsv(vintagesCsv(history, { cutoff: emptyAt, seriesId: 'gdp' })).length, 1);
  const exact = vintagesPage({ vintageSeries: 'gdp', vintageCutoff: t1 }, history);
  assert.ok(exact.includes('2.2%'));
  assert.doesNotMatch(exact, /Unavailable before the first retained capture/);
});

test('selected series without retained observation captures has no invented first-capture boundary', () => {
  const history = fixture();
  const html = vintagesPage({ vintageSeries: 'sofr', vintageCutoff: t2 }, history);
  assert.match(html, /First retained capture for this series: Unavailable/);
  assert.match(html, /No observation capture is retained for this series/);
  assert.doesNotMatch(html, /First retained capture for this series: <time/);
});

test('vintage CSV exports as-known observations and observed changes with provenance and unknown causes', () => {
  const [header, ...values] = parseCsv(vintagesCsv(fixture(), { cutoff: '2026-10-21T12:00:00.456', seriesId: 'gdp' }));
  const rows = values.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
  const observation = rows.find(row => row.row_type === 'as-known-observation');
  assert.equal(observation.value, '2.4');
  assert.equal(observation.unit, 'Percent q/q annualized');
  assert.equal(observation.first_captured_at, t1); assert.equal(observation.first_captured_value, '2.2');
  assert.equal(observation.last_captured_at, t2); assert.equal(observation.release_date, '');
  assert.equal(observation.cutoff_utc, t2); assert.equal(observation.source_series, 'A191RL');
  assert.equal(observation.provenance_sha256, 'b'.repeat(64));
  const change = rows.find(row => row.row_type === 'observed-value-change');
  assert.equal(change.previous_value, '2.2'); assert.equal(change.value, '2.4'); assert.equal(change.change_reason, 'unknown');
  assert.match(change.limitations, /first.*release|first.*reported/i);
  const early = parseCsv(vintagesCsv(fixture(), { cutoff: t1, seriesId: 'gdp' }));
  assert.equal(early.length, 2);
  assert.throws(() => vintagesCsv(fixture(), { cutoff: 'bad', seriesId: 'gdp' }), /cutoff/i);
});

test('opted-in vintage CSV uses only each annual input receipt and its actual retrieval clock',()=>{
 const nominal=treasuryParYieldUrl(2003),real=treasuryParYieldUrl(2003,'real');
 const capture=(fetchedAt,id,urls,value,marked=true)=>{
  const nominalAt=new Date(Date.parse(fetchedAt)-120000).toISOString(),realAt=new Date(Date.parse(fetchedAt)-60000).toISOString();
  const provenance=Array.from({length:24},(_,index)=>2003+index).flatMap(year=>['nominal','real'].map(kind=>({url:treasuryParYieldUrl(year,kind),sha256:(year*2+(kind==='real'?1:0)).toString(16).padStart(64,'0'),retrievedAt:year===2003?(kind==='real'?realAt:nominalAt):fetchedAt})));
  return {id:'yields',fetchedAt,provenance,series:{[id]:{...(marked?{inputProvenanceScope:'observation-source-urls'}:{}),sourceIds:['TC_10YEAR'],sourceUrl:treasuryParYieldUrl(2026),sourceUrls:[treasuryParYieldUrl(2026),treasuryParYieldUrl(2026,'real')],observations:[{date:'2003-01-02',value,publishedAt:null,sourceUrl:urls[0],sourceUrls:urls}]}}};
 };
 for(const [id,urls] of [['realYield10',[real]],['inflationComp10',[nominal,real]]]){
  const first=capture(t1,id,urls,2),next=capture(t2,id,urls,3),history=recordVintages(null,{yields:first},{yields:next},{checkedAt:t2});
  const [headers,...values]=parseCsv(vintagesCsv(history,{seriesId:id,cutoff:t2})),rows=values.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]])));
  assert.deepEqual(rows.map(row=>row.row_type),['as-known-observation','observed-value-change']);
  const expected=next.provenance.filter(row=>urls.includes(row.url));
  for(const row of rows){
   assert.equal(row.provenance_sha256,expected.map(receipt=>receipt.sha256).join('; '));
   assert.equal(row.provenance_urls,urls.join('; '));
   assert.equal(row.source_urls,urls.join('; '));
   assert.equal(row.retrieved_at,expected.map(receipt=>receipt.retrievedAt).sort().at(-1));
   assert.equal(row.last_captured_at,t2,'source confirmation remains separate from actual input retrieval');
  }
  const legacy=capture(t1,id,urls,2,false),legacyHistory=recordVintages(null,{}, {yields:legacy},{checkedAt:t1});
  const [legacyHeaders,legacyValue]=parseCsv(vintagesCsv(legacyHistory,{seriesId:id,cutoff:t1})),row=Object.fromEntries(legacyHeaders.map((header,index)=>[header,legacyValue[index]]));
  assert.equal(row.provenance_sha256,legacy.provenance.map(receipt=>receipt.sha256).join('; '));
  assert.equal(row.provenance_urls,legacy.provenance.map(receipt=>receipt.url).join('; '));
  assert.equal(row.retrieved_at,t1,'unmarked captures keep their source clock');
 }
});

test('opted-in main 10Y vintage CSV matches retained receipt hashes and fails on incomplete evidence',()=>{
 const sourceUrl=treasuryParYieldUrl(2003),receipt={url:sourceUrl,sha256:'a'.repeat(64),retrievedAt:t1};
 const source={id:'treasury',fetchedAt:t2,provenance:[receipt,{...receipt,sha256:'b'.repeat(64),retrievedAt:t2}],series:{yield:{inputProvenanceScope:'observation-source-urls',sourceIds:['BC_10YEAR'],sourceUrl,observations:[{date:'2003-01-02',value:4,publishedAt:null,sourceUrl,sourceSha256:receipt.sha256,retrievedAt:t1}]}}};
 const history=recordVintages(null,{}, {treasury:source},{checkedAt:t2}),[headers,value]=parseCsv(vintagesCsv(history,{seriesId:'yield',cutoff:t2}));
 const row=Object.fromEntries(headers.map((header,index)=>[header,value[index]]));
 assert.equal(row.provenance_sha256,receipt.sha256);assert.equal(row.retrieved_at,t1);assert.equal(row.provenance_urls,sourceUrl);
 const bad=structuredClone(source);bad.series.yield.observations[0].sourceSha256='f'.repeat(64);
 const badHistory=recordVintages(null,{}, {treasury:bad},{checkedAt:t2});
 assert.throws(()=>vintagesCsv(badHistory,{seriesId:'yield',cutoff:t2}),/provenance|capture/i);
});

test('NY Fed calculated vintage rows retain captured notices, input URLs and terms at each change', t => {
  const id = 'vintageFundingSpread';
  registry[id] = { id, name: 'Funding rate difference', unit: 'Current registry unit', frequency: 'Monthly', adjustment: 'Current adjustment', definition: 'Current definition', observationType: 'official', agency: 'marketFunctioning', precision: 2, format: 'basisPoints', source: { name: 'Federal Reserve Bank of New York', url: 'https://www.newyorkfed.org/' } };
  t.after(() => { delete registry[id]; });
  const terms = 'https://www.newyorkfed.org/privacy/termsofuse';
  const inputUrls = ['https://markets.newyorkfed.org/api/rates/secured/sofr/search.json', 'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json'];
  const captured = (fetchedAt, value, label) => ({ id: 'marketFunctioning', fetchedAt, sourceNotice: 'Required source copyright and republication disclaimer.', licenseUrl: terms, attribution: 'Source: Federal Reserve Bank of New York.', sourceTitle: 'New York Fed reference rates', redistributionNotice: 'Source downstream restrictions remain in force.', series: { [id]: { observations: [{ date: '2026-10-19', value, publishedAt: null }], sourceIds: ['SOFR:percentRate', 'EFFR:percentRate'], sourceUrl: inputUrls[0], sourceUrls: inputUrls, sourceNotice: `Required series ${label} notice.`, termsUrl: terms, attribution: 'New York Fed rates; Meridian calculation.', sourceTitle: 'SOFR–EFFR difference', redistributionNotice: 'Retain the source permissions and restrictions.', observationType: 'calculated', dataStatus: 'calculated', unit: 'Basis points', frequency: 'Daily', adjustment: 'Not seasonally adjusted', definition: `Captured ${label} definition.`, calculation: '100 * (SOFR - EFFR), identical effective date', coverageNote: 'Same-date funding rates only.' } }, provenance: [{ url: inputUrls[0], sha256: 'c'.repeat(64), retrievedAt: fetchedAt }] });
  const initial = captured(t1, 5, 'initial'), revised = captured(t2, 6, 'revised');
  const history = recordVintages(null, {}, { marketFunctioning: initial }, { checkedAt: t2 });
  const vintages = recordVintages(history, {}, { marketFunctioning: revised }, { checkedAt: t2 });
  const rowsFor = cutoff => {
    const [header, ...rows] = parseCsv(vintagesCsv(vintages, { cutoff, seriesId: id }));
    return rows.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
  };
  const early = rowsFor(t1)[0];
  assert.equal(early.unit, 'Basis points');
  assert.equal(early.observation_type, 'calculated');
  assert.equal(early.definition, 'Captured initial definition.');
  assert.match(early.source_notice, /Required series initial notice/);
  const later = rowsFor(t2);
  assert.deepEqual(later.map(row => row.row_type), ['as-known-observation', 'observed-value-change']);
  for (const row of later) {
    assert.equal(row.unit, 'Basis points');
    assert.equal(row.frequency, 'Daily');
    assert.equal(row.adjustment, 'Not seasonally adjusted');
    assert.equal(row.definition, 'Captured revised definition.');
    assert.equal(row.observation_type, 'calculated');
    assert.equal(row.captured_data_status, 'calculated');
    assert.equal(row.source_urls, inputUrls.join('; '));
    assert.equal(row.license_url, terms);
    assert.equal(row.terms_url, terms);
    assert.match(row.source_notice, /Required source copyright and republication disclaimer/);
    assert.match(row.source_notice, /Required series revised notice/);
    assert.match(row.redistribution_notice, /Source downstream restrictions/);
    assert.match(row.redistribution_notice, /Retain the source permissions/);
    assert.match(row.attribution, /Source: Federal Reserve Bank of New York/);
    assert.match(row.attribution, /Meridian calculation/);
    assert.equal(row.source_title, 'SOFR–EFFR difference');
    assert.equal(row.coverage_note, 'Same-date funding rates only.');
  }
  const html = vintagesPage({ vintageSeries: id, vintageCutoff: t2 }, vintages);
  assert.match(html, /Required source copyright and republication disclaimer/);
  assert.match(html, /Required series revised notice/);
  assert.match(html, /Retain the source permissions/);
  assert.match(html, /Basis points/);
  assert.ok(!html.includes('Current registry unit'));
});

test('vintage BLS CSV keeps both captured source conditions and the required BLS disclaimer', () => {
  const first = { ...source(t1, 2.2), id: 'bls', sourceNotice: 'Additional captured BLS source condition', series: { cpi: { ...source(t1, 2.2).series.gdp, sourceNotice: 'Captured BLS series condition' } } };
  const vintages = recordVintages(null, {}, { bls: first }, { checkedAt: t2 });
  const [header, value] = parseCsv(vintagesCsv(vintages, { cutoff: t2, seriesId: 'cpi' }));
  const row = Object.fromEntries(header.map((key, index) => [key, value[index]]));
  assert.ok(row.source_notice.includes(BLS_DATA_NOTICE));
  assert.match(row.source_notice, /Additional captured BLS source condition/);
  assert.match(row.source_notice, /Captured BLS series condition/);
});

test('whole-second UTC cutoff aliases retain exact inclusion in vintage page and CSV', () => {
  const first = source('2026-10-20T12:00:00Z', 2.2);
  const vintages = recordVintages(null, {}, { bea: first }, { checkedAt: '2026-10-21T13:00:00Z' });
  const [header, value] = parseCsv(vintagesCsv(vintages, { cutoff: '2026-10-20T12:00:00Z', seriesId: 'gdp' }));
  const row = Object.fromEntries(header.map((key, index) => [key, value[index]]));
  assert.equal(row.cutoff_utc, '2026-10-20T12:00:00.000Z');
  assert.equal(row.value, '2.2');
  assert.equal(parseCsv(vintagesCsv(vintages, { cutoff: '2026-10-20T11:59:59.999Z', seriesId: 'gdp' })).length, 1);
  assert.match(vintagesPage({ vintageCutoff: '2026-10-20T12:00:00Z' }, vintages), /Exact retrieval cutoff: 2026-10-20T12:00:00.000Z/);
});
