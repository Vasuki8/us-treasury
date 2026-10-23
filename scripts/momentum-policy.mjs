import { momentumInputs, annualizedMomentum, consecutiveAverage } from '../src/momentum.js';
const inputCodes={payroll:['CES0000000001'],cpiSaIndex:['CUSR0000SA0'],cpiCoreSaIndex:['CUSR0000SA0L1E'],pceIndex:['DPCERG'],pceCoreIndex:['DPCCRG']};
export const momentumPolicies=['bls','bea'].map(agency=>({id:`${agency}-reviewed-momentum`,agency,reviewedOn:'2026-10-22',commercialUse:true,basis:'Calculations from admitted public-domain BLS/BEA observations in one retrieval vintage; exact endpoint formulas, source IDs and notices retained',terms:agency==='bls'?['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm']:['https://www.bea.gov/help/faq/147'],feed:agency==='bls'?'bls-api':'bea-nipa',series:Object.fromEntries(Object.entries(momentumInputs).filter(([, [input]])=>(input.startsWith('pce')?'bea':'bls')===agency).map(([id,[input]])=>[id,inputCodes[input]]))}));
export function assertMomentumData(snapshot){
 for(const [id,[input,months,kind]] of Object.entries(momentumInputs))for(const source of Object.values(snapshot.sources??{})){
  if(!source.series?.[id])continue;
  const original=source.series[input],derived=source.series[id];
  if(!original||derived.observationType!=='calculated')throw new Error(`Missing momentum input/label for ${id}`);
  const expected=kind==='average'?consecutiveAverage(original.observations):annualizedMomentum(original.observations,months);
  if(JSON.stringify(derived.observations)!==JSON.stringify(expected))throw new Error(`Momentum formula/input mismatch for ${id}`);
 }
}
