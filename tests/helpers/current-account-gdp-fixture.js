import {currentAccountRegistry,BEA_ITA_URL,BEA_ITA_LICENSE} from '../../src/current-account-registry.js';
const GDP_URL='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
// Fixed input fixture: live snapshot revisions/releases must not rewrite unit tests.
export function currentAccountGdpFixture(){
 const dates=['2026-01-01','2026-04-01'],itaAt='2026-10-23T04:21:42.080Z',gdpAt='2026-10-23T02:56:31.625Z';
 const receipt=(url,retrievedAt)=>[{url,retrievedAt,sha256:'a'.repeat(64),lastModified:null}];
 return {
  beaIta:{id:'beaIta',status:'ok',fetchedAt:itaAt,tableReleaseDate:'2026-09-24',provenance:receipt(BEA_ITA_URL,itaAt),series:{currentAccountBalance:{...currentAccountRegistry.currentAccountBalance,sourceIds:['ITA:T1.1:line30:World:SA:Q'],sourceUrl:BEA_ITA_URL,sourceUnit:'Millions of dollars',sourceTitle:'Table 1.1. U.S. International Transactions',licenseUrl:BEA_ITA_LICENSE,observations:dates.map((date,i)=>({date,value:[-212.597,-246.023][i],sourceValue:['-212597','-246023'][i],sourcePeriodLabel:`2026Q${i+1}`,publishedAt:null,footnotes:[]}))}}},
  bea:{id:'bea',status:'ok',fetchedAt:gdpAt,provenance:receipt(GDP_URL,gdpAt),series:{nominalGdp:{sourceIds:['A191RC'],sourceUrl:GDP_URL,observationType:'official',observations:dates.map((date,i)=>({date,value:[31906.274,32563.03][i],sourceValue:['31,906,274','32,563,030'][i],publishedAt:null}))}}},
 };
}
