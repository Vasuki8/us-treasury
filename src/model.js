import { series } from './data.js';

/** Required notice for redistributed BLS API data and derived analyses. */
export const BLS_DATA_NOTICE = 'BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.';

/** Numeric nulls are missing data, never zero. Reject nonfinite values as missing, too. */
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clean = (value) => Number(value.toFixed(12));
const isYield = (s) => s.id === 'yield' || s.code === 'DGS10' || s.changeInBasisPoints===true;

export function getSeries(id) {
  return Object.hasOwn(series, id) ? series[id] : undefined;
}

const aliases = {
  jobs: ['payroll', 'unrate'],
  employment: ['payroll', 'unrate'],
  'jobs data': ['payroll', 'unrate'],
  unemployment: ['unrate'],
  'unemployment rate': ['unrate'],
  inflation: ['cpi', 'pce'],
  'consumer prices': ['cpi'],
  gdp: ['gdp'],
  'economic growth': ['gdp'],
  treasury: ['yield', 'debt'],
  'interest rates': ['yield'],
  'bond yields': ['yield'],
  debt: ['debt'],
  'national debt': ['debt'],
  'jobless claims': ['claims'],
  'job openings': ['openings'],
};

/** Filters compose; an empty watchlist produces an empty result. */
export function filterSeries({ query = '', topic = 'All topics', frequency = 'All frequencies', watchlist = null } = {}) {
  const normalized = String(query).trim().toLowerCase();
  const alias = Object.hasOwn(aliases, normalized) ? aliases[normalized] : undefined;
  const terms = normalized.split(/\s+/).filter(Boolean);
  const saved = watchlist === null ? null : new Set(watchlist);
  return Object.values(series).filter((s) => {
    if (topic !== 'All topics' && s.topic !== topic) return false;
    if (frequency !== 'All frequencies' && s.frequency !== frequency) return false;
    if (saved && !saved.has(s.id)) return false;
    if (alias) return alias.includes(s.id);
    const haystack = [s.id, s.code, s.name, s.short, s.topic, s.frequency, s.source.name, s.definition].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Return the actual final observation, even when its value is missing. */
export function latest(s) {
  return s?.observations?.at(-1);
}
export function observationCoverageLabel(observation={}){
  if(observation.partial===false)return 'Complete recorded month';
  if(observation.partial!==true)return '';
  const counts=[];
  if(Number.isInteger(observation.auctionCount))counts.push(`${observation.auctionCount} result auctions`);
  if(Number.isInteger(observation.pendingCount))counts.push(`${observation.pendingCount} awaiting results`);
  return ['PARTIAL',...counts].join(' · ');
}

export function formatValue(s, value) {
  if (!s || !finite(value)) return '—';
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: s.precision,
    maximumFractionDigits: s.precision,
  }).format(Object.is(value, -0) ? 0 : value);
  switch (s.format) {
    case 'percent': return `${number}%`;
    case 'trillions': return `$${number}T`;
    case 'billions': return `$${number}B`;
    case 'basisPoints': return `${number} bp`;
    case 'percentagePoints': return `${number} pp`;
    case 'thousands': return `${number}k`;
    case 'millions': return `${number}M`;
    default: return number;
  }
}

function changeValue(s, current, prior) {
  if (!finite(current) || !finite(prior)) return null;
  return clean((current - prior) * (s.format === 'percent' && isYield(s) ? 100 : 1));
}

function changeUnit(s) {
  if (s.format !== 'percent') return s.unit;
  return isYield(s) ? 'Basis points' : 'Percentage points';
}

export function formatChange(s) {
  const observations = s?.observations;
  if (!observations || observations.length < 2) return '—';
  const value = changeValue(s, observations.at(-1).value, observations.at(-2).value);
  if (!finite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  if (s.format === 'percent') {
    return `${sign}${Math.abs(value).toFixed(isYield(s) ? 0 : s.precision)} ${isYield(s) ? 'bp' : 'pp'}`;
  }
  return sign + formatValue(s, Math.abs(value));
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO observation dates are interpreted in UTC, independent of the browser's time zone. */
export function periodLabel(s, date) {
  if (!s || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '—';
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  if (s.frequency === 'Monthly') return `${monthNames[month]} ${year}`;
  if (s.frequency === 'Quarterly') return `Q${Math.floor(month / 3) + 1} ${year}`;
  const day = `${parsed.getUTCDate()} ${monthNames[month]} ${year}`;
  return s.frequency === 'Weekly' ? `${s.periodType==='stock'?'As of':'Week ending'} ${day}` : day;
}

function rangeSize(range) {
  const count = Number(range);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 12;
}

/**
 * Transform the full history before slicing, so the first displayed change can
 * refer to an observation just outside the requested range. No gaps are filled.
 */
export function transformSeries(s, mode = 'level', range = 12) {
  if (!s) return { series: s, observations: [], unit: '' };
  if (!['level', 'change'].includes(mode)) throw new RangeError(`Unknown transform: ${mode}`);
  const observations = s.observations.map((o, index, all) => ({
    ...o,
    value: mode === 'change'
      ? changeValue(s, o.value, all[index - 1]?.value)
      : finite(o.value) ? o.value : null,
  }));
  const count = rangeSize(range);
  return {
    series: s,
    observations: count ? observations.slice(-count) : [],
    unit: mode === 'change' ? changeUnit(s) : s.unit,
  };
}

/**
 * Native comparisons are independent panels. Explicit indexing uses the first
 * shared nonzero, finite baseline within every displayed range. Exact dates
 * must match; mixed frequencies are never aggregated or forward-filled.
 */
export function compareSeries(ids, mode = 'native', range = 12) {
  if (!['native', 'indexed'].includes(mode)) return { panels: [], error: `Unknown comparison mode: ${mode}` };
  const selected = [...new Set(ids)];
  if (!selected.length) return { panels: [], error: null };
  if (selected.some((id) => !getSeries(id))) return { panels: [], error: 'One or more selected series are unknown or unavailable.' };
  const panels = selected.map((id) => transformSeries(getSeries(id), 'level', range));
  if (mode === 'native') return { panels, error: null };
  const byDate = panels.map((panel) => new Map(panel.observations.map((o) => [o.date, o.value])));
  const baseline = panels[0].observations.find((o) => byDate.every((values) => finite(values.get(o.date)) && values.get(o.date) !== 0));
  if (!baseline) {
    return { panels: [], error: 'No common nonzero baseline exists in the displayed ranges. Different frequencies or missing values may prevent indexing; use native panels or a wider range.' };
  }
  return {
    panels: panels.map((panel, index) => ({
      series: panel.series,
      unit: 'Index (common baseline = 100)',
      baselineDate: baseline.date,
      baselineValue: byDate[index].get(baseline.date),
      observations: panel.observations.filter((o) => o.date >= baseline.date).map((o) => ({
        ...o,
        value: finite(o.value) ? clean(o.value / byDate[index].get(baseline.date) * 100) : null,
      })),
    })),
    error: null,
  };
}

/** Escape RFC 4180 cells and neutralize formula-like text without altering numeric values. */
export function csvCell(value, numericSource = false) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  const validatedNumber=numericSource && /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text.trim());
  if (typeof value === 'string' && !validatedNumber && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function tabularCsv(headers,rows){return [headers,...rows].map(row=>row.map(cell=>csvCell(cell)).join(',')).join('\r\n')+'\r\n';}

/** Export exactly the displayed observations; missing numeric cells remain blank. */
export function toCsv(ids, { transform = 'level', range = 12, comparison = 'native' } = {}) {
  const result = compareSeries(ids, comparison, range);
  if (result.error) throw new Error(result.error);
  if (comparison === 'indexed' && transform !== 'level') {
    throw new RangeError('Indexed comparisons export indexed levels; choose native panels to export changes.');
  }
  const panels = comparison === 'indexed' ? result.panels : result.panels.map((panel) => transformSeries(panel.series, transform, range));
  const rows = [['series_id', 'name', 'date', 'value', 'unit', 'frequency', 'adjustment', 'source', 'publication_date', 'transform', 'data_status','retrieved_at','source_url','source_series','calculation','source_value','source_baseline_date','source_baseline_value','index_baseline_date','index_baseline_value','source_notice','coverage_note','observation_type','source_urls','license_url','attribution','source_title','partial','auction_count','pending_count','revision_indicator','source_notes']];
  for (const panel of panels) {
    const s = panel.series;
    const publications = new Map(s.observations.map((o) => [o.date, o.publishedAt]));
    for (const observation of panel.observations) {
      rows.push([s.id, s.name, observation.date, observation.value, panel.unit, s.frequency, s.adjustment,
        s.source.name, publications.get(observation.date), comparison === 'indexed' ? 'indexed' : transform, s.dataStatus||'unknown',s.fetchedAt,observation.sourceUrl||s.sourceUrl||s.source.url,(s.source.seriesIds||[]).join('; '),s.calculation,observation.sourceValue,observation.baseDate|| (observation.yearAgoSourceValue!=null?`${Number(observation.date.slice(0,4))-1}${observation.date.slice(4)}`:null),observation.baseValue??observation.yearAgoSourceValue,panel.baselineDate,panel.baselineValue,s.agency === 'bls' ? BLS_DATA_NOTICE : s.sourceNotice??'',s.coverageNote,s.observationType??'official',(observation.sourceUrls??s.sourceUrls??[]).join('; '),s.licenseUrl,s.attribution,s.sourceTitle,observation.partial,observation.auctionCount,observation.pendingCount,observation.revisionIndicator,(observation.footnotes??[]).join('; ')]);
    }
  }
  return `${rows.map((row) => row.map((cell,index)=>csvCell(cell,index===15||index===17)).join(',')).join('\r\n')}\r\n`;
}
