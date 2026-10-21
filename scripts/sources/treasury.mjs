import { parseCsv, requestText } from './http.mjs';

const DEBT_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&page%5Bsize%5D=100';
const TENORS = [
  ['1M', 1 / 12, ['1 Mo']],
  ['1.5M', 0.125, ['1.5 Month', '1.5 Mo']],
  ['2M', 2 / 12, ['2 Mo']],
  ['3M', 0.25, ['3 Mo']],
  ['4M', 4 / 12, ['4 Mo']],
  ['6M', 0.5, ['6 Mo']],
  ['1Y', 1, ['1 Yr']],
  ['2Y', 2, ['2 Yr']],
  ['3Y', 3, ['3 Yr']],
  ['5Y', 5, ['5 Yr']],
  ['7Y', 7, ['7 Yr']],
  ['10Y', 10, ['10 Yr']],
  ['20Y', 20, ['20 Yr']],
  ['30Y', 30, ['30 Yr']],
];

function nullableNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function calendarDate(year, month, day) {
  const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`Invalid Treasury observation date: ${text}`);
  }
  return text;
}

function isoDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (!match) throw new Error(`Invalid Treasury observation date: ${text}`);
  return calendarDate(match[1], Number(match[2]), Number(match[3]));
}

function csvDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text).trim());
  if (!match) throw new Error(`Invalid Treasury yield date: ${text}`);
  return calendarDate(match[3], Number(match[1]), Number(match[2]));
}

function sortedUnique(rows) {
  const unique=new Map();
  for(const row of rows) {
    if(unique.has(row.date))throw new Error(`Duplicate Treasury observation date: ${row.date}`);
    unique.set(row.date,row);
  }
  return [...unique.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function requireUsable(observations, name) {
  if (!observations.some(row => row.value !== null && Number.isFinite(row.value))) {
    throw new Error(`No usable Treasury ${name} observations`);
  }
  return observations;
}

export function parseDebt(payload) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('Invalid Treasury debt response: expected a data array');
  const observations = payload.data.map(row => {
    const dollars = nullableNumber(row.tot_pub_debt_out_amt);
    return {
      date: isoDate(row.record_date),
      value: dollars === null ? null : dollars / 1e12,
      publishedAt: null,
      sourceValue: row.tot_pub_debt_out_amt === null || row.tot_pub_debt_out_amt === undefined ? 'null' : String(row.tot_pub_debt_out_amt),
    };
  });
  return requireUsable(sortedUnique(observations), 'debt');
}

function parseYieldRows(text) {
  const [header, ...rows] = parseCsv(text);
  const normalize = value => String(value).replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const names = (header ?? []).map(normalize);
  const dateIndex = names.indexOf('date');
  if (dateIndex < 0 || !names.includes('10 yr')) throw new Error('Unrecognized Treasury yield CSV headers');
  const indices = TENORS.map(([, , aliases]) => names.findIndex(name => aliases.some(alias => normalize(alias) === name)));
  return sortedUnique(rows.filter(row => row.some(value => String(value).trim())).map(row => ({
    date: csvDate(row[dateIndex]),
    rates: TENORS.map((_, index) => indices[index] < 0 ? null : nullableNumber(row[indices[index]])),
  })));
}

function buildYieldResult(rows) {
  const tenYearIndex = TENORS.findIndex(([tenor]) => tenor === '10Y');
  const observations = requireUsable(rows.map(row => ({ date: row.date, value: row.rates[tenYearIndex], publishedAt: null })), 'yield');
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  return {
    observations,
    yieldCurve: TENORS.map(([tenor, years], index) => ({ tenor, years, value: latest.rates[index], previous: previous?.rates[index] ?? null })),
    curveDate: latest.date,
    previousCurveDate: previous?.date ?? null,
  };
}

export function parseYieldCsv(text) {
  return buildYieldResult(parseYieldRows(text));
}

function yieldUrl(year) {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

export async function collectTreasury({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const cutoff = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const sourceUrl = yieldUrl(year);
  const debtUrl = `${DEBT_URL}&filter=record_date:lte:${cutoff}`;
  const [debtResponse, currentYieldResponse] = await Promise.all([
    requestText(debtUrl, { fetchImpl }),
    requestText(sourceUrl, { fetchImpl }),
  ]);
  const responses = [debtResponse, currentYieldResponse];
  const debt = requireUsable(parseDebt(JSON.parse(debtResponse.text)).filter(row => row.date <= cutoff), 'debt');
  let rows = parseYieldRows(currentYieldResponse.text).filter(row => row.date <= cutoff);
  const tenYearIndex = TENORS.findIndex(([tenor]) => tenor === '10Y');
  if (rows.filter(row => row.rates[tenYearIndex] !== null).length < 36) {
    const previousYieldResponse = await requestText(yieldUrl(year - 1), { fetchImpl });
    responses.push(previousYieldResponse);
    rows = sortedUnique([...parseYieldRows(previousYieldResponse.text), ...rows]).filter(row => row.date <= cutoff);
  }
  const curve = buildYieldResult(rows);
  return {
    id: 'treasury',
    fetchedAt: responses.map(response => response.retrievedAt).sort().at(-1),
    series: {
      debt: {
        observations: debt,
        calculation: 'USD dollars / 1e12',
        sourceUrl: debtUrl,
        sourceIds: ['tot_pub_debt_out_amt'],
        dataStatus: 'official',
      },
      yield: {
        observations: curve.observations,
        calculation: 'Published daily Treasury par yield, percent',
        sourceUrl,
        sourceIds: ['BC_10YEAR'],
        dataStatus: 'official',
      },
    },
    yieldCurve: curve.yieldCurve,
    curveDate: curve.curveDate,
    previousCurveDate: curve.previousCurveDate,
    provenance: responses.map(({ text, ...metadata }) => metadata),
    warnings: [],
  };
}
