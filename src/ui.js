import { getSeries, latest, formatValue, formatChange, periodLabel, BLS_DATA_NOTICE } from './model.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function button(label, attrs = '', className = 'action') {
  return `<button type="button" class="${escapeHtml(className)}" ${attrs}>${escapeHtml(label)}</button>`;
}

export function heading(title, subtitle, actions = '') {
  return `<header class="page-heading"><div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div><div class="actions">${actions}</div></header>`;
}

export function panel(index, title, body, actions = '', note = '', extraClass = '') {
  return `<section class="panel${extraClass ? ` ${escapeHtml(extraClass)}` : ''}"><header class="panel-head"><h2><span class="index">${escapeHtml(index)}</span>${escapeHtml(title)}</h2><div class="actions">${actions}</div></header>${body}${note ? `<p class="panel-note">${escapeHtml(note)}</p>` : ''}</section>`;
}

export function chart(ids, { height = 180, kind = 'line', transform = 'level', range = 12, comparison = 'native' } = {}) {
  const names = ids.map(id => getSeries(id)?.name).filter(Boolean).join(', ');
  return `<div class="chart" data-chart data-series="${escapeHtml(ids.join(','))}" data-kind="${escapeHtml(kind)}" data-transform="${escapeHtml(transform)}" data-range="${escapeHtml(range)}" data-comparison="${escapeHtml(comparison)}" data-height="${escapeHtml(height)}"><p class="chart-fallback muted">${escapeHtml(kind === 'curve' ? 'Treasury yield curve' : names)} chart · official snapshot</p></div>`;
}

export function seriesLink(id, label, className = '') {
  const series = getSeries(id);
  if (!series) return '';
  return `<a class="${escapeHtml(className)}" href="#/series/${encodeURIComponent(id)}">${escapeHtml(label ?? series.name)}</a>`;
}

export function metrics(ids) {
  return `<section class="metrics" aria-label="Headline indicators">${ids.map(id => {
    const series = getSeries(id);
    if (!series) return '';
    const observation = latest(series);
    return `<a class="metric" href="#/series/${encodeURIComponent(id)}"${series.error ? ` title="${escapeHtml(series.error)}"` : ''}><span class="metric-name">${escapeHtml(series.short)}</span><strong class="metric-value">${escapeHtml(formatValue(series, observation?.value))}</strong><span class="metric-change">${escapeHtml(formatChange(series))}</span><span class="metric-period">${escapeHtml(observation ? periodLabel(series, observation.date) : 'Unavailable')}${series.dataStatus === 'cached' ? ' · CACHED' : ''}</span></a>`;
  }).join('')}</section>`;
}

export function table(headers, rows, caption = '') {
  return `<div class="table-wrap"><table>${caption ? `<caption class="sr-only">${escapeHtml(caption)}</caption>` : ''}<thead><tr>${headers.map((header, index) => `<th scope="col"${index > 0 && index < 3 ? ' class="num"' : ''}>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function seriesTable(ids) {
  const rows = ids.map(id => {
    const series = getSeries(id);
    if (!series) return '';
    const observation = latest(series);
    return `<tr><th scope="row">${seriesLink(id)}<span class="table-code mono muted">${escapeHtml(series.code)}${series.dataStatus === 'cached' ? ' · CACHED' : ''}</span>${!observation && series.error ? `<span class="table-code muted">${escapeHtml(series.error)}</span>` : ''}</th><td class="num">${escapeHtml(formatValue(series, observation?.value))}</td><td class="num muted">${escapeHtml(formatChange(series))}</td><td class="mono">${escapeHtml(observation ? periodLabel(series, observation.date) : '—')}</td></tr>`;
  }).join('');
  return table(['INDICATOR', 'LATEST', 'PERIOD CHANGE', 'OBSERVATION'], rows, 'Official macroeconomic snapshot; unavailable observations appear as a dash');
}

export function emptyState(message, detail = '', action = '') {
  return `<div class="empty-state"><p>${escapeHtml(message)}</p>${detail ? `<p class="muted">${escapeHtml(detail)}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
}

export function sourceLink(series) {
  const url = series.source?.url ?? '';
  const name = series.source?.name ?? 'Source unavailable';
  return /^https:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} ↗</a>` : escapeHtml(name);
}

export function seriesStatus(series) {
  return series.dataStatus === 'cached' ? 'Cached official snapshot' : series.dataStatus === 'official' ? 'Official snapshot' : 'Unavailable';
}

/** The BLS disclaimer and last successful capture accompany every route. */
export function sourceNotice(sources = {}) {
  const retrieved = sources.bls?.fetchedAt;
  const retrieval = retrieved
    ? `BLS data retrieved <time datetime="${escapeHtml(retrieved)}">${escapeHtml(retrieved)}</time>.`
    : 'BLS retrieval unavailable.';
  return `<p>Data sources: <a href="https://home.treasury.gov/" target="_blank" rel="noopener noreferrer">U.S. Treasury</a>, <a href="https://www.bls.gov/" target="_blank" rel="noopener noreferrer">Bureau of Labor Statistics</a> and <a href="https://www.bea.gov/" target="_blank" rel="noopener noreferrer">Bureau of Economic Analysis</a>. Meridian is an independent site and is not endorsed by these agencies.</p><p>${escapeHtml(BLS_DATA_NOTICE)} ${retrieval} <a href="https://www.bls.gov/developers/termsOfService.htm" target="_blank" rel="noopener noreferrer">BLS data terms ↗</a></p>`;
}

/** Last successful retrieval and latest attempt remain separate after failures. */
export function sourceStatusList(sources = {}, { compact = false } = {}) {
  const names = { treasury: 'TREASURY', bls: 'BLS', bea: 'BEA' };
  const entries = Object.entries(sources);
  if (!entries.length) return '<p class="panel-note">Source retrieval metadata is unavailable.</p>';
  return entries.map(([id, source]) => {
    const label = source.status === 'ok' ? 'Official snapshot' : source.fetchedAt ? 'Cached · refresh failed' : 'Unavailable';
    if (compact) {
      const timestamp = value => value ? `<time datetime="${escapeHtml(value)}">${escapeHtml(value.slice(0,10))}<br>${escapeHtml(value.slice(11))}</time>` : 'Unavailable';
      return `<div class="definition"><h3>${escapeHtml(names[id] ?? id.toUpperCase())}</h3><p>${escapeHtml(label)}</p><p>Retrieved<br><span class="mono">${timestamp(source.fetchedAt)}</span></p><p>Last attempt<br><span class="mono">${timestamp(source.lastAttemptAt)}</span></p>${source.error ? `<p class="amber">${escapeHtml(source.error)}</p>` : ''}</div>`;
    }
    return `<div class="definition"><h3>${escapeHtml(names[id] ?? id.toUpperCase())} · ${escapeHtml(label)}</h3><dl class="facts"><dt>Retrieved</dt><dd class="mono">${escapeHtml(source.fetchedAt ?? 'No successful retrieval')}</dd><dt>Last attempt</dt><dd class="mono">${escapeHtml(source.lastAttemptAt ?? 'Not attempted')}</dd></dl>${source.error ? `<p class="amber">${escapeHtml(source.error)}</p>` : ''}${(source.warnings ?? []).map(warning => `<p class="muted">${escapeHtml(warning)}</p>`).join('')}</div>`;
  }).join('');
}
