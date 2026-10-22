import {Worker} from 'node:worker_threads';
import {requestBytes} from './http.mjs';
import {easternInstant} from './calendar-utils.mjs';

export const DOL_ADVANCE_URL='https://www.dol.gov/ui/data.pdf';
export const DOL_ADVANCE_LICENSE='https://www.dol.gov/general/aboutdol/copyright';
export const DOL_ADVANCE_ATTRIBUTION='Source: U.S. Department of Labor, Employment and Training Administration.';
export const DOL_ADVANCE_PUBLICATION_NOTE='DOL release dates have day precision. The announced 08:30 Eastern embargo clock does not establish an exact server-publication instant. Actual retrieval is shown separately.';
export const DOL_ADVANCE_IDS=Object.freeze({claimsAdvance:'InitialClaims/SA/Release',continuedClaimsAdvance:'ContinuedClaims/SA/Release'});
// Exact reviewed inserts; unknown notices require a new source review.
export const DOL_SEASONAL_UPDATE_NOTICES=Object.freeze({
 '2025-03-20':{kind:'scheduled-update',sourceText:'REVISION TO SEASONAL ADJUSTMENT FACTORS Note: Calendar Year (CY) 2025 seasonal factors and revised seasonal factors for CY 2020-2024 for both initial claims and continued claims will be available at https://www.bls.gov/lau/seasonal-adjustment-for-weekly-unemployment-insurance- claims.htm by 12:00 P.M. (Eastern) on Thursday, March 27, 2025. Revisions to the historical series for CY 2020-2024 for both initial claims and continued claims will be published on March 27, 2025, with the release of the Unemployment Insurance Weekly Claims News Release.',note:'DOL announced 2025 seasonal factors and revised 2020–2024 factors/history for March 27, 2025. This March 20 notice schedules the update; it does not establish that the update was applied to these readings.'},
 '2025-03-27':{kind:'applied-update',sourceText:"REVISION TO SEASONAL ADJUSTMENT FACTORS Note : This week's release reflects the annual revision to the weekly unemployment claims seasonal adjustment factors. The seasonal adjustment factors used for the UI Weekly Claims data from 2020 forward, along with the resulting seasonally adjusted values for initial claims and continuing claims, have been revised. For more information regarding the seasonal adjustment methodology, please see the additional information at the end of this news release.",note:'DOL states this release applies the annual seasonal-factor revision to initial and continued claims from 2020 forward. This selected archive retains only the advance and prior-week facts in each release, not all historical values affected by the update. A specific numeric revision cause is not inferred.'},
 '2026-03-12':{kind:'scheduled-update',sourceText:'REVISION TO SEASONAL ADJUSTMENT FACTORS Note: Calendar Year (CY) 2026 seasonal factors and revised seasonal factors for CY 2021-2025 for both initial claims and continued claims will be available at https://www.bls.gov/lau/seasonal-adjustment-for-weekly-unemployment- insurance-claims.htm by 12:00 P.M. (Eastern) on Thursday, March 1 9 , 2026. Revisions to the historical series for CY 2021-2025 for both initial claims and continued claims will be published on March 19, 2026, with the release of the Unemployment Insurance Weekly Claims News Release.',note:'DOL announced 2026 seasonal factors and revised 2021–2025 factors/history for March 19, 2026. This March 12 notice schedules the update; it does not establish that the update was applied to these readings.'},
 '2026-03-19':{kind:'applied-update',sourceText:"REVISION TO SEASONAL ADJUSTMENT FACTORS Note: This week's release reflects the annual revision to the weekly unemployment claims seasonal adjustment factors. The seasonal adjustment factors used for the UI Weekly Claims data from 2021 forward, along with the resulting seasonally adjusted values for initial claims and continuing claims, have been revised. For more information regarding the seasonal adjustment methodology, please see the additional information at the end of this news release.",note:'DOL states this release applies the annual seasonal-factor revision to initial and continued claims from 2021 forward. This selected archive retains only the advance and prior-week facts in each release, not all historical values affected by the update. A specific numeric revision cause is not inferred.'},
});
export const DOL_RELEASE_NOTICES=Object.freeze({
 '2025-11-20':{sourceText:'Note: Due to the lapse in appropriations in effect from October 1, 2025, through November 12, 2025, there will be no publication of the Unemployment Insurance Claims news releases that would have been published from October 2, 2025, through November 13, 2025. The official seasonally adjusted unemployment insurance claims data for this period may be accessed through our public website using the following URL: https://oui.doleta.gov/unemploy/claims_arch.asp',note:'DOL states that no weekly claims news releases were published for October 2 through November 13, 2025 because of the lapse in appropriations. Revised historical data for that interval are separate from unavailable advance releases. This November 20 release does not specify whether its prior-week comparison values are revised or unrevised.'},
});
const maxBytes=4*1024*1024,dayMs=86400000;
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fail=message=>{throw new Error('Invalid DOL advance release: '+message);};
const normalized=text=>text.replaceAll('’',"'").replace(/\s+/g,' ').trim();
function one(text,expression,label){const matches=[...text.matchAll(new RegExp(expression.source,expression.flags.includes('g')?expression.flags:expression.flags+'g'))];if(matches.length!==1)fail('missing or ambiguous '+label);return matches[0];}
function count(text){if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text))fail('invalid count');const value=Number(text.replaceAll(',',''));if(!Number.isSafeInteger(value)||value<0)fail('unsafe count');return value;}
function calendar(month,day,year){
 const index=monthNames.indexOf(month);if(index<0)fail('invalid month');
 const date=`${year}-${String(index+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const value=new Date(date+'T00:00:00Z');if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date)fail('invalid calendar date');return date;
}
function weekDate(month,day,releaseDate,maxAge){
 const year=Number(releaseDate.slice(0,4));
 const dates=[];
 for(const candidateYear of [year,year-1]){
  // A valid leap-day week in one year need not exist in the other candidate.
  try{const candidate=calendar(month,day,candidateYear);if(candidate<=releaseDate)dates.push(candidate);}catch{/* Invalid candidate dates provide no reference week. */}
 }
 dates.sort().reverse();
 const date=dates[0],age=(Date.parse(releaseDate)-Date.parse(date))/dayMs;
 if(!date||age<0||age>maxAge||new Date(date+'T00:00:00Z').getUTCDay()!==6)fail('invalid or non-Saturday reference week');return date;
}
function signedChange(description){
 if(description==='unchanged')return 0;
 const match=/^(?:a|an) (increase|decrease) of ([\d,]+)$/.exec(description);if(!match)fail('unknown change wording');return count(match[2])*(match[1]==='decrease'?-1:1);
}
function corroborate(table,label,currentDate,priorDate,current,prior,change,releaseDate){
 const match=one(table,new RegExp(label+' \\(SA\\) ([\\d,]+) ([\\d,]+) ([+-]?[\\d,]+)'),'seasonally adjusted '+label+' table');
 const signed=match[3].startsWith('-')?-count(match[3].slice(1)):count(match[3].replace(/^\+/,''));
 if(count(match[1])!==current||count(match[2])!==prior||signed!==change)fail('narrative and SA table disagree');
 const prefix=table.slice(0,match.index),header=prefix.slice(prefix.lastIndexOf('WEEK ENDING'));
 const dates=/^WEEK ENDING ([A-Z][a-z]+) (\d{1,2}) ([A-Z][a-z]+) (\d{1,2}) Change\b/.exec(header);
 if(!dates||weekDate(dates[1],dates[2],releaseDate,21)!==currentDate||weekDate(dates[3],dates[4],releaseDate,28)!==priorDate)fail('narrative and table reference weeks disagree');
}

function measurement(text,table,{id,expression,label,maxAge},releaseDate){
 const match=one(text,expression,id+' advance statement'),date=weekDate(match[1],match[2],releaseDate,maxAge),current=count(match[3]),change=signedChange(match[4]);
 const priorStatus=match[5],remainder=text.slice(match.index+match[0].length),boundary=/The 4\s*-\s*week moving average/.exec(remainder);
 if(!boundary)fail('missing moving-average boundary for '+id);
 let priorText=remainder.slice(0,boundary.index).trim();let priorSourceValue,oldSourceValue;
 const subject=id==='claimsAdvance'?'initial claims':'insured unemployment';
 priorText=priorText.replace(new RegExp('^This is the (?:highest|lowest) level for '+subject+' since [A-Z][a-z]+ \\d{1,2}, \\d{4} when it was [\\d,]+\\.(?: |$)'),'');
 if(priorStatus==='revised'){
  const revision=one(priorText,/^The previous week's level was revised (up|down) (?:by )?([\d,]+) from ([\d,]+) to ([\d,]+)\.$/,'prior-week revision');
  priorSourceValue=revision[4];oldSourceValue=revision[3];
  if(count(priorSourceValue)-count(oldSourceValue)!==count(revision[2])*(revision[1]==='down'?-1:1))fail('prior revision arithmetic disagrees');
  if(match[6]&&count(match[6])!==count(priorSourceValue))fail('conflicting prior level');
 }else if(priorStatus==='unrevised'){
  if(priorText||!match[6])fail('missing explicit unrevised prior');priorSourceValue=match[6];oldSourceValue=match[6];
 }else{
  if(priorText||match[6])fail('unexpected unspecified prior wording');
  const row=one(table,new RegExp(label+' \\(SA\\) ([\\d,]+) ([\\d,]+) ([+-]?[\\d,]+)'),'unspecified prior SA table');
  priorSourceValue=row[2];oldSourceValue=null;
 }
 const prior=count(priorSourceValue);if(current-prior!==change)fail('reported weekly change disagrees');
 const priorDate=new Date(Date.parse(date+'T00:00:00Z')-7*dayMs).toISOString().slice(0,10);
 corroborate(table,label,date,priorDate,current,prior,change,releaseDate);
 const publication={publishedAt:releaseDate,publicationDatePrecision:'day'};
 const priorRole='prior-week-'+(priorStatus??'status-unknown');
 const priorFootnote=priorStatus?`Prior-week ${priorStatus} comparison in the ${releaseDate} release, not an advance observation for this week. Previously published count: ${oldSourceValue}. Release date has day precision.`:`Prior-week comparison in the ${releaseDate} release, not an advance observation for this week. Revision status is not stated and no previously published count is supplied. Release date has day precision.`;
 return {
  observations:[
   {date:priorDate,value:prior/1000,sourceValue:priorSourceValue,...publication,releaseStage:priorRole,previouslyPublishedSourceValue:oldSourceValue,footnotes:[priorFootnote]},
   {date,value:current/1000,sourceValue:match[3],...publication,releaseStage:'advance',footnotes:[`Advance estimate; subject to revision. Released ${releaseDate} (day precision). Change versus the same release's ${priorStatus?priorStatus+' prior week':'prior-week comparison (revision status unspecified)'}: ${change} claims.`]},
  ],
  sourceUrl:DOL_ADVANCE_URL,sourceIds:[DOL_ADVANCE_IDS[id]],observationType:'official',dataStatus:'official',frequency:'Weekly',adjustment:'Seasonally adjusted',unit:id==='claimsAdvance'?'Thousands of claims':'Thousands of continued claims',
  sourceTitle:'Unemployment Insurance Weekly Claims',licenseUrl:DOL_ADVANCE_LICENSE,attribution:DOL_ADVANCE_ATTRIBUTION,
  calculation:'Published national regular UI seasonally adjusted count / 1000. Weekly change compares current advance with the prior-week value in the same release; no historical-feed splice.',
  measure:`Latest release context: ${label}; one current advance and one ${priorStatus?'explicitly '+priorStatus:'revision-status-unspecified'} prior-week comparison. Not historical first-release vintages or unique unemployed people.`,
  publicationNote:DOL_ADVANCE_PUBLICATION_NOTE,
  coverageNote:`DOL release ${releaseDate} (day precision): prior comparison ${priorDate}, advance week ${date}. Two observations from this release only, kept separate from the revised historical series. Initial and continued weeks may differ. Subject to revision; retrieval does not establish the exact publication instant.`,
 };
}

/** Parse bounded extracted text, requiring independent SA table corroboration. */
export function parseDolAdvanceText(input,{now=new Date()}={}){
 if(!input||typeof input.firstPage!=='string'||typeof input.tableText!=='string'||input.firstPage.length>20000||input.tableText.length>500000)fail('text limits or schema');
 const first=normalized(input.firstPage),table=normalized(input.tableText);
 if(!first.includes('News Release')||!first.includes('TRANSMISSION OF MATERIALS IN THIS RELEASE IS EMBARGOED UNTIL'))fail('release header');
 const header=one(first,/8:30 A\.M\. \(Eastern\) ([A-Z][a-z]+), ([A-Z][a-z]+) (\d(?:\s*\d)?)\s*, (20\d{2}) (.*?)UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA/,'dated seasonally adjusted release header');
 const releaseDate=calendar(header[2],header[3].replace(/\s/g,''),header[4]);
 const insert=header[5].trim(),notice=insert?DOL_SEASONAL_UPDATE_NOTICES[releaseDate]:null,releaseNotice=insert?DOL_RELEASE_NOTICES[releaseDate]:null;
 if(insert&&(!notice&&!releaseNotice||insert!==(notice??releaseNotice).sourceText))fail('unreviewed seasonal adjustment or release notice');
 if(days[new Date(releaseDate+'T00:00:00Z').getUTCDay()]!==header[1])fail('release weekday disagreement');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||Date.parse(easternInstant(releaseDate,'08:30'))>now.getTime())fail('future release or embargo not elapsed');
 const status=releaseNotice?'(?:(revised|unrevised) )?':'(revised|unrevised) ';
 const shared=" (a decrease of [\\d,]+|an increase of [\\d,]+|unchanged) from the previous week's "+status+"level(?: of ([\\d,]+))?\\.";
 const series={};
 for(const definition of [
  {id:'claimsAdvance',label:'Initial Claims',maxAge:14,expression:new RegExp('In the week ending ([A-Z][a-z]+) (\\d{1,2}), the advance figure for seasonally adjusted initial claims was ([\\d,]+),'+shared)},
  {id:'continuedClaimsAdvance',label:'Insured Unemployment',maxAge:21,expression:new RegExp('The advance number for seasonally adjusted insured unemployment during the week ending ([A-Z][a-z]+) (\\d{1,2}) was ([\\d,]+),'+shared)},
 ])series[definition.id]=measurement(first,table,definition,releaseDate);
 if(notice)for(const item of Object.values(series))for(const row of item.observations)row.footnotes.push(notice.note);
 if(releaseNotice)for(const item of Object.values(series))for(const row of item.observations)row.footnotes.push(releaseNotice.note);
 return {id:'dolAdvance',releaseDate,series,...(notice?{seasonalAdjustmentKind:notice.kind,seasonalAdjustmentNote:notice.note}:{}),...(releaseNotice?{publicationNotice:releaseNotice.note}:{}),coverageNote:`Latest DOL advance release context, issued ${releaseDate} (day precision). Current advance readings and same-release prior comparisons are separate from the revised historical XML feed.${notice?' '+notice.note:''}${releaseNotice?' '+releaseNotice.note:''}`};
}

export function extractDolAdvancePdf(bytes,{timeoutMs=15000}={}){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength>maxBytes||Buffer.from(bytes).subarray(0,8).toString('ascii').match(/^%PDF-1\.[0-9]/)===null)return Promise.reject(new Error('Invalid DOL advance PDF input or byte limit'));
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./dol-advance-pdf-worker.mjs',import.meta.url),{workerData:bytes,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128}});
  let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>finish(new Error('DOL advance PDF extraction timeout')),timeoutMs);
  worker.once('message',result=>result?.error?finish(new Error('DOL advance PDF extraction: '+result.error)):finish(null,result));
  worker.once('error',error=>finish(error));worker.once('exit',code=>{if(!settled)finish(new Error('DOL advance PDF extraction exited before a result: '+code));});
 });
}

export async function collectDolAdvance({fetchImpl=globalThis.fetch,now=new Date(),extractPdf=extractDolAdvancePdf}={}){
 const {bytes,...provenance}=await requestBytes(DOL_ADVANCE_URL,{fetchImpl,maxBytes});
 if(provenance.url!==DOL_ADVANCE_URL)fail('unreviewed PDF redirect');
 if(!Buffer.from(bytes).subarray(0,8).toString('ascii').startsWith('%PDF-1.'))fail('response is not a PDF');
 const source=parseDolAdvanceText(await extractPdf(bytes),{now});
 const age=Math.floor((Date.parse(now.toISOString().slice(0,10))-Date.parse(source.releaseDate))/dayMs);
 return {...source,fetchedAt:provenance.retrievedAt,provenance:[provenance],warnings:age>10?[`DOL advance release is dated ${source.releaseDate}, ${age} days before this retrieval cutoff; a successful fetch does not establish a newer release.`]:[]};
}
