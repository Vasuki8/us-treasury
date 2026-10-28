import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLaborEvidence,collectLaborEvidence} from '../scripts/sources/labor-evidence.mjs';
import {parsePcePriceContributions,collectPcePriceContributions} from '../scripts/sources/pce-price-contributions.mjs';
import {economicEvidenceCsv,economicEvidenceContext,renderLaborEvidence,renderPcePriceContributions,laborUncertaintyNote,pceContributionSummary,exactMonthlyChanges} from '../src/economic-evidence.js';
import {assertEconomicEvidenceSources} from '../scripts/economic-evidence-policy.mjs';
import {economicEvidenceSources} from '../src/economic-evidence-snapshot.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {economicEvidenceRegistry} from '../src/economic-evidence-registry.js';
import {comparisonClassification} from '../src/comparison-policy.js';
import {validateEconomicEvidenceContext,validatePceBaseEffectsContext} from '../src/economic-evidence-validation.js';
import {pceBaseEffectsContext} from '../src/pce-base-effects.js';
import {series as liveSeries} from '../src/data.js';
import {researchJsonCopy} from '../src/research-workspaces.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const ids=['CES0500000013','CES0500000012','CES0500000021','CES0500000022','CES0500000023'];
const payload=()=>({status:'REQUEST_SUCCEEDED',message:[],Results:{series:ids.map((seriesID,i)=>({seriesID,data:[{year:'2026',period:'M09',value:i<2?'11.24':'49.0',footnotes:[{code:'P',text:'preliminary'}]},{year:'2026',period:'M07',value:i<2?'11.20':'48.0',footnotes:[]}]}))}});
const bea='%SeriesCode,Period,Value\nDPCERGM,2026M08,0.3\nCE000885,2026M08,0.10\nCE000888,2026M08,0.21\nCE001177,2026M08,0.03\n';

test('labor parser retains native strings, preliminary flags and gaps without inventing monthly comparisons',()=>{
 const parsed=parseLaborEvidence(payload());
 assert.deepEqual(Object.keys(parsed.series),['realHourlyEarnings','realWeeklyEarnings','privateDiffusion1m','privateDiffusion3m','privateDiffusion6m']);
 const hourly=parsed.series.realHourlyEarnings;
 assert.equal(hourly.observations[1].sourceValue,'11.24');
 assert.deepEqual(hourly.observations[1].footnotes,[{code:'P',text:'preliminary'}]);
 assert.equal(hourly.observations[1].publishedAt,null);
 assert.equal(exactMonthlyChanges(hourly).monthly,null);
 assert.equal(exactMonthlyChanges(hourly).annual,null);
 assert.equal(parsed.series.privateDiffusion3m.horizonMonths,3);
 assert.match(hourly.definition,/CPI-U/);assert.match(hourly.definition,/composition/i);
});

test('labor parser fails closed on wrong families, duplicate periods and invalid diffusion bounds',()=>{
 let p=payload();p.Results.series[0].seriesID='CES0500000003';assert.throws(()=>parseLaborEvidence(p),/series/i);
 p=payload();p.Results.series[0].data.push(p.Results.series[0].data[0]);assert.throws(()=>parseLaborEvidence(p),/duplicate/i);
 p=payload();p.Results.series[2].data[0].value='101';assert.throws(()=>parseLaborEvidence(p),/diffusion/i);
 p=payload();p.Results.series[1].data[0].value='NaN';assert.throws(()=>parseLaborEvidence(p),/numeric/i);
});

test('independent collectors use their exact reviewed feeds, honest identity and actual response receipts without following redirects',async()=>{
 const calls=[],now=new Date('2026-10-28T12:00:00.000Z');
 const labor=await collectLaborEvidence({now,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(payload()));}});
 const pce=await collectPcePriceContributions({now,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(bea);}});
 assert.equal(calls[0].url,'https://api.bls.gov/publicAPI/v1/timeseries/data/');assert.equal(calls[0].options.redirect,'manual');
 assert.deepEqual(JSON.parse(calls[0].options.body),{seriesid:ids,startyear:'2017',endyear:'2026'});
 assert.equal(calls[1].url,'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt');assert.equal(calls[1].options.redirect,'manual');
 for(const {options}of calls)assert.match(options.headers['User-Agent'],/MeridianMacroResearch/);
 for(const source of [labor,pce]){assert.equal(source.provenance[0].retrievedAt,source.fetchedAt);assert.match(source.provenance[0].sha256,/^[a-f0-9]{64}$/);}
 for(const collect of [collectLaborEvidence,collectPcePriceContributions])await assert.rejects(collect({now,fetchImpl:async()=>new Response('',{status:302,headers:{location:'https://attacker.example/'}})}),/redirect/i);
});

test('PCE decomposition sums goods and services once and retains the published rounding residual',()=>{
 const source=parsePcePriceContributions(bea),summary=pceContributionSummary(source);
 assert.equal(summary.date,'2026-08-01');assert.equal(summary.total,.3);
 assert.equal(summary.sum,.31);assert.equal(summary.residual,-.01);
 assert.deepEqual(summary.components.map(row=>[row.id,row.value]),[['pceGoodsPriceContribution',.1],['pceServicesPriceContribution',.21]]);
 assert.equal(summary.housing,.03);assert.equal(source.series.pceHousingPriceContribution.parentContribution,'pceServicesPriceContribution');
 assert.equal(source.series.pcePriceGrowth.observations[0].publishedAt,null);
 assert.throws(()=>parsePcePriceContributions(bea.replace('0.21','0.51')),/reconciliation/i);
 assert.throws(()=>parsePcePriceContributions(bea.replace('CE000888','UNKNOWN')),/missing/i);
 const missing=parsePcePriceContributions(bea.replace('0.21','(NA)'));
 assert.equal(pceContributionSummary(missing).complete,false);assert.equal(pceContributionSummary(missing).sum,null);
});

test('working evidence capture passes scoped admission and exports full selected rows and receipts',()=>{
 assertEconomicEvidenceSources(economicEvidenceSources);
 for(const source of Object.values(economicEvidenceSources)){
  const csv=economicEvidenceCsv(source,{range:{preset:'custom',startDate:'2026-08-01',endDate:'2026-09-01'}});
  assert.match(csv,/source_value/);assert.match(csv,/capture_provenance_json/);assert.match(csv,/published_at/);
  assert.ok(csv.includes(source.provenance[0].sha256));assert.ok(csv.includes(source.provenance[0].retrievedAt));
  assert.doesNotMatch(csv,/2026-07-01/);
  const frozen=economicEvidenceContext(source,{range:{preset:'all'}});
  assert.equal(frozen.source.id,source.id);assert.equal(frozen.attachments[0].type,'text/csv');
  assert.notEqual(frozen.source,source);assert.deepEqual(frozen.source.provenance,source.provenance);
 }
 const changed=structuredClone(economicEvidenceSources);changed.laborEvidence.series.privateDiffusion1m.sourceIds=['CES0500000001'];assert.throws(()=>assertEconomicEvidenceSources(changed),/scope|identity/i);
 const forged=structuredClone(economicEvidenceSources);forged.pcePriceContributions.provenance[0].url='https://example.com/data.csv';assert.throws(()=>assertEconomicEvidenceSources(forged),/feed|receipt/i);
});

test('new source capture normalization preserves earnings population, diffusion horizon and contribution hierarchy for immutable replay',()=>{
 const vintages=recordVintages(undefined,{},economicEvidenceSources,{checkedAt:'2026-10-28T03:05:00.000Z',seriesMetadata:economicEvidenceRegistry});
 const replay=asKnownOn(vintages,'2026-10-28T03:05:00.000Z');
 assert.equal(replay.sources.laborEvidence.series.privateDiffusion3m.horizonMonths,3);
 assert.equal(replay.sources.laborEvidence.series.realHourlyEarnings.population,'All employees on total private nonfarm payrolls');
 assert.equal(replay.sources.pcePriceContributions.series.pceHousingPriceContribution.parentContribution,'pceServicesPriceContribution');
 assertCommercialData({sources:replay.sources});
 assert.equal(comparisonClassification(economicEvidenceRegistry.realHourlyEarnings),'level');
 assert.equal(comparisonClassification(economicEvidenceRegistry.privateDiffusion1m),'rate');
 assert.equal(comparisonClassification(economicEvidenceRegistry.pceGoodsPriceContribution),'contribution');
});

test('frozen economic validation rejects active URLs, forged scopes, invalid dates/values and invalid PCE recomputation',()=>{
 for(const source of Object.values(economicEvidenceSources)){
  const good=researchJsonCopy(economicEvidenceContext(source,{range:{preset:'all'}}));assert.equal(validateEconomicEvidenceContext(good),good);
  const id=Object.keys(good.source.series)[0];
  for(const mutate of [c=>{c.source.series[id].sourceUrl='javascript:alert(1)';},c=>{c.source.provenance[0].url='https://attacker.example/data';},c=>{c.source.series[id].observations[0].date='2026-02-30';},c=>{c.source.series[id].observations[0].value=Infinity;},c=>{c.source.series[id].sourceIds=['OTHER'];},c=>{c.source.series[id].unit='Wrong';},c=>{c.source.series[id].observations.push(c.source.series[id].observations[0]);}]){
   const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateEconomicEvidenceContext(bad),/Invalid frozen/);
  }
 }
 for(const id of ['pceIndex','pceCoreIndex']){
  const good=researchJsonCopy(pceBaseEffectsContext(liveSeries[id]));assert.equal(validatePceBaseEffectsContext(good),good);
  const altered=structuredClone(good);altered.model.rows[0].annualRate=999;assert.throws(()=>validatePceBaseEffectsContext(altered),/model differs/);
  const malicious=structuredClone(good);malicious.indexSeries.sourceUrl='javascript:alert(1)';assert.throws(()=>validatePceBaseEffectsContext(malicious),/identity/);
 }
});

test('a frozen historical chart window retains independent captured latest readings and deterministic selected CSV',()=>{
 const source=economicEvidenceSources.laborEvidence,range={preset:'custom',startDate:'2018-01-01',endDate:'2018-03-01'},context=researchJsonCopy(economicEvidenceContext(source,{range}));
 validateEconomicEvidenceContext(context);
 assert.equal(context.source.series.realHourlyEarnings.observations.at(-1).date,'2026-09-01');
 assert.match(renderLaborEvidence(context.source,{range:context.window,frozen:true}),/2026-09/);
 const csvRows=parseCsv(context.attachments[0].content).slice(1);assert.equal(csvRows.length,15);assert.deepEqual([...new Set(csvRows.map(row=>row[4]))],['2018-01-01','2018-02-01','2018-03-01']);
 assert.doesNotMatch(renderLaborEvidence(context.source,{range:context.window,frozen:true}),/data-export-economic-evidence/);
 const forged=structuredClone(context);forged.attachments[0].content+='forged row';assert.throws(()=>validateEconomicEvidenceContext(forged),/CSV differs/);
});

test('frozen contribution admission checks complete historical decompositions even when an attacker regenerates its CSV',()=>{
 for(const index of [0,-1]){
  const context=economicEvidenceContext(economicEvidenceSources.pcePriceContributions,{range:{preset:'all'}}),rows=context.source.series.pceGoodsPriceContribution.observations,row=rows.at(index);
  row.value=99;row.sourceValue='99.00';context.attachments[0].content=economicEvidenceCsv(context.source,{range:context.window});
  assert.throws(()=>validateEconomicEvidenceContext(context),/contribution reconciliation/);
 }
 const incomplete=economicEvidenceContext(economicEvidenceSources.pcePriceContributions,{range:{preset:'all'}});const row=incomplete.source.series.pceGoodsPriceContribution.observations.at(-1);row.value=null;row.sourceValue='(NA)';incomplete.attachments[0].content=economicEvidenceCsv(incomplete.source,{range:incomplete.window});
 assert.equal(validateEconomicEvidenceContext(incomplete),incomplete);assert.equal(pceContributionSummary(incomplete.source).complete,false);
});

test('frozen evidence requires the exact resolved window for its captured source and rejects conflicting mode/count or forged bounds',()=>{
 const context=researchJsonCopy(economicEvidenceContext(economicEvidenceSources.pcePriceContributions,{range:{preset:'1y'}}));validateEconomicEvidenceContext(context);
 for(const mutate of [c=>{c.window.mode='observations';c.window.count=1;},c=>{c.window.startDate='2024-01-01';},c=>{c.window.endDate='2025-12-01';},c=>{c.window.fullStartDate='1900-01-01';},c=>{c.window.fullEndDate='2099-01-01';},c=>{c.window.label='One observation';}]){
  const bad=structuredClone(context);mutate(bad);assert.throws(()=>validateEconomicEvidenceContext(bad),/window/i);
 }
 for(const range of [6,{preset:'observations',count:2},{preset:'custom',startDate:'2020-01-01',endDate:'2020-03-01'}])validateEconomicEvidenceContext(researchJsonCopy(economicEvidenceContext(economicEvidenceSources.pcePriceContributions,{range})));
});

test('labor evidence renders separate real earnings and diffusion units and valid charts; uncertainty is never applied to gain differences',()=>{
 const html=renderLaborEvidence();
 assert.match(html,/Real earnings/);assert.match(html,/1982/);assert.match(html,/CPI-U/);assert.match(html,/composition/);
 assert.match(html,/1-month span/);assert.match(html,/3-month span/);assert.match(html,/6-month span/);
 assert.match(html,/50/);assert.match(html,/not employment-weighted growth/);assert.match(html,/Preliminary/);
 assert.match(html,/data-chart-catalog="laborEvidence"/);assert.match(html,/<table/);assert.match(html,/data-export-economic-evidence="laborEvidence"/);
 assert.match(laborUncertaintyNote({observations:[{date:'2026-09-01',value:29,footnotes:['preliminary']}]}),/Preliminary/);
 const note=laborUncertaintyNote({observations:[]});assert.match(note,/sampling/);assert.match(note,/difference between two monthly job gains/);
 assert.doesNotMatch(note,/statistically significant increase|statistically significant decrease/);
 const pce=renderPcePriceContributions();assert.match(pce,/percentage points/);assert.match(pce,/not annualized/);assert.match(pce,/not added again/);assert.match(pce,/Rounding residual/);
});
