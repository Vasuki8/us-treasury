import test from 'node:test';
import assert from 'node:assert/strict';
import { series } from '../src/data.js';

let watchlist;
try { watchlist = await import('../src/watchlist-page.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('watchlist-page.js')) throw error; }
const watchlistPage = state => { assert.ok(watchlist, 'Watchlist page must exist'); return watchlist.watchlistPage(state); };

test('watchlist opens saved indicators with source, observation coverage and removal controls', () => {
  const output = watchlistPage({ saved: ['sofr', 'publicDebt', 'sofr', 'unknown'], selected: ['sofr'], storageAvailable: true });
  assert.match(output, /<h1>WATCHLIST<\/h1>/);
  assert.equal((output.match(/data-save="sofr"/g) ?? []).length, 1);
  assert.match(output, /href="#\/series\/sofr[^\"]*"/);
  assert.match(output, /data-save="publicDebt"/);
  assert.match(output, /data-add-compare="publicDebt"/);
  assert.match(output, /data-add-compare="sofr"[^>]*>VIEW COMPARISON/);
  assert.ok(output.includes(series.sofr.source.name));
  assert.ok(output.includes(series.sofr.observations[0].date));
  assert.ok(output.includes(series.sofr.observations.at(-1).date));
  assert.ok(output.includes(series.sofr.fetchedAt));
  assert.match(output, /observations|reference dates/i);
  assert.doesNotMatch(output, /Unknown series|undefined|NaN/);
});

test('watchlist caps new comparison additions at four without blocking existing selections', () => {
  const output = watchlistPage({ saved: ['debt', 'sofr'], selected: ['sofr', 'effr', 'yield', 'publicDebt'] });
  assert.match(output, /data-add-compare="debt"[^>]* disabled/);
  assert.match(output, /data-add-compare="sofr"(?![^>]* disabled)[^>]*>VIEW COMPARISON/);
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
