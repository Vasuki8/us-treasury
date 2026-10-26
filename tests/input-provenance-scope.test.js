import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';

test('data mapping preserves explicit receipt-selection opt-in and leaves legacy series unmarked',async()=>{
 const previous=snapshot.sources.yields;
 const legacy={...previous.series.spread2s10s};delete legacy.inputProvenanceScope;
 snapshot.sources.yields={...previous,series:{...previous.series,
  realYield10:{...previous.series.realYield10,inputProvenanceScope:'observation-source-urls'},
  spread2s10s:legacy,
 }};
 try{
  const {series}=await import('../src/data.js?receipt-selection-opt-in');
  assert.equal(series.realYield10.inputProvenanceScope,'observation-source-urls');
  assert.equal(series.spread2s10s.inputProvenanceScope,undefined);
 }finally{snapshot.sources.yields=previous;}
});
