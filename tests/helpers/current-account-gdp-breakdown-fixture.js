import {currentAccountGdpFixture} from './current-account-gdp-fixture.js';
import {currentAccountRegistry,BEA_ITA_URL,BEA_ITA_LICENSE} from '../../src/current-account-registry.js';

export function currentAccountGdpBreakdownFixture(){
 const sources=currentAccountGdpFixture();
 for(const [id,line,values] of [
  ['itaGoodsBalance',32,[-265,-291.302]],['itaServicesBalance',33,[88,91.485]],
  ['itaPrimaryIncomeBalance',34,[-1,-11.405]],['itaSecondaryIncomeBalance',35,[-34.597,-34.802]],
 ]) sources.beaIta.series[id]={...currentAccountRegistry[id],sourceIds:[`ITA:T1.1:line${line}:World:SA:Q`],sourceUrl:BEA_ITA_URL,licenseUrl:BEA_ITA_LICENSE,
  observations:values.map((value,i)=>({date:['2026-01-01','2026-04-01'][i],value,sourceValue:String(Math.round(value*1000)),sourcePeriodLabel:`2026Q${i+1}`,publishedAt:null,footnotes:[]}))};
 return sources;
}
