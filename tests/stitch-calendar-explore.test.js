import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPage} from '../src/calendar-page.js';
import {explorePage} from '../src/explore-page.js';
import {parseRoute,defaults} from '../src/router.js';
import {series,releases,dataStatus} from '../src/data.js';
import {formatChange,formatValue,periodLabel} from '../src/model.js';

const state=hash=>({...parseRoute(hash),saved:[]});
const decode=href=>href.replaceAll('&amp;','&');

test('Calendar reference week and month navigation use actual filtered schedule dates across a month boundary',()=>{
 const prior=[...releases],calendar=dataStatus.calendar;
 const event={sourceId:'dol',program:'weekly-claims',name:'Retained claims schedule',agency:'DOL',topic:'Labor',seriesId:'claimsAdvance',seriesIds:['claimsAdvance'],time:'08:30',scheduleBasis:'recurring-rule',sourceUrl:'https://www.dol.gov/ui/data.pdf'};
 releases.splice(0,releases.length,...['2026-10-31','2026-11-01','2026-11-03'].map(date=>({...event,id:'stitch-'+date,date})),{...event,id:'excluded-bill',date:'2026-11-02',sourceId:'treasury-auctions',topic:'Rates',securityType:'Bill'});
 dataStatus.calendar={status:'ok',sources:{dol:{status:'ok',fetchedAt:'2026-10-30T12:00:00Z'}}};
 try{
  const html=calendarPage(state('#/calendar?month=2026-11&event=stitch-2026-11-01&calendarTopic=Labor'));
  const week=html.match(/<nav class="calendar-week-strip"[^]*?<\/nav>/)?.[0]??'';
  assert.equal((week.match(/class="calendar-week-day/g)??[]).length,7);
  assert.match(week,/datetime="2026-10-31"[^]*?1 retained event/);
  assert.match(week,/datetime="2026-11-01"[^]*?1 retained event/);
  assert.match(week,/aria-current="date"><time datetime="2026-11-01"/);
  const monthGrid=html.match(/<div class="calendar-month-grid">([^]*?)<\/div>/)?.[1]??'';
  assert.equal((monthGrid.match(/class="calendar-month-day/g)??[]).length,42);
  assert.equal((monthGrid.match(/ has-events/g)??[]).length,2);
  assert.match(monthGrid,/aria-label="2 Nov 2026 · 0 retained events"/);
  const dayHref=week.match(/href="([^"]+)"[^>]*><time datetime="2026-10-31"/)?.[1];
  assert.ok(dayHref);
  const destination=parseRoute(decode(dayHref));
  assert.equal(destination.calendarMonth,'2026-10');assert.equal(destination.day,'2026-10-31');
  assert.equal(destination.calendarTopic,'Labor');assert.equal(destination.eventId,'');
  assert.match(html,/calendar-schedule-column[^]*?calendar-side-stack[^]*?calendar-month-card[^]*?calendar-upcoming-list[^]*?id="calendar-selected-preview"/);
  assert.match(html,/Schedule information describes planned publication timing/);
  assert.doesNotMatch(html,/Consensus|Subscribe iCal|Bond mkts closed|Actual<\/th>/);
 }finally{releases.splice(0,releases.length,...prior);dataStatus.calendar=calendar;}
});

test('Explore reference catalog keeps native changes, periods and actual observation trends in eight columns',()=>{
 const current=series.unrate,prior=current.observations;
 current.observations=[{date:'2026-07-01',value:4},{date:'2026-08-01',value:null},{date:'2026-09-01',value:4.2}];
 try{
  const input=state('#/explore?q=UNRATE&selected=unrate&window=custom&start=2020-01-01&end=2021-01-01'),saved=structuredClone(input);
  const html=explorePage(input);
  assert.deepEqual(input,saved);
  const row=html.match(/<tr data-catalog-series="unrate"[^]*?<\/tr>/)?.[0]??'';
  assert.equal((row.match(/<t[dh](?: |\>)/g)??[]).length,8);
  assert.match(row,/class="num catalog-change"[^]*?>—<\/td>/);
  assert.match(row,/class="catalog-reference"><time datetime="2026-09-01"/);
  assert.match(row,/class="catalog-spark"/);
  const path=row.match(/<path d="([^"]+)"/)?.[1]??'';
  assert.equal((path.match(/M/g)??[]).length,2);assert.doesNotMatch(path,/L/);
  assert.match(html,/class="catalog-filter-bar"[^]*?id="topic-filter"[^]*?id="frequency-filter"/);
  assert.ok(html.indexOf('class="catalog-filter-bar"')<html.indexOf('class="catalog-table"'));
  assert.match(html,/Recent trends use up to 12 retained observations/);
  assert.match(html,/Selected series preview/);
  assert.match(html,/data-series="unrate"[^>]*data-range="12"/);
  assert.match(html,/Recent preview observations[^]*?time datetime="2026-08-01"[^]*?>—<\/td>/);
  assert.doesNotMatch(html,/12M Trend|8 example series|JSON API|Download Series CSV/);
 }finally{current.observations=prior;}
});

test('Explore preview follows its own retained series without changing comparison selection or the research window',()=>{
 const input={...defaults,page:'explore',saved:[],selected:['unrate'],window:'custom',startDate:'2020-01-01',endDate:'2021-01-01'},saved=structuredClone(input);
 const html=explorePage(input,{workspacePreview:'gdp'});
 assert.deepEqual(input,saved);
 const preview=html.slice(html.indexOf('<aside id="catalog-preview"'));
 assert.match(preview,/data-series="gdp"[^>]*data-range="12"/);
 assert.match(preview,/data-preview-active="true"/);
 for(const row of series.gdp.observations.slice(-4)){
  assert.ok(preview.includes(periodLabel(series.gdp,row.date)));
  assert.ok(preview.includes(formatValue(series.gdp,row.value)));
 }
 assert.match(html,/data-remove="unrate"/);
 assert.ok(html.includes(formatChange(series.gdp)));
});
