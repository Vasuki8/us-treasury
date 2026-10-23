import { csvCell, tabularCsv } from './model.js';
import { panel, table, button, emptyState, escapeHtml as esc } from './ui.js';

const BEA_SOURCE_URL = 'https://www.bea.gov/data/intl-trade-investment/international-transactions';
const BEA_LICENSE_URL = 'https://www.bea.gov/about/policies-and-information';
const BEA_ATTRIBUTION = 'Source: U.S. Bureau of Economic Analysis, International Transactions Accounts.';
const componentDefinitions = [
  ['itaGoodsBalance', 'Goods balance'],
  ['itaServicesBalance', 'Services balance'],
  ['itaPrimaryIncomeBalance', 'Primary income balance'],
  ['itaSecondaryIncomeBalance', 'Secondary income balance'],
];
const seriesDefinitions = [
  ['currentAccountBalance', 'Current account balance'],
  ['itaGoodsServicesBalance', 'Goods and services balance'],
  ...componentDefinitions,
];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const difference = (current, previous) => finite(current) && finite(previous) ? current - previous : null;
const sum = values => values.every(finite) ? values.reduce((total, value) => total + value, 0) : null;
const valueAt = (series, date) => {
  const value = series?.observations?.find(row => row.date === date)?.value;
  return finite(value) ? value : null;
};
function precedingQuarter(date) {
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
  return month === 1 ? `${year - 1}-10-01` : `${year}-${String(month - 3).padStart(2, '0')}-01`;
}

/** Published quarterly amounts; differences describe accounting changes only. */
export function currentAccountContext(source = {}) {
  const date = source?.series?.currentAccountBalance?.observations?.map(row => row.date).sort().at(-1) ?? null;
  const previousDate = date ? precedingQuarter(date) : null;
  const pair = series => {
    const current = valueAt(series, date), previous = valueAt(series, previousDate);
    return { current, previous, change: difference(current, previous) };
  };
  const headline = pair(source?.series?.currentAccountBalance);
  headline.balanceType = !finite(headline.current) ? 'unavailable' : headline.current < 0 ? 'deficit' : headline.current > 0 ? 'surplus' : 'balanced';
  headline.movement = headline.current < 0 && headline.previous < 0 && finite(headline.change)
    ? headline.change > 0 ? 'narrowed' : headline.change < 0 ? 'widened' : 'unchanged'
    : 'balance-change';
  const components = componentDefinitions.map(([id, label]) => ({ id, label, ...pair(source?.series?.[id]) }));
  const componentSum = Object.fromEntries(['current', 'previous', 'change'].map(key => [key, sum(components.map(item => item[key]))]));
  const reconciliation = Object.fromEntries(['current', 'previous', 'change'].map(key => [key, difference(headline[key], componentSum[key])]));
  return {
    status: date ? source?.status === 'ok' ? 'official' : source?.fetchedAt ? 'cached' : 'unavailable' : 'unavailable',
    date, previousDate, headline, components, componentSum, reconciliation,
    fetchedAt: source?.fetchedAt ?? null, error: source?.error ?? null, coverageNote: source?.coverageNote ?? null,
  };
}

const quarterLabel = date => date ? `Q${Math.ceil(Number(date.slice(5, 7)) / 3)} ${date.slice(0, 4)}` : 'Unavailable';
function amount(value, signed = false) {
  if (!finite(value)) return 'Unavailable';
  const displayedValue = Number(value.toFixed(6));
  const sign = displayedValue < 0 ? '-' : signed && displayedValue > 0 ? '+' : '';
  return `${sign}$${Math.abs(displayedValue).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 })}B`;
}
function secureUrl(value, fallback) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return value;
  } catch { /* Missing and unsafe source URLs use the official reference. */ }
  return fallback;
}
function movementText(result) {
  const { headline } = result;
  if (!finite(headline.current)) return 'Latest published current-account balance unavailable. The comparison is not shifted to an older quarter.';
  if (!finite(headline.change)) return `Quarterly change unavailable: the published balance for ${quarterLabel(result.previousDate)} is missing.`;
  if (headline.movement === 'narrowed' || headline.movement === 'widened') return `The current-account deficit ${headline.movement} by ${amount(Math.abs(headline.change))} from the preceding quarter.`;
  if (headline.movement === 'unchanged') return 'The current-account deficit was unchanged from the preceding quarter.';
  return `The current-account balance ${headline.change > 0 ? 'increased' : headline.change < 0 ? 'decreased' : 'was unchanged'}${headline.change === 0 ? '' : ` by ${amount(Math.abs(headline.change))}`} from the preceding quarter.`;
}
function sourceDetails(source) {
  const headline = source?.series?.currentAccountBalance;
  return {
    title: headline?.sourceTitle ?? source?.sourceTitle ?? 'BEA International Transactions Accounts',
    url: secureUrl(headline?.sourceUrl ?? source?.sourceUrl, BEA_SOURCE_URL),
    licenseUrl: secureUrl(headline?.licenseUrl ?? source?.licenseUrl, BEA_LICENSE_URL),
    attribution: headline?.attribution ?? source?.attribution ?? BEA_ATTRIBUTION,
    notice: headline?.sourceNotice ?? source?.sourceNotice ?? '',
  };
}

/** A compact Graphite accounting panel using the captured ITA source only. */
export function currentAccountPanel(source = {}, { frozen = false } = {}) {
  const result = currentAccountContext(source), credit = sourceDetails(source);
  const captureStatus = frozen ? `Frozen recorded source status: ${result.status}` : result.status === 'official' ? 'Official capture' : result.status === 'cached' ? 'Cached · refresh failed' : 'Unavailable';
  const status = `<p class="panel-note"><strong>${esc(captureStatus)}</strong> · Retrieved ${esc(result.fetchedAt ?? 'not recorded')}.${result.error ? ` <span class="amber">${esc(result.error)}</span>` : ''}</p>`;
  const rows = [
    ['Current account balance', result.headline],
    ...result.components.map(item => [item.label, item]),
    ['Component sum (calculated)', result.componentSum],
    ['Rounding / reconciliation residual (calculated)', result.reconciliation],
  ].map(([label, item]) => `<tr><th scope="row">${esc(label)}</th><td class="num">${esc(amount(item.current))}</td><td class="num">${esc(amount(item.previous))}</td><td class="num">${esc(amount(item.change, true))}</td></tr>`).join('');
  const accounting = result.date ? `<p class="panel-note"><strong>${esc(quarterLabel(result.date))} · ${esc(result.headline.balanceType)}</strong>. ${esc(movementText(result))}</p>${table(['BALANCE / ACCOUNTING CHECK', quarterLabel(result.date), quarterLabel(result.previousDate), 'CHANGE'], rows, 'Published current-account and component balances with exact preceding-quarter changes in billions of U.S. dollars')}` : emptyState('Current-account accounting context unavailable.', 'A verified quarterly ITA capture is required. Missing observations remain unavailable.');
  const definition = '<p class="panel-note">USD billions · seasonally adjusted quarterly amounts, not annualized. These ITA balances differ from NIPA goods and services measured at SAAR. The four-component sum is goods + services + primary income + secondary income; the reconciliation residual is the published current account less that sum. Source rounding can produce differences. Each change uses the exact preceding quarter; missing inputs remain unavailable.</p><p class="panel-note">Component changes describe accounting arithmetic; they do not identify causes or market surprises. The international current account is distinct from the federal budget balance.</p>';
  const publicationNote = source?.series?.currentAccountBalance?.publicationNote;
  const metadata = `<p class="panel-note">Table release date: ${esc(source?.tableReleaseDate ?? 'not recorded')}. This is separate from retrieval time and is not a historical first-publication date.${publicationNote ? ` ${esc(publicationNote)}` : ''}${result.coverageNote ? ` ${esc(result.coverageNote)}` : ''}</p>`;
  const sourceCredit = `<p class="panel-note">${esc(credit.attribution)} <a href="${esc(credit.url)}" target="_blank" rel="noopener noreferrer">${esc(credit.title)} ↗</a> · <a href="${esc(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">BEA source policies ↗</a>${credit.notice ? ` ${esc(credit.notice)}` : ''}</p>`;
  return panel('CA', `${frozen ? 'FROZEN ' : ''}CURRENT ACCOUNT · ACCOUNTING CHANGES`, status + accounting + definition + metadata + sourceCredit, frozen ? '' : button('CSV CURRENT & PRIOR', 'data-export-current-account'));
}

/** Exact displayed periods, preserving missingness, source precision and evidence. */
export function currentAccountCsv(source = {}) {
  const result = currentAccountContext(source), credit = sourceDetails(source);
  const headers = ['series_id', 'name', 'date', 'source_period_label', 'date_convention', 'value', 'unit', 'frequency', 'adjustment', 'annualization', 'missing', 'source_value', 'source_unit', 'publication_date', 'publication_note', 'table_release_date', 'retrieved_at', 'capture_status', 'source_ids', 'source_url', 'source_title', 'calculation', 'coverage_note', 'attribution', 'source_notice', 'license_url', 'capture_provenance_json'];
  const rows = result.date ? seriesDefinitions.flatMap(([id, name]) => {
    const item = source?.series?.[id];
    return [result.previousDate, result.date].map(date => {
      const row = item?.observations?.find(row => row.date === date), value = finite(row?.value) ? row.value : null;
      return [id, name, date, row?.sourcePeriodLabel ?? null, item?.dateConvention ?? 'quarter-start', value, 'USD billions', 'Quarterly', 'Seasonally adjusted', 'Not annualized', value === null, row?.sourceValue ?? null, item?.sourceUnit ?? item?.sourceUnits ?? null, row?.publishedAt ?? null, item?.publicationNote ?? null, source?.tableReleaseDate ?? null, result.fetchedAt, result.status, (item?.sourceIds ?? []).join('; '), item?.sourceUrl ?? credit.url, item?.sourceTitle ?? credit.title, item?.calculation ?? '', item?.coverageNote ?? result.coverageNote, item?.attribution ?? credit.attribution, item?.sourceNotice ?? credit.notice, item?.licenseUrl ?? credit.licenseUrl, JSON.stringify(source?.provenance ?? [])];
    });
  }) : [];
  const sourceValueColumn = headers.indexOf('source_value');
  return tabularCsv(headers, []) + rows.map(row => row.map((value, index) => csvCell(value, index === sourceValueColumn)).join(',') + '\r\n').join('');
}
