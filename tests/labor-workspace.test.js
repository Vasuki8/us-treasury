import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor,safeReturnTo} from '../src/router.js';
import {indicatorHref,workspaceReturn,createWorkspaceMemory,updateWorkspaceSelection,viewRange} from '../src/workspace-context.js';
import {createWorkspace,openWorkspace} from '../src/research-workspaces.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage} from '../src/research-packages.js';
import {toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('canonical and legacy Labor routes retain valid focus, exact window, table filters and comparisons',()=>{
 const initial=parseRoute('#/economy/labor');
 assert.equal(initial.macroFamily,'labor');assert.equal(initial.macroMeasure,'underemployment');
 for(const path of ['#/economy/labor','#/economy?family=labor']){
  const state=parseRoute(path+(path.includes('?')?'&':'?')+'measure=wages&window=custom&start=2026-08-01&end=2026-09-30&group=pay&q=earnings&selected=wages,weeklyHours');
  const copy=parseRoute(routeFor(state));
  for(const key of ['page','macroFamily','macroMeasure','window','startDate','endDate','laborGroup','query'])assert.equal(copy[key],state[key],key);
  assert.equal(copy.macroMeasure,'wages');assert.equal(copy.laborGroup,'pay');assert.equal(copy.query,'earnings');assert.deepEqual(copy.selected,['wages','weeklyHours']);
 }
 assert.equal(parseRoute('#/economy/labor?family=prices&measure=cpiMonthly').macroMeasure,'underemployment');
 assert.equal(parseRoute('#/economy/labor?group=constructor').laborGroup,'all');
 assert.equal(parseRoute(routeFor({page:'labor',macroFamily:'prices',macroMeasure:'cpiMonthly'})).macroFamily,'labor');
});

test('Labor detail and comparison returns preserve query, measure, window, selection and workspace position',()=>{
 const state=parseRoute('#/economy/labor?measure=weeklyHours&window=all&group=jobs&q=hours&selected=payroll,weeklyHours');
 const href=routeFor(state),detail=parseRoute(indicatorHref('weeklyHours',state));
 assert.equal(workspaceReturn(detail).label,'BACK TO LABOR');assert.equal(workspaceReturn(detail).href,href);
 const compare={...state,page:'explore',exploreMode:'compare',returnTo:href},nested=parseRoute(indicatorHref('weeklyHours',compare));
 assert.equal(workspaceReturn(parseRoute(workspaceReturn(nested).href)).label,'BACK TO LABOR');
 const changed=parseRoute(updateWorkspaceSelection(href,['unrate','underemployment']));
 assert.deepEqual(changed.selected,['unrate','underemployment']);assert.equal(changed.macroMeasure,'weeklyHours');
 assert.equal(safeReturnTo('#/economy/laboratory'),null);assert.equal(safeReturnTo('#/economy/labor/../../research'),null);
 const memory=createWorkspaceMemory();memory.remember(state,{left:0,top:850,focusHref:indicatorHref('weeklyHours',state)});
 assert.equal(memory.recall(state).top,850);
});

test('saved Labor views and frozen results retain the focused measure and exact scoped CSV',async()=>{
 const state=parseRoute('#/economy/labor?measure=wages&window=custom&start=2026-08-01&end=2026-09-30&group=pay&q=earnings&selected=cpi,gdp');
 const opened=openWorkspace(createWorkspace({name:'Labor wages',state}));
 for(const key of ['page','macroFamily','macroMeasure','window','startDate','endDate','laborGroup','query'])assert.equal(opened[key],state[key],key);
 const args=buildPinContext(state);assert.deepEqual(args.state.selected,['wages']);assert.equal(args.context.familyReadings.length,23);
 assert.equal(args.context.familyReadings.find(s=>s.id==='wages').frequency,'Monthly');
 const pkg=await createResearchPackage({name:'Focused Labor wages',...args});
 const {researchPackageCsv}=await import('../src/research-packages.js');
 const [columns,...values]=parseCsv(researchPackageCsv(pkg));
 assert.equal(values.length,2);assert.deepEqual(values.map(r=>r[columns.indexOf('date')]),['2026-08-01','2026-09-01']);
 assert.ok(values.every(r=>r[columns.indexOf('series_id')]==='wages'));
 assert.equal(args.assumptions.comparison,'native');assert.equal(args.assumptions.transform,'level');
});

test('actual Labor CSV action exports the same custom window as the focused chart',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const from=source.indexOf('function exportCsv('),end=source.indexOf('function downloadJson(',from);assert.ok(from>=0&&end>from);
 const state=parseRoute('#/economy/labor?measure=wages&window=custom&start=2026-08-01&end=2026-09-30'),downloads=[];
 new Function('state','toCsv','viewRange','downloadCsv','announce',source.slice(from,end)+';exportCsv([state.macroMeasure]);')(state,toCsv,viewRange,(content)=>downloads.push(content),message=>assert.fail(message));
 assert.equal(downloads.length,1);const [header,...rows]=parseCsv(downloads[0]);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r[header.indexOf('date')]),['2026-08-01','2026-09-01']);
});
