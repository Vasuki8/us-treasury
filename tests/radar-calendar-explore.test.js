import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPage} from '../src/calendar-page.js';
import {explorePage} from '../src/explore-page.js';
import {defaults} from '../src/router.js';
import {releases,dataStatus} from '../src/data.js';
const render = (state={}) => (state.page==='calendar'?calendarPage:explorePage)({...defaults,saved:[],density:'compact',...state});
const fixture = run => {
  const original=[...releases],status=dataStatus.calendar;
  const event={id:'radar-claims',sourceId:'dol',program:'weekly-claims',name:'Weekly claims',agency:'DOL',topic:'Labor',seriesId:'claimsAdvance',seriesIds:['claimsAdvance'],date:'2026-11-05',time:'08:30',scheduledAt:'2026-11-05T13:30:00Z',periodLabel:'Week ended Oct 31, 2026',scheduleBasis:'recurring-rule',sourceUrl:'https://www.dol.gov/ui/data.pdf'};
  releases.splice(0,releases.length,{...event,id:'radar-later',name:'Later claims',date:'2026-11-12',scheduledAt:'2026-11-12T13:30:00Z'},event);
  dataStatus.calendar={status:'partial',message:'Retained schedule',sources:{dol:{status:'error',fetchedAt:'2026-10-20T12:00:00Z',lastAttemptAt:'2026-10-21T12:00:00Z',error:'HTTP 503',coverageNote:'Agency rule coverage',warnings:['Check posted exceptions']}},links:[]};
  try {run();} finally {releases.splice(0,releases.length,...original);dataStatus.calendar=status;}
};

test('Calendar exposes the selected preview as a reachable named region with full scheduled context',()=>fixture(()=>{
  const html=render({page:'calendar',calendarMonth:'2026-11',eventId:'radar-claims'});
  assert.match(html,/id="calendar-selected-preview"[^>]*aria-label="Selected scheduled event"/);
  assert.match(html,/data-calendar-preview aria-controls="calendar-selected-preview"/);
  const preview=html.slice(html.indexOf('id="calendar-selected-preview"'));
  for(const text of ['Weekly claims','Week ended Oct 31, 2026','08:30 EST','CACHED SCHEDULE','AGENCY RULE','HTTP 503','2026-10-20T12:00:00Z','OFFICIAL SCHEDULE','OPEN RELEASE EVIDENCE','data-save="claimsAdvance"'])assert.ok(preview.includes(text),text);
  assert.match(preview,/past scheduled time does not establish/);
  assert.ok(html.indexOf('data-event="radar-claims"')<html.indexOf('data-event="radar-later"'));
  assert.equal((html.match(/scope="rowgroup"/g)||[]).length,2);
}));

test('Calendar unmatched Watchlist preserves recovery and schedule-source context',()=>fixture(()=>{
  const html=render({page:'calendar',calendarMonth:'2026-11',watchOnly:true,saved:[]});
  for(const text of ['Your watchlist is empty','data-reset-calendar','No release selected','Agency rule coverage','Check posted exceptions','Eastern Time (EST / EDT)'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/data-event=/);
}));

test('Catalog keeps native unit and reference period with the latest reading and preserves discovery actions',()=>{
  const html=render({page:'explore',query:'UNRATE',selected:['unrate']});
  const reading=html.match(/<td class="num catalog-reading">([^]*?)<\/td>/)?.[1]??'';
  assert.match(reading,/Percent/);
  assert.match(reading,/Reference period/);
  assert.match(reading,/<time datetime="\d{4}-\d{2}-\d{2}">/);
  for(const text of ['id="catalog-search"','id="topic-filter"','id="frequency-filter"','id="catalog-result-count"','data-select="unrate"','data-remove="unrate"','SELECTED 1/4','SERIES CATALOG','Inflation momentum','Labor breadth','Policy versus funding','Real income versus spending'])assert.ok(html.includes(text),text);
});

test('Comparison keeps native panels, exact-window controls, errors and export eligibility',()=>{
  const native=render({page:'explore',exploreMode:'compare',selected:['unrate','cpi'],window:'observations',range:6});
  for(const text of ['id="comparison-select"','id="window-start"','id="window-end"','Each series uses its own observation count','data-cursor-group="comparison"','no interpolation','DISPLAYED WINDOW','NO FILL','data-remove="unrate"'])assert.ok(native.includes(text),text);
  const invalid=render({page:'explore',exploreMode:'compare',selected:['unrate','cpi'],comparison:'indexed'});
  assert.match(invalid,/Comparison unavailable/);
  assert.match(invalid,/data-comparison-mode="native"/);
  assert.match(invalid,/data-comparison-mode="difference"/);
  assert.match(invalid,/data-export disabled/);
  const empty=render({page:'explore',exploreMode:'compare',selected:[]});
  assert.match(empty,/No series selected/);assert.match(empty,/OPEN CATALOG/);
  const difference=render({page:'explore',exploreMode:'compare',selected:['unrate'],comparison:'difference',window:'all'});
  assert.match(difference,/Change from baseline/);assert.match(difference,/BASELINE DIFFERENCE/);
});
