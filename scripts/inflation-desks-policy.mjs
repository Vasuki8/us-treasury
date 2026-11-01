import {inflationDeskDefinitions} from '../src/inflation-desk-definitions.js';
import {validateInflationDeskSource} from '../src/inflation-desk-schema.js';
export const inflationDeskPolicies=Object.values(inflationDeskDefinitions).map(d=>({
 id:d.id==='inflationBea'?'bea-inflation-specialist-tables':'cleveland-median-trimmed-cpi',
 agency:d.id,reviewedOn:'2026-11-01',commercialUse:true,feed:d.id,terms:[d.licenseUrl],series:Object.fromEntries(Object.entries(d.series).map(([id,s])=>[id,s.codes])),
 basis:d.id==='inflationBea'?'BEA original public-domain monthly statistical values with official SeriesRegister/TablesRegister identity, native rates/effects and explicit Meridian annual/share calculations.':'Cleveland Fed own median and trimmed-mean CSV data under CC BY-SA 4.0 with source, license, modification and downstream share-alike notices. October and November 2025 imputation retained.',
}));
export const matchesInflationDeskFeed=(url,feed)=>Boolean(inflationDeskDefinitions[feed]?.feeds.includes(url));
export function assertInflationDeskSources(sources,{complete=true}={}){
 if(!sources||typeof sources!=='object'||Array.isArray(sources))throw new Error('Inflation desk: invalid sources');
 if(complete&&Object.keys(sources).sort().join(',')!==Object.keys(inflationDeskDefinitions).sort().join(','))throw new Error('Inflation desk: incomplete source family');
 for(const id of Object.keys(inflationDeskDefinitions)){
  const source=sources[id];if(!source&&!complete)continue;
  if(source?.status==='unavailable'&&!source.fetchedAt&&!Object.keys(source.series??{}).length&&!source.provenance?.length)continue;
  validateInflationDeskSource(source);
 }return sources;
}
