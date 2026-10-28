import {isDeepStrictEqual} from 'node:util';
import {LABOR_EVIDENCE_URL,PCE_PRICE_CONTRIBUTIONS_URL,laborEvidenceDefinitions,pceContributionDefinitions,BLS_EVIDENCE_NOTICE} from '../src/economic-evidence-definitions.js';
import {isIsoDate} from '../src/date-window.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const economicEvidencePolicies=[
 {id:'bls-real-earnings-private-diffusion',agency:'laborEvidence',commercialUse:true,reviewedOn:'2026-10-27',feed:LABOR_EVIDENCE_URL,terms:['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm'],series:Object.fromEntries(Object.entries(laborEvidenceDefinitions).map(([id,d])=>[id,[d.code]])),basis:'Scoped public-domain BLS CES real earnings and private employment diffusion statistics; BLS attribution and derived-analysis disclaimer retained.'},
 {id:'bea-pce-price-contributions',agency:'pcePriceContributions',commercialUse:true,reviewedOn:'2026-10-27',feed:PCE_PRICE_CONTRIBUTIONS_URL,terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],series:Object.fromEntries(Object.entries(pceContributionDefinitions).map(([id,d])=>[id,[d.code]])),basis:'BEA public-domain NIPA Table 2.8.8 monthly published price contributions, goods/services top-level partition and housing detail; source credit retained.'},
];
const fail=reason=>{throw new Error(`Unreviewed economic evidence scope: ${reason}`);};
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export const matchesEconomicEvidenceFeed=(value,feed)=>economicEvidencePolicies.some(policy=>policy.feed===feed&&value===policy.feed);

/** Separate, fail-closed admission for the supplemental captured evidence. */
export function assertEconomicEvidenceSources(sources,{complete=true}={}){
 if(!sources||complete&&Object.keys(sources).sort().join(',')!=='laborEvidence,pcePriceContributions')fail('source family');
 for(const policy of economicEvidencePolicies){
  const source=sources[policy.agency],definitions=policy.agency==='laborEvidence'?laborEvidenceDefinitions:pceContributionDefinitions;
  if(!source&&!complete)continue;
  if(source?.status==='unavailable'&&!source.fetchedAt&&!Object.keys(source.series??{}).length&&!source.provenance?.length)continue;
  if(source?.id!==policy.agency||source.status!==undefined&&!['ok','error'].includes(source.status)||!timestamp(source.fetchedAt)||!Array.isArray(source.provenance)||!source.provenance.length)fail('source identity or capture time');
  if(Object.keys(source.series??{}).sort().join(',')!==Object.keys(definitions).sort().join(','))fail('series identity');
  for(const receipt of source.provenance){if(receipt.url!==policy.feed||!/^[a-f0-9]{64}$/.test(receipt.sha256)||!timestamp(receipt.retrievedAt)||receipt.retrievedAt>source.fetchedAt)fail('feed receipt');}
  if(!source.provenance.some(row=>row.retrievedAt===source.fetchedAt))fail('latest capture receipt');
  for(const [id,d]of Object.entries(definitions)){
   const series=source.series[id];for(const [key,value]of Object.entries(d))if(!isDeepStrictEqual(series[key],value))fail(`${id} definition identity`);
   if(!isDeepStrictEqual(series.sourceIds,[d.code])||series.sourceUrl!==policy.feed||series.frequency!=='Monthly'||series.adjustment!=='Seasonally adjusted'||series.observationType!=='official'||typeof series.attribution!=='string'||!series.attribution.startsWith('Source:')||!policy.terms.includes(series.licenseUrl))fail(`${id} units, source or attribution`);
   if(policy.agency==='laborEvidence'&&series.sourceNotice!==BLS_EVIDENCE_NOTICE)fail('BLS required notice');
   if(!Array.isArray(series.observations)||!series.observations.length||series.observations.length>120)fail('observation coverage');
   let previous='';
   for(const row of series.observations){
    if(!isIsoDate(row.date)||!row.date.endsWith('-01')||row.date<=previous||row.date>source.fetchedAt.slice(0,10)||row.publishedAt!==null||typeof row.sourceValue!=='string')fail('observation date or publication precision');previous=row.date;
    const missing=['','-','—','(NA)','(ND)','(D)','NA','N/A','...','---'].includes(row.sourceValue);
    if(missing?row.value!==null:!finite(row.value)||!/^[-+]?\d+(?:\.\d+)?$/.test(row.sourceValue)||Number(row.sourceValue)!==row.value)fail('native numeric value');
    if(policy.agency==='laborEvidence'){
     if(row.date<'2017-01-01'||finite(row.value)&&(row.value<0||d.horizonMonths&&row.value>100)||!Array.isArray(row.footnotes)||row.footnotes.some(n=>typeof n.code!=='string'||typeof n.text!=='string'))fail('labor bounds or footnotes');
    }
   }
  }
  if(policy.agency==='pcePriceContributions'){
   const maps=Object.fromEntries(Object.entries(source.series).map(([id,s])=>[id,new Map(s.observations.map(row=>[row.date,row.value]))]));
   for(const row of source.series.pcePriceGrowth.observations){const goods=maps.pceGoodsPriceContribution.get(row.date),services=maps.pceServicesPriceContribution.get(row.date);if([row.value,goods,services].every(finite)&&Math.abs(row.value-goods-services)>.060000001)fail('PCE reconciliation');}
  }
 }
 return sources;
}
