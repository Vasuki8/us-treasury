import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import * as core from '../src/refunding-desk.js';
import * as collector from '../scripts/sources/refunding-desk.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/treasury-desks/refunding-2026-08.json',import.meta.url)));
const pdfBytes=readFileSync(new URL('./fixtures/treasury-desks/buyback-2026-09.pdf',import.meta.url));
const pdfReceipt=JSON.parse(readFileSync(new URL('./fixtures/treasury-desks/buyback-2026-09.receipt.json',import.meta.url)));
const xmlUrl='https://home.treasury.gov/system/files/221/Tentative-Buyback-ScheduleQ32026.xml';
const pdfUrl=xmlUrl.replace('.xml','.pdf');
const datedIndex=fixture.documents.index.replace(/<a[^>]+>Buyback Schedule: XML<\/a>/,
 `<a href="${xmlUrl}">Buyback Schedule: XML Format</a> (Last updated on August 5, 2026)<br><a href="${pdfUrl}">Buyback Schedule: PDF Format</a> (Updated on September 9, 2026)`);
const documents=async()=>({...structuredClone(fixture.documents),index:datedIndex,...await collector.extractRefundingBuybackPdf(pdfBytes)});
function source(docs,receipts=fixture.provenance){
 const tables=core.parseRefundingDocuments(docs),values=[tables.package,tables.newCash,...tables.estimates.map(r=>r.borrowing)],links=core.refundingDocumentLinks(docs.index);
 return{id:'treasuryRefunding',status:'ok',fetchedAt:receipts.at(-1).retrievedAt,documents:docs,tables,provenance:structuredClone(receipts),series:Object.fromEntries(Object.entries(core.refundingDeskRegistry).map(([id,d],i)=>[id,{unit:d.unit,frequency:d.frequency,adjustment:d.adjustment,observationType:d.observationType,calculation:d.definition,sourceIds:[id],sourceUrl:i<2?links.policy:links.borrowing,licenseUrl:core.REFUNDING_TERMS,attribution:'Source: U.S. Department of the Treasury.',observations:[{date:i<2?tables.policyDate:tables.borrowingDate,value:values[i],sourceValue:String(values[i]),publishedAt:null}]}]))};
}

test('buyback discovery selects the latest dated official format independent of anchor order',()=>{
 assert.equal(core.refundingDocumentLinks(datedIndex).buybacks,pdfUrl);
 const reversed=datedIndex.replace(/(<a[^>]+>Buyback Schedule: XML[^]*?)(<a[^>]+>Buyback Schedule: PDF[^]*?\))/, '$2<br>$1');
 assert.equal(core.refundingDocumentLinks(reversed).buybacks,pdfUrl);
 assert.equal(core.refundingDocumentLinks(datedIndex.replace('September 9, 2026','July 9, 2026')).buybacks,xmlUrl);
 assert.equal(core.matchesRefundingDocumentUrl(pdfUrl),true);
 for(const url of [pdfUrl+'?redirect=1',pdfUrl+'#page=1',pdfUrl.replace('home.treasury.gov','example.com'),pdfUrl.replace('.pdf','.docx')])assert.equal(core.matchesRefundingDocumentUrl(url),false);
 for(const index of [datedIndex.replace('September 9, 2026','September 99, 2026'),datedIndex.replace(' (Updated on September 9, 2026)',''),datedIndex.replace(pdfUrl,pdfUrl+'?redirect=1'),datedIndex+`<a href="${pdfUrl.replace('Q32026','Q32026-v2')}">Buyback Schedule: PDF Format</a> (Updated on September 9, 2026)`])assert.throws(()=>core.refundingDocumentLinks(index));
});

test('actual Treasury PDF bytes retain native dates, amended amounts and lower-bound maximum semantics',async()=>{
 assert.equal(createHash('sha256').update(pdfBytes).digest('hex'),pdfReceipt.sha256);
 const d=await documents(),table=core.parseRefundingDocuments(d).buybacks;
 assert.equal(table.documentDate,'2026-09-09');assert.equal(table.sourceFormat,'pdf');assert.equal(table.sourceUrl,pdfUrl);assert.equal(table.versionStatus,'latest-linked');
 assert.equal(table.rows.length,20);assert.equal(table.startDate,'2026-08-06');assert.equal(table.endDate,'2026-11-05');
 const november=table.rows.find(r=>r.date==='2026-11-04');
 assert.equal(november.maximumDollars,'4000000000');assert.equal(november.maximumBillions,4);assert.equal(november.maximumOperator,'>=');assert.equal(november.maximumSourceValue,'= or > $4 billion');
 assert.equal(table.rows.find(r=>r.date==='2026-09-10').maximumBillions,6);
 assert.equal(table.rows.find(r=>r.date==='2026-09-15').maximumBillions,.5);
 assert.equal(table.rows.find(r=>r.date==='2026-11-05').maximumOperator,'=');
 assert.equal(table.rows[0].quarterRole,'previous refunding quarter');
 await assert.rejects(()=>collector.extractRefundingBuybackPdf(new Uint8Array(8*1024*1024+1)),/bound/);
});

test('buyback PDF admission rejects unknown native formats, shifted columns, omitted cells and publication mismatches',async()=>{
 const base=await documents();
 for(const mutate of [d=>d.buybacksGrid.cells.find(c=>c.text==='= or > $4 billion').text='approximately $4 billion',d=>d.buybacksGrid.cells.find(c=>c.text==='Maximum').x=100,d=>d.buybacksGrid.cells.splice(d.buybacksGrid.cells.findIndex(c=>c.text==='$6 billion'),1),d=>d.buybacksGrid.cells.find(c=>c.text==='11/4/2026').text='11/40/2026',d=>d.buybacksGrid.cells.find(c=>c.text==='For Publication September 9, 2026').text='For Publication September 10, 2026']){
  const d=structuredClone(base);mutate(d);d.buybacks=d.buybacksGrid.cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim();assert.throws(()=>core.parseRefundingDocuments(d));
 }
 const altered=structuredClone(base);altered.buybacks=altered.buybacks.replace('$6 billion','$60 billion');assert.throws(()=>core.parseRefundingDocuments(altered));
});

test('reviewed buyback PDF admits publication in the preceding month and rejects a two-month lead',async()=>{
 const base=await documents(),nativeRows=core.parseRefundingDocuments(base).buybacks.rows;
 const published=(nativeDate,indexDate,xmlDate)=>{
  const d=structuredClone(base);d.index=d.index.replace('September 9, 2026',indexDate).replace('August 5, 2026',xmlDate);
  d.buybacksGrid.cells.find(c=>c.text.startsWith('For Publication ')).text='For Publication '+nativeDate;
  d.buybacks=d.buybacksGrid.cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim();return d;
 };
 const preceding=core.parseRefundingDocuments(published('July 31, 2026','July 31, 2026','July 30, 2026')).buybacks;
 assert.equal(preceding.documentDate,'2026-07-31');assert.deepEqual(preceding.rows,nativeRows);
 assert.throws(()=>core.parseRefundingDocuments(published('June 30, 2026','June 30, 2026','June 29, 2026')),/Mismatched buyback refunding quarter/);
 assert.throws(()=>core.parseRefundingDocuments(published('July 31, 2026','July 30, 2026','July 29, 2026')),/Mismatched buyback PDF publication/);
 // Crossing a calendar year cannot turn a distant publication into a one-month lead.
 assert.throws(()=>core.parseRefundingDocuments(published('December 31, 2025','December 31, 2025','December 30, 2025')),/Mismatched buyback refunding quarter/);
});

test('buyback publication rejects conflicting index dates and forged prior-quarter footnotes',async()=>{
 assert.throws(()=>core.refundingDocumentLinks(datedIndex.replace('(Updated on September 9, 2026)','(Updated on September 9, 2026) (Updated on September 10, 2026)')));
 const d=await documents();d.buybacksGrid.cells.find(c=>c.text.startsWith('*Operation')).text='*Operation is scheduled within the May 2027 refunding quarter.';d.buybacks=d.buybacksGrid.cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim();assert.throws(()=>core.parseRefundingDocuments(d));
});

test('buyback discovery cannot repurpose an allowed PDF from another source role',()=>{
 assert.throws(()=>core.refundingDocumentLinks(datedIndex.replace(pdfUrl,'https://home.treasury.gov/system/files/221/TreasuryPresentationToTBACQ42026.pdf')));
});

test('new PDF capture binds six exact roles and old XML remains valid but visibly superseded',async()=>{
 const receipts=[...fixture.provenance.slice(0,-1),pdfReceipt],current=source(await documents(),receipts);
 assert.equal(core.validateRefundingDeskSource(current),true);
 assert.deepEqual(core.refundingBuybackPublication(current),{status:'latest-linked',documentDate:'2026-09-09',latestDocumentDate:'2026-09-09',sourceUrl:pdfUrl,latestSourceUrl:pdfUrl});
 const old=source({...structuredClone(fixture.documents),index:datedIndex});assert.equal(core.validateRefundingDeskSource(old),true);
 assert.deepEqual(core.refundingBuybackPublication(old),{status:'superseded',documentDate:'2026-08-05',latestDocumentDate:'2026-09-09',sourceUrl:xmlUrl,latestSourceUrl:pdfUrl});
 for(const mutate of [s=>s.provenance.at(-1).url=xmlUrl,s=>s.tables.buybacks.rows.find(r=>r.maximumOperator==='>=').maximumOperator='=',s=>s.provenance.push({...s.provenance.at(-1)}),s=>s.tables.buybacks.documentDate='2026-08-05',s=>s.fetchedAt='2026-09-08T00:00:00.000Z']){const s=structuredClone(current);mutate(s);assert.equal(core.validateRefundingDeskSource(s),false);}
 const earlyReceipt=structuredClone(current);earlyReceipt.provenance.at(-1).retrievedAt='2026-09-08T00:00:00.000Z';earlyReceipt.provenance[0].retrievedAt=earlyReceipt.fetchedAt;assert.equal(core.validateRefundingDeskSource(earlyReceipt),false);
 const browserCode=readFileSync(new URL('../src/refunding-desk.js',import.meta.url),'utf8').replace(/\bexport /g,'')+'\nvalidateRefundingDeskSource(candidate)';
 assert.equal(runInNewContext(browserCode,{URL,candidate:structuredClone(current)},{timeout:2000}),true);
});

// Real PDF extraction and parsing stay in the collector path; only network I/O is substituted.
function surveyPdf(text){
 const lines=['Longer-Term Privately-Held Net Marketable Borrowing Estimates',...text.replace(/[^\x20-\x7e]/g,' ').match(/.{1,90}(?: |$)/g)],escaped=lines.map(s=>s.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)')),stream=`BT /F1 6 Tf 36 750 Td 9 TL ${escaped.map(s=>`(${s}) Tj T*`).join(' ')} ET`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf);
}
test('collector fetches only selected reviewed PDF role and keeps exact six hashed input receipts',async()=>{
 const links=core.refundingDocumentLinks(datedIndex),bodies=new Map([[core.REFUNDING_INDEX,datedIndex],[links.borrowing,fixture.documents.borrowing],[links.policy,fixture.documents.policy],[links.recommended,readFileSync(new URL('./fixtures/treasury-desks/tbac-2026-08.pdf',import.meta.url))],[links.presentation,surveyPdf(fixture.documents.survey)],[pdfUrl,pdfBytes]]),calls=[];
 const fetchImpl=async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.ok(bodies.has(url),'unexpected URL '+url);return new Response(bodies.get(url));};
 const captured=await collector.collectRefundingDesk({fetchImpl});
 assert.equal(core.validateRefundingDeskSource(captured),true);assert.equal(captured.provenance.length,6);assert.deepEqual(calls,[...bodies.keys()]);assert.ok(!calls.includes(xmlUrl));
 assert.equal(captured.provenance.at(-1).sha256,pdfReceipt.sha256);assert.equal(captured.tables.buybacks.rows.find(r=>r.date==='2026-11-04').maximumOperator,'>=');
 await assert.rejects(()=>collector.collectRefundingDesk({fetchImpl:async()=>Object.assign(new Response(datedIndex),{redirected:true})}),/redirect/);
});
