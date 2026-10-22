import test from 'node:test';
import assert from 'node:assert/strict';
import { freshnessBanner } from '../src/ui.js';
import { mountFreshnessBanner } from '../src/freshness-controller.js';

const capturedAt = '2026-10-21T23:18:30.000Z';
const targetIds = ['treasury', 'bls', 'bea', 'dol', 'census'];
const researchIds = ['fiscal','refinancing','yields','auctions','ownership','macroContributions','marketFunctioning','policyRates','activity','housing'];
function snapshot() {
  const source = () => ({ status: 'ok', fetchedAt: capturedAt, lastAttemptAt: capturedAt });
  return {
    sources: Object.fromEntries([...targetIds,...researchIds].map(id => [id, source()])),
    calendar: { sources: Object.fromEntries([...targetIds, 'treasury-yield-timing'].map(id => [id, source()])) },
  };
}

// Exercise the controller's narrow DOM contract without adding a runtime DOM dependency.
function fixture() {
  const document = new EventTarget();
  document.visibilityState = 'visible';
  document.activeElement = {};
  const timerHost = new EventTarget();
  const intervals = new Map();
  timerHost.setInterval = (callback, delay) => { intervals.set(1, { callback, delay }); return 1; };
  timerHost.clearInterval = id => intervals.delete(id);
  const container = {
    ownerDocument: document, writes: 0, markup: '', details: null, summary: null, reload: null,
    contains(node) { return !!node && [this.details, this.summary, this.reload].includes(node); },
    querySelector(selector) {
      return selector === '.freshness-details' ? this.details
        : selector === '.freshness-details summary' ? this.summary
          : selector === '[data-reload-snapshot]' ? this.reload : null;
    },
    set innerHTML(value) {
      if (this.contains(document.activeElement)) document.activeElement = {};
      this.writes++;
      this.markup = value;
      this.details = value.includes('class="freshness-details"') ? { open: false } : null;
      const control = () => ({ focus(options) { this.focusOptions = options; document.activeElement = this; } });
      this.summary = this.details ? control() : null;
      this.reload = value.includes('data-reload-snapshot') ? control() : null;
    },
    get innerHTML() { return this.markup; },
  };
  let currentTime = new Date('2026-10-21T23:30:00.000Z');
  const data = snapshot();
  function mount() {
    return mountFreshnessBanner(container, data, { now: () => currentTime, timerHost, visibilityTarget: document });
  }
  return {
    container, document, timerHost, intervals, data, mount,
    at(value) { currentTime = new Date(value); },
    tick() { for (const { callback } of intervals.values()) callback(); },
  };
}

test('mount renders the supplied snapshot and starts a one-minute freshness check', () => {
  const view = fixture();
  const mounted = view.mount();
  assert.equal(view.container.innerHTML, freshnessBanner(view.data, { now: new Date('2026-10-21T23:30:00.000Z') }));
  assert.equal(view.container.writes, 1);
  assert.equal(view.intervals.get(1).delay, 60_000);
  assert.equal(typeof mounted.refresh, 'function');
  mounted.destroy();
});

test('the mounted banner changes when its snapshot misses the daily refresh deadline', () => {
  const view = fixture();
  view.at('2026-10-22T00:36:59.999Z');
  const mounted = view.mount();
  const beforeDeadline = view.container.innerHTML;
  view.at('2026-10-22T00:37:00.000Z');
  view.tick();
  assert.notEqual(view.container.innerHTML, beforeDeadline, 'a missed refresh must become visible without page navigation');
  assert.equal(view.container.innerHTML, freshnessBanner(view.data, { now: new Date('2026-10-22T00:37:00.000Z') }));
  assert.equal(view.container.writes, 2);
  mounted.destroy();
});

test('unchanged markup leaves the native disclosure and focused summary intact', () => {
  const view = fixture();
  const mounted = view.mount();
  const details = view.container.details;
  const summary = view.container.summary;
  details.open = true;
  summary.focus();
  view.tick();
  mounted.refresh();
  assert.equal(view.container.writes, 1, 'native open-state changes must not invalidate the memoized template');
  assert.equal(view.container.details, details);
  assert.equal(view.container.details.open, true);
  assert.equal(view.document.activeElement, summary);
  mounted.destroy();
});

test('a changed banner preserves the expanded disclosure and focused summary', () => {
  const view = fixture();
  const mounted = view.mount();
  view.container.details.open = true;
  const previousSummary = view.container.summary;
  previousSummary.focus();
  view.data.calendar.sources.bls.status = 'error';
  view.data.calendar.sources.bls.error = 'HTTP 403';
  mounted.refresh();
  assert.equal(view.container.writes, 2);
  assert.equal(view.container.details.open, true);
  assert.notEqual(view.container.summary, previousSummary);
  assert.equal(view.document.activeElement, view.container.summary);
  assert.deepEqual(view.container.summary.focusOptions, { preventScroll: true });
  mounted.destroy();
});

test('a changing banner never moves focus from another part of the page', () => {
  const view = fixture();
  const mounted = view.mount();
  const elsewhere = view.document.activeElement;
  view.data.sources.treasury.status = 'error';
  mounted.refresh();
  assert.equal(view.container.writes, 2);
  assert.equal(view.document.activeElement, elsewhere);
  mounted.destroy();
});

test('an updated stale banner restores focus to the replacement reload button', () => {
  const view = fixture();
  view.at('2026-10-22T00:37:00.000Z');
  const mounted = view.mount();
  assert.ok(view.container.reload, 'stale data must provide an explicit reload control');
  const previousReload = view.container.reload;
  previousReload.focus();
  view.data.calendar.sources.bls.status = 'error';
  mounted.refresh();
  assert.notEqual(view.container.reload, previousReload);
  assert.equal(view.document.activeElement, view.container.reload);
  assert.deepEqual(view.container.reload.focusOptions, { preventScroll: true });
  mounted.destroy();
});

test('a corrected clock removes the stale reload control and safely returns its focus to the summary', () => {
  const view = fixture();
  view.at('2026-10-22T00:37:00.000Z');
  const mounted = view.mount();
  assert.ok(view.container.reload, 'stale data must provide an explicit reload control');
  view.container.details.open = true;
  view.container.reload.focus();
  view.at('2026-10-22T00:36:59.999Z');
  mounted.refresh();
  assert.equal(view.container.reload, null);
  assert.equal(view.container.details.open, true);
  assert.equal(view.document.activeElement, view.container.summary);
  mounted.destroy();
});

test('hidden interval ticks wait until visibility resumes and pageshow also refreshes', () => {
  const view = fixture();
  const mounted = view.mount();
  view.document.visibilityState = 'hidden';
  view.data.sources.treasury.status = 'error';
  view.tick();
  view.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(view.container.writes, 1);
  view.document.visibilityState = 'visible';
  view.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(view.container.writes, 2);
  view.data.sources.bls.status = 'error';
  view.timerHost.dispatchEvent(new Event('pageshow'));
  assert.equal(view.container.writes, 3);
  mounted.destroy();
});

test('destroy clears its interval and listeners and is safe to call twice', () => {
  const view = fixture();
  const mounted = view.mount();
  mounted.destroy();
  mounted.destroy();
  assert.equal(view.intervals.size, 0);
  view.data.sources.treasury.status = 'error';
  view.document.dispatchEvent(new Event('visibilitychange'));
  view.timerHost.dispatchEvent(new Event('pageshow'));
  view.tick();
  mounted.refresh();
  assert.equal(view.container.writes, 1);
});
