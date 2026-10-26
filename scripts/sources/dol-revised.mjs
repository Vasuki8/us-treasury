import {setTimeout as delay} from 'node:timers/promises';
import {collectDol} from './dol.mjs';
import {requestBytes,requestText} from './http.mjs';
import {parseDolAdvanceText,extractDolAdvancePdf,DOL_ADVANCE_PUBLICATION_NOTE,DOL_SEASONAL_UPDATE_NOTICES} from './dol-advance.mjs';
import {assertDolRevisedHistoryData} from '../dol-revised-policy.mjs';

const xmlUrl='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const indexUrl='https://oui.doleta.gov/unemploy/archive.asp';
const ids={claims:'claimsAdvance',continuedClaims:'continuedClaimsAdvance'};
const dayMs=86400000;
const fail=message=>{throw new Error('Invalid DOL revised history: '+message);};
const nextWeek=date=>new Date(Date.parse(date+'T00:00:00Z')+7*dayMs).toISOString().slice(0,10);
const rawCount=value=>String(value).replaceAll(',','');
const eligible=row=>['prior-week-revised','prior-week-unrevised'].includes(row.releaseStage);
const pdfDate=url=>{const match=/\/press\/(\d{4})\/(\d{2})(\d{2})\d{2}\.pdf$/.exec(url);return match?`${match[1]}-${match[2]}-${match[3]}`:null;};

/** Only links published in the annual archive are candidates, including holiday releases. */
export function discoverDolReleases(html,{year,now=new Date()}={}){
 if(typeof html!=='string'||Buffer.byteLength(html,'utf8')>2*1024*1024)fail('archive index size limit or schema');
 if(!Number.isInteger(year)||year<2000||year>2099||!(now instanceof Date)||!Number.isFinite(+now))fail('archive year or cutoff');
 const cutoff=now.toISOString().slice(0,10),links=new Map();
 const visible=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 for(const match of visible.matchAll(/<a\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)){
  const href=match[1]??match[2]??match[3];
  if(!/^(?:https:\/\/oui\.doleta\.gov|\.\.)?\/press\/20\d{2}\/\d{6}\.pdf$/.test(href))continue;
  const url=new URL(href,indexUrl).href,parts=/^https:\/\/oui\.doleta\.gov\/press\/(20\d{2})\/(\d{2})(\d{2})(\d{2})\.pdf$/.exec(url);
  if(!parts||Number(parts[1])!==year||parts[4]!==parts[1].slice(2))continue;
  const publicationDate=`${parts[1]}-${parts[2]}-${parts[3]}`,parsed=new Date(publicationDate+'T00:00:00Z');
  if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==publicationDate||publicationDate>cutoff)continue;
  links.set(url,{url,publicationDate});
 }
 return [...links.values()].sort((a,b)=>b.publicationDate.localeCompare(a.publicationDate));
}

function assertNotShrunk(previous,source){
 if(!previous)return;
 for(const id of Object.keys(ids)){
  const before=previous.series?.[id]?.observations,after=source.series[id].observations;
  if(!Array.isArray(before)||!before.length)continue;
  const dates=new Set(after.map(row=>row.date));
  const latest=before.findLast(row=>row.value!==null)?.date;
  if(after[0].date>before[0].date||latest&&after.findLast(row=>row.value!==null)?.date<latest||before.some(row=>!dates.has(row.date)))fail(`${id} coverage would shrink from previous history`);
 }
}

function assertSeasonalRegime(xmlThrough,latestReleaseDate,parsed){
 const applied=Object.entries(DOL_SEASONAL_UPDATE_NOTICES).filter(([date,notice])=>date<=latestReleaseDate&&notice.kind==='applied-update').map(([date])=>date);
 if(parsed.seasonalAdjustmentKind==='applied-update')applied.push(parsed.releaseDate);
 if(applied.some(date=>Object.values(xmlThrough).some(through=>through<date)))fail('annual seasonal revision requires both XML endpoints on or after its release date');
}

function bridgeComplete(source,priors,overlaps,targets){
 return Object.keys(ids).every(id=>{
  if(!overlaps[id])return false;
  for(let date=nextWeek(source.series[id].latestObservationDate);date<=targets[id];date=nextWeek(date))if(!priors[id].has(date))return false;
  return true;
 });
}

/** Extend the strict historical XML only with explicit, table-corroborated PDF priors. */
export async function collectDolWithRevisions({previous,now=new Date(),fetchImpl=globalThis.fetch,extractPdf=extractDolAdvancePdf,maxAttempts=process.env.SOURCE_RETRY_ATTEMPTS==='3'?3:1,pause=delay}={}){
 assertDolRevisedHistoryData(previous);
 const retained=previous?.revisedHistoryProfile?previous:null;
 const officialFetch=(url,options)=>fetchImpl(url,{...options,redirect:'error'});
 const source=await collectDol({fetchImpl:officialFetch,now,maxAttempts,pause});
 if(source.provenance[0].url!==xmlUrl)fail('unreviewed historical XML redirect URL');
 const xmlThrough=Object.fromEntries(Object.keys(ids).map(id=>[id,source.series[id].latestObservationDate]));
 const xmlRows=Object.fromEntries(Object.keys(ids).map(id=>[id,new Map(source.series[id].observations.map(row=>[row.date,row]))]));
 const priors={claims:new Map(),continuedClaims:new Map()},overlaps={},receipts=[...source.provenance];
 const xmlFloor=Object.values(xmlThrough).sort()[0];
 const scanThrough=Object.keys(ids).map(id=>[xmlThrough[id],retained?.series[id].observations.findLast(row=>row.value!==null)?.date??xmlThrough[id]].sort().at(-1)).sort()[0];
 const earliestContext=new Date(Date.parse(xmlFloor+'T00:00:00Z')-7*dayMs).toISOString().slice(0,10);
 const pdfReceipts=new Map((retained?.provenance??[]).filter(receipt=>pdfDate(receipt.url)>=earliestContext).map(receipt=>[receipt.url,receipt]));
 function rememberPrior(id,row,fresh=false){
  if(row.date>xmlThrough[id]&&(fresh||!priors[id].has(row.date)))priors[id].set(row.date,structuredClone(row));
  const xmlRow=xmlRows[id].get(row.date);
  if(xmlRow&&xmlRow.value!==null){
   if(xmlRow.value!==row.value||rawCount(xmlRow.sourceValue)!==rawCount(row.sourceValue)){
    if(fresh)fail(`${id} XML and PDF overlap counts disagree`);
    return;
   }
   if(!overlaps[id]||row.date>overlaps[id].date)overlaps[id]=structuredClone(row);
  }
 }
 if(retained)for(const id of Object.keys(ids)){
  for(const row of [...retained.series[id].observations,retained.revisedHistoryProfile.overlaps[id]])if(eligible(row)&&pdfReceipts.has(row.sourceUrl))rememberPrior(id,row);
 }
 let targets,latestReleaseDate,pdfCount=0,complete=false;
 for(const year of [now.getUTCFullYear(),now.getUTCFullYear()-1]){
  const body=new URLSearchParams({report:'press',year:String(year),submit:'Submit'}).toString();
  const {text,...receipt}=await requestText(indexUrl,{fetchImpl:officialFetch,method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'},maxBytes:2*1024*1024,maxAttempts,sleepImpl:pause});
  if(receipt.url!==indexUrl)fail('unreviewed archive index redirect URL');
  if(!/<html\b/i.test(text)||!text.includes('UI Weekly Claims News Release')||!/<table\b[^>]*\bclass\s*=\s*["']calendar["']/i.test(text))fail('unrecognized archive index schema');
  receipts.push(receipt);
  for(const release of discoverDolReleases(text,{year,now})){
   if(pdfCount===8)fail('eight-PDF bounded bridge window exhausted');
   if(targets&&release.publicationDate<earliestContext)fail('missing release context within the preceding XML week');
   const {bytes,...provenance}=await requestBytes(release.url,{fetchImpl:officialFetch,maxBytes:4*1024*1024,maxAttempts,sleepImpl:pause});pdfCount++;
   if(provenance.url!==release.url)fail('unreviewed dated PDF redirect URL');
   if(!bytes.subarray(0,8).toString('ascii').match(/^%PDF-1\.[0-9]/))fail('response is not a PDF');
   const parsed=parseDolAdvanceText(await extractPdf(bytes),{now});
   if(parsed.releaseDate!==release.publicationDate)fail('dated PDF URL and publication date disagree');
   pdfReceipts.set(provenance.url,provenance);
   const selected={};
   for(const [id,advanceId]of Object.entries(ids)){
    const rows=parsed.series[advanceId].observations.filter(eligible);
    if(rows.length!==1)fail(`${id} requires one explicit revised or unrevised prior role`);
    selected[id]={...rows[0],publishedAt:null,publicationDate:parsed.releaseDate,sourceUrl:provenance.url,sourceSha256:provenance.sha256,retrievedAt:provenance.retrievedAt};
   }
   if(!targets){
    targets=Object.fromEntries(Object.keys(ids).map(id=>[id,selected[id].date]));latestReleaseDate=parsed.releaseDate;
    if(Object.keys(ids).every(id=>xmlThrough[id]>=targets[id])){assertNotShrunk(previous,source);return source;}
   }
   assertSeasonalRegime(xmlThrough,latestReleaseDate,parsed);
   for(const id of Object.keys(ids)){
    const row=selected[id];
    if(row.date>targets[id])fail(`${id} prior reference week exceeds the newest release`);
    for(const [date,prior]of priors[id])if(prior.sourceUrl===provenance.url)priors[id].delete(date);
    if(overlaps[id]?.sourceUrl===provenance.url)delete overlaps[id];
    rememberPrior(id,row,true);
   }
   complete=release.publicationDate<=scanThrough&&bridgeComplete(source,priors,overlaps,targets);
   if(complete)break;
  }
  if(complete)break;
  if(pdfCount===8)fail('eight-PDF bounded bridge window exhausted');
 }
 if(!complete)fail('missing continuous weekly bridge or exact XML overlap within two annual indexes');
 const xmlReceipt=source.provenance[0];
 for(const id of Object.keys(ids)){
  const series=source.series[id];
  series.observations=series.observations.map(row=>({...row,sourceUrl:xmlUrl,sourceSha256:xmlReceipt.sha256,retrievedAt:xmlReceipt.retrievedAt}));
  for(let date=nextWeek(xmlThrough[id]);date<=targets[id];date=nextWeek(date))series.observations.push(priors[id].get(date));
  series.latestObservationDate=series.observations.at(-1).date;
  series.inputProvenanceScope='observation-source-urls';
  series.sourceUrls=[...new Set([...series.observations.map(row=>row.sourceUrl),overlaps[id].sourceUrl])];
  series.frequency='Weekly';series.adjustment='Seasonally adjusted';series.unit=id==='claims'?'Thousands of claims':'Thousands of continued claims';series.observationType='official';
  series.publicationNote=DOL_ADVANCE_PUBLICATION_NOTE;
  series.coverageNote=`National regular UI ${id==='claims'?'initial':'continued'} claims; XML base ${series.observations[0].date} through ${xmlThrough[id]}; confirmed prior-week PDF supplement through ${series.latestObservationDate}, latest release ${latestReleaseDate} (day precision). Advance readings remain separate. Earlier history is first captured on actual retrieval; source values and seasonal adjustment may be revised.`;
 }
 source.latestObservationDate=source.series.claims.latestObservationDate;
 source.coverageNote=source.series.claims.coverageNote;
 source.warnings=source.warnings.map(warning=>warning.replace(/^DOL historical continued claims latest observation is /,'DOL XML base continued claims latest observation is ').replace(/^DOL historical feed latest observation is /,'DOL XML base initial claims latest observation is '));
 source.revisedHistoryProfile={version:1,xmlThrough,latestReleaseDate,overlaps};
 source.provenance=[...receipts,...pdfReceipts.values()];source.fetchedAt=source.provenance.map(row=>row.retrievedAt).sort().at(-1);
 assertNotShrunk(previous,source);
 assertDolRevisedHistoryData(source);
 return source;
}
