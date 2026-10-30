import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationChanged,parseRoute} from '../src/router.js';
import {laborPage} from '../src/labor-page.js';
import {series} from '../src/data.js';

test('catalog paging starts a destination while filter typing remains an in-place update',()=>{
 const first=parseRoute('#/explore'),second={...first,catalogPage:2};
 assert.equal(destinationChanged(first,second),true);
 assert.equal(destinationChanged(second,{...second,catalogPage:1,query:'GDP'}),false);
 assert.equal(destinationChanged(first,{...first,query:'GDP'}),false);
});

test('Labor keeps ordinary capture-stitching prose in a closed disclosure below analysis',()=>{
 const original=series.payroll;
 const note='Capture stitching sentinel: retained from dated source captures with a ten-year retrieval window.';
 try{
  series.payroll={...original,coverageNote:note};
  const html=laborPage({macroMeasure:'payroll'}),history=html.split('class="labor-history"')[1]?.split('class="labor-aside"')[0];
  const first=history.indexOf(note),disclosure=history.lastIndexOf('<details',first);
  assert.ok(first>0&&disclosure>=0,'Complete capture prose is retained in a closed source disclosure.');
  const open=history.lastIndexOf('<details',first),close=history.lastIndexOf('</details>',first);
  assert.ok(open>close,'The prose stays inside its disclosure.');
  assert.ok(!history.slice(open,history.indexOf('>',open)).includes(' open'));
 }finally{series.payroll=original;}
});
