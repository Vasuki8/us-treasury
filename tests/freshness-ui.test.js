import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../src/ui.js';

const captured='2026-10-21T23:18:30.150Z';
const retained='2026-10-21T22:48:25.560Z';
const attempt='2026-10-22T23:37:00.000Z';
const ids=['treasury','bls','bea','dol','census'];
function snapshot() {
  const source=()=>({status:'ok',fetchedAt:captured,lastAttemptAt:captured});
  return {generatedAt:'2099-01-01T00:00:00.000Z',checkedAt:attempt,
    sources:Object.fromEntries(ids.map(id=>[id,source()])),
    calendar:{checkedAt:attempt,sources:Object.fromEntries([...ids,'treasury-yield-timing'].map(id=>[id,source()]))}};
}
function banner(value) {
  assert.equal(typeof ui.freshnessBanner,'function','the shared freshness banner must exist');
  return ui.freshnessBanner(value);
}

test('banner labels the last successful source retrieval separately from a later refresh attempt',()=>{
  const html=banner(snapshot());
  assert.match(html,/aria-label="Data freshness"/);
  assert.match(html,/Last successful source refresh/);
  assert.ok(html.includes(`datetime="${captured}"`));
  assert.match(html,/Oct 21, 2026.*19:18:30 EDT/);
  assert.match(html,/Latest attempt/);
  assert.ok(html.includes(`datetime="${attempt}"`));
  assert.doesNotMatch(html,/2099/,'assembly time must not masquerade as source success');
  assert.match(html,/All 11 sources captured/);
  assert.doesNotMatch(html,/role="alert"|aria-live/,'static snapshot metadata should not repeatedly interrupt navigation');
});

test('cached calendar is named prominently while current BLS statistics remain distinct',()=>{
  const data=snapshot();
  data.calendar.sources.bls={status:'error',fetchedAt:retained,lastAttemptAt:attempt,error:'Official source HTTP 403 (www.bls.gov)'};
  const html=banner(data);
  const summary=html.slice(0,html.indexOf('<details'));
  assert.match(summary,/Cached.*BLS release calendar/);
  assert.doesNotMatch(summary,/Cached.*BLS data/);
  assert.match(html,/1 cached/);
  assert.ok(html.includes(`datetime="${retained}"`));
  assert.match(html,/Official source HTTP 403/);
  assert.match(html,/<summary[^>]*>.*Refresh details/);
  assert.doesNotMatch(html,/<details\s+open/,'the all-source detail list should start collapsed');
});

test('first failures are unavailable and do not invent a successful refresh',()=>{
  const html=banner({generatedAt:'2026-10-23T01:00:00.000Z',checkedAt:attempt,sources:{bls:{status:'unavailable',fetchedAt:null,error:'Not retrieved'}}});
  assert.match(html,/No successful source refresh recorded/);
  assert.match(html,/11 unavailable/);
  assert.match(html,/Unavailable/);
  assert.doesNotMatch(html,/All 11 sources captured|Cached:/);
  assert.doesNotMatch(html,/datetime="2026-10-23T01/);
});

test('banner escapes source errors and preserves an explicit Eastern standard-time label',()=>{
  const data=snapshot();
  data.sources.bls={status:'error',fetchedAt:'2026-01-15T15:04:05.000Z',lastAttemptAt:attempt,error:'<img src=x onerror="alert(1)">'};
  const html=banner(data);
  assert.match(html,/Jan 15, 2026.*10:04:05 EST/);
  assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html,/<img|<script/);
});
