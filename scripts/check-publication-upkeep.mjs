import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicationArchive} from '../src/publication-archive.js';
import {claimsPublicationArchive} from '../src/claims-publication-archive.js';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';
import {publicationScope,assertPublicationData} from './publication-policy.mjs';
import {claimsPublicationScope,assertClaimsPublicationData} from './dol-publication-policy.mjs';
import {cpiPublicationScope,assertCpiPublicationData} from './cpi-publication-policy.mjs';
import {publicationUpkeep} from '../src/publication-upkeep.js';
import {requestText} from './sources/http.mjs';
import {isIsoDate} from '../src/date-window.js';
const CPI_INDEX='https://www.bls.gov/bls/news-release/cpi.htm';
const GDP_INDEX='https://www.bea.gov/data/gdp/gross-domestic-product';
const links=html=>[...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]);
export function discoverCpiCandidates(html,{from='2026-02-13',through=new Date().toISOString().slice(0,10)}={}){
 if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024||!/<h1[^>]*>\s*Consumer Price Index Archived News Releases\s*<\/h1>/i.test(html))throw Error('Unrecognized CPI archive index; source review required.');
 const rows=new Map();
 for(const href of links(html)){
  let url;try{url=new URL(href,CPI_INDEX);}catch{continue;}
  const match=/^\/news\.release\/archives\/cpi_(\d{2})(\d{2})(\d{4})\.htm$/.exec(url.pathname);
  if(url.origin!=='https://www.bls.gov'||url.search||url.hash||!match)continue;
  const publicationDate=`${match[3]}-${match[1]}-${match[2]}`;
  if(isIsoDate(publicationDate)&&publicationDate>=from&&publicationDate<=through)rows.set(url.href,{sourceUrl:url.href,publicationDate});
 }
 if(rows.size>1000)throw Error('CPI candidate scope exceeds bound.');
 return [...rows.values()].sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
}
export function discoverGdpCandidates(html){
 const urls=[...new Set(links(html).flatMap(href=>{try{const url=new URL(href,GDP_INDEX);return url.origin==='https://www.bea.gov'&&!url.search&&!url.hash&&/^\/sites\/default\/files\/\d{4}-\d{2}\/gdp-gdi-vintage-history\.xlsx$/.test(url.pathname)?[url.href]:[];}catch{return [];}}))];
 if(!urls.length||urls.length>12)throw Error('Unrecognized GDP dated vintage workbook links; source review required.');
 return urls.map(sourceUrl=>({sourceUrl,publicationDate:null}));
}
/** Bounded official discovery: BLS archive links, BEA dated vintage link, DOL latest dated PDF identity. */
export async function checkPublicationUpkeep({discover=false,fetchImpl=globalThis.fetch,now=new Date()}={}){
 assertPublicationData(publicationArchive);assertClaimsPublicationData(claimsPublicationArchive);assertCpiPublicationData(cpiPublicationArchive);
 const discoveries={};
 if(discover){
  for(const [family,url,parse] of [['cpi',CPI_INDEX,text=>discoverCpiCandidates(text,{through:now.toISOString().slice(0,10)})],['gdp',GDP_INDEX,discoverGdpCandidates]]){
   try{const {text,...provenance}=await requestText(url,{fetchImpl,maxBytes:2*1024*1024});if(provenance.url!==url)throw Error('Official discovery index redirected; review required.');const candidates=parse(text);if(!candidates.length)throw Error('Official discovery index returned no in-scope candidates; review required.');discoveries[family]={status:'checked',candidates,provenance:[provenance],note:family==='gdp'?'Checks dated vintage workbook links only; does not verify every GDP news release.':'Checks dated CPI archive links from the first approved publication through the check day.'};}catch(error){discoveries[family]={status:'error',error:error.message,candidates:[]};}
  }
  try{const {collectDolAdvance}=await import('./sources/dol-advance.mjs');const source=await collectDolAdvance({fetchImpl,now});discoveries.claims={status:'checked',candidates:[{sourceUrl:'https://www.dol.gov/ui/data.pdf',publicationDate:source.releaseDate,matchBy:'publicationDate'}],provenance:source.provenance,warnings:source.warnings,note:'Checks the latest official claims release day only; does not discover every missing intermediate historical edition.'};}catch(error){discoveries.claims={status:'error',error:error.message,candidates:[]};}
 }
 return publicationUpkeep({archives:{gdp:publicationArchive,claims:claimsPublicationArchive,cpi:cpiPublicationArchive},approvedScopes:{gdp:publicationScope,claims:claimsPublicationScope,cpi:cpiPublicationScope},discoveries,checkedAt:now.toISOString()});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(arg=>!['--discover','--json'].includes(arg)))throw Error('Usage: node scripts/check-publication-upkeep.mjs [--discover] [--json]. Checks never mutate archives.');
 const report=await checkPublicationUpkeep({discover:args.includes('--discover')});
 console.log(args.includes('--json')?JSON.stringify(report,null,2):Object.entries(report.families).map(([family,row])=>`${family}: ${row.status}; ${row.retainedCount}/${row.approvedCount} approved facts; ${row.missingApprovedIds.length} missing approved; ${row.reviewQueue.length} candidates awaiting review; discovery ${row.discovery.status}`).join('\n')+'\n'+report.interpretation);
 // Missing approved data is a failed invariant; review candidates alone do not block current-data publication.
 if(['invalid-archive','missing-approved'].includes(report.status))process.exitCode=1;
}
