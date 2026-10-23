import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMacroContributions} from '../scripts/sources/macro-contributions.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {gdpContributionSummary,validateContributionQuarter} from '../src/macro-contributions.js';
import {economicDepthRegistry} from '../src/economic-depth-registry.js';

const url='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const values={A191RL:2.2,DPCERY:2.51,A006RY:.82,A822RY:-.01,A020RY:.56,A021RY:-1.66,A007RY:1.28,A014RY:-.46,DGDSRY:1.01,DSERRY:1.5};
const fixture=overrides=>'%SeriesCode,Period,Value\n'+Object.entries({...values,...overrides}).map(([code,value])=>`${code},2026Q2,${value}`).join('\n');
const expected=[['gdpFixedInvestmentContribution','A007RY','fixedInvestment',1.28],['gdpInventoriesContribution','A014RY','inventories',-.46],['gdpConsumptionGoodsContribution','DGDSRY','consumptionGoods',1.01],['gdpConsumptionServicesContribution','DSERRY','consumptionServices',1.5]];
test('published GDP subcomponents preserve exact values and remain outside the top-level contribution sum',()=>{
  const result=parseMacroContributions(fixture());
  for(const [id,code,key,value]of expected){
    assert.equal(result.series[id]?.observations[0].value,value,id);
    assert.equal(result.quarterly[0][key],value,key);
    assert.deepEqual(result.series[id].sourceIds,[code]);
    assert.equal(result.series[id].observations[0].sourceValue,String(value));
    assert.equal(result.series[id].observations[0].publishedAt,null);
    assert.equal(result.series[id].observationType,'official');
    assert.equal(economicDepthRegistry[id]?.comparisonClass,'contribution');
    assert.equal(economicDepthRegistry[id]?.agency,'macroContributions');
    assert.equal(economicDepthRegistry[id]?.unit,'Percentage points q/q annualized');
  }
  assert.equal(result.quarterly[0].complete,true);
  assert.ok(Math.abs(result.quarterly[0].reconciliationResidual+.02)<1e-12);
  const summary=gdpContributionSummary(result);
  assert.equal(summary.components.length,5,'nested contributions cannot be counted as extra top-level components');
  assert.equal(summary.contributionSum,2.22);
  assert.equal(summary.components.find(row=>row.id==='imports').value,-1.66);
});

test('missing subcomponents stay missing without changing a complete headline decomposition or older captures',()=>{
  const result=parseMacroContributions(fixture({A014RY:'(NA)',DGDSRY:'(NA)'}));
  assert.equal(result.series.gdpInventoriesContribution?.observations[0].value,null);
  assert.equal(result.quarterly[0].consumptionGoods,null);
  assert.equal(result.quarterly[0].complete,true);
  const old={date:'2026-04-01',total:2.2,consumption:2.51,investment:.82,government:-.01,exports:.56,imports:-1.66};
  assert.equal(validateContributionQuarter(old).complete,true);
  assert.equal(gdpContributionSummary({quarterly:[old]}).contributionSum,2.22);
  assert.doesNotThrow(()=>assertCommercialData({sources:{macroContributions:{series:{gdpInvestmentContribution:{sourceIds:['A006RY'],sourceUrl:url}}}}}));
  assert.throws(()=>parseMacroContributions(fixture().replace('A007RY,2026Q2,1.28','')),/missing.*A007RY/i);
});

test('GDP subcomponent admission restricts exact fields, quarterly feed, provenance and unavailable publication instants',()=>{
  const captured=()=>({sources:{macroContributions:{...parseMacroContributions(fixture()),provenance:[{url,sha256:'a'.repeat(64)}]}}});
  assert.doesNotThrow(()=>assertCommercialData(captured()));
  for(const mutate of [s=>s.sources.macroContributions.series.gdpInventoriesContribution.sourceIds=['A014RC'],s=>s.sources.macroContributions.series.gdpFixedInvestmentContribution.sourceUrl=url.replace('NipaDataQ','NipaDataM'),s=>s.sources.macroContributions.provenance=[],s=>s.sources.macroContributions.series.gdpConsumptionGoodsContribution.observations[0].publishedAt='2026-09-30']){
    const data=captured();mutate(data);assert.throws(()=>assertCommercialData(data),/identifier|feed|provenance|publication/i);
  }
});
