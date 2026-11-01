import test from 'node:test';
import assert from 'node:assert/strict';
import {series,dataStatus} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {researchPage} from '../src/research-page.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {requiredSourceIds} from '../src/source-controller.js';

const ids=['gdpInventoriesContribution','weeklyHours','netInterestTtm','privateDomesticDemandGrowth'];

test('Overview freezes each displayed diagnostic latest/prior reading and measurement evidence independently of later data',async()=>{
 const stamp='2026-10-30T12:00:00.000Z';
 const catalog={...series,...Object.fromEntries(ids.map((id,index)=>{
  const original=series[id],observations=original.observations.slice(-2).map((row,offset)=>({...row,value:9200+index*10+offset}));
  return [id,{...original,name:`Frozen diagnostic ${id}`,unit:`Captured unit ${id}`,definition:`Captured definition ${id}`,calculation:`Captured calculation ${id}`,fetchedAt:stamp,dataStatus:'cached',error:`Captured warning ${id}`,observations}];
 }))};
 const originals=Object.fromEntries(ids.map(id=>[id,series[id]]));
 const args=buildPinContext(parseRoute('#/overview'),{catalog,overviewPreview:'payroll',overviewChartSettings:{inflationFamily:'headline'}});
 assert.deepEqual(args.context.overviewComparisonCharts[0].series.map(row=>row.id),['payroll']);
 assert.ok(args.context.overviewComparisonCharts[1].series.every(row=>row.id.startsWith('headlinePce')));
 for(const id of ids){
  const captured=args.context.overviewTopicReadings.find(row=>row.id===id);
  assert.ok(captured,`${id} must remain in the generic frozen Overview readings`);
  for(const field of ['name','unit','frequency','adjustment','definition','observationType','calculation','fetchedAt','dataStatus','error','source','provenance'])assert.deepEqual(captured[field],catalog[id][field],`${id}: ${field}`);
  assert.deepEqual(captured.latest,catalog[id].observations.at(-1));
  assert.deepEqual(captured.prior,catalog[id].observations.at(-2));
 }
 assert.deepEqual(args.state.selected,['gdp','pceCoreMonthly','payroll','policyTargetUpper']);
 const pkg=await createResearchPackage({name:'Overview diagnostic sentinels',...args});
 const bytes=exportResearchPackage(pkg);
 try{
  for(const id of ids)series[id]={...series[id],name:`Current replacement ${id}`,unit:'Current replacement unit',observations:[{date:'2030-01-01',value:999999}]};
  for(const id of ids){catalog[id].observations.at(-1).value=-999999;catalog[id].definition='Changed after package creation';}
  const restored=await importResearchPackage(bytes);
  assert.equal(exportResearchPackage(restored),bytes);
  assert.deepEqual(restored.context.overviewTopicReadings,pkg.context.overviewTopicReadings);
  const html=researchPage({...parseRoute('#/research?view=packages'),packageId:restored.id},{library:{packages:[restored]}});
  for(const [index,id]of ids.entries()){
   const row=html.match(new RegExp(`<tr><th scope="row">Frozen diagnostic ${id}<[^]*?</tr>`))?.[0]??'';
   assert.ok(row.includes((9201+index*10).toLocaleString('en-US')),`${id} frozen latest value`);
   assert.ok(row.includes(`Captured unit ${id}`));
   assert.ok(row.includes(pkg.context.overviewTopicReadings.find(row=>row.id===id).latest.date));
  }
  assert.doesNotMatch(html,/Current replacement|999,999/);
 }finally{for(const id of ids)series[id]=originals[id];}
});

test('Overview core one-month diagnostic retains exact index endpoints independently of headline inflation chart controls',async()=>{
 const input={...series.pceCoreIndex,fetchedAt:'2026-10-30T15:00:00.000Z',dataStatus:'cached',error:'Captured core-index warning',observations:[
  {date:'2026-06-01',value:100,sourceValue:'100',publishedAt:null},
  {date:'2026-07-01',value:102,sourceValue:'102',publishedAt:null},
  {date:'2026-08-01',value:104,sourceValue:'104',publishedAt:null},
  {date:'2026-09-01',value:106,sourceValue:'106',publishedAt:null},
 ]};
 const catalog={...series,pceCoreIndex:input};
 const options={catalog,overviewPreview:'weeklyHours',overviewChartSettings:{growth:'10y',inflation:'3y',inflationFamily:'headline'}};
 const args=buildPinContext(parseRoute('#/overview'),options);
 const reading=args.context.overviewTopicReadings.find(row=>row.id==='corePce1m');
 assert.ok(reading,'the always-visible core diagnostic is retained separately from the selected chart family');
 assert.ok(args.context.overviewComparisonCharts.every(chart=>chart.series.every(row=>row.id!=='corePce1m')));
 assert.equal(reading.name,'Core PCE · 1-month annualized');
 assert.equal(reading.unit,'Percent · annual rate');assert.equal(reading.frequency,'Monthly');
 assert.equal(reading.observationType,'calculated');assert.equal(reading.adjustment,input.adjustment);
 assert.equal(reading.latest.value,100*((106/104)**12-1));
 assert.equal(reading.prior.value,100*((104/102)**12-1));
 assert.deepEqual(reading.latest.inputDates,['2026-08-01','2026-09-01']);
 assert.deepEqual(reading.latest.inputValues,[104,106]);
 assert.deepEqual(reading.prior.inputDates,['2026-07-01','2026-08-01']);
 assert.deepEqual(reading.prior.inputValues,[102,104]);
 assert.match(reading.calculation,/\^12/);assert.equal(reading.latest.calculation,reading.calculation);
 assert.equal(reading.latest.publishedAt,null);assert.equal(reading.prior.publishedAt,null);
 for(const field of ['fetchedAt','dataStatus','error','source','provenance'])assert.deepEqual(reading[field],input[field],field);
 const pkg=await createResearchPackage({name:'Core diagnostic with headline chart',...args});
 const bytes=exportResearchPackage(pkg);
 input.observations.at(-1).value=999999;
 const restored=await importResearchPackage(bytes);
 assert.deepEqual(restored.context.overviewTopicReadings.find(row=>row.id==='corePce1m'),pkg.context.overviewTopicReadings.find(row=>row.id==='corePce1m'));
 const html=researchPage({...parseRoute('#/research?view=packages'),packageId:restored.id},{library:{packages:[restored]}});
 assert.match(html,/Core PCE · 1-month annualized/);
 input.observations=input.observations.filter(row=>row.date!=='2026-08-01');
 const missing=buildPinContext(parseRoute('#/overview'),options).context.overviewTopicReadings.find(row=>row.id==='corePce1m');
 assert.equal(missing.latest.value,null);assert.deepEqual(missing.latest.inputValues,[null,999999]);
});

test('Overview retains the inventory-contribution source with strict source identities and unknown publication instants',async()=>{
 assert.ok(requiredSourceIds(parseRoute('#/overview'),{purpose:'freeze'}).includes('macroContributions'),'freezing loads complete contribution evidence before building the package');
 const args=buildPinContext(parseRoute('#/overview'));
 assert.deepEqual(args.context.moduleSources.macroContributions,dataStatus.sources.macroContributions);
 const pkg=await createResearchPackage({name:'Overview contribution evidence',...args});
 const restored=await importResearchPackage(exportResearchPackage(pkg));
 const source=restored.context.moduleSources.macroContributions;
 assert.deepEqual(source,dataStatus.sources.macroContributions);
 assert.doesNotThrow(()=>assertCommercialData({sources:{macroContributions:source}}));
 for(const mutate of [
  value=>{value.series.gdpInventoriesContribution.sourceIds=['A014RC'];},
  value=>{value.series.gdpInventoriesContribution.observations.at(-1).publishedAt='2026-10-30';},
 ]){
  const invalid=structuredClone(source);mutate(invalid);
  assert.throws(()=>assertCommercialData({sources:{macroContributions:invalid}}),/identifier|publication/i);
 }
});
