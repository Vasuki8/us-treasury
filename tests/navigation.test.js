import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeFor } from '../src/router.js';
import { readPreferences, writePreferences } from '../src/storage.js';
import { releases } from '../src/data.js';
import {readFile} from 'node:fs/promises';

const [shell,application]=await Promise.all(['../index.html','../src/app.js'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
function themeControl(storage){
  const label={textContent:''},sun={hidden:false},moon={hidden:true},attributes=new Map();
  const button={id:'theme-toggle',dataset:{},disabled:false,setAttribute:(name,value)=>attributes.set(name,value),querySelector:selector=>({'[data-theme-label]':label,'[data-theme-sun]':sun,'[data-theme-moon]':moon}[selector])};
  const root={dataset:{}},meta={content:''},density={value:''},notices=[];
  const document={documentElement:{dataset:{}},activeElement:button,querySelector:()=>meta,getElementById:id=>id==='theme-toggle'?button:id==='density-select'?density:null};
  const start=application.indexOf('function persist()'),end=application.indexOf('function rememberFocus()',start);
  assert.ok(start>=0&&end>start,'Theme helpers must remain independently usable');
  const click=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(application);assert.ok(click,'Native button click dispatch must exist');
  const env={state:readPreferences(storage),storage,writePreferences,root,document,announce:message=>notices.push(message),render:()=>{throw Error('Theme changes must preserve the focused native control');}};
  const handlers=new Function('env',`let {${Object.keys(env).join(',')}}=env;${application.slice(start,end)};return {apply:applyAppearance,click:async event=>{${click[1]}},state:()=>state};`)(env);
  return {...handlers,button,label,sun,moon,attributes,root,document,meta,density,notices};
}

test('deep links restore a series, transformation, range and tab', () => {
  const state = parseRoute('#/series/gdp?range=6&transform=change&tab=methodology');
  assert.equal(state.page, 'indicator');
  assert.equal(state.seriesId, 'gdp');
  assert.equal(state.range, 6);
  assert.equal(state.transform, 'change');
  assert.equal(state.tab, 'methodology');
});

test('comparison links restore selections and filters without executing markup', () => {
  const input = { page: 'explore', selected: ['cpi', 'unrate'], exploreMode: 'compare', comparison: 'indexed', query: '<jobs & wages>', topic: 'Labor', frequency: 'Monthly' };
  const restored = parseRoute(routeFor(input));
  for (const key of ['page', 'selected', 'exploreMode', 'comparison', 'query', 'topic', 'frequency']) assert.deepEqual(restored[key], input[key]);
});

test('malformed paths, unknown ids and invalid settings resolve safely', () => {
  assert.equal(parseRoute('#/%E0%A4%A').page, 'overview');
  const state = parseRoute('#/series/missing?range=NaN&transform=unknown&tab=oops');
  assert.equal(state.seriesId, 'unrate');
  assert.equal(state.range, 12);
  assert.equal(state.transform, 'level');
  assert.equal(state.tab, 'data');
  assert.deepEqual(parseRoute('#/explore?selected=bad,cpi,cpi,unrate').selected, ['cpi', 'unrate']);
});

test('calendar deep links retain watchlist mode and reject unverified event and day values', () => {
  const state = parseRoute(routeFor({page:'calendar',day:'1900-10-22',calendarTopic:'Labor',watchOnly:true,eventId:'unverified-event'}));
  assert.equal(state.day, 'all');
  assert.equal(state.watchOnly, true);
  assert.equal(state.eventId, '');
  assert.equal(state.calendarTopic, 'Labor');
});

test('explicit empty comparison selection survives a link round trip', () => {
  assert.deepEqual(parseRoute(routeFor({page:'explore',selected:[]})).selected, []);
});

test('calendar links validate captured events and infer the month for an explicit captured date', () => {
  const saved = releases.splice(0);
  releases.push({ id: 'employment-2026-11-06', date: '2026-11-06', topic: 'Labor' }, { id: 'cpi-2026-10-15', date: '2026-10-15', topic: 'Prices' });
  try {
    const direct = parseRoute('#/calendar?event=employment-2026-11-06&day=2026-11-06');
    assert.equal(direct.eventId, 'employment-2026-11-06');
    assert.equal(direct.day, '2026-11-06');
    assert.equal(direct.calendarMonth, '2026-11');
    const month = parseRoute(routeFor({ page: 'calendar', calendarMonth: '2026-11', day: '2026-11-06', eventId: 'employment-2026-11-06', watchOnly: true }));
    assert.equal(month.calendarMonth, '2026-11');
    assert.equal(month.day, '2026-11-06');
    assert.equal(month.watchOnly, true);
    assert.equal(parseRoute('#/calendar?month=1900-01&day=1900-01-01&event=unknown').calendarMonth, 'upcoming');
    assert.equal(parseRoute('#/calendar?month=2026-10&day=2026-11-06').day, 'all');
    releases.splice(0);
    assert.equal(parseRoute('#/calendar?event=employment-2026-11-06&day=2026-11-06').day, 'all');
    assert.equal(parseRoute('#/calendar?event=employment-2026-11-06').eventId, '');
  } finally { releases.splice(0, releases.length, ...saved); }
});

test('deep linked comparisons respect the same four-series limit as the catalog', () => {
  assert.deepEqual(parseRoute('#/explore?selected=cpi,unrate,gdp,yield,debt').selected,['cpi','unrate','gdp','yield']);
});

test('corrupt and unavailable storage produce safe defaults', () => {
  assert.deepEqual(readPreferences({getItem:()=>'{broken'}).saved, []);
  const result = readPreferences({getItem:()=>{throw Error('denied');}});
  assert.deepEqual(result.saved, []);
  assert.equal(result.storageAvailable, false);
  assert.equal(writePreferences({setItem:()=>{throw Error('quota');}}, {saved:['cpi']}), false);
});

test('saved preferences reject unrecognized series and restore density', () => {
  const storage = {getItem:()=>JSON.stringify({saved:['cpi','bad','cpi'],density:'comfortable',theme:'Paper'})};
  const result = readPreferences(storage);
  assert.deepEqual(result.saved, ['cpi']);
  assert.equal(result.density, 'comfortable');
  assert.equal(result.theme, 'Light');
  let saved;
  assert.equal(writePreferences({setItem:(key,value)=>{saved=JSON.parse(value);}},result),true);
  assert.deepEqual(saved.saved,['cpi']);
});

test('new and unavailable browsers start in Light mode', () => {
  for (const storage of [undefined, {getItem:()=>null}, {getItem:()=>'{broken'}, {getItem:()=>{throw Error('denied');}}]) {
    assert.equal(readPreferences(storage).theme, 'Light');
  }
});

test('Light and Graphite persist alongside watchlist and density preferences', () => {
  const values = new Map();
  const storage = {getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value)};
  for (const theme of ['Graphite', 'Light']) {
    assert.equal(writePreferences(storage, {theme, saved:['cpi'], density:'comfortable'}), true);
    const restored = readPreferences(storage);
    assert.equal(restored.theme, theme);
    assert.deepEqual(restored.saved, ['cpi']);
    assert.equal(restored.density, 'comfortable');
  }
});

test('legacy appearance choices migrate to their light or dark equivalent', () => {
  for (const [previous, expected] of [['Paper','Light'], ['Midnight','Graphite'], ['Graphite','Graphite'], ['unknown','Light']]) {
    assert.equal(readPreferences({getItem:()=>JSON.stringify({theme:previous})}).theme, expected);
  }
});

test('the theme control is a labelled native icon button',()=>{
  const button=/<button\b[^>]*id="theme-toggle"[^>]*>([^]*?)<\/button>/.exec(shell);
  assert.ok(button,'The checkbox must be replaced with a native button');
  assert.match(button[0],/type="button"/);assert.match(button[0],/aria-label="Light theme\. Switch to Dark theme\."/);
  assert.match(button[1],/data-theme-label[^>]*>Light<\/span>/);
  assert.equal([...button[1].matchAll(/<svg\b/g)].length,2);
  assert.match(button[1],/data-theme-sun[^>]*aria-hidden="true"/);
  assert.match(button[1],/data-theme-moon[^>]*aria-hidden="true"[^>]*hidden/);
  assert.doesNotMatch(button[0],/type="checkbox"|role="switch"|theme-track/);
});

test('the actual theme button switches icons, current text and accessible action while preserving focus and preferences',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const view=themeControl(storage);view.apply();
  assert.equal(view.label.textContent,'Light');assert.equal(view.sun.hidden,false);assert.equal(view.moon.hidden,true);
  assert.equal(view.attributes.get('aria-label'),'Light theme. Switch to Dark theme.');
  await view.click({target:{closest:()=>view.button}});
  assert.equal(view.state().theme,'Graphite');assert.equal(view.label.textContent,'Dark');
  assert.equal(view.sun.hidden,true);assert.equal(view.moon.hidden,false);
  assert.equal(view.attributes.get('aria-label'),'Dark theme. Switch to Light theme.');
  assert.equal(view.root.dataset.theme,'Graphite');assert.equal(view.document.documentElement.dataset.theme,'Graphite');assert.equal(view.meta.content,'#19151f');
  assert.equal(view.document.activeElement,view.button);assert.equal(readPreferences(storage).theme,'Graphite');assert.match(view.notices.at(-1),/Dark theme enabled.*Saved in this browser/);
  await view.click({target:{closest:()=>view.button}});
  assert.equal(view.state().theme,'Light');assert.equal(view.label.textContent,'Light');assert.equal(view.sun.hidden,false);assert.equal(view.moon.hidden,true);
  assert.equal(view.meta.content,'#f7f5ec');assert.equal(readPreferences(storage).theme,'Light');assert.equal(view.document.activeElement,view.button);
});

test('legacy dark preferences restore the moon control and unavailable persistence remains session-only',async()=>{
  const view=themeControl({getItem:()=>JSON.stringify({theme:'Midnight',saved:['cpi'],density:'comfortable'}),setItem:()=>{throw Error('quota');}});
  view.apply();assert.equal(view.label.textContent,'Dark');assert.equal(view.moon.hidden,false);assert.equal(view.density.value,'comfortable');
  await view.click({target:{closest:()=>view.button}});
  assert.equal(view.state().theme,'Light');assert.equal(view.label.textContent,'Light');assert.equal(view.state().storageAvailable,false);
  assert.deepEqual(view.state().saved,['cpi']);assert.equal(view.state().density,'comfortable');assert.match(view.notices.at(-1),/session.*storage is unavailable/i);
});
