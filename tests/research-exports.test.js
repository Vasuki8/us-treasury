import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalFinancingCsv} from '../src/research-exports.js';
import {parseCsv} from '../scripts/sources/http.mjs';
test('financing export identifies calculated fields and preserves missing release times, cached status and source provenance',()=>{
  const source={status:'error',fetchedAt:'2026-10-22T02:30:00Z',coverageNote:'As recorded; later revisions may not be incorporated.',provenance:[{url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_2?fields=record_date'}],monthly:[{date:'2026-09-01',periodEnd:'2026-09-30',fiscalYear:2026,deficit:2,borrowingPublic:3,cashReduction:-2,otherFinancing:1,financingResidual:0,financingReconciliation:'reconciled-within-one-dollar'}]};
  const [headers,row]=parseCsv(fiscalFinancingCsv(source)),data=Object.fromEntries(headers.map((key,i)=>[key,row[i]]));
  assert.equal(data.financingResidual,'0');assert.equal(data.release_date,'');assert.equal(data.data_status,'cached');assert.equal(data.unit,'USD billions');assert.match(data.observation_type,/calculated/);assert.match(data.calculation,/residual/);assert.equal(data.source_url,source.provenance[0].url);assert.match(data.coverage_note,/revisions/);
});
