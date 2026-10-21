import test from 'node:test';
import assert from 'node:assert/strict';
import { zipFixture } from './helpers/zip.mjs';
import { collectCensus, parseCensusCsv as parse } from '../scripts/sources/census.mjs';
const now=new Date('2026-10-21T12:00:00Z');
const usage='Data Usage and Attribution\n==========================\nAll products developed using these data files must attribute the datasource as the U.S. Census Bureau and must contain the originating program name.\nContacts\n';
function csv({periods=['1,Jun-2026','2,Jul-2026','3,Aug-2026','4,Sep-2026'],rows=['1,7,4,0,9,1,100.00','2,7,4,0,9,1,125.00','3,7,4,0,9,1,100.00','4,7,4,0,9,1,110.00']}={}) {
  return ['CATEGORIES','cat_idx,cat_code,cat_desc,cat_indent','7,44X72,"44X72: Retail Trade and Food Services",0','8,44000,Retail only,0','','DATA TYPES','dt_idx,dt_code,dt_desc,dt_unit','4,SM,Sales - Monthly,MLN$','5,MPCSM,Sales - Monthly Percent Change,PCT','','ERROR TYPES','et_idx,err_code,err_desc,err_unit','1,E_SM,CV of Sales,PCT','','GEO LEVELS','geo_idx,geo_code,geo_desc','9,US,U.S. Total','','TIME PERIODS','per_idx,per_name',...periods,'','NOTES','"Latest month is an advance estimate, subject to revision."','','DATA UPDATED ON','Thursday, 15-Oct-26 07:31:23 EDT','','DATA','per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val',...rows,'4,8,4,0,9,1,999','4,7,4,0,9,0,999','4,7,0,1,9,1,999','4,7,5,0,9,1,10'].join('\r\n');
}

test('Census resolves metadata IDs and calculates exact monthly change with original inputs', () => {
  const result=parse(csv(),{now});
  assert.equal(result.observations.length,4);
  assert.equal(result.observations[0].value,null);
  assert.equal(result.observations[1].value,25);
  assert.ok(Math.abs(result.observations[2].value+20)<1e-10);
  const latest=result.observations.at(-1);
  assert.ok(Math.abs(latest.value-10)<1e-10);
  assert.equal(latest.date,'2026-09-01');assert.equal(latest.sourceValue,'110.00');
  assert.equal(latest.baseDate,'2026-08-01');assert.equal(latest.baseValue,'100.00');assert.equal(latest.publishedAt,null);
  assert.match(latest.footnotes.join(' '),/advance|revis/i);
  assert.equal(result.fileUpdatedAt,'Thursday, 15-Oct-26 07:31:23 EDT');
});

test('Census missing months, suppressed sales and zero denominator produce no invented growth', () => {
  const result=parse(csv({periods:['1,Apr-2026','2,Jun-2026','3,Jul-2026','4,Aug-2026','5,Sep-2026'],rows:['1,7,4,0,9,1,100','2,7,4,0,9,1,100','3,7,4,0,9,1,0','4,7,4,0,9,1,20','5,7,4,0,9,1,(S)']}),{now});
  assert.deepEqual(result.observations.map(row=>row.value),[null,null,-100,null,null]);
  assert.equal(result.observations.at(-1).sourceValue,'(S)');
  assert.equal(result.observations.at(-2).baseValue,'0');
});

test('Census rejects the wrong dataset/schema, duplicates and invalid selected values', () => {
  for(const input of [csv().replace('44X72','WRONG'),csv().replace('MLN$','PCT'),csv().replace('9,US,','9,OTHER,'),csv().replace('per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val','wrong,header'),csv().replace('4,7,4,0,9,1,110.00','4,7,4,0,9,1,oops'),csv()+'\n4,7,4,0,9,1,111']) {
    assert.throws(()=>parse(input,{now}),/Census|metadata|header|duplicate|numeric/i);
  }
});

test('Census filters future periods then retains 36 observations after calculating growth', () => {
  const periods=[],rows=[];
  for(let index=0;index<40;index++) {
    const date=new Date(Date.UTC(2023,index,1));
    periods.push(`${index+1},${date.toLocaleString('en-US',{month:'short',timeZone:'UTC'})}-${date.getUTCFullYear()}`);
    rows.push(`${index+1},7,4,0,9,1,${100+index}`);
  }
  const result=parse(csv({periods,rows}),{now:new Date('2026-03-15T00:00:00Z')});
  assert.equal(result.observations.length,36);assert.equal(result.observations[0].date,'2023-04-01');
  assert.ok(result.observations[0].value!==null);assert.equal(result.observations.at(-1).date,'2026-03-01');
  assert.ok(!result.observations.at(-1).footnotes.some(note=>/advance estimate/i.test(note)));
});

test('Census collector returns snapshot provenance and required program attribution from official ZIP', async () => {
  const bytes=zipFixture([{name:'MARTS-mf.csv',text:csv()},{name:'/README',text:usage}]);
  const result=await collectCensus({now,fetchImpl:async url=>{assert.equal(url,'https://www.census.gov/econ_getzippedfile/?programCode=MARTS');return new Response(bytes);}});
  assert.equal(result.id,'census');assert.deepEqual(result.series.retail.sourceIds,['MARTS:44X72:SM:US:SA']);
  assert.equal(result.series.retail.dataStatus,'official');assert.match(result.series.retail.attribution,/U.S. Census Bureau.*Advance Monthly Retail Trade Survey/);
  assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);assert.equal(result.provenance[0].fileUpdatedAt,'Thursday, 15-Oct-26 07:31:23 EDT');
  assert.match(result.provenance[0].usageNote,/originating program name/);assert.ok(!('bytes' in result.provenance[0]));
});

test('Census source failure or invalid ZIP rejects instead of manufacturing observations', async () => {
  await assert.rejects(collectCensus({now,fetchImpl:async()=>new Response('blocked',{status:503})}),/503/);
  await assert.rejects(collectCensus({now,fetchImpl:async()=>new Response('<html>Missing Key</html>')}),/ZIP|archive/i);
});
