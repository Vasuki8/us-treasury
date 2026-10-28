import test from 'node:test';
import assert from 'node:assert/strict';
import {economicEvidenceSources} from '../src/economic-evidence-snapshot.js';
import {renderLaborEvidence,renderPcePriceContributions} from '../src/economic-evidence.js';
import {relevantRefreshIds} from '../src/research-status.js';
import {series} from '../src/data.js';
test('new source failures stay visible beside retained readings and in affected-view freshness',()=>{
 for(const [id,render,page,macroFamily]of [['laborEvidence',renderLaborEvidence,'labor','labor'],['pcePriceContributions',renderPcePriceContributions,'macroCoverage','prices']]){
  const source={...economicEvidenceSources[id],status:'error',error:'HTTP 503 <retained>'},html=render(source,{range:12});
  const prefix=html.slice(0,html.indexOf('<details'));
  assert.match(prefix,/role="status"/);assert.match(prefix,/HTTP 503 &lt;retained&gt;/);assert.ok(prefix.includes(source.fetchedAt));
  assert.ok(relevantRefreshIds({page,macroFamily,macroMeasure:'cpiMonthly'},series).includes('data:'+id));
 }
});
