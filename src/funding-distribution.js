import {resolveDateWindow} from './date-window.js';
import {transformSeries} from './model.js';

export const FUNDING_RATE_IDS=Object.freeze(['sofr','effr']);
const definitions={sofr:['SOFR','Percent','percent',2],effr:['EFFR','Percent','percent',2],sofrEffrSpread:['SOFR − EFFR','Basis points','basisPoints',1]};

/** Explicit source binding. Missing captured inputs must never borrow the live catalog. */
export function fundingChartCatalog(source={}, {frozen=false}={}) {
 const catalog=Object.fromEntries(Object.entries(definitions).map(([id,[name,unit,format,precision]])=>{
  const retained=source?.series?.[id]??{};
  return [id,{...retained,id,name,short:name,unit,format,precision,frequency:'Daily',fetchedAt:source?.fetchedAt??null,
   observations:structuredClone(retained.observations??[])}];
 }));
 return {catalog,evidenceLabel:frozen?'Frozen New York Fed funding observations · recorded inputs; median spread calculated by Meridian':`${source?.fetchedAt?(source.status==='ok'?'Captured':'Cached'):'Retrieval unavailable · retained'} New York Fed funding observations; median spread calculated by Meridian`};
}

/** Independent daily transaction populations, exact published fields and one shared window. */
export function fundingDistributionHistory(source={},range={preset:'all'}) {
 const {catalog}=fundingChartCatalog(source),window=resolveDateWindow(range,Object.values(catalog));
 return {panels:FUNDING_RATE_IDS.map(id=>transformSeries(catalog[id],'level',range,window)),window,error:window.error};
}
