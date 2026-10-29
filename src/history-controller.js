import {rememberStableFocus,restoreStableFocus} from './stable-focus.js';
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
  const focused=rememberStableFocus(main,{document});
  const left=window.scrollX,top=window.scrollY;
  render();
  const restored=restoreStableFocus(main,focused,{document,restoreValue:true});
  if(!restored&&focused?.id==='history-retry'&&(!document.activeElement||document.activeElement===document.body)){
    (document.getElementById('vintage-cutoff')??document.getElementById('detail-tab-revisions'))?.focus({preventScroll:true});
  }
  window.scrollTo({ left, top, behavior:'instant' });
}
