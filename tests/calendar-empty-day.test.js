import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute} from '../src/router.js';
import {calendarScope} from '../src/calendar-scope.js';
import {calendarPage} from '../src/calendar-page.js';

test('a valid day with no captured release remains selected and shows an empty schedule',()=>{
 const state=parseRoute('#/calendar?scope=treasury&calendarTopic=Rates&month=2099-01&day=2099-01-03');
 assert.equal(state.day,'2099-01-03');assert.equal(state.calendarMonth,'2099-01');
 const scope=calendarScope(state);
 assert.equal(scope.month,'2099-01');assert.deepEqual(scope.filtered,[]);
 assert.ok(scope.days.includes('2099-01-03'));
 const html=calendarPage({...state,saved:[]});
 assert.match(html,/value="2099-01-03" selected/);
 assert.match(html,/No releases match these filters/);
 assert.match(html,/Treasury &amp; funding/);
});

test('impossible dates and months are still rejected',()=>{
 const state=parseRoute('#/calendar?month=2026-13&day=2026-02-30');
 assert.equal(state.day,'all');assert.equal(state.calendarMonth,'upcoming');
});

test('empty selected days anchor both calendar highlights and their own week after date or watchlist filtering',()=>{
 for(const [query,selected,monday] of [
  ['scope=treasury&calendarTopic=Rates&month=2099-01&day=2099-01-03','2099-01-03','2098-12-29'],
  ['month=2026-11&day=2026-11-18&calendarTopic=Labor&watch=1','2026-11-18','2026-11-16'],
 ]){
  const state={...parseRoute('#/calendar?'+query),saved:[]};
  assert.deepEqual(calendarScope(state).filtered,[]);
  const html=calendarPage(state);
  const week=html.match(/<nav class="calendar-week-strip"[^]*?<\/nav>/)?.[0]??'';
  assert.match(week,new RegExp(`aria-current="date"><time datetime="${selected}"`));
  assert.match(week,new RegExp(`<time datetime="${monday}"`));
  assert.match(html,new RegExp(`class="calendar-month-day[^\"]* is-selected"[^>]*aria-current="date">${Number(selected.slice(-2))}<`));
  assert.match(html,/No releases match these filters/);
  assert.match(html,/No release selected/);
 }
});
