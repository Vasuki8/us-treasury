import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeFor } from '../src/router.js';
import { readPreferences, writePreferences } from '../src/storage.js';
import { releases } from '../src/data.js';

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
  const state = parseRoute(routeFor({page:'calendar',day:'2026-10-22',calendarTopic:'Labor',watchOnly:true,eventId:'claims-oct22'}));
  assert.equal(state.day, 'all');
  assert.equal(state.watchOnly, true);
  assert.equal(state.eventId, 'cpi');
  assert.equal(state.calendarTopic, 'Labor');
});

test('explicit empty comparison selection survives a link round trip', () => {
  assert.deepEqual(parseRoute(routeFor({page:'explore',selected:[]})).selected, []);
});

test('empty official calendar does not retain previously invented schedule links', () => {
  assert.deepEqual(releases,[]);
  assert.equal(parseRoute('#/calendar?event=payroll-oct20&day=2026-10-20').day,'all');
  assert.equal(parseRoute('#/calendar?event=payroll-oct20').eventId,'cpi');
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
  assert.equal(result.theme, 'Paper');
  let saved;
  assert.equal(writePreferences({setItem:(key,value)=>{saved=JSON.parse(value);}},result),true);
  assert.deepEqual(saved.saved,['cpi']);
});
