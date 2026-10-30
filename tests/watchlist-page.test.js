import test from 'node:test';
import assert from 'node:assert/strict';
import { series } from '../src/data.js';
import {humanTimestamp} from '../src/ui-time.js';

let watchlist;
try { watchlist = await import('../src/watchlist-page.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('watchlist-page.js')) throw error; }
const watchlistPage = state => { assert.ok(watchlist, 'Watchlist page must exist'); return watchlist.watchlistPage(state); };
const compareControl=(html,id)=>{
  const match=[...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)]
    .find(([,attributes])=>attributes.includes(`data-add-compare="${id}"`));
  assert.ok(match,`Comparison action for ${id}`);
  return {disabled:/\sdisabled(?:\s|$)/.test(match[1]),label:match[2]};
};

test('watchlist opens saved indicators with source, observation coverage and removal controls', () => {
  const output = watchlistPage({ saved: ['sofr', 'publicDebt', 'sofr', 'unknown'], selected: ['sofr'], storageAvailable: true });
  assert.equal(output.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1],'Watchlist');
  assert.equal((output.match(/data-save="sofr"/g) ?? []).length, 1);
  assert.match(output, /href="#\/series\/sofr[^\"]*"/);
  assert.match(output, /data-save="publicDebt"/);
  assert.match(output, /data-add-compare="publicDebt"/);
  assert.deepEqual(compareControl(output,'sofr'),{disabled:false,label:'View comparison'});
  assert.ok(output.includes(series.sofr.source.name));
  assert.ok(output.includes(series.sofr.observations[0].date));
  assert.ok(output.includes(series.sofr.observations.at(-1).date));
  assert.ok(output.includes(humanTimestamp(series.sofr.fetchedAt)));
  assert.match(output, /observations|reference dates/i);
  assert.doesNotMatch(output, /Unknown series|undefined|NaN/);
});

test('watchlist caps new comparison additions at four without blocking existing selections', () => {
  const output = watchlistPage({ saved: ['debt', 'sofr'], selected: ['sofr', 'effr', 'yield', 'publicDebt'] });
  assert.equal(compareControl(output,'debt').disabled,true);
  assert.deepEqual(compareControl(output,'sofr'),{disabled:false,label:'View comparison'});
  assert.match(output, /four|4 series/i);
});

test('watchlist distinguishes empty persistence and unavailable browser storage', () => {
  const empty = watchlistPage({ saved: [] });
  assert.match(empty, /No saved series/i);
  assert.match(empty, /href="#\/explore/);
  const session = watchlistPage({ saved: ['sofr'], storageAvailable: false });
  assert.match(session, /session/i);
  assert.match(session, /browser storage is unavailable/i);
  assert.doesNotMatch(session, /saved in this browser/i);
});

test('unavailable saved data shows explicit unavailability and escapes source errors', () => {
  const id = 'watchlist-fixture';
  series[id] = { ...series.sofr, id, name: '<script>unsafe</script>', observations: [], dataStatus: 'unavailable', fetchedAt: null, error: '<img src=x onerror=alert(1)>' };
  try {
    const output = watchlistPage({ saved: [id], selected: [] });
    assert.match(output, /unavailable/i);
    assert.match(output, /No successful retrieval/);
    assert.match(output, /&lt;script&gt;/);
    assert.doesNotMatch(output, /<script>|<img/);
    assert.doesNotMatch(output, /0 observations/);
  } finally { delete series[id]; }
});

test('named watchlists expose selection, names and portable settings controls',()=>{
 const output=watchlistPage({saved:['sofr'],watchlists:[{id:'rates',name:'Rates <study>',saved:['sofr']},{id:'prices',name:'Prices',saved:['cpi']}],activeWatchlistId:'rates'});
 for(const text of ['id="watchlist-active"','id="watchlist-name"','Rates &lt;study&gt;','data-create-watchlist','data-rename-watchlist','data-delete-watchlist','data-export-settings','id="research-settings-import"'])assert.ok(output.includes(text),text);
});

test('watchlist policy updates and related catalysts are distinct from the next data release',()=>{
 const events=[{id:'decision',sourceId:'fomc',program:'fomc-decision',name:'FOMC decision',date:'2026-11-01',seriesId:'effr'},{id:'minutes',sourceId:'fomc',program:'fomc-minutes',name:'FOMC minutes',date:'2026-11-20',seriesId:'policyTargetUpper'}];
 const output=watchlist.watchlistPage({saved:['effr','policyTargetUpper']},{events,now:new Date('2026-10-27T12:00:00Z')});
 assert.match(output,/Next policy update/);assert.match(output,/Related catalyst/);assert.match(output,/Next release not in retained schedule/);assert.doesNotMatch(output,/Next release[^<]*FOMC minutes/);
});
