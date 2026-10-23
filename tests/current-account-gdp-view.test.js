import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpFixture} from './helpers/current-account-gdp-fixture.js';
import {parseCsv} from '../scripts/sources/http.mjs';
const view=await import('../src/current-account-gdp-view.js').catch(()=>({}));
const copy=currentAccountGdpFixture;

test('Graphite ratio panel labels the calculation, matching quarter, SAAR conversion and percentage-point change',()=>{
 assert.equal(typeof view.currentAccountGdpPanel,'function');
 const html=view.currentAccountGdpPanel(copy());
 assert.match(html,/CURRENT ACCOUNT \/ NOMINAL GDP/);assert.match(html,/Calculated metric/);
 assert.match(html,/-3\.02%/);assert.match(html,/8,140\.7575/);assert.match(html,/32,563\.030/);
 assert.match(html,/percentage points/);assert.match(html,/SAAR/);assert.match(html,/100 ×/);
 assert.match(html,/2026-10-23T04:21:42\.080Z/);assert.match(html,/2026-10-23T02:56:31\.625Z/);
 assert.match(html,/different retrieval vintages/);assert.match(html,/data-export-current-account-gdp/);
 assert.match(html,/GDP publication date.*unknown/i);assert.match(html,/Source: U.S. Bureau of Economic Analysis/);
});

test('ratio panel discloses cached source errors, missing exact GDP and escapes source text',()=>{
 const sources=copy();sources.bea.status='error';sources.bea.error='GDP <failed>';
 let html=view.currentAccountGdpPanel(sources);assert.match(html,/Cached/);assert.match(html,/GDP &lt;failed&gt;/);
 sources.bea.series.nominalGdp.observations=sources.bea.series.nominalGdp.observations.filter(row=>row.date!=='2026-04-01');
 html=view.currentAccountGdpPanel(sources);assert.match(html,/Unavailable/);assert.doesNotMatch(html,/-3\.02%/);
 assert.match(view.currentAccountGdpPanel({}),/unavailable/i);
 assert.match(view.currentAccountGdpPanel({}),/data-export-current-account-gdp disabled/);
});

test('CSV retains both exact quarterly inputs, native source strings, factor four, rights and separate evidence',()=>{
 assert.equal(typeof view.currentAccountGdpCsv,'function');
 const [headers,...rows]=parseCsv(view.currentAccountGdpCsv(copy())),records=rows.map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));
 assert.equal(records.length,2);const current=records.find(row=>row.reference_quarter==='2026-04-01');
 assert.ok(Math.abs(Number(current.value_percent)-100*(-246.023)/(32563.03/4))<1e-12);
 assert.equal(current.observation_type,'calculated');assert.equal(current.numerator_value,'-246.023');
 assert.equal(current.denominator_saar_value,'32563.03');assert.equal(current.denominator_quarter_value,'8140.7575');assert.equal(current.denominator_saar_divisor,'4');
 assert.equal(current.numerator_source_value,'-246023');assert.equal(current.denominator_source_value,'32,563,030');
 assert.equal(current.numerator_table_release_date,'2026-09-24');assert.equal(current.denominator_publication_date,'');
 assert.equal(current.numerator_retrieved_at,'2026-10-23T04:21:42.080Z');assert.equal(current.denominator_retrieved_at,'2026-10-23T02:56:31.625Z');
 assert.deepEqual(JSON.parse(current.denominator_provenance_json).map(row=>row.url),['https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt']);
 assert.match(current.calculation,/100 ×/);assert.match(current.license_url,/bea.gov/);assert.match(current.limitations,/revised/);
});

test('CSV preserves missing denominators and neutralizes untrusted metadata, with frozen view omitting live actions',()=>{
 const sources=copy();sources.bea.series.nominalGdp.observations=sources.bea.series.nominalGdp.observations.filter(row=>row.date!=='2026-04-01');
 sources.bea.series.nominalGdp.sourceTitle='=UNTRUSTED()';
 const [header,...rows]=parseCsv(view.currentAccountGdpCsv(sources)),current=Object.fromEntries(header.map((key,index)=>[key,rows.at(-1)[index]]));
 assert.equal(current.value_percent,'');assert.equal(current.denominator_saar_value,'');assert.equal(current.missing,'true');
 assert.equal(current.denominator_source_title,"'=UNTRUSTED()");
 const html=view.currentAccountGdpPanel(copy(),{frozen:true});assert.match(html,/FROZEN CURRENT ACCOUNT/);assert.doesNotMatch(html,/data-export-current-account-gdp/);assert.match(html,/recorded inputs/i);
 assert.doesNotMatch(html,/latest revised BEA|latest-quarter context/i);
});
