import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSeries,toCsv} from '../src/model.js';
import {parseRoute,routeFor} from '../src/router.js';
import {viewRange} from '../src/workspace-context.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage} from '../src/research-packages.js';

const s=(id,dateConvention,periodType,observations)=>({id,name:id,short:id,code:id,agency:'test',dateConvention,periodType,frequency:'Quarterly',unit:'USD billions',format:'billions',precision:1,comparisonClass:'amount',adjustment:'Unadjusted',source:{name:'Test',url:'https://example.com',seriesIds:[id]},observations:observations.map(([date,value])=>({date,value}))});
const catalog={flow:s('flow','quarter-start','flow',[['2025-01-01',10],['2025-04-01',12]]),stock:s('stock','quarter-end','stock',[['2025-03-31',20],['2025-06-30',30]])};
const range={preset:'all',alignment:'quarter'};
test('explicit quarter baseline keeps original dates and stock/flow semantics',()=>{
 assert.match(compareSeries(['flow','stock'],'indexed',{preset:'all'},catalog).error,/exact shared date/);
 const result=compareSeries(['flow','stock'],'indexed',range,catalog);
 assert.equal(result.error,null);
 assert.deepEqual(result.panels.map(p=>p.baselineDate),['2025-01-01','2025-03-31']);
 assert.deepEqual(result.panels.map(p=>p.baselinePeriod),['2025Q1','2025Q1']);
 assert.deepEqual(result.panels.map(p=>p.observations.at(-1).value),[120,150]);
 assert.equal(result.panels[1].observations.at(-1).date,'2025-06-30');
 assert.match(toCsv(['flow','stock'],{range,comparison:'indexed',catalog}),/reference_quarter/);
});
test('quarter matching rejects survey rounds, undeclared conventions and duplicate quarter rows',()=>{
 for(const override of [{dateConvention:'survey-round'},{dateConvention:undefined},{frequency:'Monthly'},{observations:[{date:'2025-01-01',value:10},{date:'2025-02-01',value:11}]}]){
  assert.match(compareSeries(['flow','stock'],'difference',range,{...catalog,flow:{...catalog.flow,...override}}).error,/declared|quarter|Quarterly/);
 }
});
test('quarter mode survives route and frozen package round trip',async()=>{
 const state={page:'explore',exploreMode:'compare',selected:['nominalGdp','foreignTreasuryHoldings'],comparison:'indexed',alignment:'quarter',window:'all'};
 assert.equal(parseRoute(routeFor(state)).alignment,'quarter');
 assert.equal(viewRange(state).alignment,'quarter');
 const pkg=await createResearchPackage({name:'Quarter baseline',state:{...state,selected:['flow','stock']},catalog,sources:{},snapshot:{}});
 const reopened=await importResearchPackage(exportResearchPackage(pkg));
 assert.equal(reopened.panels[1].baselineDate,'2025-03-31');
 assert.equal(reopened.request.range.alignment,'quarter');
});
