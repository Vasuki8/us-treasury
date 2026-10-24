import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublicationUpkeep,publicationUpkeepExitCode} from '../scripts/check-publication-upkeep.mjs';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';

const headline='https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/cpi.csv?sc_lang=en';
const core='https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/core.csv?sc_lang=en';
const gdp='https://www.bea.gov/data/gdp/gross-domestic-product';
const gdpHtml='<a href="https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx">GDP workbook</a>';
const csv=(series,month='09')=>`date,${series}_index,ann_monthly_chg\n08/01/2026,100,1\n${month}/01/2026,101,2\n`;

test('automatic CPI upkeep uses the Fed downloads without requesting any blocked BLS page or replacing retained facts',async()=>{
 const calls=[],before=JSON.stringify(cpiPublicationArchive);
 const report=await checkPublicationUpkeep({discover:true,now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async(url,options)=>{
  calls.push(url);
  if(url===headline||url===core){assert.equal(options.redirect,'manual');return new Response(csv(url===headline?'cpi':'core'));}
  if(url===gdp)return new Response(gdpHtml);
  if(url==='https://www.dol.gov/ui/data.pdf')return new Response('',{status:503});
  throw Error('Unexpected source request');
 }});
 const cpi=report.families.cpi;assert.equal(cpi.discovery.status,'checked');assert.equal(cpi.discovery.source,'cleveland-fed-cpi');assert.equal(cpi.discovery.candidates[0].period,'2026-09-01');assert.equal(cpi.discovery.candidates[0].publicationDate,null);assert.equal(cpi.reviewQueue.length,0);
 assert.equal(calls.some(url=>new URL(url).hostname.endsWith('bls.gov')),false);assert.equal(cpi.retainedCount,54);assert.equal(JSON.stringify(cpiPublicationArchive),before);
 assert.equal(report.families.gdp.discovery.status,'checked');assert.equal(report.families.claims.discovery.status,'error');assert.equal(publicationUpkeepExitCode(report),1);
});

test('a new secondary CPI reference month enters review with no invented BLS publication identity',async()=>{
 const report=await checkPublicationUpkeep({discover:true,now:new Date('2026-11-24T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>url===headline||url===core?new Response(csv(url===headline?'cpi':'core','10')):url===gdp?new Response(gdpHtml):new Response('',{status:403})});
 const rows=report.families.cpi.reviewQueue;assert.equal(rows.length,1);assert.equal(rows[0].period,'2026-10-01');assert.equal(rows[0].publicationDate,null);assert.equal(rows[0].evidenceType,'secondary-data-availability');assert.match(rows[0].sourceUrl,/clevelandfed\.org/);assert.doesNotMatch(JSON.stringify(rows),/cpi_\d{8}\.htm/);assert.equal(publicationUpkeepExitCode(report),1);
});

test('partial secondary observations remain an explicit failed check without falling back to blocked BLS sources',async()=>{
 const calls=[];
 const report=await checkPublicationUpkeep({discover:true,now:new Date('2026-11-24T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{calls.push(url);return url===headline||url===core?new Response(csv(url===headline?'cpi':'core',url===headline?'10':'09')):url===gdp?new Response(gdpHtml):new Response('',{status:403});}});
 assert.equal(report.families.cpi.discovery.status,'error');assert.equal(report.families.cpi.discovery.candidates.length,0);assert.equal(calls.some(url=>new URL(url).hostname.endsWith('bls.gov')),false);assert.equal(report.families.cpi.retainedCount,54);
});
