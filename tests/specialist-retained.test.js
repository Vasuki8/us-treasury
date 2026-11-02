import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {specialistDeskChartCatalog,specialistDeskCsv,fxScenario} from '../src/specialist-desks.js';
import {specialistDeskPage} from '../src/specialist-desks-page.js';
import {parseCsv} from '../scripts/sources/http.mjs';
const retained=await import('../src/specialist-retained.js').catch(()=>({}));
const fixture=async id=>JSON.parse(await readFile(new URL(`./fixtures/market-desks/${id}-candidate.json`,import.meta.url),'utf8'));
const series=(id,values,unit='Percent')=>({id,name:id,unit,frequency:'Monthly',observations:values.map(([date,value])=>({date,value}))});

test('dealer default plots all four retained signed sectors in USD billions',async()=>{
 const source=await fixture('dealerDetails'),html=specialistDeskPage({page:'dealers'},{sources:{dealerDetails:source},catalog:{}});
 assert.match(html,/data-series="dealerNetCoupons,dealerNetBills,dealerNetAgencyMbs,dealerNetTips"/);
 assert.match(html,/Signed Wednesday stocks/);
});

test('SOFR fan is bound to retained percentiles and ON RRP table shows accepted volume/date without a fixing',()=>{
 const sofr=series('sofr',[['2026-10-30',3.9]]);Object.assign(sofr.observations[0],{percentile1:3.8,percentile25:3.88,percentile75:3.93,percentile99:4.1});
 const sources={sofr:{id:'sofr',series:{sofr}},onRrp:{id:'onRrp',series:{onRrpAccepted:series('onRrpAccepted',[['2026-10-30',4.375]],'USD billions')}}};
 const html=specialistDeskPage({page:'money',specialistView:'fan'},{sources,catalog:{}});
 assert.match(html,/data-kind="funding-distribution"/);assert.match(html,/data-chart-catalog="specialist"/);
 const rrp=html.match(/<th scope="row">Fed ON RRP accepted operation<\/th>([^]*?)<\/tr>/)?.[1];assert.ok(rrp);assert.match(rrp,/4\.375/);assert.match(rrp,/2026-10-30/);assert.match(rrp,/Not a transaction fixing/);assert.doesNotMatch(rrp,/3\.90%/);
});

test('current refunding composition matches announcement month and keeps missing tenors empty',async()=>{
 assert.equal(typeof retained.refundingPackageComposition,'function');const source=await fixture('refunding'),before=JSON.stringify(source),composition=retained.refundingPackageComposition(source);
 assert.equal(composition.date,'2026-08-05');assert.equal(composition.period,'Aug-26');assert.deepEqual(composition.rows.map(r=>r.value),[58,42,25]);assert.equal(composition.total,125);assert.match(composition.sourceUrl,/sb0590$/);assert.equal(composition.receipts.length,1);assert.equal(JSON.stringify(source),before);
 const incomplete=structuredClone(source);incomplete.tables.couponTable.rows.find(r=>r.period==='Aug-26').values[4]=null;const gap=retained.refundingPackageComposition(incomplete);assert.equal(gap.rows[1].value,null);assert.equal(gap.total,null);
 const wrong=structuredClone(source);wrong.tables.policyDate='2027-02-03';assert.equal(retained.refundingPackageComposition(wrong).total,null);
});

test('read-only borrowing actuals require exact quarterly language, values, date and matching document receipt',async()=>{
 assert.equal(typeof retained.retainedBorrowingActuals,'function');const source=await fixture('refunding'),before=JSON.stringify(source),actual=retained.retainedBorrowingActuals(source);
 assert.equal(actual.rows.length,1);assert.deepEqual(actual.rows[0].period,'April–June 2026');assert.equal(actual.rows[0].endDate,'2026-06-30');assert.equal(actual.rows[0].borrowing,190);assert.equal(actual.rows[0].closingCash,919);assert.equal(actual.rows[0].observationType,'official-actual');assert.equal(actual.receipts.length,1);assert.match(actual.sourceUrl,/sb0584$/);assert.equal(JSON.stringify(source),before);
 for(const text of ['During the July–September 2026 quarter, Treasury expects to borrow $739 billion in privately-held net marketable debt, assuming an end-of-September cash balance of $950 billion.','During the April–July 2026 quarter, Treasury borrowed $190 billion in privately-held net marketable debt and ended the quarter with a cash balance of $919 billion.']){const other=structuredClone(source);other.documents.borrowing=text;assert.equal(retained.retainedBorrowingActuals(other).rows.length,0);}
 const missing=structuredClone(source);missing.provenance=[];assert.equal(retained.retainedBorrowingActuals(missing).rows.length,0);assert.match(retained.retainedBorrowingActuals(missing).coverage,/receipt/i);
});

test('refunding view and CSV expose current composition and retained actual with exact provenance and missing decomposition',async()=>{
 const source=await fixture('refunding'),sources={treasuryRefunding:source},html=specialistDeskPage({page:'refunding'},{sources,catalog:{}}),rows=parseCsv(specialistDeskCsv(sources,{page:'refunding'},{retainedViews:true}));
 assert.match(html,/Current announced package composition/);assert.match(html,/April–June 2026 · official actual/);assert.match(html,/\$190\.00B/);assert.match(html,/\$919\.00B/);
 const actual=rows.find(r=>r[0]==='retained-document-actual');assert.ok(actual);assert.equal(actual[4],'2026-06-30');assert.equal(actual[6],'190');assert.equal(actual[10],'official-actual');assert.match(actual[12],/sb0584$/);assert.ok(actual[13]);const metadata=JSON.parse(actual[16]);assert.equal(metadata.closingCash,919);assert.equal(metadata.somaRunoff,null);
 const components=rows.filter(r=>r[0]==='package-component');assert.deepEqual(components.map(r=>Number(r[6])),[58,42,25]);assert.ok(components.every(r=>r[4]==='2026-08-05'&&r[12].endsWith('sb0590')));
});

test('TIPS adds percent par compensation and retained staff-model forward/liquidity controls',async()=>{
 const source=JSON.parse(await readFile(new URL('./fixtures/market-desks/yields-curve-excerpt.json',import.meta.url),'utf8')),sources={yields:source,dkwInflation:await fixture('dkwInflation')},html=specialistDeskPage({page:'tips'},{sources,catalog:{}}),curve=source.curveHistory.at(-1),spread=curve.nominal['10Y']-curve.real['10Y'];
 assert.match(html,/class="specialist-curve-compensation"/);assert.ok(html.includes(`10Y · ${spread}% · ${curve.date}`));assert.doesNotMatch(html,new RegExp(`10Y · ${spread*100}%`));
 for(const [key,ids]of [['forward','dkwInflationComp5f5,dkwInflationExpected5f5,dkwInflationRisk5f5'],['liquidity','dkwTipsLiquidity5,dkwTipsLiquidity10,dkwTipsLiquidity5f5']])assert.ok(specialistDeskPage({page:'tips',specialistView:key},{sources,catalog:{}}).includes(`data-series="${ids}"`));
});

test('wedge reference lines use one exact retained sample, preserve null gaps and export their full sample basis',()=>{
 const sources={bls:{id:'bls',series:{cpiCore:series('cpiCore',[['2025-01-01',3],['2025-02-01',null],['2025-03-01',4]])}},bea:{id:'bea',series:{pceCore:series('pceCore',[['2025-01-01',2],['2025-02-01',3],['2025-03-01',4]])}}};
 const c=specialistDeskChartCatalog(sources,{catalog:{}}).specialist.catalog;assert.ok(c.coreCpiPceWedgeMean);assert.deepEqual(c.coreCpiPceWedgeMean.observations.map(r=>r.value),[-50,null,-50]);assert.deepEqual(c.coreCpiPceWedgeUpper.observations.map(r=>r.value),[0,null,0]);assert.deepEqual(c.coreCpiPceWedgeLower.observations.map(r=>r.value),[-100,null,-100]);assert.equal(c.coreCpiPceWedgeMean.sample.count,2);assert.equal(c.coreCpiPceWedgeMean.sample.startDate,'2025-01-01');
 const rows=parseCsv(specialistDeskCsv(sources,{page:'wedge',specialistRange:'MAX'},{retainedViews:true})),mean=rows.find(r=>r[2]==='coreCpiPceWedgeMean');assert.ok(mean);assert.match(mean[16],/sample/);assert.match(mean[16],/2025-01-01/);
});

test('Fed cut comparison preserves dated USD/ECB anchors and the active foreign shock while BoJ context remains explicitly unavailable',async()=>{
 const sources={ecbPolicy:await fixture('ecbPolicy'),ecbFx:await fixture('ecbFx'),fedFx:await fixture('fedFx'),policyRates:{id:'policyRates',series:{policyTargetUpper:series('policyTargetUpper',[['2026-10-30',4]])}}},state={page:'fxBasis',fxScenario:'fed-cut',fxFedShock:-50,fxForeignShock:-25,fxHorizon:6},html=specialistDeskPage(state,{sources,catalog:{}}),post=fxScenario(sources,state);
 assert.match(html,/Pre-cut vs post-cut reference comparison/);assert.match(html,/USD anchor · 2026-10-30/);assert.match(html,/3\.50%/);assert.ok(html.includes(post.forwardReference.toFixed(5)));
 const divergence=specialistDeskPage({...state,fxScenario:'policy-divergence'},{sources,catalog:{}});assert.match(divergence,/BoJ policy-divergence context unavailable/);assert.match(divergence,/EUR\/USD · USD\/ECB reference calculator/);
 const exported=specialistDeskCsv(sources,state,{retainedViews:true});assert.match(exported,/fxPreCutReferenceForward/);assert.match(exported,/fxPostCutReferenceForward/);assert.match(exported,/fxReferenceForwardDelta/);
});

test('malformed retained refunding dates and missing FX anchors stay unavailable',async()=>{
 const source=await fixture('refunding');source.tables.policyDate='2026-99-01';source.tables.borrowingDate='2026-99-01';assert.equal(retained.refundingPackageComposition(source).total,null);assert.equal(retained.retainedBorrowingActuals(source).rows.length,0);
 const html=specialistDeskPage({page:'fxBasis',fxScenario:'fed-cut'},{sources:{},catalog:{}}),comparison=html.slice(html.indexOf('Pre-cut vs post-cut reference comparison'),html.indexOf('Cross-currency basis dynamics'));assert.ok(comparison);assert.doesNotMatch(comparison,/<td[^>]*>0\.0 bp<\/td>/);
});

test('retained statement parsing rejects malformed evidence and conflicting completed-quarter values',async()=>{
 const source=await fixture('refunding'),invalid=structuredClone(source);invalid.documents.borrowing={text:'Not a retained statement string'};assert.equal(retained.retainedBorrowingActuals(invalid).rows.length,0);
 const conflict=structuredClone(source);conflict.documents.borrowing+=' During the April–June 2026 quarter, Treasury borrowed $191 billion in privately-held net marketable debt and ended the quarter with a cash balance of $919 billion.';assert.equal(retained.retainedBorrowingActuals(conflict).rows.length,0);assert.match(retained.retainedBorrowingActuals(conflict).coverage,/ambiguous|conflict/i);
 const duplicate=structuredClone(source);duplicate.tables.couponTable.rows.push({...duplicate.tables.couponTable.rows.find(r=>r.period==='Aug-26'),values:[69,99,70,44,42,16,25,28]});assert.equal(retained.refundingPackageComposition(duplicate).total,null);
});

test('SEP prior comparisons and QT policy status disclose evidence absent from retained captures',async()=>{
 const sep=await fixture('fedSep'),qt=await fixture('fedQt');const fomc=specialistDeskPage({page:'fomc'},{sources:{fedSep:sep},catalog:{}}),balance=specialistDeskPage({page:'qt'},{sources:{fedQt:qt},catalog:{}});
 assert.match(fomc,/Prior-vintage values unavailable in retained capture/);assert.match(balance,/Dated QT policy regime unavailable/);assert.match(balance,/implementation note|policy text/);assert.doesNotMatch(balance,/Runoff ceased|December 1, 2025/);
});

test('unversioned frozen exports preserve baseline CSV bytes while new retained records require explicit opt-in',async()=>{
 // SHA256 of b38e172's actual exports for these retained fixture maps and states.
 const checks=[
  [{treasuryRefunding:await fixture('refunding')},{page:'refunding'},'bc6721b1a6222a28a69bbfa8a5dd7cb6e1daa18af97b42b88e40f4b67766ee22'],
  [{bls:{id:'bls',series:{cpiCore:series('cpiCore',[['2025-01-01',3],['2025-02-01',null],['2025-03-01',4]])}},bea:{id:'bea',series:{pceCore:series('pceCore',[['2025-01-01',2],['2025-02-01',3],['2025-03-01',4]])}}},{page:'wedge',specialistRange:'MAX'},'e73c5cef5f841c73f7fde21b73504264d9ee37295daa6f3492620e008f3b064f'],
  [{ecbPolicy:await fixture('ecbPolicy'),ecbFx:await fixture('ecbFx'),fedFx:await fixture('fedFx'),policyRates:{id:'policyRates',series:{policyTargetUpper:series('policyTargetUpper',[['2026-10-30',4]])}}},{page:'fxBasis',fxScenario:'fed-cut',fxFedShock:-50,fxForeignShock:-25,fxHorizon:6},'c52253fd58bf3540c101c20f4ee2a584eac13ac0f7282c15dd645c576d8dbfc0'],
 ];
 for(const [sources,state,hash]of checks){const before=JSON.stringify(sources),legacy=specialistDeskCsv(sources,state);assert.equal(createHash('sha256').update(legacy).digest('hex'),hash,state.page);assert.equal(specialistDeskCsv(sources,state,{retainedViews:false}),legacy);assert.notEqual(specialistDeskCsv(sources,state,{retainedViews:true}),legacy);assert.equal(JSON.stringify(sources),before);}
});
