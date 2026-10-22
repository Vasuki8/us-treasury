import {tabularCsv} from './model.js';
export function fiscalFinancingCsv(source={}){
  const keys=['date','periodEnd','fiscalYear','deficit','borrowingPublic','cashReduction','otherFinancing','financingResidual','financingReconciliation'];
  const sourceUrl=source.provenance?.find(item=>item.url.includes('/mts_table_2?'))?.url??'';
  return tabularCsv([...keys,'unit','retrieved_at','data_status','observation_type','source','source_url','release_date','calculation','coverage_note'],(source.monthly??[]).map(row=>[...keys.map(key=>row[key]),'USD billions',source.fetchedAt,source.status==='ok'?'official':'cached','Official financing lines; calculated deficit and source residual','U.S. Treasury Fiscal Data MTS table 2',sourceUrl,null,'Deficit = outlays - receipts. Source residual = deficit - borrowingPublic - cashReduction - otherFinancing. Other amounts are reported monthly actuals.',source.coverageNote]));
}
