import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {assertMacroCoverageData} from '../scripts/macro-coverage-policy.mjs';
import {snapshot as stored} from '../src/official-snapshot.js';
import {dolRevisedFixture as fixture} from './helpers/dol-revised-fixture.js';

let policy;
try { policy=await import('../scripts/dol-revised-policy.mjs'); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('dol-revised-policy.mjs'))throw error; }
const api=()=>{assert.ok(policy,'DOL revised admission policy must exist');return policy;};
const xml='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const index='https://oui.doleta.gov/unemploy/archive.asp';
const pdfs=['100826','101526','102226','100126','092426'].map(day=>`https://oui.doleta.gov/press/2026/${day}.pdf`);
const receipts=[xml,index,...pdfs].map((url,i)=>({url,sha256:String(i+1).repeat(64),retrievedAt:`2026-10-26T12:00:0${i}.000Z`,lastModified:null}));
const tuple=receipt=>({sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt});
const xmlRow=(date,sourceValue)=>({date,value:sourceValue===''?null:Number(sourceValue.replaceAll(',',''))/1000,publishedAt:null,sourceValue,...tuple(receipts[0])});
const admission=source=>assertCommercialData({sources:{dol:source}});
function rejected(mutate,label){const source=fixture();mutate(source);assert.throws(()=>admission(source),/DOL revised|unreviewed|macro coverage/i,label);}
function shiftFixture(days){
 const shift=value=>new Date(Date.parse(value)-days*86400000).toISOString().slice(0,10);
 return JSON.parse(JSON.stringify(fixture()),(_key,value)=>{
  if(typeof value!=='string')return value;
  if(/^2026-\d{2}-\d{2}(?:T.*)?$/.test(value))return shift(value.slice(0,10))+value.slice(10);
  const match=/^https:\/\/oui.doleta.gov\/press\/2026\/(\d{2})(\d{2})26\.pdf$/.exec(value);
  if(!match)return value;
  const date=shift(`2026-${match[1]}-${match[2]}`);
  return `https://oui.doleta.gov/press/2026/${date.slice(5,7)}${date.slice(8,10)}26.pdf`;
 });
}
function retainedFixture(){
 const source=fixture(),xmlReceipt=source.provenance[0];
 xmlReceipt.retrievedAt='2026-12-07T12:00:00.000Z';
 source.provenance[1].retrievedAt='2026-12-07T12:00:01.000Z';
 for(const series of Object.values(source.series))for(const row of series.observations)if(row.sourceUrl===xml)row.retrievedAt=xmlReceipt.retrievedAt;
 const releases=[['2026-10-29','2026-10-17','2026-10-10'],['2026-11-05','2026-10-24','2026-10-17'],['2026-11-12','2026-10-31','2026-10-24'],['2026-11-19','2026-11-07','2026-10-31'],['2026-11-26','2026-11-14','2026-11-07'],['2026-12-03','2026-11-21','2026-11-14']];
 for(const [i,[date,claimsDate,continuedDate]]of releases.entries()){
  const receipt={url:`https://oui.doleta.gov/press/2026/${date.slice(5,7)}${date.slice(8)}26.pdf`,sha256:(i+8).toString(16).repeat(64),retrievedAt:`2026-12-07T12:00:0${i+2}.000Z`,lastModified:null};
  source.provenance.push(receipt);
  for(const [id,period,value]of [['claims',claimsDate,201+i],['continuedClaims',continuedDate,1704+i]]){
   const row={...source.series[id].observations.at(-1),date:period,value,sourceValue:String(value*1000),...tuple(receipt),publicationDate:date,releaseStage:'prior-week-revised',previouslyPublishedSourceValue:String(value*1000-1000)};
   source.series[id].observations.push(row);source.series[id].sourceUrls.push(receipt.url);source.series[id].latestObservationDate=period;
  }
 }
 source.fetchedAt='2026-12-07T12:00:07.000Z';source.latestObservationDate='2026-11-21';source.revisedHistoryProfile.latestReleaseDate='2026-12-03';
 return source;
}

test('DOL revised feed matcher permits only bare XML, archive index and valid dated official PDFs',()=>{
 const match=api().matchesDolRevisedFeed;
 for(const url of [xml,index,...pdfs,'https://oui.doleta.gov/press/2024/022924.pdf'])assert.equal(match(url),true,url);
 for(const url of [xml+'?',index+'#',pdfs[0]+'?download=1',pdfs[0]+'#',pdfs[0].replace('2026/','2025/'),pdfs[0].replace('100826','023026'),pdfs[0].replace('https://','http://'),pdfs[0].replace('gov/','gov:443/'),pdfs[0].replace('https://','https://user:pass@'),'https://example.com/press/2026/100826.pdf','https://www.dol.gov/ui/data.pdf','https://oui.doleta.gov/press/2026/100826.PDF'])assert.equal(match(url),false,url);
});

test('DOL revised admission accepts the complete two-series profile and preserves old XML meanings',()=>{
 const source=fixture();
 assert.equal(api().hasDolRevisedHistory(source),true);
 assert.doesNotThrow(()=>api().assertDolRevisedHistoryData(source));
 assert.doesNotThrow(()=>assertMacroCoverageData({sources:{dol:source}}));
 assert.doesNotThrow(()=>admission(source));
 assert.doesNotThrow(()=>admission(stored.sources.dol));
 assert.doesNotThrow(()=>api().assertDolRevisedHistoryData(undefined));
 assert.equal(source.series.claims.observations[1].value,null);
});

test('DOL revised admission rejects profile, feed, rights and measurement-scope substitutions',()=>{
 api();
 for(const [label,mutate]of [
  ['profile version',s=>s.revisedHistoryProfile.version=2],['extra profile key',s=>s.revisedHistoryProfile.scope='all'],['missing endpoint',s=>delete s.revisedHistoryProfile.xmlThrough.claims],['missing overlap',s=>delete s.revisedHistoryProfile.overlaps.continuedClaims],
  ['missing series',s=>delete s.series.continuedClaims],['extra series',s=>s.series.claimsAdvance=structuredClone(s.series.claims)],['source ID',s=>s.series.claims.sourceIds=['InitialClaims/NSA']],['series PDF override',s=>s.series.claims.sourceUrl=pdfs[0]],['scoped provenance',s=>delete s.series.claims.inputProvenanceScope],
  ['unrelated supporting URL',s=>s.series.claims.sourceUrls.push(index)],['missing supporting URL',s=>s.series.claims.sourceUrls.pop()],['frequency',s=>s.series.claims.frequency='Monthly'],['adjustment',s=>s.series.continuedClaims.adjustment='Not seasonally adjusted'],['unit',s=>s.series.claims.unit='Claims'],['rights',s=>s.series.claims.licenseUrl='https://vendor.example/terms'],['attribution',s=>s.series.claims.attribution='DOL'],['vendor notice',s=>s.series.claims.redistributionNotice='Vendor terms'],
 ])rejected(mutate,label);
});

test('DOL revised admission binds exact receipts to real row clocks, hashes and latest retrieval',()=>{
 api();
 for(const [label,mutate]of [
  ['row hash',s=>s.series.claims.observations.at(-1).sourceSha256='f'.repeat(64)],['row clock',s=>s.series.claims.observations[0].retrievedAt='2026-10-26T12:00:09.000Z'],['missing receipt',s=>s.provenance.pop()],['duplicate XML',s=>s.provenance.push(structuredClone(s.provenance[0]))],['extra receipt field',s=>s.provenance[0].requestYear=2026],['invalid receipt hash',s=>s.provenance[0].sha256='x'],['invalid receipt clock',s=>s.provenance[0].retrievedAt='2026-02-30T00:00:00.000Z'],['parent clock',s=>s.fetchedAt='2026-10-26T12:00:09.000Z'],['parent earlier clock',s=>s.fetchedAt=receipts[0].retrievedAt],['PDF query',s=>s.provenance[2].url+='?download=1'],['unapproved receipt',s=>s.provenance.push({url:'https://vendor.example/data',sha256:'a'.repeat(64),retrievedAt:s.fetchedAt,lastModified:null})],
  ['receipt hash coercion',s=>s.provenance[0].sha256=[s.provenance[0].sha256]],['row hash coercion',s=>s.series.claims.observations[0].sourceSha256=[s.provenance[0].sha256]],['row URL coercion',s=>s.series.claims.observations[0].sourceUrl=[xml]],['row clock coercion',s=>s.series.claims.observations[0].retrievedAt=[s.provenance[0].retrievedAt]],
 ])rejected(mutate,label);
});

test('DOL revised admission requires explicit PDF prior roles, raw counts and unknown publication instants',()=>{
 api();
 for(const [label,mutate]of [
  ['advance role',s=>s.series.claims.observations.at(-1).releaseStage='advance'],['unknown role',s=>s.series.claims.observations.at(-1).releaseStage='prior-week-unknown'],['count scaling',s=>s.series.claims.observations.at(-1).value=201],['raw count',s=>s.series.claims.observations.at(-1).sourceValue='200.0'],['old count',s=>s.series.claims.observations.at(-1).previouslyPublishedSourceValue='missing'],['unrevised disagreement',s=>s.series.claims.observations.at(-1).releaseStage='prior-week-unrevised'],['publication precision',s=>s.series.claims.observations.at(-1).publicationDatePrecision='second'],['invented instant',s=>s.series.claims.observations.at(-1).publishedAt='2026-10-22T12:30:00.000Z'],['wrong release date',s=>s.series.claims.observations.at(-1).publicationDate='2026-10-21'],['missing notes',s=>s.series.claims.observations.at(-1).footnotes=[]],['row receipt override',s=>s.series.claims.observations.at(-1).provenance=[s.provenance.at(-1)]],['XML role override',s=>s.series.claims.observations[0].releaseStage='prior-week-revised'],['XML count mismatch',s=>s.series.claims.observations[0].value=1],['XML null mismatch',s=>s.series.claims.observations[1].sourceValue='0'],
 ])rejected(mutate,label);
 const unrevised=fixture();Object.assign(unrevised.series.claims.observations.at(-1),{releaseStage:'prior-week-unrevised',previouslyPublishedSourceValue:'200000'});assert.doesNotThrow(()=>admission(unrevised));
});

test('DOL revised admission requires matching complete overlaps and continuous appended Saturdays',()=>{
 api();
 for(const [label,mutate]of [
  ['overlap count mismatch',s=>s.revisedHistoryProfile.overlaps.claims.sourceValue='198,000'],['overlap value mismatch',s=>s.revisedHistoryProfile.overlaps.claims.value=198],['overlap wrong week',s=>s.revisedHistoryProfile.overlaps.claims.date='2026-09-19'],['overlap role',s=>s.revisedHistoryProfile.overlaps.claims.releaseStage='advance'],['overlap missing metadata',s=>delete s.revisedHistoryProfile.overlaps.claims.footnotes],['tail gap',s=>s.series.claims.observations.splice(-2,1)],['duplicate week',s=>s.series.claims.observations.at(-1).date='2026-10-03'],['weekday',s=>s.series.claims.observations.at(-1).date='2026-10-11'],['pre-native period',s=>s.series.claims.observations[0].date='1966-12-31'],['wrong XML endpoint',s=>s.revisedHistoryProfile.xmlThrough.claims='2026-10-03'],['wrong latest release',s=>s.revisedHistoryProfile.latestReleaseDate='2026-10-15'],['wrong latest observation',s=>s.series.claims.latestObservationDate='2026-10-03'],
 ])rejected(mutate,label);
});

test('a series already ahead of the PDFs can prove an earlier exact XML overlap while the other series extends',()=>{
 api();
 const source=fixture();
 source.series.claims.observations=[...source.series.claims.observations.slice(0,3),xmlRow('2026-10-03','198000'),xmlRow('2026-10-10','200000'),xmlRow('2026-10-17','194000')];
 source.revisedHistoryProfile.xmlThrough.claims='2026-10-17';
 source.series.claims.sourceUrls=[xml,pdfs[0]];
 source.series.claims.latestObservationDate='2026-10-17';
 source.latestObservationDate='2026-10-17';
 assert.doesNotThrow(()=>admission(source));
 Object.assign(source.revisedHistoryProfile.overlaps.claims,{sourceValue:'200000',value:200});
 assert.throws(()=>admission(source),/overlap/i);
});

test('DOL revised admission bounds PDF/index receipts and prevents annual-regime bridges',()=>{
 api();
 rejected(s=>{for(let i=0;i<6;i++)s.provenance.push({url:`https://oui.doleta.gov/press/2026/0${i+1}0126.pdf`,sha256:'a'.repeat(64),retrievedAt:s.fetchedAt,lastModified:null});},'ninth PDF');
 rejected(s=>{s.provenance.push({...s.provenance[1],sha256:'a'.repeat(64)},{...s.provenance[1],sha256:'b'.repeat(64)});},'third archive index');
 assert.throws(()=>admission(shiftFixture(203)),/annual seasonal revision requires both XML endpoints/);
});

test('retained PDF history can exceed eight receipts while only the newly retrieved PDFs use the refresh budget',()=>{
 api();
 const source=retainedFixture();
 assert.equal(source.provenance.filter(receipt=>receipt.url.endsWith('.pdf')).length,11);
 assert.equal(source.series.claims.observations.find(row=>row.date==='2026-10-03').retrievedAt,'2026-10-26T12:00:03.000Z');
 assert.doesNotThrow(()=>admission(source));
 source.series.claims.observations.at(-1).retrievedAt='2026-11-30T12:00:00.000Z';
 assert.throws(()=>admission(source),/observation receipt/,'a retained-looking row clock must still select the actual matching receipt');
});

test('a ninth newly retrieved PDF fails even when every publication date is within valid notice context bounds',()=>{
 api();
 const source=retainedFixture();
 for(const date of ['2026-12-10','2026-12-17','2026-12-24'])source.provenance.push({url:`https://oui.doleta.gov/press/2026/${date.slice(5,7)}${date.slice(8)}26.pdf`,sha256:'e'.repeat(64),retrievedAt:'2026-12-28T12:00:00.000Z',lastModified:null});
 source.fetchedAt='2026-12-28T12:00:00.000Z';source.revisedHistoryProfile.latestReleaseDate='2026-12-24';
 assert.throws(()=>admission(source),/eight newly retrieved PDFs/);
});

test('archive indexes must be retrieved with the fresh XML',()=>{
 api();
 const oldIndex=fixture();oldIndex.provenance[1].retrievedAt='2026-10-26T11:59:59.000Z';
 assert.throws(()=>admission(oldIndex),/archive index.*XML/);
});

test('known applied revisions cannot be skipped by omitting their PDF receipt',()=>{
 api();
 const skipped=shiftFixture(196);skipped.provenance=skipped.provenance.filter(receipt=>receipt.url!=='https://oui.doleta.gov/press/2026/031926.pdf');
 assert.throws(()=>admission(skipped),/annual seasonal revision requires both XML endpoints/,'known annual barrier applies even without its PDF receipt');
});

test('DOL revised admission retains bounded context across the XML endpoint to catch seasonal notices',()=>{
 api();
 rejected(s=>{s.provenance.splice(-2);s.fetchedAt=s.provenance.at(-1).retrievedAt;},'missing context at or before the XML endpoint');
 rejected(s=>s.provenance.at(-1).url='https://oui.doleta.gov/press/2026/091726.pdf','context older than seven days before XML');
});

test('removing the DOL profile cannot admit PDF rows through legacy XML or another agency',()=>{
 api();
 rejected(s=>delete s.revisedHistoryProfile,'profile removal');
 rejected(s=>{delete s.revisedHistoryProfile;s.provenance=[s.provenance[0]];delete s.series.continuedClaims;delete s.series.claims.sourceUrls;delete s.series.claims.inputProvenanceScope;},'claims-only downgrade');
 const stripped=fixture();delete stripped.revisedHistoryProfile;
 for(const series of Object.values(stripped.series)){
  delete series.inputProvenanceScope;delete series.sourceUrls;
  series.observations=series.observations.map(({date,value,publishedAt,sourceValue})=>({date,value,publishedAt,sourceValue}));
 }
 assert.throws(()=>api().assertDolRevisedHistoryData(stripped),/DOL revised/i,'PDF/index receipts require the complete profile even when all row/series markers were removed');
 const other={sources:{bea:{...fixture(),series:{gdp:{sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt',sourceIds:['A191RL'],observations:[{date:'2026-07-01',value:1,publishedAt:null,sourceValue:'1',sourceUrl:xml}]}},provenance:[{url:xml}]}}};assert.throws(()=>assertCommercialData(other),/unreviewed|provenance/i);
});
