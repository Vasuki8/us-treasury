import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectDolWithRevisions,discoverDolReleases} from '../scripts/sources/dol-revised.mjs';
import {DOL_SEASONAL_UPDATE_NOTICES,parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {assertDolRevisedHistoryData} from '../scripts/dol-revised-policy.mjs';
import {dolRevisedFixture} from './helpers/dol-revised-fixture.js';
import {releaseFixture} from './helpers/dol-advance-fixture.js';

const xmlUrl='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const indexUrl='https://oui.doleta.gov/unemploy/archive.asp';
const now=new Date('2026-10-26T20:00:00Z');
const day=86400000;
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*day).toISOString().slice(0,10);
const monthDay=date=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
const number=value=>value.toLocaleString('en-US');
const pdfUrl=date=>`https://oui.doleta.gov/press/${date.slice(0,4)}/${date.slice(5,7)}${date.slice(8)}${date.slice(2,4)}.pdf`;
const xml=(rows)=>`<r539cyNational rundate="10/26/2026">${rows.map(([date,initial,continued])=>`<week><weekEnded>${date.slice(5,7)}/${date.slice(8)}/${date.slice(0,4)}</weekEnded><InitialClaims><SA>${initial??''}</SA></InitialClaims><ContinuedClaims><SA>${continued??''}</SA></ContinuedClaims></week>`).join('')}</r539cyNational>`;
const baseRows=[['2026-09-12','201,000','1,690,000'],['2026-09-19',null,'1,699,000'],['2026-09-26','199,000','1,714,000']];
function fixture(date,initialPriorDate,continuedPriorDate,initialPrior,continuedPrior,{notice,unrevised=false}={}){
 const result=releaseFixture({
  header:new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}),
  initialDate:monthDay(shift(initialPriorDate,7)),priorInitialDate:monthDay(initialPriorDate),continuedDate:monthDay(shift(continuedPriorDate,7)),priorContinuedDate:monthDay(continuedPriorDate),
  initial:number(initialPrior+1000),initialChange:'an increase of 1,000',initialPrior:unrevised?`unrevised level of ${number(initialPrior)}`:`revised level. The previous week's level was revised up by 1,000 from ${number(initialPrior-1000)} to ${number(initialPrior)}`,
  continued:number(continuedPrior+1000),continuedChange:'an increase of 1,000',continuedPrior:unrevised?`unrevised level of ${number(continuedPrior)}`:`revised level. The previous week's level was revised up by 1,000 from ${number(continuedPrior-1000)} to ${number(continuedPrior)}`,
  initialTable:`${number(initialPrior+1000)} ${number(initialPrior)} +1,000`,continuedTable:`${number(continuedPrior+1000)} ${number(continuedPrior)} +1,000`,
 });
 if(notice)result.firstPage=result.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA',notice+' UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA');
 return result;
}
const october={
 '2026-10-22':fixture('2026-10-22','2026-10-10','2026-10-03',200000,1703000),
 '2026-10-15':fixture('2026-10-15','2026-10-03','2026-09-26',198000,1714000),
 '2026-10-08':fixture('2026-10-08','2026-09-26','2026-09-19',199000,1699000),
 '2026-10-01':fixture('2026-10-01','2026-09-19','2026-09-12',200000,1690000),
 '2026-09-24':fixture('2026-09-24','2026-09-12','2026-09-05',201000,1688000),
};
function harness({rows=baseRows,releases=october,indexes,mutateResponse}={}){
 const requests=[],bytes=new Map(Object.keys(releases).map(date=>[pdfUrl(date),Buffer.from('%PDF-1.7\n'+date)]));
 return {requests,bytes,fetchImpl:async(url,options)=>{
  requests.push({url,method:options.method,body:options.body,redirect:options.redirect});
  const replacement=mutateResponse?.(url,options);if(replacement)return replacement;
  if(url===xmlUrl)return new Response(xml(rows));
  if(url===indexUrl){const year=new URLSearchParams(options.body).get('year');return new Response(indexes?.[year]??`<html><p>UI Weekly Claims News Release</p><table class="calendar"><caption>${year}</caption>${Object.keys(releases).filter(date=>date.startsWith(year)).map(date=>`<a href="${pdfUrl(date)}">${date}</a>`).join('')}</table></html>`);}
  assert.ok(bytes.has(url),'never request an undiscovered dated PDF: '+url);return new Response(bytes.get(url));
 },extractPdf:async input=>releases[Buffer.from(input).toString().split('\n')[1]]};
}
const collect=options=>collectDolWithRevisions({now,...options});

function retainedTailFixture(){
 const source=dolRevisedFixture(),through='2026-06-27',releases={},receipts=[{url:xmlUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-19T12:00:00.000Z',lastModified:null},{url:indexUrl,sha256:'b'.repeat(64),retrievedAt:'2026-10-19T12:00:01.000Z',lastModified:null}],pdfRows={claims:[],continuedClaims:[]};
 for(let i=0;i<17;i++){
  const publicationDate=shift('2026-06-25',i*7),text=fixture(publicationDate,shift(publicationDate,-12),shift(publicationDate,-19),200000,1700000),bytes=Buffer.from('%PDF-1.7\n'+publicationDate);
  releases[publicationDate]=text;
  const receipt={url:pdfUrl(publicationDate),sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:shift(publicationDate,1)+'T12:00:00.000Z',lastModified:null};receipts.push(receipt);
  const parsed=parseDolAdvanceText(text,{now});
  for(const [id,advanceId]of [['claims','claimsAdvance'],['continuedClaims','continuedClaimsAdvance']])pdfRows[id].push({...parsed.series[advanceId].observations[0],publishedAt:null,publicationDate,sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt});
 }
 source.provenance=receipts;source.fetchedAt=receipts[1].retrievedAt;source.latestObservationDate='2026-10-03';
 source.revisedHistoryProfile={version:1,xmlThrough:{claims:through,continuedClaims:through},latestReleaseDate:'2026-10-15',overlaps:{}};
 for(const id of ['claims','continuedClaims']){
  const base={date:through,value:id==='claims'?200:1700,publishedAt:null,sourceValue:id==='claims'?'200,000':'1,700,000',sourceUrl:xmlUrl,sourceSha256:receipts[0].sha256,retrievedAt:receipts[0].retrievedAt};
  const overlap=pdfRows[id].find(row=>row.date===through);source.revisedHistoryProfile.overlaps[id]=overlap;
  const series=source.series[id];series.observations=[base,...pdfRows[id].filter(row=>row.date>through)];series.latestObservationDate=series.observations.at(-1).date;series.sourceUrls=[...new Set([xmlUrl,...series.observations.map(row=>row.sourceUrl),overlap.sourceUrl])];
 }
 return {source,releases};
}

test('discovery uses only actual exact dated PDF links for the requested year and UTC cutoff',()=>{
 const html=`<a href="../press/2026/102226.pdf">Oct 22</a><a href='/press/2026/101526.pdf'>Oct 15</a><a href="https://oui.doleta.gov/press/2026/101526.pdf">duplicate</a><a href="https://example.com/press/2026/100826.pdf">foreign</a><a href="/press/2026/100826.pdf?download=1">query</a><a href="/press/2026/103226.pdf">invalid day</a><a href="/press/2025/122525.pdf">other year</a><a href="/press/2026/102926.pdf">future</a><a data-href="/press/2026/100826.pdf">not a link</a><!-- <a href="/press/2026/100126.pdf">comment</a> -->`;
 assert.deepEqual(discoverDolReleases(html,{year:2026,now}),[{url:pdfUrl('2026-10-22'),publicationDate:'2026-10-22'},{url:pdfUrl('2026-10-15'),publicationDate:'2026-10-15'}]);
 assert.throws(()=>discoverDolReleases(' '.repeat(2*1024*1024+1),{year:2026,now}),/limit|size/i);
});

test('October bridge preserves XML and adds independently dated confirmed priors with scoped receipts',async()=>{
 const h=harness(),result=await collect(h),initial=result.series.claims,continued=result.series.continuedClaims;
 assert.deepEqual(initial.observations.map(row=>[row.date,row.value,row.sourceValue]),[['2026-09-12',201,'201,000'],['2026-09-19',null,''],['2026-09-26',199,'199,000'],['2026-10-03',198,'198,000'],['2026-10-10',200,'200,000']]);
 assert.deepEqual(continued.observations.map(row=>[row.date,row.value]),[['2026-09-12',1690],['2026-09-19',1699],['2026-09-26',1714],['2026-10-03',1703]]);
 assert.deepEqual(result.revisedHistoryProfile.xmlThrough,{claims:'2026-09-26',continuedClaims:'2026-09-26'});
 assert.deepEqual(Object.keys(result.revisedHistoryProfile).sort(),['latestReleaseDate','overlaps','version','xmlThrough']);assert.equal(result.revisedHistoryProfile.version,1);assert.equal(result.revisedHistoryProfile.latestReleaseDate,'2026-10-22');
 assert.equal(result.revisedHistoryProfile.overlaps.claims.date,'2026-09-26');assert.equal(result.revisedHistoryProfile.overlaps.continuedClaims.date,'2026-09-26');
 assert.equal(result.latestObservationDate,'2026-10-10');assert.equal(continued.latestObservationDate,'2026-10-03');
 for(const [id,series]of Object.entries(result.series)){
  assert.equal(series.sourceUrl,xmlUrl);assert.equal(series.inputProvenanceScope,'observation-source-urls');assert.equal(series.frequency,'Weekly');assert.equal(series.adjustment,'Seasonally adjusted');assert.equal(series.observationType,'official');assert.equal(series.dataStatus,'official');
  assert.match(series.unit,/Thousands/);assert.ok(series.coverageNote.length<600);assert.match(series.coverageNote,/XML.*2026-09-26/);assert.match(series.publicationNote,/day precision/);
  for(const row of [...series.observations,result.revisedHistoryProfile.overlaps[id]]){
   const receipt=result.provenance.find(receipt=>receipt.url===row.sourceUrl&&receipt.sha256===row.sourceSha256);assert.ok(receipt);assert.equal(row.retrievedAt,receipt.retrievedAt);assert.equal(row.publishedAt,null);assert.ok(!Object.hasOwn(row,'provenance'));
   if(row.sourceUrl!==xmlUrl){assert.match(row.releaseStage,/^prior-week-(revised|unrevised)$/);assert.equal(row.publicationDatePrecision,'day');assert.equal(typeof row.previouslyPublishedSourceValue,'string');assert.ok(row.footnotes.length);}
  }
  assert.deepEqual(new Set(series.sourceUrls),new Set([xmlUrl,...series.observations.map(row=>row.sourceUrl),result.revisedHistoryProfile.overlaps[id].sourceUrl]));
 }
 assert.equal(result.provenance.length,7);assert.equal(result.fetchedAt,result.provenance.map(row=>row.retrievedAt).sort().at(-1));
 assert.deepEqual(h.requests.filter(row=>row.url.endsWith('.pdf')).map(row=>row.url),[pdfUrl('2026-10-22'),pdfUrl('2026-10-15'),pdfUrl('2026-10-08'),pdfUrl('2026-10-01'),pdfUrl('2026-09-24')]);
 const index=h.requests.find(row=>row.url===indexUrl);assert.equal(index.method,'POST');assert.equal(index.body,'report=press&year=2026&submit=Submit');
 assert.ok(h.requests.every(row=>row.redirect==='error'));assert.match(result.warnings.join(' '),/DOL XML base.*2026-09-26/);assert.doesNotMatch(result.warnings.join(' '),/DOL historical feed latest/);
 const receipt=result.provenance.find(row=>row.url===pdfUrl('2026-10-22'));assert.equal(receipt.sha256,createHash('sha256').update(h.bytes.get(receipt.url)).digest('hex'));
});

test('explicit unrevised priors are eligible and current advance values never enter history',async()=>{
 const releases={...october,'2026-10-22':fixture('2026-10-22','2026-10-10','2026-10-03',200000,1703000,{unrevised:true})};
 const result=await collect(harness({releases}));assert.equal(result.series.claims.observations.at(-1).releaseStage,'prior-week-unrevised');assert.equal(result.series.claims.observations.at(-1).previouslyPublishedSourceValue,'200,000');assert.ok(!result.series.claims.observations.some(row=>row.date==='2026-10-17'));
});

test('missing weekly bridge and numeric overlap mismatch fail the candidate',async()=>{
 await assert.rejects(collect(harness({releases:{'2026-10-22':october['2026-10-22'],'2026-10-08':october['2026-10-08']}})),/bridge|continuous|overlap|window/i);
 await assert.rejects(collect(harness({rows:baseRows.map(row=>row[0]==='2026-09-26'?[row[0],'200,000',row[2]]:row)})),/overlap/i);
 const result=await collect(harness({rows:baseRows.map(row=>row[0]==='2026-09-26'?[row[0],'199000',row[2]]:row)}));assert.equal(result.series.claims.observations[2].sourceValue,'199000');assert.equal(result.revisedHistoryProfile.overlaps.claims.sourceValue,'199,000');
});

test('a missing endpoint PDF can use an earlier exact retained XML overlap with a complete tail and notice context',async()=>{
 const releases={...october};delete releases['2026-10-08'];
 const result=await collect(harness({releases}));assert.equal(result.revisedHistoryProfile.overlaps.claims.date,'2026-09-12');assert.equal(result.series.claims.latestObservationDate,'2026-10-10');assert.equal(result.series.claims.observations.at(-1).sourceValue,'200,000');
});

test('one XML series can already exceed its newest PDF prior while the other series extends',async()=>{
 const rows=[...baseRows,['2026-10-03',null,'1,703,000'],['2026-10-10',null,'1,728,000']];
 const result=await collect(harness({rows}));assert.equal(result.revisedHistoryProfile.xmlThrough.claims,'2026-09-26');assert.equal(result.revisedHistoryProfile.xmlThrough.continuedClaims,'2026-10-10');assert.equal(result.revisedHistoryProfile.overlaps.continuedClaims.date,'2026-10-03');assert.equal(result.series.claims.latestObservationDate,'2026-10-10');assert.equal(result.series.continuedClaims.latestObservationDate,'2026-10-10');assert.ok(result.series.continuedClaims.observations.every(row=>row.sourceUrl===xmlUrl));
});

test('unknown notice or prior role, dated PDF mismatch and redirect fail closed',async()=>{
 const unknown=structuredClone(october);unknown['2026-10-22'].firstPage=unknown['2026-10-22'].firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA','New seasonal factors now apply. UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA');
 await assert.rejects(collect(harness({releases:unknown})),/notice/i);
 const role=structuredClone(october);role['2026-10-22'].firstPage=role['2026-10-22'].firstPage.replace("previous week's revised level", "previous week's final level");await assert.rejects(collect(harness({releases:role})),/advance|prior/i);
 const mismatch=harness();mismatch.extractPdf=async()=>october['2026-10-15'];await assert.rejects(collect(mismatch),/date|publication/i);
 const redirected=harness({mutateResponse:url=>{if(url===pdfUrl('2026-10-22')){const response=new Response('%PDF-1.7\nredirect');Object.defineProperty(response,'url',{value:'https://example.com/other.pdf'});return response;}}});await assert.rejects(collect(redirected),/redirect|URL/i);
 const xmlRedirect=harness({mutateResponse:url=>{if(url===xmlUrl){const response=new Response(xml(baseRows));Object.defineProperty(response,'url',{value:'https://example.com/xml'});return response;}}});await assert.rejects(collect(xmlRedirect),/redirect|URL/i);
});

test('failed PDF fetch and size violations reject without returning a partial supplement',async()=>{
 for(const replacement of [()=>new Response('unavailable',{status:503}),()=>new Response('<html>denied</html>'),()=>new Response(Buffer.alloc(4*1024*1024+1))])await assert.rejects(collect(harness({mutateResponse:url=>url===pdfUrl('2026-10-15')?replacement():undefined})),/HTTP|PDF|limit/i);
});

test('previous coverage cannot shrink when a prior PDF disappears or the XML base loses old weeks',async()=>{
 const previous=await collect(harness());
 const releases={...october};delete releases['2026-10-22'];await assert.rejects(collect({...harness({releases}),previous}),/shrink|coverage|latest/i);
 await assert.rejects(collect({...harness({rows:baseRows.slice(1)}),previous}),/shrink|coverage|histor/i);
});

test('XML catch-up supersedes supplement naturally without old PDF overrides',async()=>{
 const previous=await collect(harness());const h=harness({rows:[...baseRows,['2026-10-03','198,000','1,703,000'],['2026-10-10','200,000',null]]});
 const result=await collect({...h,previous});assert.ok(!Object.hasOwn(result,'revisedHistoryProfile'));assert.equal(result.series.claims.observations.length,5);assert.ok(result.series.claims.observations.every(row=>!Object.hasOwn(row,'sourceSha256')));assert.equal(result.provenance.length,1);
});

test('new-year discovery falls back to previous year and accepts actual holiday release dates',async()=>{
 const releases={
  '2026-01-08':fixture('2026-01-08','2025-12-27','2025-12-20',200000,1700000),
  '2025-12-31':fixture('2025-12-31','2025-12-20','2025-12-13',199000,1699000),
  '2025-12-18':fixture('2025-12-18','2025-12-06','2025-11-29',198000,1698000),
  '2025-12-11':fixture('2025-12-11','2025-11-29','2025-11-22',198000,1698000),
 };
 const rows=[['2025-12-13','198,000','1,699,000'],['2025-12-20','199,000',null]],h=harness({releases,rows});
 const result=await collectDolWithRevisions({...h,now:new Date('2026-01-10T20:00:00Z')});assert.equal(result.series.claims.latestObservationDate,'2025-12-27');assert.equal(result.series.continuedClaims.latestObservationDate,'2025-12-20');assert.deepEqual(h.requests.filter(row=>row.url===indexUrl).map(row=>new URLSearchParams(row.body).get('year')),['2026','2025']);
});

test('discovery and bridging stop after eight actual PDFs and at most two annual indexes',async()=>{
 const dates=Array.from({length:10},(_,i)=>shift('2026-10-22',-7*i));const releases=Object.fromEntries(dates.map((date,i)=>[date,fixture(date,shift('2026-10-10',-7*i),shift('2026-10-03',-7*i),200000,1700000)]));
 const h=harness({releases,rows:[['2026-07-04','200,000','1,700,000']]});await assert.rejects(collect(h),/eight|8|window|overlap|bridge/i);assert.equal(h.requests.filter(row=>row.url.endsWith('.pdf')).length,8);assert.ok(h.requests.filter(row=>row.url===indexUrl).length<=2);
});

test('captured applied seasonal updates block old XML regimes even if isolated overlaps match',async()=>{
 const applied='2026-03-19',releases={
  '2026-04-02':fixture('2026-04-02','2026-03-21','2026-03-14',200000,1700000),
  '2026-03-26':fixture('2026-03-26','2026-03-14','2026-03-07',200000,1700000),
  [applied]:fixture(applied,'2026-03-07','2026-02-28',200000,1700000,{notice:DOL_SEASONAL_UPDATE_NOTICES[applied].sourceText}),
 };
 const h=harness({releases,rows:[['2026-02-28','200,000','1,700,000'],['2026-03-07','200,000',null]]});
 await assert.rejects(collectDolWithRevisions({...h,now:new Date('2026-04-03T20:00:00Z')}),/seasonal|regime|annual/i);
});

test('complete matching anchors still scan every dated release back through both XML endpoints for notices',async()=>{
 const releases=structuredClone(october);releases['2026-10-01'].firstPage=releases['2026-10-01'].firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA','Unknown applied annual seasonal revision. UNEMPLOYMENT INSURANCE WEEKLY CLAIMS SEASONALLY ADJUSTED DATA');
 await assert.rejects(collect(harness({releases})),/notice/i);
});

test('a missing release context cannot be bridged by scanning beyond the preceding XML week',async()=>{
 const releases={...october,'2026-09-17':fixture('2026-09-17','2026-09-05','2026-08-29',200000,1700000)};delete releases['2026-10-01'];delete releases['2026-09-24'];
 await assert.rejects(collect(harness({releases})),/context|window|bridge/i);
});

test('retry receipts contain only successful responses and preserve exact retry options',async()=>{
 let failures=0;const waits=[],h=harness({mutateResponse:url=>url===pdfUrl('2026-10-22')&&failures++===0?new Response('temporary',{status:503}):undefined});
 const result=await collect({...h,maxAttempts:2,pause:async ms=>waits.push(ms)});assert.deepEqual(waits,[5000]);assert.equal(result.provenance.filter(row=>row.url===pdfUrl('2026-10-22')).length,1);assert.equal(result.provenance.find(row=>row.url===pdfUrl('2026-10-22')).sha256,createHash('sha256').update(h.bytes.get(pdfUrl('2026-10-22'))).digest('hex'));
});

test('a verified fourteen-week retained tail advances within eight new PDFs and preserves original row receipts',async()=>{
 const {source:previous,releases}=retainedTailFixture();assertDolRevisedHistoryData(previous);
 releases['2026-10-22']=fixture('2026-10-22','2026-10-10','2026-10-03',200000,1700000);
 const h=harness({rows:[['2026-06-27','200,000','1,700,000']],releases}),result=await collect({...h,previous});
 assert.equal(result.series.claims.latestObservationDate,'2026-10-10');assert.equal(result.series.continuedClaims.latestObservationDate,'2026-10-03');assert.equal(result.series.claims.observations.length,16);assert.equal(result.series.continuedClaims.observations.length,15);assert.ok(h.requests.filter(row=>row.url.endsWith('.pdf')).length<=8);
 const original=previous.series.claims.observations.find(row=>row.date==='2026-07-04'),retained=result.series.claims.observations.find(row=>row.date==='2026-07-04');assert.deepEqual(retained,original);assert.equal(retained.sourceUrl,pdfUrl('2026-07-16'));assert.equal(retained.retrievedAt,'2026-07-17T12:00:00.000Z');
 assert.ok(result.provenance.filter(row=>row.url.endsWith('.pdf')).length>8);assert.equal(new Set(result.provenance.filter(row=>row.url.endsWith('.pdf')).map(row=>row.url)).size,result.provenance.filter(row=>row.url.endsWith('.pdf')).length);
 const replaced=result.series.claims.observations.find(row=>row.date==='2026-10-03');assert.ok(replaced.retrievedAt>previous.series.claims.observations.at(-1).retrievedAt);assert.equal(replaced.retrievedAt,result.provenance.find(row=>row.url===replaced.sourceUrl).retrievedAt);assert.equal(previous.series.claims.observations.at(-1).retrievedAt,'2026-10-16T12:00:00.000Z');assertDolRevisedHistoryData(result);
});

test('untrusted retained profiles are rejected before any source request',async()=>{
 const previous=dolRevisedFixture();previous.series.claims.observations.at(-1).sourceSha256='f'.repeat(64);const h=harness();await assert.rejects(collect({...h,previous}),/receipt|hash|revised history/i);assert.equal(h.requests.length,0);
});

test('partial XML catch-up supersedes retained PDF rows and prunes only context older than its preceding week',async()=>{
 const {source:previous,releases}=retainedTailFixture();releases['2026-10-22']=fixture('2026-10-22','2026-10-10','2026-10-03',200000,1700000);
 const rows=Array.from({length:13},(_,i)=>[shift('2026-06-27',i*7),'200,000','1,700,000']);
 const result=await collect({...harness({rows,releases}),previous});assert.deepEqual(result.revisedHistoryProfile.xmlThrough,{claims:'2026-09-19',continuedClaims:'2026-09-19'});assert.equal(result.series.claims.observations.find(row=>row.date==='2026-07-04').sourceUrl,xmlUrl);assert.ok(!result.provenance.some(row=>row.url===pdfUrl('2026-07-16')));assert.equal(result.provenance.find(row=>row.url===pdfUrl('2026-09-17')).retrievedAt,'2026-09-18T12:00:00.000Z');assertDolRevisedHistoryData(result);
});

test('fully caught-up XML supersedes retained PDF values even when the authoritative counts changed',async()=>{
 const {source:previous,releases}=retainedTailFixture();releases['2026-10-22']=fixture('2026-10-22','2026-10-10','2026-10-03',200000,1700000);
 const rows=Array.from({length:16},(_,i)=>[shift('2026-06-27',i*7),i===14?'201,000':'200,000','1,700,000']);
 const result=await collect({...harness({rows,releases}),previous});assert.ok(!Object.hasOwn(result,'revisedHistoryProfile'));assert.equal(result.series.claims.observations.find(row=>row.date==='2026-10-03').value,201);assert.equal(result.provenance.length,1);
});
