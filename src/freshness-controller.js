import { freshnessBanner } from './ui.js';

/** Keep age warnings current without fetching data or rerendering the page. */
export function mountFreshnessBanner(container, snapshot, {
  now = () => new Date(), timerHost = window, visibilityTarget = container.ownerDocument, getOptions = () => ({}),
} = {}) {
  let previousMarkup;
  let destroyed = false;

  function refresh() {
    if (destroyed) return;
    const markup = freshnessBanner(snapshot, { now: now(), ...getOptions() });
    if (markup === previousMarkup) return;

    const details = container.querySelector('.freshness-details');
    const summary = container.querySelector('.freshness-details summary');
    const reload = container.querySelector('[data-reload-snapshot]');
    const active = container.ownerDocument.activeElement;
    const focused = active === summary && summary ? 'summary' : active === reload && reload ? 'reload' : null;
    const open = details?.open ?? false;

    container.innerHTML = markup;
    previousMarkup = markup;
    const nextDetails = container.querySelector('.freshness-details');
    if (nextDetails) nextDetails.open = open;
    if (focused) {
      const nextSummary = container.querySelector('.freshness-details summary');
      const nextFocus = focused === 'reload' ? container.querySelector('[data-reload-snapshot]') ?? nextSummary : nextSummary;
      nextFocus?.focus({ preventScroll: true });
    }
  }

  function refreshWhenVisible() {
    if (visibilityTarget.visibilityState !== 'hidden') refresh();
  }

  refresh();
  const interval = timerHost.setInterval(refreshWhenVisible, 60_000);
  visibilityTarget.addEventListener('visibilitychange', refreshWhenVisible);
  timerHost.addEventListener('pageshow', refreshWhenVisible);
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      timerHost.clearInterval(interval);
      visibilityTarget.removeEventListener('visibilitychange', refreshWhenVisible);
      timerHost.removeEventListener('pageshow', refreshWhenVisible);
    },
  };
}
