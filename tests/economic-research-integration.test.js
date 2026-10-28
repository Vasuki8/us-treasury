import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageAttachments} from '../src/research-packages.js';
import {researchPage} from '../src/research-page.js';
import {parseRoute,routeFor} from '../src/router.js';
import {buildPceBaseEffects} from '../src/pce-base-effects.js';
import {researchJsonCopy} from '../src/research-workspaces.js';

test('conditional PCE controls survive deep links and freeze exact indexes, assumptions and modeled rows',async()=>{
 const state={page:'macroCoverage',macroFamily:'prices',macroMeasure:'pceMonthly',window:'1y',pceBaseIndex:'pceCoreIndex',pceMonthlyRate:.25,pceHorizonMonths:6,pceTargetAnnualRate:2.1};
 const restored=parseRoute(routeFor(state));
 assert.equal(restored.pceMonthlyRate,.25);assert.equal(restored.pceHorizonMonths,6);assert.equal(restored.pceBaseIndex,'pceCoreIndex');
 const pkg=await createResearchPackage({name:'Conditional inflation',...buildPinContext(restored)});
 const frozen=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(frozen.context.pceBaseEffects.model,JSON.parse(JSON.stringify(buildPceBaseEffects(frozen.context.pceBaseEffects.indexSeries,{monthlyRate:.25,horizonMonths:6,targetAnnualRate:2.1}))));
 assert.equal(frozen.context.pceBaseEffects.model.rows.length,6);assert.equal(frozen.context.pceBaseEffects.model.rows[0].observationType,'modeled');
 assert.ok(Number.isFinite(frozen.context.pceBaseEffects.model.rows[0].rollingOutMonthlyRate));
 assert.ok(researchPackageAttachments(frozen).some(file=>file.name==='pce-base-effects.csv'));
 const html=researchPage({researchView:'packages',packageId:frozen.id},{library:{packages:[frozen]}});
 assert.match(html,/Conditional PCE base effects/);assert.match(html,/Frozen assumptions/);
 assert.doesNotMatch(html,/id="pce-monthly-rate"|data-export-pce-base-effects|data-export-economic-evidence/);
 assert.match(html,/data-chart-catalog="pceBaseEffects"/);
});
test('labor source evidence freezes its selected window, preliminary flags and original receipt without borrowing current data',async()=>{
 const state={page:'labor',macroMeasure:'payroll',window:'1y'},pkg=await createResearchPackage({name:'Labor evidence',...buildPinContext(state)}),frozen=await importResearchPackage(exportResearchPackage(pkg));
 const capture=frozen.context.economicEvidence.laborEvidence;
 assert.equal(capture.source.series.realHourlyEarnings.unit,series.realHourlyEarnings.unit);
 assert.ok(capture.source.provenance[0].sha256);assert.ok(capture.source.series.realHourlyEarnings.observations.at(-1).footnotes.length);
 const html=researchPage({researchView:'packages',packageId:frozen.id},{library:{packages:[frozen]}});
 assert.match(html,/data-chart-catalog="laborEvidence"/);assert.doesNotMatch(html,/data-export-economic-evidence/);
});
test('downloaded source and conditional CSV attachments must match the nested validated frozen evidence',async()=>{
 for(const name of ['pce-base-effects.csv','pcePriceContributions.csv']){
  const args=buildPinContext({page:'macroCoverage',macroFamily:'prices',macroMeasure:'pceMonthly',window:'1y'});
  args.context=researchJsonCopy(args.context);
  args.context.attachments.find(file=>file.name===name).content='scenario,value\r\nWrong,999\r\n';
  await assert.rejects(createResearchPackage({name:'Mismatched attachment',...args}),/economic evidence attachment/);
 }
});
