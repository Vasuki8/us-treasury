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
 assert.ok(html.includes(origin.replaceAll('&','&amp;')));assert.match(html,/BACK TO INDICATOR/);assert.match(html,/>OPEN CALENDAR</);assert.doesNotMatch(html,/RETURN TO CALENDAR/);
});

test('research destinations have one shared sibling navigation with distinct evidence titles',()=>{
 for(const state of [{page:'research',researchView:'publications'},{page:'research',researchView:'packages'},{page:'vintages'}]){
  const html=researchNavigation(state);
  for(const label of ['Publication History','Retrieval History','Capture Changes','Saved Views','Frozen Results','Watchlist'])assert.ok(html.includes(label),label);
  assert.equal((html.match(/aria-current="page"/g)??[]).length,1);
 }
});
