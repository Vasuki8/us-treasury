import test from 'node:test';
import assert from 'node:assert/strict';
import * as navigation from '../src/research-navigation.js';
import * as workspace from '../src/workspace-preview.js';
import {defaults} from '../src/router.js';
import {getSeries,latest,periodLabel} from '../src/model.js';
import {escapeHtml} from '../src/ui.js';
import {displayCurrencyUnit,displayUnitLabel,formatDisplayValue} from '../src/display-format.js';
import {syncCompactNavigation} from '../src/compact-navigation.js';

test('sidebar offers every research family destination without depending on a selected page',()=>{
 const html=navigation.workspaceNavigation();
 for(const href of ['#/economy?family=activity','#/economy?family=prices','#/economy/labor','#/credit',
  '#/economy?family=policy','#/market','#/fiscal','#/refinancing','#/auctions','#/ownership']){
  assert.ok(html.includes(`href="${href}"`),href);
 }
 assert.equal((html.match(/data-workspace-family=/g)??[]).length,3);
 assert.match(html,/data-nav-family="prices"/);
});

test('sidebar follows the active family without accumulating open groups or undoing a manual toggle during refresh',()=>{
 const groups=['economy','fed','treasury'].map(id=>({dataset:{workspaceFamily:id},open:false}));
 const root={querySelector:()=>null,querySelectorAll:selector=>selector==='[data-workspace-family]'?groups:[]};
 syncCompactNavigation(root,{page:'labor'});assert.deepEqual(groups.map(group=>group.open),[true,false,false]);
 groups[1].open=true;
 syncCompactNavigation(root,{page:'labor'});assert.equal(groups[1].open,true,'a same-view refresh preserves manual expansion');
 syncCompactNavigation(root,{page:'fiscal'});assert.deepEqual(groups.map(group=>group.open),[false,false,true]);
 syncCompactNavigation(root,{page:'overview'});assert.deepEqual(groups.map(group=>group.open),[false,false,false]);
});

test('preview uses native units, an explicit observation window and a full-history route without selecting comparison series',()=>{
 const state={...defaults,page:'explore',selected:['unrate'],window:'custom',startDate:'2020-01-01',endDate:'2021-01-01'};
 const before=structuredClone(state),current=getSeries('gdp');
 const html=workspace.seriesPreview('gdp',state);
 assert.deepEqual(state,before);
 assert.match(html,/data-series="gdp"/);
 assert.match(html,/data-range="12"/);
 assert.match(html,/12 retained observations/);
 assert.ok(html.includes(escapeHtml(current.unit)));
 assert.ok(html.includes(escapeHtml(periodLabel(current,latest(current).date))));
 assert.match(html,/href="#\/series\/gdp\?/);
 assert.doesNotMatch(html,/data-select=|data-export/);
});

test('preview escapes source failures and does not invent observations for an unavailable series',()=>{
 const current=getSeries('gdp'),before={observations:current.observations,error:current.error};
 try{
  current.observations=[];current.error='<source unavailable>';
  const html=workspace.seriesPreview('gdp',{...defaults,page:'explore'});
  assert.match(html,/&lt;source unavailable&gt;/);
  assert.match(html,/Unavailable/);
  assert.doesNotMatch(html,/<source unavailable>/);
  assert.equal(workspace.seriesPreview('does-not-exist',defaults),'');
 }finally{Object.assign(current,before);}
});

test('preview value and label share a currency scale when latest and history cross a threshold',()=>{
 const current=getSeries('tgaBalance'),saved=current.observations;
 try{
  current.observations=[{date:'2026-10-29',value:1500},{date:'2026-10-30',value:945}];
  const options={currencyUnit:displayCurrencyUnit([current])},html=workspace.seriesPreview(current.id,defaults);
  const value=formatDisplayValue(current,945,options),unit=displayUnitLabel(current,options);
  assert.ok(html.includes(`<strong>${escapeHtml(value)}</strong>`),`Expected ${value} with ${unit}`);
  assert.ok(html.includes(escapeHtml(unit)));
 }finally{current.observations=saved;}
});
