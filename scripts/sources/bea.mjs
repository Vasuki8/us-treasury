import { iterateCsv, requestText } from './http.mjs';

const QUARTERLY_URL = 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const MONTHLY_URL = 'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const MISSING_VALUES = new Set(['', '(NA)', '(ND)', '(D)', 'NA', 'N/A', '...', '---']);
const NUMBER = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

/** BEA publishes these keyless flat files as CSV despite the .txt extension. */
export function parseBea(text, seriesCode, frequency) {
  if (typeof text !== 'string' || text.trimStart().startsWith('<')) {
    throw new Error('BEA returned HTML or an invalid flat-file response');
  }
  const code = { quarterly: 'Q', monthly: 'M', Q: 'Q', M: 'M' }[frequency];
  if (!code) throw new Error(`Invalid BEA frequency: ${frequency}`);

  const rows = iterateCsv(text);
  const header = rows.next().value?.map(value => value.trim().replace(/^%/, ''));
  const seriesColumn = header?.indexOf('SeriesCode') ?? -1;
  const periodColumn = header?.indexOf('Period') ?? -1;
  const valueColumn = header?.indexOf('Value') ?? -1;
  if ([seriesColumn, periodColumn, valueColumn].includes(-1)) {
    throw new Error('BEA flat-file header must contain %SeriesCode,Period,Value');
  }

  const observations = [];
  const periods = new Set();
  for (const row of rows) {
    if (row[seriesColumn]?.trim() !== seriesCode) continue;
    const period = row[periodColumn]?.trim() ?? '';
    if (/^\d{4}$/.test(period)) continue;
    if (code === 'Q' && /^\d{4}M(?:0[1-9]|1[0-2])$/.test(period)) continue;
    if (code === 'M' && /^\d{4}Q[1-4]$/.test(period)) continue;
    const match = period.match(code === 'Q' ? /^(\d{4})Q([1-4])$/ : /^(\d{4})M(0[1-9]|1[0-2])$/);
    if (!match || Number(match[1]) === 0) throw new Error(`Invalid BEA period for ${seriesCode}: ${period}`);
    if (periods.has(period)) throw new Error(`Duplicate BEA period for ${seriesCode}: ${period}`);
    periods.add(period);
    if (row.length !== header.length) throw new Error(`Invalid BEA row for ${seriesCode} ${period}`);

    const sourceValue = row[valueColumn].trim();
    let value = null;
    if (!MISSING_VALUES.has(sourceValue.toUpperCase())) {
      if (!NUMBER.test(sourceValue)) throw new Error(`Invalid BEA numeric value for ${seriesCode} ${period}`);
      value = Number(sourceValue.replaceAll(',', ''));
      if (!Number.isFinite(value)) throw new Error(`Invalid BEA numeric value for ${seriesCode} ${period}`);
    }
    const month = code === 'Q' ? (Number(match[2]) - 1) * 3 + 1 : Number(match[2]);
    observations.push({ date: `${match[1]}-${String(month).padStart(2, '0')}-01`, value, publishedAt: null, sourceValue });
  }
  if (!observations.length) throw new Error(`Missing BEA series ${seriesCode} at ${frequency} frequency`);
  return observations.sort((a, b) => a.date.localeCompare(b.date));
}

function pceInflation(indexes) {
  const byDate = new Map(indexes.map(observation => [observation.date, observation]));
  return indexes.map(observation => {
    const yearAgoDate = `${Number(observation.date.slice(0, 4)) - 1}${observation.date.slice(4)}`;
    const yearAgo = byDate.get(yearAgoDate);
    return {
      ...observation,
      value: observation.value !== null && yearAgo?.value != null && yearAgo.value !== 0
        ? 100 * (observation.value / yearAgo.value - 1)
        : null,
      yearAgoSourceValue: yearAgo?.sourceValue ?? null,
    };
  });
}

export async function collectBea({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const cutoff = now.toISOString().slice(0, 10);
  const [quarterly, monthly] = await Promise.all([
    requestText(QUARTERLY_URL, { fetchImpl }),
    requestText(MONTHLY_URL, { fetchImpl }),
  ]);
  const gdp = parseBea(quarterly.text, 'A191RL', 'Q').filter(observation => observation.date <= cutoff);
  const pce = pceInflation(parseBea(monthly.text, 'DPCERG', 'M').filter(observation => observation.date <= cutoff));
  return {
    id: 'bea',
    fetchedAt: [quarterly.retrievedAt, monthly.retrievedAt].sort().at(-1),
    series: {
      gdp: {
        observations: gdp.slice(-36),
        sourceUrl: QUARTERLY_URL,
        sourceIds: ['A191RL'],
        calculation: 'Published percent change from the preceding quarter in real GDP, annualized (NIPA Table 1.1.1, line 1).',
        dataStatus: 'official',
      },
      pce: {
        observations: pce.slice(-36),
        sourceUrl: MONTHLY_URL,
        sourceIds: ['DPCERG'],
        calculation: '100 * (index / exact year-ago index - 1); headline PCE price index (NIPA Table 2.8.4, line 1).',
        dataStatus: 'official',
      },
    },
    provenance: [quarterly, monthly].map(({ text: _text, ...metadata }) => metadata),
    warnings: [],
  };
}
