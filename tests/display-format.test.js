import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {formatValue,formatChange} from '../src/model.js';
import {metrics,seriesTable,chart} from '../src/ui.js';

const display=await import('../src/display-format.js').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND'&&error.message.includes('display-format.js'))return {};
  throw error;
});
const amount=(values,format='billions')=>({format,unit:`USD ${format}`,observations:values.map(value=>({value}))});

test('ordinary dollar wages retain a raw dollar unit instead of fractional thousands',()=>{
  const wages={format:'number',unit:'Dollars per paid hour',observations:[{value:37.56}]};
  assert.equal(display.formatDisplayValue(wages,37.56),'$37.6');
  assert.equal(display.displayCurrencyUnit([wages]),'');
  assert.equal(display.formatDisplayValue(wages,-.00142),'−$0.00142');
  assert.equal(display.displayUnitLabel(wages),'Dollars per paid hour');
  const smallAmount={format:'billions',unit:'USD billions per month',observations:[{value:.0000000142}]};
  assert.equal(display.formatDisplayValue(smallAmount,.0000000142),'$14.2');
  assert.equal(display.displayUnitLabel(smallAmount),'USD per month');
});
const value=(...args)=>{
  assert.equal(typeof display.formatDisplayValue,'function','shared display formatter must exist');
  return display.formatDisplayValue(...args);
};

test('currency headlines share a selected unit and retain three significant figures',()=>{
  const receipts=amount([5403.21]),debt=amount([32.68],'trillions');
  assert.equal(typeof display.displayCurrencyUnit,'function');
  const currencyUnit=display.displayCurrencyUnit([receipts,debt]);
  assert.equal(currencyUnit,'T');
  assert.equal(value(receipts,5403.21,{currencyUnit}),'$5.40T');
  assert.equal(value(debt,32.68,{currencyUnit}),'$32.7T');
  assert.equal(value(receipts,.351,{currencyUnit}),'$0.000351T');
});

test('currency signs precede the symbol and rounded zero has no sign',()=>{
  const money=amount([]),options={currencyUnit:'B',change:true};
  assert.equal(value(money,-14.234,options),'−$14.2B');
  assert.equal(value(money,14.234,options),'+$14.2B');
  assert.equal(value(money,-0,options),'$0.00B');
  assert.equal(value({format:'basisPoints'},-.1,{change:true}),'0 bp');
  for(const missing of [null,undefined,NaN,Infinity,-Infinity])assert.equal(value(money,missing),'—');
});

test('currency scale selection respects native input scales without treating counts as dollars',()=>{
  assert.equal(typeof display.displayCurrencyUnit,'function');
  assert.equal(display.displayCurrencyUnit([amount([-1.2])]),'B');
  assert.equal(display.displayCurrencyUnit([amount([.351])]),'M');
  assert.equal(display.displayCurrencyUnit([amount([.000351])]),'K');
  assert.equal(display.displayCurrencyUnit([{format:'millions',unit:'Millions of openings',observations:[{value:8}]}]),undefined);
  assert.equal(value({format:'millions',unit:'Millions of openings'},7.456),'7.46M');
  assert.equal(value({format:'thousands',unit:'Thousands of jobs'},142.56),'143k');
  assert.equal(value({format:'percent'},62.639),'62.6%');
  assert.equal(value({format:'basisPoints'},37.8),'38 bp');
});

test('display changes preserve measurement semantics and never mutate inputs',()=>{
  const money=amount([5417.444,5403.21]);
  const original=JSON.stringify(money);
  assert.equal(typeof display.formatDisplayChange,'function');
  assert.equal(display.formatDisplayChange(money,{currencyUnit:'B'}),'−$14.2B');
  assert.equal(display.formatDisplayChange({format:'percent',observations:[{value:4.2},{value:4.58}]}),'+0.38 pp');
  assert.equal(display.formatDisplayChange({id:'yield',format:'percent',observations:[{value:4.2},{value:4.58}]}),'+38 bp');
  assert.equal(display.formatDisplayChange(amount([2,null])),'—');
  assert.equal(display.formatDisplayChange(amount([2])),'—');
  assert.equal(JSON.stringify(money),original);
  assert.equal(formatValue({format:'billions',precision:2},5403.21),'$5,403.21B');
  assert.equal(formatChange({format:'percent',precision:1,observations:[{value:4.1},{value:4.2}]}),'+0.1 pp');
});

test('generic headlines use a common display unit while source table precision stays native',()=>{
  const id='displayFormatFixture';
  series[id]={...series.debt,...amount([5417.444,5403.21]),id,short:'Receipt fixture',precision:2};
  try{
    const html=metrics([id,'debt'],{currencyUnit:'T'});
    assert.match(html,/\$5\.40T/);
    assert.match(html,/−\$0\.0142T/);
    assert.match(seriesTable([id]),/\$5,403\.21B/);
    assert.match(metrics([id]),/\$5\.40T/);
  }finally{delete series[id];}
});

test('omitted chart windows follow source frequency while explicit observation counts remain exact',()=>{
  assert.match(chart(['payroll']),/data-range="\{&quot;preset&quot;:&quot;5y&quot;\}"/);
  assert.match(chart(['yield']),/data-range="\{&quot;preset&quot;:&quot;1y&quot;\}"/);
  assert.match(chart(['payroll'],{range:12}),/data-range="12"/);
});

test('display unit labels keep the native monetary and temporal qualifiers',()=>{
  assert.equal(typeof display.displayUnitLabel,'function');
  const spending={format:'billions',unit:'Billions of chained 2017 dollars (SAAR)'};
  assert.equal(display.displayUnitLabel(spending,{currencyUnit:'T'}),'Trillions of chained 2017 dollars (SAAR)');
  const id='displayLabelFixture';
  series[id]={...series.debt,...amount([5403.21]),id,short:'Receipt fixture',precision:2};
  try{
    assert.match(metrics([id],{currencyUnit:'T',showBasis:true}),/metric-basis">[^<]*USD trillions/);
  }finally{delete series[id];}
});
