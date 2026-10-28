import {requestText} from './http.mjs';
import {parseBeaBatch} from './bea.mjs';
import {PCE_PRICE_CONTRIBUTIONS_URL,pceContributionDefinitions} from '../../src/economic-evidence-definitions.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);

export function parsePcePriceContributions(text,{cutoff='9999-12-31',limit=120}={}){
 if(!Number.isInteger(limit)||limit<1||limit>120)throw new Error('Invalid PCE contribution retention');
 const raw=parseBeaBatch(text,Object.values(pceContributionDefinitions).map(row=>row.code),'M'),series={};
 for(const [id,definition]of Object.entries(pceContributionDefinitions)){
  const observations=raw[definition.code].filter(row=>row.date<=cutoff).slice(-limit);if(!observations.length)throw new Error('Missing PCE contribution observations');
  series[id]={...definition,observations,frequency:'Monthly',adjustment:'Seasonally adjusted',observationType:'official',sourceIds:[definition.code],sourceUrl:PCE_PRICE_CONTRIBUTIONS_URL,attribution:'Source: U.S. Bureau of Economic Analysis, NIPA Table 2.8.8.',licenseUrl:'https://www.bea.gov/help/faq/147',calculation:definition.definition};
 }
 const maps=Object.fromEntries(Object.entries(series).map(([id,s])=>[id,new Map(s.observations.map(row=>[row.date,row.value]))]));
 const dates=[...new Set(Object.values(series).flatMap(s=>s.observations.map(row=>row.date)))].sort();
 for(const date of dates){const [total,goods,services]=['pcePriceGrowth','pceGoodsPriceContribution','pceServicesPriceContribution'].map(id=>maps[id].get(date));if([total,goods,services].every(finite)&&Math.abs(total-goods-services)>.060000001)throw new Error('PCE price contribution reconciliation exceeds published rounding');}
 return {series,coverageNote:'Published monthly BEA NIPA Table 2.8.8 PCE price contributions; latest 120 available monthly observations per selected series. Goods and services are the only top-level components. Housing is detail within services. Seasonally adjusted monthly changes and percentage-point contributions are not annualized. Current revised history; individual publication dates are unknown. No CPI effects, relative-importance approximations or causal effects are inferred.'};
}

export async function collectPcePriceContributions({fetchImpl=globalThis.fetch,now=new Date()}={}){
 const response=await requestText(PCE_PRICE_CONTRIBUTIONS_URL,{headers:{'User-Agent':'MeridianMacroResearch/0.1 (source reliability review; https://github.com/Vasuki8/us-treasury)'},fetchImpl:async(url,options)=>{const result=await fetchImpl(url,{...options,redirect:'manual'});if(result.redirected||result.url&&result.url!==url||result.status>=300&&result.status<400)throw new Error('Unreviewed PCE contribution redirect');return result;}});
 const {text,...receipt}=response;
 return {id:'pcePriceContributions',status:'ok',fetchedAt:receipt.retrievedAt,...parsePcePriceContributions(text,{cutoff:now.toISOString().slice(0,10)}),provenance:[receipt]};
}
