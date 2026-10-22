import { series } from './data.js';
import { resolveDateWindow, windowObservations } from './date-window.js';
import { indexEligibilityError } from './comparison-policy.js';
import { searchSeries } from './search.js';
export { resolveDateWindow, windowObservations } from './date-window.js';
export { comparisonClassification } from './comparison-policy.js';

/** Required notice for redistributed BLS API data and derived analyses. */
export const BLS_DATA_NOTICE = 'BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.';

/** Numeric nulls are missing data, never zero. Reject nonfinite values as missing, too. */
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clean = (value) => Number(value.toFixed(12));
const isYield = (s) => s.id === 'yield' || s.code === 'DGS10' || s.changeInBasisPoints===true;

export function getSeries(id) {
  return Object.hasOwn(series, id) ? series[id] : undefined;
}

/** Filters compose; an empty watchlist produces an empty result. */
export function filterSeries(filters = {}) {
  return searchSeries(Object.values(series), filters);
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

function coverage(s, observations) {
  const full = resolveDateWindow({ preset: 'all' }, [s]);
  return { fullStartDate: full.fullStartDate, fullEndDate: full.fullEndDate, fullCount: s.observations.length,
    startDate: observations[0]?.date ?? null, endDate: observations.at(-1)?.date ?? null, count: observations.length };
}

/**
 * Transform the full history before slicing, so the first displayed change can
 * refer to an observation just outside the requested range. No gaps are filled.
 */
export function transformSeries(s, mode = 'level', range = 12, resolved = null) {
  if (!s) return { series: s, observations: [], unit: '' };
  if (!['level', 'change'].includes(mode)) throw new RangeError(`Unknown transform: ${mode}`);
  const observations = s.observations.map((o, index, all) => ({
    ...o,
    value: mode === 'change'
      ? changeValue(s, o.value, all[index - 1]?.value)
      : finite(o.value) ? o.value : null,
  }));
  const window = resolved ?? resolveDateWindow(range, [s]);
  const displayed = windowObservations(observations, window);
  return {
    series: s,
    observations: displayed,
    unit: mode === 'change' ? changeUnit(s) : s.unit,
    window, coverage: coverage(s, displayed), error: window.error,
  };
}

/**
 * Native and baseline-difference comparisons use independent panels. Eligible
 * levels may be ratio-indexed at the first shared positive finite baseline.
 * Exact dates must match; source frequencies are never aggregated or filled.
 */
export function compareSeries(ids, mode = 'native', range = 12) {
  if (!['native', 'indexed', 'difference'].includes(mode)) return { panels: [], error: `Unknown comparison mode: ${mode}` };
  const selected = [...new Set(ids)];
  if (!selected.length) return { panels: [], error: null };
  if (selected.some((id) => !getSeries(id))) return { panels: [], error: 'One or more selected series are unknown or unavailable.' };
  const window = resolveDateWindow(range, selected.map(getSeries));
  if (window.error) return { panels: [], error: window.error, window };
  const panels = selected.map((id) => transformSeries(getSeries(id), 'level', range, window));
  if (mode === 'native') return { panels, error: null, window };
  if (mode === 'indexed') {
    const error = panels.map(indexEligibilityError).find(Boolean);
    if (error) return { panels: [], error, window };
  }
  const byDate = panels.map((panel) => new Map(panel.observations.map((o) => [o.date, o.value])));
  const baseline = panels[0].observations.find((o) => byDate.every((values) => finite(values.get(o.date)) && (mode === 'difference' || values.get(o.date) > 0)));
  if (!baseline) {
    return { panels: [], error: `No common ${mode === 'indexed' ? 'positive ' : ''}finite baseline exists on an exact shared date in the displayed window. Different source frequencies or missing values may prevent comparison; use native panels or a wider window.`, window };
  }
  return {
    panels: panels.map((panel, index) => {
      const baselineValue = byDate[index].get(baseline.date);
      const observations = panel.observations.filter((o) => o.date >= baseline.date).map((o) => ({
        ...o,
        value: mode === 'difference' ? changeValue(panel.series, o.value, baselineValue) : finite(o.value) ? clean(o.value / baselineValue * 100) : null,
      }));
      return { ...panel, unit: mode === 'difference' ? changeUnit(panel.series) : 'Index (common baseline = 100)',
        baselineDate: baseline.date, baselineValue,
        formula: mode === 'indexed' ? '100 × value / baseline' : panel.series.format === 'percent' && isYield(panel.series) ? '100 × (value − baseline)' : 'value − baseline',
        observations, coverage: coverage(panel.series, observations) };
    }),
    error: null, window,
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
  if (comparison !== 'native' && transform !== 'level') {
    throw new RangeError(`${comparison === 'indexed' ? 'Indexed' : 'Baseline difference'} comparisons derive from levels; choose native panels to export period changes.`);
  }
  const panels = comparison !== 'native' ? result.panels : result.panels.map((panel) => transformSeries(panel.series, transform, range, result.window));
  const rows = [['series_id', 'name', 'date', 'value', 'unit', 'frequency', 'adjustment', 'source', 'publication_date', 'transform', 'data_status','retrieved_at','source_url','source_series','calculation','source_value','source_baseline_date','source_baseline_value','index_baseline_date','index_baseline_value','source_notice','coverage_note','observation_type','source_urls','license_url','attribution','source_title','partial','auction_count','pending_count','revision_indicator','source_notes','suppressed','measure','capture_provenance_json','comparison_mode','comparison_baseline_date','comparison_baseline_value','comparison_formula','window_preset','window_start_date','window_end_date','window_label']];
  for (const panel of panels) {
    const s = panel.series;
    const publications = new Map(s.observations.map((o) => [o.date, o.publishedAt]));
    for (const observation of panel.observations) {
      rows.push([s.id, s.name, observation.date, observation.value, panel.unit, s.frequency, s.adjustment,
        s.source.name, publications.get(observation.date), comparison !== 'native' ? comparison : transform, s.dataStatus||'unknown',s.fetchedAt,observation.sourceUrl||s.sourceUrl||s.source.url,(s.source.seriesIds||[]).join('; '),s.calculation,observation.sourceValue,observation.baseDate|| (observation.yearAgoSourceValue!=null?`${Number(observation.date.slice(0,4))-1}${observation.date.slice(4)}`:null),observation.baseValue??observation.yearAgoSourceValue,comparison === 'indexed' ? panel.baselineDate : null,comparison === 'indexed' ? panel.baselineValue : null,s.agency === 'bls' ? BLS_DATA_NOTICE : s.sourceNotice??'',s.coverageNote,s.observationType??'official',(observation.sourceUrls??s.sourceUrls??[]).join('; '),s.licenseUrl,s.attribution,s.sourceTitle,observation.partial,observation.auctionCount,observation.pendingCount,observation.revisionIndicator,(observation.footnotes??[]).join('; '),observation.suppressed,s.measure,JSON.stringify(observation.inputProvenance??s.provenance??[]),comparison,panel.baselineDate,panel.baselineValue,panel.formula,panel.window.preset,panel.window.startDate,panel.window.endDate,panel.window.label]);
    }
  }
  return `${rows.map((row) => row.map((cell,index)=>csvCell(cell,index===15||index===17)).join(',')).join('\r\n')}\r\n`;
}
