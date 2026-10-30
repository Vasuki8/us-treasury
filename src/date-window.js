/** A real ISO calendar date, interpreted only at midnight UTC. */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const defaultWindowPreset = (seriesList=[]) => ['Monthly','Quarterly'].includes(seriesList[0]?.frequency)?'5y':'1y';

function dateBounds(seriesList) {
  let startDate = null, endDate = null;
  for (const s of seriesList) {
    const retained=s?.retainedCoverage;
    const rows=retained?[{date:retained.startDate},{date:retained.endDate}]:s?.observations??[];
    for (const {date} of rows) {
      if (!isIsoDate(date)) continue;
      if (startDate === null || date < startDate) startDate = date;
      if (endDate === null || date > endDate) endDate = date;
    }
  }
  return { fullStartDate: startDate, fullEndDate: endDate };
}

function yearsBefore(date, years) {
  const year = Number(date.slice(0, 4)) - years;
  const candidate = `${String(year).padStart(4, '0')}${date.slice(4)}`;
  // An anniversary of February 29 falls on February 28 in a non-leap year.
  return isIsoDate(candidate) ? candidate : `${String(year).padStart(4, '0')}-02-28`;
}

/**
 * Resolve calendar bounds once for all selected source calendars. Numeric
 * legacy ranges remain observation counts; the direct-model default is 12.
 * Exact custom bounds are inclusive and are never clamped to source coverage.
 */
export function resolveDateWindow(range = 12, seriesList = []) {
  const bounds = dateBounds(seriesList);
  if (range === null || typeof range !== 'object') {
    const number = Number(range);
    const count = Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 12;
    return { mode: 'observations', preset: 'observations', count, startDate: null, endDate: null, label: `${count} OBS`, error: null, ...bounds };
  }
  const { preset, startDate = '', endDate = '' } = range;
  if(preset==='observations'&&Number.isInteger(range.count)&&range.count>=0&&range.count<=50000)return {mode:'observations',preset,count:range.count,startDate:null,endDate:null,label:`${range.count} OBS`,error:null,...bounds};
  const resolved = { mode: 'calendar', preset, count: null, startDate: null, endDate: null, label: preset === 'all' ? 'All' : preset === 'custom' ? 'Custom' : String(preset).toUpperCase(), error: null, ...bounds };
  if (!['1y', '3y', '5y', 'all', 'custom'].includes(preset)) {
    return { ...resolved, error: `Unknown date-window preset: ${String(preset)}.` };
  }
  if (preset === 'custom') {
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) return { ...resolved, error: 'Enter both start and end dates as real UTC calendar dates (YYYY-MM-DD).' };
    if (startDate > endDate) return { ...resolved, error: 'The start date must be on or before the end date.' };
    return { ...resolved, startDate, endDate, label: `${startDate} – ${endDate}` };
  }
  if (!bounds.fullEndDate) return resolved;
  return { ...resolved, startDate: preset === 'all' ? bounds.fullStartDate : yearsBefore(bounds.fullEndDate, Number(preset[0])), endDate: bounds.fullEndDate };
}

/** Filter original source dates without interpolation, aggregation, or filling. */
export function windowObservations(observations, resolved) {
  if (resolved.error) return [];
  if (resolved.mode === 'observations') return resolved.count ? observations.slice(-resolved.count) : [];
  if (!resolved.startDate || !resolved.endDate) return [];
  return observations.filter(({ date }) => isIsoDate(date) && date >= resolved.startDate && date <= resolved.endDate);
}
