import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkPublicationUpkeep,publicationUpkeepExitCode} from '../scripts/check-publication-upkeep.mjs';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';

const feed='https://www.bls.gov/feed/cpi.rss';
const index='https://www.bls.gov/bls/news-release/cpi.htm';
const now=new Date('2026-10-24T12:00:00Z');
const archiveHtml='<h1>Consumer Price Index Archived News Releases</h1><a href="https://www.bls.gov/news.release/archives/cpi_10142026.htm">October release</a>';
const gdpHtml='<a href="https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx">GDP vintage workbook</a>';
const fixture=await readFile(new URL('./fixtures/cpi-discovery-feed.atom',import.meta.url),'utf8');

test('the complete upkeep request path accepts official feed identities and keeps each family independent',async()=>{
 const before=JSON.stringify(cpiPublicationArchive),calls=[];
 const report=await checkPublicationUpkeep({discover:true,now,pause:async()=>{},fetchImpl:async(url,options)=>{
  calls.push(url);
  if(url===feed){assert.equal(options.redirect,'manual');assert.match(options.headers['User-Agent'],/us-treasury-data-refresh/);return new Response(fixture);}
  if(url==='https://www.bea.gov/data/gdp/gross-domestic-product')return new Response(gdpHtml);
  if(url==='https://www.dol.gov/ui/data.pdf')return new Response('',{status:503});
  throw Error('Unexpected request');
 }});
 assert.equal(report.families.cpi.discovery.status,'checked');assert.equal(report.families.cpi.discovery.source,'release-feed');assert.equal(report.families.cpi.discovery.candidates.length,9);
 assert.equal(report.families.gdp.discovery.status,'checked');assert.equal(report.families.claims.discovery.status,'error');assert.equal(publicationUpkeepExitCode(report),1);
 assert.equal(calls.includes(index),false);assert.equal(JSON.stringify(cpiPublicationArchive),before);
});

test('CPI denial is recorded, uses the reviewed fallback and cannot stop other release checks',async()=>{
 const calls=[];
 const report=await checkPublicationUpkeep({discover:true,now,pause:async()=>{},fetchImpl:async url=>{
  calls.push(url);
  if(url===feed)return new Response('',{status:403});
  if(url===index)return new Response(archiveHtml);
  if(url==='https://www.bea.gov/data/gdp/gross-domestic-product')return new Response(gdpHtml);
  return new Response('',{status:403});
 }});
 assert.equal(report.families.cpi.discovery.source,'archive-index');assert.equal(report.families.cpi.discovery.status,'checked');
 assert.equal(report.families.cpi.discovery.attempts[0].httpStatus,403);assert.equal(calls.filter(x=>x===feed).length,1);assert.equal(calls.filter(x=>x===index).length,1);
 assert.equal(report.families.gdp.discovery.status,'checked');assert.equal(report.families.claims.discovery.status,'error');
});
