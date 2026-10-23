import test from 'node:test';
import assert from 'node:assert/strict';
import {zipFixture} from './helpers/zip.mjs';
import * as source from '../scripts/sources/credit-context.mjs';
import {assertCreditContextData} from '../scripts/credit-context-policy.mjs';
import {creditContextRegistry} from '../src/credit-context-registry.js';
import {creditContextCsv,creditContextPage} from '../src/credit-context-page.js';
const now=new Date('2026-10-22T22:00:00Z');
const obs=(date,value)=>`<frb:Obs OBS_STATUS="A" OBS_VALUE="${value}" TIME_PERIOD="${date}" />`;
const frame=(id,rows)=>`<message:MessageGroup><message:Header><message:ID>${id}</message:ID></message:Header><kf:DataSet>${rows}</kf:DataSet></message:MessageGroup>`;
function dsr(){return frame('DSR',[
  ['DSR_RATIO','Debt service ratio, seasonally adjusted','11.111439'],['MORTGAGE_DSR_RATIO','Mortgage debt service ratio, seasonally adjusted','5.829946'],['CONSUMER_DSR_RATIO','Consumer debt service ratio, seasonally adjusted','5.281493'],
].map(([code,label,value])=>`<kf:Series CURRENCY="NA" DEBT="TOTAL" FREQ="162" SERIES_NAME="${code}" TYPE="DSR" UNIT="Percent" UNIT_MULT="1"><frb:Annotations><common:Annotation><common:AnnotationType>Short Description</common:AnnotationType><common:AnnotationText>${label}</common:AnnotationText></common:Annotation></frb:Annotations>${obs('2026-06-30',value)}</kf:Series>`).join(''));}
function del(){return frame('CHGDEL',[
  ['CONCC','STFBQDCC%STFBAILCC_XEOP_MA.Q','2.85'],['RERES','STFBQDSS%STFBAILSS_XEOP_XDO_MA.Q','1.86'],
].map(([loan,code,value])=>`<kf:Series CHGDEL="DEL" COMPONENT="RATIO" CURRENCY="NA" FREQ="162" LOANTYPE="${loan}" SA="SA" SERIES_NAME="${code}" SIZE="ALL" UNIT="Percentage" UNIT_MULT="1">${obs('2026-06-30',value)}</kf:Series>`).join(''));}

test('current-methodology DSR preserves published aggregate ratios with exact quarter dates and no vintage splicing',()=>{
  assert.equal(typeof source.parseHouseholdDebtXml,'function','Reviewed DSR parser must exist');
  const parsed=source.parseHouseholdDebtXml(dsr(),{now});
  assert.equal(parsed.householdDebtService.observations[0].value,11.111439);
  assert.equal(parsed.mortgageDebtService.observations[0].value,5.829946);
  assert.equal(parsed.consumerDebtService.observations[0].value,5.281493);
  assert.equal(parsed.householdDebtService.observations[0].date,'2026-06-30');assert.equal(parsed.householdDebtService.observations[0].publishedAt,null);
  assert.match(parsed.householdDebtService.coverageNote,/2005/);assert.match(parsed.mortgageDebtService.coverageNote,/escrow/);
  for(const text of [dsr().replace('UNIT="Percent"','UNIT="Currency"'),dsr().replace('TYPE="DSR"','TYPE="FOR"'),dsr().replaceAll('2026-06-30','2004-12-31'),dsr().replaceAll('2026-06-30','2026-06-29'),dsr().replace('Debt service ratio, seasonally adjusted','Debt service ratio, not seasonally adjusted')])assert.throws(()=>source.parseHouseholdDebtXml(text,{now}),/Board|metadata|date|inception|adjustment|description/i);
});

test('bank delinquency ratios keep loan-dollar denominators and reject chargeoffs, top100, NSA and impossible percentages',()=>{
  assert.equal(typeof source.parseLoanDelinquencyXml,'function','Reviewed bank delinquency parser must exist');
  const parsed=source.parseLoanDelinquencyXml(del(),{now});
  assert.equal(parsed.bankCardDelinquency.observations[0].value,2.85);assert.equal(parsed.bankMortgageDelinquency.observations[0].value,1.86);
  assert.match(parsed.bankMortgageDelinquency.coverageNote,/thirty|30/);assert.equal(parsed.bankCardDelinquency.observations[0].publishedAt,null);
  for(const text of [del().replace('CHGDEL="DEL"','CHGDEL="CHG"'),del().replace('SIZE="ALL"','SIZE="TOP100"'),del().replace('SA="SA"','SA="NSA"'),del().replace('2.85','101')])assert.throws(()=>source.parseLoanDelinquencyXml(text,{now}),/Board|metadata|percentage|numeric/i);
});

test('household collectors preserve distinct source contracts, rates, provenance and export definitions',async()=>{
  assert.equal(typeof source.collectHouseholdDebt,'function');assert.equal(typeof source.collectLoanDelinquency,'function');
  const householdDebt=await source.collectHouseholdDebt({now,fetchImpl:async url=>{assert.equal(url,'https://www.federalreserve.gov/releases/dsr/data/FRB_dsr_xml.zip');return new Response(zipFixture([{name:'DSR_data.xml',text:dsr()}]));}});
  const loanDelinquency=await source.collectLoanDelinquency({now,fetchImpl:async url=>{assert.equal(url,'https://www.federalreserve.gov/releases/chgdel/data/FRB_CHGDEL_xml.zip');return new Response(zipFixture([{name:'CHGDEL_data.xml',text:del()}]));}});
  const sources={householdDebt,loanDelinquency};assert.doesNotThrow(()=>assertCreditContextData({sources}));
  for(const id of ['householdDebtService','mortgageDebtService','consumerDebtService','bankCardDelinquency','bankMortgageDelinquency'])assert.equal(creditContextRegistry[id].comparisonClass,'rate');
  const bad=structuredClone(sources);bad.householdDebt.methodology='old-dsr-1980';assert.throws(()=>assertCreditContextData({sources:bad}),/methodology|credit/i);
  const csv=creditContextCsv(sources);assert.match(csv,/DSR_RATIO/);assert.match(csv,/STFBQDCC%STFBAILCC_XEOP_MA.Q/);assert.match(csv,/Percent of disposable personal income/);assert.match(csv,/Percent of end-of-quarter loans/);
  const html=creditContextPage(sources,{documents:[]});assert.match(html,/metric-value">11\.11%/);assert.match(html,/metric-value">2\.85%/);
});
