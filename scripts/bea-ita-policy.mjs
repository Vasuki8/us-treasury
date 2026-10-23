import {currentAccountDefinitions,currentAccountRegistry,BEA_ITA_URL,BEA_ITA_LICENSE,itaLocator} from '../src/current-account-registry.js';
import {isIsoDate} from '../src/date-window.js';
const fail=message=>{throw new Error(`Unreviewed BEA ITA data: ${message}`);};
export const beaItaPolicy={id:'bea-ita-current-account',agency:'beaIta',reviewedOn:'2026-10-23',commercialUse:true,
 basis:'BEA public-domain agency-authored Table 1.1 statistical balances; scoped commercial display, calculation and CSV redistribution with attribution; no branding/endorsement',
 terms:[BEA_ITA_LICENSE,'https://www.bea.gov/help/guidelines-for-citing-bea'],feed:'bea-ita-table11',
 series:Object.fromEntries(currentAccountDefinitions.map(([id,line])=>[id,[itaLocator(line)]])),
};
export const matchesBeaItaFeed=(value,feed)=>feed==='bea-ita-table11'&&value===BEA_ITA_URL;
export function itaSourceNumber(input){
 if(typeof input!=='string')fail('source number must retain its original string');
 const value=input.trim();
 if(!value||/^\.+$/.test(value)||['n.a.','(D)','(*)'].includes(value))return null;
 if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))fail('invalid source number');
 const parsed=Number(value.replaceAll(',',''));if(!Number.isFinite(parsed))fail('nonfinite source number');return parsed;
}
export function itaQuarterEnd(date){
 if(!isIsoDate(date)||!/^\d{4}-(?:01|04|07|10)-01$/.test(date))fail('invalid quarter-start date');
 const [year,month]=date.split('-').map(Number);
 return new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10);
}
export function assertItaReconciliation(series){
 const maps=Object.fromEntries(Object.entries(series).map(([id,item])=>[id,new Map(item.observations.map(row=>[row.date,itaSourceNumber(row.sourceValue)]))]));
 for(const {date} of series.currentAccountBalance.observations){
  const value=id=>maps[id]?.get(date);
  for(const [total,parts,tolerance] of [['currentAccountBalance',['itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'],2],['currentAccountBalance',['itaGoodsServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'],2],['itaGoodsServicesBalance',['itaGoodsBalance','itaServicesBalance'],1]]){
   const inputs=[value(total),...parts.map(value)];
   if(inputs.every(Number.isFinite)&&Math.abs(inputs[0]-inputs.slice(1).reduce((a,b)=>a+b,0))>tolerance+1e-8)fail('published balance reconciliation exceeds source rounding');
  }
 }
}
export function assertBeaItaData(snapshot){
 const source=snapshot.sources?.beaIta;if(!source)return;
 if(!source.fetchedAt&&!Object.keys(source.series??{}).length)return;
 if(source.id!=='beaIta'||!isIsoDate(source.tableReleaseDate)||!isIsoDate(source.nextReleaseDate)||source.nextReleaseDate<=source.tableReleaseDate||source.tableReleaseDate>String(source.fetchedAt).slice(0,10))fail('table release date metadata');
 if(!Array.isArray(source.provenance)||source.provenance.length!==1||source.provenance.some(row=>row.url!==BEA_ITA_URL||!/^[a-f0-9]{64}$/.test(row.sha256)||row.retrievedAt!==source.fetchedAt||!Number.isFinite(Date.parse(row.retrievedAt))))fail('original response provenance');
 if(Object.keys(source.series??{}).length!==currentAccountDefinitions.length)fail('required six balance series');
 let dates=null;
 for(const [id,line] of currentAccountDefinitions){
  const item=source.series?.[id],definition=currentAccountRegistry[id];if(!item)fail(`required balance ${id}`);
  for(const key of ['unit','frequency','adjustment','dateConvention','periodType','comparisonClass','observationType'])if(item[key]!==definition[key])fail(`measurement unit/annualization/identity ${id}/${key}`);
  if(item.sourceUnit!=='Millions of dollars'||item.sourceUrl!==BEA_ITA_URL||JSON.stringify(item.sourceIds)!==JSON.stringify([itaLocator(line)])||item.licenseUrl!==BEA_ITA_LICENSE||!item.attribution?.includes('U.S. Bureau of Economic Analysis')||!item.calculation?.includes('1000')||!item.publicationNote?.includes(source.tableReleaseDate))fail(`balance source/rights/definition ${id}`);
  if(!Array.isArray(item.observations)||!item.observations.length)fail(`empty balance ${id}`);
  const ownDates=[];let previous='';
  for(const row of item.observations){
   if(itaQuarterEnd(row.date)>source.tableReleaseDate||row.date<=previous||row.sourcePeriodLabel!==`${row.date.slice(0,4)}Q${(Number(row.date.slice(5,7))+2)/3}`)fail('quarter date or original period label');
   if(row.publishedAt!==null||!Array.isArray(row.footnotes)||row.footnotes.some(note=>typeof note!=='string'))fail('publication date or source notes');
   const raw=itaSourceNumber(row.sourceValue);if(row.value!==(raw===null?null:raw/1000))fail('balance value does not match original source millions');
   ownDates.push(row.date);previous=row.date;
  }
  if(dates&&JSON.stringify(ownDates)!==JSON.stringify(dates))fail('incompatible balance quarter calendars');dates=ownDates;
 }
 assertItaReconciliation(source.series);
}
