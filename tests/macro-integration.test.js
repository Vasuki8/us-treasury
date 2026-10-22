import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {getSeries,formatValue,toCsv} from '../src/model.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
test('macro route and contribution units distinguish percent from percentage points',()=>{
 assert.equal(parseRoute('#/macro').page,'macro');assert.equal(routeFor({page:'macro'}),'#/macro');
 assert.equal(formatValue(getSeries('gdpTotalContribution'),2.2),'2.2%');assert.equal(formatValue(getSeries('gdpConsumptionContribution'),2.51),'2.51 pp');
 assert.match(toCsv(['gdpConsumptionContribution']),/Percentage points/);
});
test('macro admission scopes published BEA codes to the quarterly contribution input',()=>{
 const series={sourceIds:['DPCERY'],sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt'};
 assert.doesNotThrow(()=>assertCommercialData({sources:{macroContributions:{series:{gdpConsumptionContribution:series}}}}));
 for(const change of [{sourceIds:['A002RY']},{sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt'}])assert.throws(()=>assertCommercialData({sources:{macroContributions:{series:{gdpConsumptionContribution:{...series,...change}}}}}));
 assert.throws(()=>assertCommercialData({sources:{macroContributions:{cpiCategoryEffects:{observations:[{date:'2026-09-01',value:0.2}]}}}}),/CPI effects/);
});
