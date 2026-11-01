import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {workspaceNavigation} from '../src/research-navigation.js';

const shell=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('the Stitch shell keeps source status and functional sharing, density and local research controls in the header',()=>{
 const header=shell.match(/<header class="brandbar"[^]*?<\/header>/)?.[0]??'';
 for(const contract of ['id="workspace-page-label"','id="command-form"','id="command-input"','id="data-freshness"','id="theme-toggle"','data-copy-link'])assert.ok(header.includes(contract),contract);
 for(const [value,label] of [['comfortable','COMF'],['compact','DENSE']])assert.match(header,new RegExp(`<button[^>]*data-display-density="${value}"[^>]*>${label}<\\/button>`));
 assert.match(header,/Workspace/);assert.match(header,/chevron_right/);
 assert.match(header,/popovertarget="local-research-menu"/);
 assert.doesNotMatch(header,/Live Feed|42 Verified|v4\.8/);
});

test('the desktop rail uses flat reference families and local symbols while research and source routes stay reachable',async()=>{
 const rail=shell.match(/<aside class="rail"[^]*?<\/aside>/)?.[0]??'';
 for(const label of ['Workspace','My Research','Data &amp; Evidence'])assert.ok(rail.includes(label),label);
 const families=workspaceNavigation();
 for(const label of ['Economy','Fed &amp; Rates','Treasury &amp; Fiscal'])assert.ok(families.includes(label),label);
 assert.equal((families.match(/<section\b/g)??[]).length,3);assert.doesNotMatch(families,/<details|<summary|<svg/);
 assert.match(families,/material-symbols-outlined nav-icon/);
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.ok(rail.includes(`v${pkg.version}`));
 for(const href of ['#/watchlist','#/research','#/research?view=packages','#/research?view=publications','#/vintages','#/research?view=changes','#/sources'])assert.ok(rail.includes(`href="${href}"`),href);
 assert.doesNotMatch(rail,/<details|<summary/);
});

test('shell changes preserve every functional mount once and retain real local-research destinations',()=>{
 for(const id of ['navigation-more','density-select','density-select-mobile','indicator-mobile','saved-count','mobile-saved-count','saved-list','workspace-topics','ticker','data-freshness','main-content','source-notice','app-status','snapshot-time'])assert.equal((shell.match(new RegExp(`id="${id}"`,'g'))??[]).length,1,id);
 const menu=shell.match(/<div id="local-research-menu"[^]*?<\/div>/)?.[0]??'';
 for(const href of ['#/watchlist','#/research','#/research?view=packages'])assert.ok(menu.includes(`href="${href}"`),href);
 assert.match(menu,/Saved in this browser/);assert.doesNotMatch(menu,/href="#"|sign.in|account settings/i);
});
