import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPage} from '../src/calendar-page.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {watchlistPage} from '../src/watchlist-page.js';
import {parseRoute} from '../src/router.js';

test('calendar keeps active filter summary and filter controls in a remembered disclosure',()=>{
 const html=calendarPage({...parseRoute('#/calendar'),saved:[]});
 assert.match(html,/data-page-disclosure="calendar:filters"/);
 assert.match(html,/class="calendar-filter-summary"/);
 assert.ok(html.indexOf('calendar-selected-summary')<html.indexOf('calendar-selected-preview'));
});
test('inflation begins with the focused reading and chart before full topic horizon coverage',()=>{
 const html=macroCoveragePage({...parseRoute('#/economy?family=prices'),saved:[]});
 assert.match(html,/<h1>INFLATION<\/h1>/i);
 assert.ok(html.indexOf('data-chart')<html.indexOf('inflation-horizon-comparison'));
 assert.match(html,/data-page-disclosure="macro-coverage:prices:history-controls"/);
});
test('watchlist prioritizes opening saved series and keeps editing in an explicit disclosure',()=>{
 const html=watchlistPage({...parseRoute('#/watchlist'),saved:['sofr']});
 assert.match(html,/data-page-disclosure="watchlist:edit"/);
 assert.match(html,/data-page-disclosure="watchlist:sofr:edit"/);
 assert.ok(html.indexOf('SAVED SERIES')<html.indexOf('Monitor scope'));
 assert.doesNotMatch(watchlistPage({saved:[]}),/use SAVE to keep/i);
});


test('calendar Today and Upcoming shortcuts retain the active scope and topic',()=>{
 const html=calendarPage({...parseRoute('#/calendar?scope=treasury&calendarTopic=Rates'),saved:[]});
 assert.match(html,/aria-label="Schedule window shortcuts"/);
 const today=html.match(/href="([^"]+)"[^>]*>TODAY<\/a>/i),upcoming=html.match(/href="([^"]+)"[^>]*>UPCOMING<\/a>/i);
 assert.ok(today);assert.ok(upcoming);
 for(const item of [today,upcoming]){const state=parseRoute(item[1].replaceAll('&amp;','&'));assert.equal(state.calendarView,'treasury');assert.equal(state.calendarTopic,'Rates');}
 assert.match(parseRoute(today[1].replaceAll('&amp;','&')).day,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(parseRoute(upcoming[1].replaceAll('&amp;','&')).calendarMonth,'upcoming');
});
