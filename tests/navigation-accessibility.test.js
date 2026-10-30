import test from 'node:test';
import assert from 'node:assert/strict';
import {indicatorPage} from '../src/indicator-page.js';
import {releasePage} from '../src/release-page.js';
import {researchNavigation} from '../src/research-navigation.js';
import {parseRoute,routeFor} from '../src/router.js';
import {readFile} from 'node:fs/promises';
const attrs=html=>Object.fromEntries([...html.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,name,value])=>[name,value]));

test('only selected indicator tab is in the Tab sequence and its panel is associated and focusable',()=>{
 for(const tab of ['data','methodology','revisions']){
  const html=indicatorPage({...parseRoute(`#/series/cpi?tab=${tab}`),saved:[]});
  const tabs=[...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map(([value])=>attrs(value));
  assert.equal(tabs.length,3);assert.equal(tabs.filter(item=>item.tabindex==='0').length,1);
  for(const item of tabs){assert.equal(item.tabindex,item['aria-selected']==='true'?'0':'-1');assert.equal(item['aria-controls'],'detail-content');}
  const panel=attrs(html.match(/<div\b[^>]*role="tabpanel"[^>]*>/)?.[0]??'');
  assert.equal(panel['aria-labelledby'],`detail-tab-${tab}`);assert.equal(panel.tabindex,'0');
 }
});

test('phone navigation keeps the density preference reachable through More',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const menu=html.slice(html.indexOf('id="navigation-more"'),html.indexOf('</details>',html.indexOf('id="navigation-more"')));
 assert.match(menu,/label[^>]*for="density-select-mobile"/);assert.match(menu,/id="density-select-mobile"/);
 for(const value of ['compact','comfortable'])assert.ok(menu.includes(`value="${value}"`));
});

test('release return points to the originating indicator and Calendar remains a separate destination',()=>{
 const origin=routeFor({...parseRoute('#/series/cpi?window=all&tab=methodology')});
 const html=releasePage({...parseRoute('#/release?publicationSeries=cpi'),returnTo:origin},{publicationState:{status:'loading'}});
 const region=html.match(/<nav\b[^>]*aria-label="Return to originating view"[^>]*>([^]*?)<\/nav>/)?.[1]??'';
 const links=[...region.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)]
  .map(([,attributes,label])=>({href:attrs(attributes).href?.replaceAll('&amp;','&'),label}));
 assert.deepEqual(links,[{href:origin,label:'Back to indicator'},{href:'#/calendar',label:'Open calendar'}]);
});

test('research destinations have one shared sibling navigation with distinct evidence titles',()=>{
 for(const state of [{page:'research',researchView:'publications'},{page:'research',researchView:'packages'},{page:'vintages'}]){
  const html=researchNavigation(state);
  const links=new Map([...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)]
   .map(([,attributes,label])=>[attrs(attributes).href,label]));
  for(const [href,label] of [
   ['#/research?view=publications','Publication history'],['#/vintages','Retrieval history'],
   ['#/research?view=changes','Capture changes'],['#/research','Saved views'],
   ['#/research?view=packages','Saved snapshots'],['#/watchlist','Watchlist'],['#/sources','Sources &amp; terms'],
  ])assert.equal(links.get(href),label);
  assert.equal((html.match(/aria-current="page"/g)??[]).length,1);
 }
});
