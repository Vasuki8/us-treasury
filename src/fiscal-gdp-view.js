import { fiscalGdpContext } from './economic-depth.js';
import { dataStatus } from './data.js';
import { tabularCsv } from './model.js';
import { supportingDetails } from './page-hierarchy.js';
import { panel,table,emptyState,button,escapeHtml as esc } from './ui.js';
const names={grossDebtToGdp:'Gross federal debt / nominal GDP',publicDebtToGdp:'Debt held by the public / nominal GDP',deficitToGdp:'Trailing-year budget deficit / nominal GDP',netInterestToGdp:'Trailing-year net budget interest / nominal GDP'};
export function fiscalGdpPanel(sources=dataStatus.sources){
 const result=fiscalGdpContext(sources);
 let body=emptyState('Fiscal GDP ratios unavailable.','A reviewed nominal GDP denominator and aligned numerator periods are required.');
 if(result){
  const ratios=Object.entries(names).map(([id,name])=>{
   const item=result[id],stock=id==='grossDebtToGdp'||id==='publicDebtToGdp';
   const period=stock?(item.numeratorDate??'Stock date not retained'):`${item.numeratorStart}–${item.numeratorEnd}`;
   const basis=stock?`Stock: ${period} / same-quarter nominal GDP SAAR`:`Flows: ${period} / actual trailing four-quarter nominal GDP`;
   return {name,item,period,basis};
  });
  const rows=ratios.map(({name,item,basis})=>`<tr><th scope="row">${esc(name)}<span class="fiscal-gdp-mobile-basis">${esc(basis)}</span></th><td class="num fiscal-gdp-value">${Number.isFinite(item.value)?item.value.toFixed(2)+'%':'Unavailable'}</td><td class="fiscal-gdp-basis">${esc(basis)}</td></tr>`).join('');
  const evidence=table(['DEFINED RATIO','NUMERATOR / DENOMINATOR','CALCULATION & RETRIEVALS'],ratios.map(({name,item,period})=>`<tr><th scope="row">${esc(name)}</th><td>${esc(period)} · ${esc(item.numeratorUnit)}<span class="table-code muted">Denominator: ${esc(item.denominatorUnit)} · ${esc((item.denominatorPeriods??[item.denominatorPeriod]).join('; '))}</span></td><td>${esc(item.formula)}<span class="table-code muted">Numerator retrieved ${esc(item.numeratorCapturedAt??'Unknown')}<br>GDP retrieved ${esc(item.denominatorCapturedAt??'Unknown')}</span></td></tr>`).join(''),'Fiscal ratio formulas, exact input periods and independent retrieval evidence')+`<p class="panel-note">${esc(result.notice)} Four GDP SAAR quarters are each divided by four before summing; fiscal flows are actual monthly dollars.</p>`;
  body=`<p class="panel-note">GDP reference quarter ${esc(result.quarterDate)} through ${esc(result.quarterEnd)} · latest revised observations, separate retrieval vintages.</p>${table(['DEFINED RATIO',{label:'PERCENT',numeric:true},'ALIGNED BASIS'],rows,'Four defined fiscal ratios with explicit stock-flow timing and nominal GDP denominator')}<p class="panel-note">Debt uses a same-quarter record within seven days of quarter end. Flow ratios use matching trailing-year fiscal and nominal GDP windows. These periods are separate from the newer retained readings above; no newer stock is divided by an old quarter without disclosure. Chained-dollar measures are never denominators.</p>${supportingDetails('fiscal:gdp-evidence','Calculation evidence · exact periods, formulas & retrievals',evidence)}`;
 }
 return panel('G','FISCAL SIZE RELATIVE TO NOMINAL GDP',body,button('CSV DEFINED RATIOS','data-export-fiscal-gdp'),'','fiscal-gdp-context');
}
export function fiscalGdpCsv(sources){
 const result=fiscalGdpContext(sources),provenance=Object.fromEntries(['treasury','fiscal','bea'].map(id=>[id,sources[id]?.provenance??[]]));
 return tabularCsv(['ratio','value_percent','observation_type','gdp_reference_quarter','quarter_end','numerator','numerator_value','numerator_unit','numerator_start','numerator_end_or_date','denominator_value','denominator_unit','denominator_periods','numerator_retrieved_at','denominator_retrieved_at','calculation','limitations','input_provenance_json'],result?Object.entries(names).map(([id,name])=>{const item=result[id],source=id==='grossDebtToGdp'?sources.treasury:sources.fiscal,key=id==='grossDebtToGdp'?'debt':'publicDebt',value=item.numeratorValue??source?.series?.[key]?.observations.find(row=>row.date===item.numeratorDate)?.value??null;return [name,item.value,'calculated',result.quarterDate,result.quarterEnd,item.numerator,value,item.numeratorUnit,item.numeratorStart??null,item.numeratorDate??item.numeratorEnd,item.denominator,item.denominatorUnit,(item.denominatorPeriods??[item.denominatorPeriod]).join(';'),item.numeratorCapturedAt,item.denominatorCapturedAt,item.formula,result.notice,JSON.stringify(provenance)];}):[]);
}
