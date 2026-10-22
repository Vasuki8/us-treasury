export const needsHistory = route => route.page === 'vintages' || route.page === 'indicator' && route.tab === 'revisions';

/** Route changes keep current inputs authoritative while a shared request finishes. */
export function createHistoryController(loader, { getRoute, onChange }) {
  let pending = false;
  return {
    sync(route, { retry = false } = {}) {
      const status = loader.getState().status;
      if (!needsHistory(route) || pending || status === 'ready' || status === 'loading' || status === 'error' && !retry) return;
      pending = true;
      const complete = () => {
        pending = false;
        if (needsHistory(getRoute())) onChange();
      };
      loader.load({ retry }).then(complete, complete);
    },
    context(route) {
      const historyState = loader.getState();
      return {
        historyState,
        revisions:historyState.status === 'ready' && route.page === 'indicator' && route.tab === 'revisions' ? loader.revisions(route.seriesId) : [],
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
    if (replacement && replacement.id === focused.id && focused.value !== undefined) replacement.value = focused.value;
    if (typeof focused.start === 'number' && typeof replacement?.setSelectionRange === 'function') {
      try { replacement.setSelectionRange(focused.start, focused.end); } catch { /* Date controls may not support text selections. */ }
    }
  }
  window.scrollTo({ left, top, behavior:'instant' });
}
