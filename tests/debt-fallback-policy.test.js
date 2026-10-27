import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {matchesResearchFeed} from '../scripts/research-policy.mjs';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {DTS_DEBT_NOTE} from '../src/debt-fallback.js';
import {registry} from '../src/registry.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

const primary='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt';
const pdf='https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250804.pdf';
const primaryValues={debt_held_public_amt:'29523300148538.85',intragov_hold_amt:'7314864649375.46',tot_pub_debt_out_amt:'36828164797914.31'};
const fallbackValues={debt_held_public_amt:'29523300',intragov_hold_amt:'7314865',tot_pub_debt_out_amt:'36838165'};
const primaryReceipt={url:primary,sha256:'a'.repeat(64),retrievedAt:'2026-10-27T03:00:00.000Z',lastModified:null};
const pdfReceipt={url:pdf,sha256:'2afa2b2497dc88fb4b14893681d127d651c868b7c3d46ad0c52455df7e6f5c9f',retrievedAt:'2026-10-27T03:00:01.000Z',lastModified:null};
const note=DTS_DEBT_NOTE;
function fixture(agency='treasury'){
 const id=agency==='treasury'?'debt':'publicDebt',field=agency==='treasury'?'tot_pub_debt_out_amt':'debt_held_public_amt';
 const row={date:'2025-08-04',value:agency==='treasury'?36.838165:29.5233,sourceValue:fallbackValues[field],publishedAt:null,sourceUnit:'USD millions',sourcePrecisionUSD:1000000,sourceSeriesId:agency==='treasury'?'DTS:IIIC:closing:gross':'DTS:IIIC:closing:public',sourceUrl:pdf,sourceSha256:pdfReceipt.sha256,retrievedAt:pdfReceipt.retrievedAt,reconciliation:'official-rounded-fallback',reconciliationResidualUSD:-10000000000,primarySourceValues:{...primaryValues},fallbackSourceValues:{...fallbackValues},inputProvenance:[{...primaryReceipt},{...pdfReceipt}],footnotes:[note]};
 const source={id:agency,fetchedAt:pdfReceipt.retrievedAt,provenance:[{...primaryReceipt},{...pdfReceipt}],series:{[id]:{sourceIds:[field],sourceUrl:primary,sourceUrls:[primary,pdf],fetchedAt:pdfReceipt.retrievedAt,provenance:[{...primaryReceipt},{...pdfReceipt}],observations:[row,{date:'2025-08-05',value:agency==='treasury'?36.84:29.53,publishedAt:null}]}}};
 if(agency==='fiscal')source.fiscal={debtBreakdown:[{...structuredClone(row),sourceValues:{...primaryValues},publicDebt:29.5233,intragovernmentalDebt:7.314865,grossDebt:36.838165}]};
 return source;
}
const admit=source=>assertCommercialData({sources:{[source.id]:source}});

test('reviewed rounded debt evidence is admitted for gross debt and fiscal public debt',()=>{
 for(const agency of ['treasury','fiscal'])assert.doesNotThrow(()=>admit(fixture(agency)),agency);
});

test('DTS feed admission permits only the exact reviewed PDF in the debt feed scopes',()=>{
 for(const feed of ['treasury-mts-fiscal','fiscal-public-debt'])assert.equal(matchesResearchFeed(pdf,feed),true,feed);
 for(const feed of ['fiscal-table9','treasury-mspd','treasury-auctions','research-par-yields'])assert.equal(matchesResearchFeed(pdf,feed),false,feed);
 for(const url of [pdf+'?',pdf+'?official=1',pdf+'#',pdf+'#page=3',pdf.replace('20250804','20250805'),pdf.replace('https://','https://user:password@'),pdf.replace('treasury.gov','treasury.gov:443'),pdf.replace('/dts/','/dts/../dts/')]){
  assert.equal(matchesResearchFeed(url,'treasury-mts-fiscal'),false,url);
  const source=fixture();source.series.debt.sourceUrls[1]=source.provenance[1].url=source.series.debt.provenance[1].url=url;
  assert.throws(()=>admit(source),/debt|fallback|provenance|feed/i,url);
 }
});

test('rounded debt admission rejects altered dates, values, precision, raw inputs and note',()=>{
 const changes=[
  ['date',row=>{row.date='2025-08-05';}],['number',row=>{row.value=36.82816479791431;}],['null',row=>{row.value=null;}],
  ['cents disguised as millions',row=>{row.sourceValue='36838165000000';}],['unit',row=>{row.sourceUnit='USD dollars';}],['precision',row=>{row.sourcePrecisionUSD=0.01;}],
  ['field',row=>{row.sourceSeriesId='tot_pub_debt_out_amt';}],['publication time',row=>{row.publishedAt='2025-08-04T20:00:00.000Z';}],
  ['primary components',row=>{row.primarySourceValues.intragov_hold_amt='7314864649375.45';}],['primary gross',row=>{row.primarySourceValues.tot_pub_debt_out_amt='36838164797914.31';}],
  ['rounded inputs',row=>{row.fallbackSourceValues.intragov_hold_amt='7314864';}],['residual sign',row=>{row.reconciliationResidualUSD=10000000000;}],
  ['marker',row=>{row.reconciliation='reconciled';}],['note',row=>{row.footnotes=['Exact debt to the penny.'];}],['no note',row=>{delete row.footnotes;}],
  ['hash',row=>{row.sourceSha256='b'.repeat(64);}],['clock',row=>{row.retrievedAt=primaryReceipt.retrievedAt;}],['no raw inputs',row=>{delete row.primarySourceValues;}],
  ['receipt override',row=>{row.inputProvenance=[{...pdfReceipt}];}],['row URL override',row=>{row.sourceUrls=[pdf];}],
  ['stripped fallback metadata',row=>{for(const key of Object.keys(row))if(!['date','value','publishedAt'].includes(key))delete row[key];}],
 ];
 for(const [label,mutate]of changes){const source=fixture();mutate(source.series.debt.observations[0]);assert.throws(()=>admit(source),/debt|fallback|provenance/i,label);}
});

test('rounded debt admission binds pinned PDF evidence to measurement and root clocks and receipt scope',()=>{
 const changes=[
  ['hash changed consistently',source=>{source.provenance[1].sha256=source.series.debt.provenance[1].sha256=source.series.debt.observations[0].inputProvenance[1].sha256=source.series.debt.observations[0].sourceSha256='b'.repeat(64);}],
  ['missing root PDF',source=>{source.provenance.pop();}],['duplicate root PDF',source=>{source.provenance.push({...pdfReceipt});}],
  ['missing series PDF',source=>{source.series.debt.provenance.pop();}],['missing series receipts',source=>{delete source.series.debt.provenance;}],
  ['undeclared PDF',source=>{delete source.series.debt.sourceUrls;}],['duplicate declared PDF',source=>{source.series.debt.sourceUrls.push(pdf);}],
  ['PDF used as primary',source=>{source.series.debt.sourceUrl=pdf;}],['future root receipt',source=>{source.provenance[1].retrievedAt='2026-10-27T03:00:02.000Z';}],
  ['invented measurement clock',source=>{source.series.debt.fetchedAt=primaryReceipt.retrievedAt;}],['invalid clock',source=>{source.provenance[1].retrievedAt='not-a-date';}],
  ['extra response body',source=>{source.provenance[1].body='copied report';}],['unrelated row evidence',source=>{source.series.debt.observations[0].inputProvenance[0].sha256='c'.repeat(64);}],
 ];
 for(const [label,mutate]of changes){const source=fixture();mutate(source);assert.throws(()=>admit(source),/debt|fallback|provenance/i,label);}
});

test('the PDF cannot become an unrelated series or an unbound supporting receipt',()=>{
 const source=fixture();source.series={yield:{sourceIds:['BC_10YEAR'],sourceUrl:pdf,observations:[{date:'2025-08-04',value:4}]}};
 assert.throws(()=>admit(source),/debt|fallback|provenance|feed/i);
 const unbound=fixture();delete unbound.series.debt.sourceUrls;delete unbound.series.debt.provenance;unbound.series.debt.observations=[{date:'2025-08-05',value:36.84,publishedAt:null}];
 assert.throws(()=>admit(unbound),/debt|fallback|provenance/i);
});

test('row URL lists and input receipts cannot move stripped DTS values to an unreviewed date',()=>{
 for(const evidence of [{sourceUrls:[pdf]},{inputProvenance:[{...primaryReceipt},{...pdfReceipt}]},{provenance:[{...pdfReceipt}]}]){
  const source=fixture();
  source.series.debt.observations=[{date:'2025-08-05',value:36.838165,sourceValue:'36838165',sourceUnit:'USD millions',sourcePrecisionUSD:1000000,publishedAt:null,...evidence}];
  assert.throws(()=>admit(source),/debt|fallback|provenance/i,JSON.stringify(evidence));
 }
});

test('fiscal composition retains the primary strings and coherent rounded balance row',()=>{
 for(const mutate of [row=>{row.sourceValues.tot_pub_debt_out_amt='36838164797914.31';},row=>{row.publicDebt=29.52330014853885;},row=>{row.intragovernmentalDebt=7.31486464937546;},row=>{row.grossDebt=36.82816479791431;},row=>{row.sourceUnit='USD dollars';},row=>{row.footnotes=[];}]){
  const source=fixture('fiscal');mutate(source.fiscal.debtBreakdown[0]);assert.throws(()=>admit(source),/debt|fallback|provenance/i);
 }
 const selected=fixture('fiscal');selected.series.publicDebt.observations=selected.series.publicDebt.observations.filter(row=>row.date!=='2025-08-04');
 for(const key of Object.keys(selected.fiscal.debtBreakdown[0]))if(!['date','publicDebt','intragovernmentalDebt','grossDebt','sourceValues'].includes(key))delete selected.fiscal.debtBreakdown[0][key];
 assert.throws(()=>admit(selected),/debt|fallback|provenance/i);
 const unbound=fixture('fiscal');unbound.series={};unbound.provenance=[];
 assert.throws(()=>admit(unbound),/debt|fallback|provenance/i);
});

test('normalized and selected debt sources retain truthful receipts without requiring omitted history',()=>{
 for(const agency of ['treasury','fiscal']){
  const source=fixture(agency),history=recordVintages(null,{}, {[agency]:source},{checkedAt:source.fetchedAt});
  const restored=asKnownOn(history,source.fetchedAt).sources[agency];
  assert.equal(restored.fiscal,undefined);
  assert.doesNotThrow(()=>assertCommercialData({sources:{[agency]:restored},vintages:history}));
  const id=agency==='treasury'?'debt':'publicDebt';restored.series[id].observations=restored.series[id].observations.filter(row=>row.date!=='2025-08-04');
  assert.doesNotThrow(()=>admit(restored));
 }
});

test('legacy debt sources remain admitted without acquiring the rounded exception',()=>{
 for(const agency of ['treasury','fiscal']){
  const source=fixture(agency),id=agency==='treasury'?'debt':'publicDebt';
  source.fetchedAt=primaryReceipt.retrievedAt;source.provenance=[{...primaryReceipt}];delete source.fiscal;
  source.series[id]={sourceUrl:primary,sourceIds:[agency==='treasury'?'tot_pub_debt_out_amt':'debt_held_public_amt'],observations:[{date:'2025-08-04',value:null,publishedAt:null,sourceValue:primaryValues[agency==='treasury'?'tot_pub_debt_out_amt':'debt_held_public_amt'],reconciliation:'source-residual-quarantined',reconciliationResidualUSD:-10000000000}]};
  assert.doesNotThrow(()=>admit(source));
  source.series[id].observations[0].primarySourceValues={...primaryValues};
  assert.doesNotThrow(()=>admit(source));
 }
});

test('a raw primary conflict without PDF evidence stays missing instead of admitting a rounded number',()=>{
 const source=fixture();source.provenance=[{...primaryReceipt}];source.fetchedAt=primaryReceipt.retrievedAt;
 source.series.debt={sourceUrl:primary,sourceIds:['tot_pub_debt_out_amt'],observations:[{date:'2025-08-04',value:36.838165,publishedAt:null,sourceValue:'36828164797914.31',reconciliation:'source-residual-quarantined',primarySourceValues:{...primaryValues},reconciliationResidualUSD:-10000000000}]};
 assert.throws(()=>admit(source),/debt|fallback|provenance/i);
 source.series.debt.observations[0].value=null;
 assert.doesNotThrow(()=>admit(source));
});

test('selected portable packages omit the repaired date while preserving admissible measurement receipts',async()=>{
 for(const agency of ['treasury','fiscal']){
  const source=fixture(agency),id=agency==='treasury'?'debt':'publicDebt';delete source.fiscal;
  source.series[id].observations=source.series[id].observations.filter(row=>row.date!=='2025-08-04');
  const item={...registry[id],...source.series[id],agency,source:{...registry[id].source,seriesIds:source.series[id].sourceIds}};
  const pkg=await createResearchPackage({name:'Selected debt inputs',state:{selected:[id],window:'all'},catalog:{[id]:item},sources:{[agency]:source},context:{page:'indicator',moduleSources:{[agency]:source}},now:source.fetchedAt});
  const exported=exportResearchPackage(pkg),restored=await importResearchPackage(exported);
  assert.equal(exportResearchPackage(restored),exported);
  const selected=restored.context.moduleSources[agency];
  assert.deepEqual(selected.series[id].observations.map(row=>row.date),['2025-08-05']);
  assert.doesNotThrow(()=>admit(selected));
 }
});
