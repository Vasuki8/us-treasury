import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {researchNavigation,navigationFamily} from '../src/research-navigation.js';

test('specialist navigation shows relevant family destinations instead of every module',()=>{
 const treasury=researchNavigation({page:'refinancing'});
 for(const label of ['Fiscal pressure','Refinancing exposure','Auction demand','Debt ownership'])assert.ok(treasury.includes(label),label);
 assert.doesNotMatch(treasury,/Credit &amp; banking|GDP contributions|Captured history|Rates &amp; curves/);
 const fed=researchNavigation({page:'macroCoverage',macroFamily:'policy'});
 for(const label of ['Policy rates','Rates &amp; curves','Funding &amp; market functioning'])assert.ok(fed.includes(label),label);
 assert.doesNotMatch(fed,/Current account|Auction demand/);
 const economy=researchNavigation({page:'macroCoverage',macroFamily:'external'});
 assert.match(economy,/current account/i);assert.match(economy,/GDP contributions/);
 assert.doesNotMatch(economy,/Policy rates|Auction demand/);
 assert.equal(researchNavigation({page:'overview'}),'');
});

test('navigation families distinguish policy, economy, treasury and evidence',()=>{
 for(const state of [{page:'labor'},{page:'macro'},{page:'credit'},{page:'macroCoverage',macroFamily:'external'}])assert.equal(navigationFamily(state),'economy');
 for(const state of [{page:'yields'},{page:'market'},{page:'macroCoverage',macroFamily:'policy'}])assert.equal(navigationFamily(state),'fed');
 assert.equal(navigationFamily({page:'auctions'}),'treasury');
 assert.equal(navigationFamily({page:'vintages'}),'evidence');
 assert.equal(navigationFamily({page:'research',researchView:'publications'}),'evidence');
 assert.equal(navigationFamily({page:'research',researchView:'packages'}),'research');
 const html=researchNavigation({page:'macroCoverage',macroFamily:'external'});
 assert.match(html,/<a[^>]*href="#\/economy\?family=external"[^>]*aria-current="page"/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(researchNavigation({page:'macroCoverage',macroFamily:'labor'}),/<a[^>]*data-nav="labor"[^>]*aria-current="page"/);
});

test('the compact shell makes Economy primary and separates rates and evidence from Treasury',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const top=html.match(/<nav class="functionbar"[^]*?<details/)?.[0]??'';
 assert.match(top,/href="#\/economy"[^>]*data-nav-group="economy"/);
 assert.match(top,/Fed &amp; rates/);
 assert.doesNotMatch(top,/Recent indicator|Labor market/);
 const rail=html.match(/<aside class="rail"[^]*?<\/aside>/)?.[0]??'';
 assert.match(rail,/MY RESEARCH/);assert.match(rail,/DATA &amp; EVIDENCE/);
 assert.doesNotMatch(rail,/Recent indicator|Refinancing risk/);
 assert.match(html,/data-source-health/);
});
