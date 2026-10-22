import {registry} from './registry.js';

export const needsHistory = route => route.page === 'vintages' || route.page === 'indicator' && route.tab === 'revisions';
export function historySeriesId(route) {
  const id = route.page === 'vintages' ? route.vintageSeries : route.seriesId;
  return Object.hasOwn(registry, id) ? id : 'gdp';
}

/** Route changes keep current inputs authoritative while a shared request finishes. */
export function createHistoryController(loader, { getRoute, onChange }) {
  const pending = new Set();
  return {
    sync(route, { retry = false } = {}) {
      if (!needsHistory(route)) return;
      const seriesId=historySeriesId(route),status = loader.getState(seriesId).status;
      if (pending.has(seriesId) || status === 'ready' || status === 'error' && !retry) return;
      pending.add(seriesId);
      const complete = () => {
        pending.delete(seriesId);
        const current=getRoute();
        if (needsHistory(current) && historySeriesId(current) === seriesId) onChange();
      };
      loader.load(seriesId,{ retry }).then(complete, complete);
    },
    context(route) {
      if (!needsHistory(route)) return {historyState:{status:'idle',history:null,error:null},revisions:[]};
      const seriesId=historySeriesId(route),historyState = loader.getState(seriesId);
      return {
        historyState,
        revisions:historyState.status === 'ready' && route.page === 'indicator' && route.tab === 'revisions' ? loader.revisions(seriesId) : [],
      };
    },
  };
}

/** Preserve the controls a reader is using across an asynchronous archive update. */
export function preserveHistoryView(main, render, { window = globalThis.window, document = main.ownerDocument } = {}) {
  const active = document.activeElement;
  const focused = main.contains(active) ? { id:active.id, tag:active.tagName, data:{...active.dataset}, start:active.selectionStart, end:active.selectionEnd, value:active.value } : null;
  const left = window.scrollX, top = window.scrollY;
  render();
  if (focused) {
    const replacement = (focused.id ? document.getElementById(focused.id) : null)
      ?? [...main.querySelectorAll(focused.tag)].find(node => Object.entries(focused.data).every(([key, value]) => node.dataset[key] === value))
      ?? (focused.id === 'history-retry' ? document.getElementById('vintage-cutoff') ?? document.getElementById('detail-tab-revisions') : null);
    replacement?.focus({ preventScroll:true });
    if (replacement && replacement.id === focused.id && replacement.type !== 'file' && focused.value !== undefined) replacement.value = focused.value;
    if (typeof focused.start === 'number' && typeof replacement?.setSelectionRange === 'function') {
      try { replacement.setSelectionRange(focused.start, focused.end); } catch { /* Date controls may not support text selections. */ }
    }
  }
  window.scrollTo({ left, top, behavior:'instant' });
}
