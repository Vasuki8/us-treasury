import { momentumInputs, annualizedMomentum, consecutiveAverage } from '../src/momentum.js';
const inputCodes={payroll:['CES0000000001'],cpiSaIndex:['CUSR0000SA0'],cpiCoreSaIndex:['CUSR0000SA0L1E'],pceIndex:['DPCERG'],pceCoreIndex:['DPCCRG']};
export const momentumPolicies=['bls','bea'].map(agency=>({id:`${agency}-reviewed-momentum`,agency,reviewedOn:'2026-10-22',commercialUse:true,basis:'Calculations from admitted public-domain BLS/BEA observations in one retrieval vintage; exact endpoint formulas, source IDs and notices retained',terms:agency==='bls'?['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm']:['https://www.bea.gov/help/faq/147'],feed:agency==='bls'?'bls-api':'bea-nipa',series:Object.fromEntries(Object.entries(momentumInputs).filter(([, [input]])=>(input.startsWith('pce')?'bea':'bls')===agency).map(([id,[input]])=>[id,inputCodes[input]]))}));
// Node 22/24 can differ by about 2.3e-14 percentage points after exponentiation.
// Admit only that numerical portability: inputs, missingness and metadata stay exact.
const annualizedValueTolerance=1e-12;
function sameObservations(actual,expected,allowRounding){
 return Array.isArray(actual)&&actual.length===expected.length&&expected.every((row,index)=>{
  const retained=actual[index];
  if(!retained||typeof retained!=='object'||Array.isArray(retained)||!Object.hasOwn(retained,'value'))return false;
  const sameValue=retained.value===row.value||allowRounding&&Number.isFinite(retained.value)&&Number.isFinite(row.value)&&Math.abs(retained.value-row.value)<=annualizedValueTolerance;
  return sameValue&&JSON.stringify({...retained,value:row.value})===JSON.stringify(row);
 });
}
export function assertMomentumData(snapshot){
 for(const [id,[input,months,kind]] of Object.entries(momentumInputs))for(const source of Object.values(snapshot.sources??{})){
  if(!source.series?.[id])continue;
  const original=source.series[input],derived=source.series[id];
  if(!original||derived.observationType!=='calculated')throw new Error(`Missing momentum input/label for ${id}`);
  const expected=kind==='average'?consecutiveAverage(original.observations):annualizedMomentum(original.observations,months);
  if(!sameObservations(derived.observations,expected,kind!=='average'))throw new Error(`Momentum formula/input mismatch for ${id}`);
 }
}
