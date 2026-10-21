import { getSeries, latest, formatValue, formatChange, periodLabel } from './model.js';

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
  return `<div class="chart" data-chart data-series="${escapeHtml(ids.join(','))}" data-kind="${escapeHtml(kind)}" data-transform="${escapeHtml(transform)}" data-range="${escapeHtml(range)}" data-comparison="${escapeHtml(comparison)}" data-height="${escapeHtml(height)}"><p class="chart-fallback muted">${escapeHtml(kind === 'curve' ? 'Synthetic Treasury yield curve' : names)} chart · synthetic observations</p></div>`;
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
    return `<a class="metric" href="#/series/${encodeURIComponent(id)}"><span class="metric-name">${escapeHtml(series.short)}</span><strong class="metric-value">${escapeHtml(formatValue(series, observation?.value))}</strong><span class="metric-change">${escapeHtml(formatChange(series))}</span><span class="metric-period">${escapeHtml(observation ? periodLabel(series, observation.date) : 'No observations')}</span></a>`;
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
    return `<tr><th scope="row">${seriesLink(id)}<span class="table-code mono muted">${escapeHtml(series.code)}</span></th><td class="num">${escapeHtml(formatValue(series, observation?.value))}</td><td class="num muted">${escapeHtml(formatChange(series))}</td><td class="mono">${escapeHtml(observation ? periodLabel(series, observation.date) : '—')}</td></tr>`;
  }).join('');
  return table(['INDICATOR', 'LATEST', 'PERIOD CHANGE', 'OBSERVATION'], rows, 'Synthetic macroeconomic observations');
}

export function emptyState(message, detail = '', action = '') {
  return `<div class="empty-state"><p>${escapeHtml(message)}</p>${detail ? `<p class="muted">${escapeHtml(detail)}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
}

export function sourceLink(series) {
  const url = series.source?.url ?? '';
  const name = series.source?.name ?? 'Source unavailable';
  return /^https:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} ↗</a>` : escapeHtml(name);
}
