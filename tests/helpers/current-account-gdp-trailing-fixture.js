import {currentAccountGdpBreakdownFixture} from './current-account-gdp-breakdown-fixture.js';
export function currentAccountGdpTrailingFixture(){
 const sources=currentAccountGdpBreakdownFixture(),dates=['2025-01-01','2025-04-01','2025-07-01','2025-10-01','2026-01-01','2026-04-01'];
 const values={currentAccountBalance:[-40,-80,-160,-200,-240,-279.999],itaGoodsBalance:[-100,-150,-200,-260,-300,-340],itaServicesBalance:[80,90,100,110,120,130],itaPrimaryIncomeBalance:[-5,-10,-20,-15,-30,-35],itaSecondaryIncomeBalance:[-15,-10,-40,-35,-30,-35],nominalGdp:[16000,20000,24000,28000,32000,36000]};
 for(const [id,amounts] of Object.entries(values)){
  const source=id==='nominalGdp'?sources.bea:sources.beaIta;
  source.series[id].observations=amounts.map((value,i)=>({date:dates[i],value,sourceValue:String(Math.round(value*1000)),sourcePeriodLabel:`${dates[i].slice(0,4)}Q${Math.ceil(Number(dates[i].slice(5,7))/3)}`,publishedAt:null,footnotes:[]}));
 }
 return sources;
}
