import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {currentAccountGdpHistory} from '../src/current-account-gdp.js';
import * as csvView from '../src/current-account-gdp-view.js';
const view=await import('../src/current-account-gdp-history-view.js').catch(()=>({}));
const all={preset:'all'},copy=()=>structuredClone(snapshot.sources);
const observation=(date,value)=>({date,value,sourceValue:String(value*1000),publishedAt:null,footnotes:[]});
function fixture(){
 const sources=copy();
 sources.beaIta.series.currentAccountBalance.observations=[observation('2025-10-01',-100),observation('2026-01-01',-200),observation('2026-04-01',-300)];
 sources.bea.series.nominalGdp.observations=[observation('2025-10-01',16000),observation('2026-01-01',20000),observation('2026-04-01',24000)];
 return sources;
}

test('historical panel supplies explicit calculated chart binding, coverage, rights and accessible table',()=>{
 assert.equal(typeof view.currentAccountGdpHistoryPanel,'function');
 const sources=copy(),expected=currentAccountGdpHistory(sources,all),html=view.currentAccountGdpHistoryPanel(sources,all);
 assert.match(html,/HISTORICAL CURRENT ACCOUNT \/ GDP/);assert.match(html,/data-chart-catalog="current-account-gdp-history"/);
 assert.ok(html.includes(`Retained: ${expected.series.observations.length} quarters · ${expected.series.observations[0].date} to ${expected.series.observations.at(-1).date}`));
 assert.ok(html.includes(`Displayed: ${expected.observations.length} quarters`));
 assert.match(html,/Calculated metric/);assert.match(html,/CSV HISTORY &amp; INPUTS/);assert.match(html,/data-export-current-account-gdp-history/);
 assert.ok(html.includes(`First ${Math.min(50,expected.observations.length)} of ${expected.observations.length}`));assert.match(html,/100 ×/);assert.match(html,/retrieval/);assert.match(html,/bea.gov\/help\/faq\/147/);
});

test('historical CSV exactly matches year, count, custom and all chart points and raw inputs',()=>{
 assert.equal(typeof csvView.currentAccountGdpHistoryCsv,'function');
 for(const range of [all,{preset:'1y'},6,{preset:'custom',startDate:'2025-02-01',endDate:'2025-09-30'}]){
  const expected=currentAccountGdpHistory(copy(),range),[header,...rows]=parseCsv(csvView.currentAccountGdpHistoryCsv(copy(),range));
  assert.equal(rows.length,expected.observations.length);
  const records=rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
  assert.deepEqual(records.map(row=>row.reference_quarter),expected.observations.map(row=>row.date));
  assert.deepEqual(records.map(row=>row.value_percent===''?null:Number(row.value_percent)),expected.observations.map(row=>row.value));
  assert.equal(records[0].change_percentage_points,'');
  for(const [i,record] of records.entries()){
   assert.equal(record.numerator_source_value,expected.observations[i].numeratorObservation?.sourceValue??'');
   assert.equal(record.denominator_source_value,expected.observations[i].denominatorObservation?.sourceValue??'');
   assert.equal(record.denominator_saar_divisor,'4');assert.equal(record.observation_type,'calculated');
  }
 }
});

test('null quarter gaps remain chart/export rows and changes do not bridge missing inputs',()=>{
 const sources=fixture(),range={preset:'custom',startDate:'2025-10-01',endDate:'2026-04-01'};
 sources.bea.series.nominalGdp.observations=sources.bea.series.nominalGdp.observations.filter(row=>row.date!=='2026-01-01');
 const [header,...rows]=parseCsv(csvView.currentAccountGdpHistoryCsv(sources,range)),records=rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
 assert.equal(records.length,3);assert.equal(records[1].value_percent,'');assert.equal(records[1].missing,'true');
 assert.equal(records[2].change_percentage_points,'');
 assert.match(view.currentAccountGdpHistoryPanel(sources,range),/1 missing/);
});

test('empty/invalid/error/cached states remain explicit, CSV preserves evidence and frozen history has no live actions',()=>{
 const future={preset:'custom',startDate:'2030-01-01',endDate:'2031-01-01'};
 assert.match(view.currentAccountGdpHistoryPanel(fixture(),future),/No retained quarters/);
 assert.match(view.currentAccountGdpHistoryPanel(copy(),{preset:'custom',startDate:'bad',endDate:'bad'}),/date/i);
 assert.match(view.currentAccountGdpHistoryPanel({},all),/unavailable/i);
 const sources=fixture();sources.bea.status='error';sources.bea.error='GDP <failed>';
 assert.match(view.currentAccountGdpHistoryPanel(sources,all),/Cached/);assert.match(view.currentAccountGdpHistoryPanel(sources,all),/GDP &lt;failed&gt;/);
 const frozen=view.currentAccountGdpHistoryPanel(sources,{preset:'1y'},{frozen:true});
 assert.match(frozen,/FROZEN HISTORICAL/);assert.doesNotMatch(frozen,/data-export-current-account-gdp-history/);assert.doesNotMatch(frozen,/data-window=/);
 const [header,...rows]=parseCsv(csvView.currentAccountGdpHistoryCsv(sources,{preset:'1y'}));
 const row=Object.fromEntries(header.map((key,i)=>[key,rows.at(-1)[i]]));assert.equal(row.denominator_capture_status,'cached');assert.match(row.limitations,/revised/);
 assert.equal(row.denominator_publication_date,'');assert.equal(JSON.parse(row.denominator_provenance_json)[0].url,'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt');
});
