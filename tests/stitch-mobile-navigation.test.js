import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stitchDeskContracts} from '../src/stitch-desk-contracts.js';
import {parseRoute} from '../src/router.js';
import {navigationFamily,navigationLinkActive} from '../src/research-navigation.js';
import {syncCompactNavigation} from '../src/compact-navigation.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const menu=html.match(/<details\b[^>]*id="navigation-more"[^>]*>([\s\S]*?)<\/details>/)?.[1];
const groups=()=>[...menu.matchAll(/<p class="navigation-group-label">([^<]+)<\/p>([\s\S]*?)(?=<p class="navigation-group-label">|$)/g)];
const anchorNodes=()=>[...menu.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,label])=>{const dataset=Object.fromEntries([...attrs.matchAll(/data-nav(?:-(family|view))?="([^"]+)"/g)].map(([,suffix,value])=>[suffix?'nav'+suffix[0].toUpperCase()+suffix.slice(1):'nav',value]));return{href:attrs.match(/href="([^"]+)"/)?.[1],label,dataset,attributes:new Map(),setAttribute(name,value){this.attributes.set(name,value);},removeAttribute(name){this.attributes.delete(name);}};});

test('mobile More contains every canonical specialist route once in its correct navigation family',()=>{
 assert.ok(menu,'the native More disclosure remains present');
 const labels={economy:'Economy',fed:'Fed &amp; Rates',treasury:'Treasury &amp; Fiscal'},nodes=anchorNodes(),grouped=groups();
 for(const [id,desk]of Object.entries(stitchDeskContracts)){
  const links=nodes.filter(node=>node.dataset.nav===id);assert.equal(links.length,1,id+' appears exactly once');
  assert.equal(links[0].href,'#'+desk.path);assert.ok(links[0].label.length>0&&links[0].label.length<=50,id+' has a compact visible label');
  const group=grouped.find(([,label])=>label===labels[desk.family]);assert.ok(group,desk.family);
  assert.ok(group[2].includes(`data-nav="${id}"`),id+' belongs to '+desk.family);
  const state=parseRoute(links[0].href);assert.equal(state.page,id);assert.equal(navigationFamily(state),desk.family);assert.equal(navigationLinkActive(links[0],state),true);
 }
 for(const href of ['#/economy?family=activity','#/macro','#/economy?family=prices','#/economy/labor','#/economy?family=housing','#/economy?family=external','#/credit','#/economy?family=policy','#/yields','#/market','#/fiscal','#/refinancing','#/auctions','#/ownership','#/research?view=publications','#/vintages','#/research?view=changes','#/sources','#/series/unrate','#/watchlist','#/research','#/research?view=packages'])assert.ok(nodes.some(node=>node.href===href),'preserves '+href);
});

test('each specialist link receives aria-current and activates mobile More through the real synchronization logic',()=>{
 for(const [id,desk]of Object.entries(stitchDeskContracts)){
  const links=anchorNodes(),summary={dataset:{}},menuNode={querySelector:selector=>selector==='summary'?summary:null,querySelectorAll:()=>links};
  const root={querySelectorAll:selector=>selector==='[data-nav]'?links:[],querySelector:selector=>selector==='#navigation-more'?menuNode:null};
  syncCompactNavigation(root,parseRoute('#'+desk.path));
  assert.deepEqual(links.filter(node=>node.attributes.get('aria-current')==='page').map(node=>node.dataset.nav),[id]);
  assert.equal(summary.dataset.active,'true');
 }
});
