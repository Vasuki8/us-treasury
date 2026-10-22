import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseDolAdvanceText,collectDolAdvance,extractDolAdvancePdf} from '../scripts/sources/dol-advance.mjs';

import {releaseFixture} from './helpers/dol-advance-fixture.js';
const now=new Date('2026-10-22T20:00:00Z');

test('advance release keeps independently dated advance and same-release revised priors, reconciled to the SA table',()=>{
 const result=parseDolAdvanceText(releaseFixture(),{now});assert.equal(result.releaseDate,'2026-10-22');
 const initial=result.series.claimsAdvance.observations,continued=result.series.continuedClaimsAdvance.observations;
 assert.deepEqual(initial.map(row=>[row.date,row.value,row.releaseStage,row.publishedAt]),[['2026-10-10',200,'prior-week-revised','2026-10-22'],['2026-10-17',194,'advance','2026-10-22']]);
 assert.deepEqual(continued.map(row=>[row.date,row.value]),[['2026-10-03',1703],['2026-10-10',1728]]);
 assert.equal(initial[0].previouslyPublishedSourceValue,'199,000');assert.equal(continued[0].previouslyPublishedSourceValue,'1,710,000');
 assert.equal(initial[1].sourceValue,'194,000');assert.equal(initial[1].publicationDatePrecision,'day');assert.match(initial[1].footnotes.join(' '),/advance.*subject to revision/i);
 for(const s of Object.values(result.series)){assert.match(s.coverageNote,/separate.*revised|not.*splice/i);assert.match(s.publicationNote,/day precision/);assert.equal(s.licenseUrl,'https://www.dol.gov/general/aboutdol/copyright');}
});

test('explicit unrevised and unchanged priors retain zero changes without inventing a revision',()=>{
 const unrevised=releaseFixture({initial:'196,000',initialChange:'a decrease of 10,000',initialPrior:'unrevised level of 206,000',initialTable:'196,000 206,000 -10,000'});
 const row=parseDolAdvanceText(unrevised,{now}).series.claimsAdvance.observations[0];assert.equal(row.releaseStage,'prior-week-unrevised');assert.equal(row.value,206);assert.equal(row.previouslyPublishedSourceValue,'206,000');
 const unchanged=releaseFixture({initial:'200,000',initialChange:'unchanged',initialPrior:'unrevised level of 200,000',initialTable:'200,000 200,000 0'});
 const rows=parseDolAdvanceText(unchanged,{now}).series.claimsAdvance.observations;assert.equal(rows[1].value-rows[0].value,0);
});

test('January reference weeks resolve to the correct calendar year without shifting the continued period',()=>{
 const fixture=releaseFixture({header:'Thursday, January 8, 2026',initialDate:'January 3',priorInitialDate:'December 27',continuedDate:'December 27',priorContinuedDate:'December 20'});
 const result=parseDolAdvanceText(fixture,{now});assert.deepEqual(result.series.claimsAdvance.observations.map(row=>row.date),['2025-12-27','2026-01-03']);assert.deepEqual(result.series.continuedClaimsAdvance.observations.map(row=>row.date),['2025-12-20','2025-12-27']);
});

test('a leap-day Saturday remains valid when the other candidate year has no February 29',()=>{
 const fixture=releaseFixture({header:'Thursday, March 5, 2020',initialDate:'February 29',priorInitialDate:'February 22',continuedDate:'February 22',priorContinuedDate:'February 15'});
 assert.equal(parseDolAdvanceText(fixture,{now}).series.claimsAdvance.observations[1].date,'2020-02-29');
});

test('release parsing fails closed on contradictory dates, counts, revision arithmetic, missing or ambiguous evidence',()=>{
 const valid=releaseFixture();
 const changes=[
  s=>({...s,firstPage:s.firstPage.replace('Thursday, October 22','Friday, October 22')}),
  s=>({...s,firstPage:s.firstPage.replace('October 17, the advance','October 18, the advance')}),
  s=>({...s,firstPage:s.firstPage.replace('194,000, a decrease','193,000, a decrease')}),
  s=>({...s,firstPage:s.firstPage.replace('up by 1,000','up by 2,000')}),
  s=>({...s,firstPage:s.firstPage.replace('200,000. The 4-week','201,000. The 4-week')}),
  s=>({...s,firstPage:s.firstPage.replace('seasonally adjusted initial claims','not seasonally adjusted initial claims')}),
  s=>({...s,firstPage:s.firstPage.replace('SEASONALLY ADJUSTED DATA','UNADJUSTED DATA')}),
  s=>({...s,tableText:s.tableText.replace('194,000','193,000')}),
  s=>({...s,tableText:s.tableText.replace('October 17 October 10','October 10 October 3')}),
  s=>({...s,tableText:s.tableText+' '+s.tableText}),s=>({...s,tableText:''}),
  s=>({...s,firstPage:s.firstPage+' '+s.firstPage}),s=>({...s,firstPage:' '.repeat(30000)+s.firstPage}),
 ];
 for(const mutate of changes)assert.throws(()=>parseDolAdvanceText(mutate(valid),{now}),/DOL advance/i);
 assert.throws(()=>parseDolAdvanceText(valid,{now:new Date('2026-10-22T12:29:59Z')}),/embargo|future/i);
 assert.throws(()=>parseDolAdvanceText(valid,{now:new Date('2026-10-21T20:00:00Z')}),/future|embargo/i);
});

test('collector has independent source identity and exact PDF-byte provenance, with a stale-release warning',async()=>{
 const bytes=Buffer.from('%PDF-1.7\nsynthetic test bytes');let calls=0;
 const source=await collectDolAdvance({now,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://www.dol.gov/ui/data.pdf');assert.equal(options.method,'GET');return new Response(bytes);},extractPdf:async input=>{assert.deepEqual(Buffer.from(input),bytes);return releaseFixture();}});
 assert.equal(calls,1);assert.equal(source.id,'dolAdvance');assert.equal(source.provenance[0].sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(source.fetchedAt,source.provenance[0].retrievedAt);assert.equal(source.warnings.length,0);
 assert.deepEqual(Object.keys(source.series),['claimsAdvance','continuedClaimsAdvance']);assert.ok(!Object.hasOwn(source.series,'claims'));
 const stale=await collectDolAdvance({now:new Date('2026-11-10T20:00:00Z'),fetchImpl:async()=>new Response(bytes),extractPdf:async()=>releaseFixture()});assert.match(stale.warnings.join(' '),/release.*2026-10-22.*19 days/i);
 for(const status of [403,503])await assert.rejects(collectDolAdvance({now,fetchImpl:async()=>new Response('Unavailable',{status})}),/HTTP/);
 await assert.rejects(collectDolAdvance({now,fetchImpl:async()=>new Response('<html>Denied</html>')}),/PDF/i);
 await assert.rejects(collectDolAdvance({now,fetchImpl:async()=>new Response(Buffer.alloc(4*1024*1024+1))}),/limit/i);
});

function pdfFixture(text,pages=1){
 const lines=text.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').match(/.{1,100}/g)??[];
 const stream='BT /F1 9 Tf 10 780 Td '+lines.map((line,i)=>(i?'0 -10 Td ':'')+'('+line+') Tj').join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pages},()=> '3 0 R').join(' ')}] /Count ${pages} >>`,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let body='%PDF-1.4\n',offsets=[0];objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${value}\nendobj\n`;});const start=Buffer.byteLength(body);body+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(body);
}

test('maintained PDF extraction runs in a bounded worker and accepts no HTML or excessive page fan-out',async()=>{
 const parsed=await extractDolAdvancePdf(pdfFixture('Synthetic extraction test.'));assert.match(parsed.firstPage,/Synthetic extraction test/);assert.ok(parsed.tableText);
 await assert.rejects(extractDolAdvancePdf(Buffer.from('not a PDF')),/PDF/i);
 await assert.rejects(extractDolAdvancePdf(pdfFixture('too many',17)),/page/i);
 await assert.rejects(extractDolAdvancePdf(pdfFixture('timeout'),{timeoutMs:1}),/timeout/i);
});
