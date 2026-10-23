import { iterateCsv, requestText } from './http.mjs';

const QUARTERLY_URL = 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const MONTHLY_URL = 'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const MISSING_VALUES = new Set(['', '(NA)', '(ND)', '(D)', 'NA', 'N/A', '...', '---']);
const NUMBER = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

export const BEA_DEPTH_QUARTERLY={
  nominalGdp:['A191RC','1.1.5 line 1','nominal gross domestic product','dollars'],
  privateDomesticDemand:['LB000003','1.4.6 line 8','real final sales to private domestic purchasers','real'],
  privateDomesticDemandGrowth:['PB000003','1.4.1 line 8','real final sales to private domestic purchasers growth','growth'],
  nominalGdi:['A261RC','1.10 line 1','nominal gross domestic income','dollars'],
  realGdiGrowth:['A261RL','1.7.1 line 11','real gross domestic income growth','growth'],
  nonresidentialInvestmentGrowth:['A008RL','1.1.1 line 9','real private nonresidential fixed investment growth','growth'],
  residentialInvestmentGrowth:['A011RL','1.1.1 line 13','real private residential fixed investment growth','growth'],
  structuresInvestmentGrowth:['A009RL','1.1.1 line 10','real nonresidential structures investment growth','growth'],
  equipmentInvestmentGrowth:['Y033RL','1.1.1 line 11','real nonresidential equipment investment growth','growth'],
  intellectualPropertyInvestmentGrowth:['Y001RL','1.1.1 line 12','real intellectual property products investment growth','growth'],
  nominalExports:['B020RC','1.1.5 line 16','nominal exports of goods and services','dollars'],
  nominalImports:['B021RC','1.1.5 line 19','nominal imports of goods and services','dollars'],
  nominalTradeBalance:['A019RC','1.1.5 line 15','nominal external balance of goods and services','dollars'],
};

/** Exact published NIPA measurements; chained components are never summed. */
export function parseBeaEconomicDepth(quarterly,monthly,{cutoff='9999-12-31'}={}) {
  const raw=parseBeaBatch(quarterly,Object.values(BEA_DEPTH_QUARTERLY).map(row=>row[0]),'Q');
  const result=Object.fromEntries(Object.entries(BEA_DEPTH_QUARTERLY).map(([id,[code,table,label,kind]])=>[id,{
    observations:raw[code].filter(row=>row.date<=cutoff).map(row=>({...row,value:row.value===null?null:kind==='growth'?row.value:row.value/1000})),
    sourceIds:[code],sourceUrl:QUARTERLY_URL,observationType:'official',dataStatus:'official',
    calculation:`Published ${label}, NIPA Table ${table}; ${kind==='growth'?'percent change from the preceding quarter, seasonally adjusted annual rate; not annualized again.':`source millions of ${kind==='real'?'chained 2017':'current'} dollars / 1000 = billions, seasonally adjusted annual rate; annualized flow, not actual quarterly dollars.${kind==='real'?' Do not sum chained-dollar components.':''}`}`,
  }]));
  result.savingRate={observations:parseBea(monthly,'A072RC','M').filter(row=>row.date<=cutoff),sourceIds:['A072RC'],sourceUrl:MONTHLY_URL,observationType:'official',dataStatus:'official',calculation:'Published personal saving as a percentage of disposable personal income, NIPA Table 2.6 line 35; seasonally adjusted percent, not household saving dollars or a growth rate.'};
  return result;
}

/** BEA publishes these keyless flat files as CSV despite the .txt extension. */
export function parseBea(text, seriesCode, frequency) {
  return parseBeaBatch(text,[seriesCode],frequency)[seriesCode];
}

/** Select a coherent family in one scan of BEA's large monthly file. */
export function parseBeaBatch(text, seriesCodes, frequency) {
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

  const selected=new Map([...new Set(seriesCodes)].map(seriesCode=>[seriesCode,{observations:[],periods:new Set()}]));
  if(!selected.size||[...selected.keys()].some(value=>typeof value!=='string'||!value))throw new Error('Invalid BEA series selection');
  for (const row of rows) {
    const seriesCode=row[seriesColumn]?.trim(),target=selected.get(seriesCode);
    if (!target) continue;
    const {observations,periods}=target;
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
  return Object.fromEntries([...selected].map(([seriesCode,{observations}])=>{
    if(!observations.length)throw new Error(`Missing BEA series ${seriesCode} at ${frequency} frequency`);
    return [seriesCode,observations.sort((a,b)=>a.date.localeCompare(b.date))];
  }));
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
  const raw=parseBeaBatch(monthly.text,['DPCERG','DPCCRG','DPCERGM','DPCCRGM','DPCERX','DPCERAM','A067RX','A067RM'],'M');
  for(const code of Object.keys(raw))raw[code]=raw[code].filter(observation=>observation.date<=cutoff);
  const pce = pceInflation(raw.DPCERG);
  const measure=(code,calculation,{observations=raw[code],observationType='official'}={})=>({observations,sourceUrl:MONTHLY_URL,sourceIds:[code],calculation,observationType,dataStatus:'official'});
  const real=(code,label)=>measure(code,`Published ${label}, NIPA ${code==='DPCERX'?'Table 2.8.6 line 1':'Table 2.6 line 37'}; raw chained-2017-dollar millions / 1000 = billions at seasonally adjusted annual rates. Do not sum chained-dollar components.`,{observations:raw[code].map(o=>({...o,value:o.value===null?null:o.value/1000}))});
  const monthlyRate=(code,label,table)=>measure(code,`Published ${label}, NIPA ${table}; percent change from the preceding month, seasonally adjusted, not annualized. Uses published quantity-index changes for real activity, not growth recomputed from rounded dollar levels.`);
  return {
    id: 'bea',
    fetchedAt: [quarterly.retrievedAt, monthly.retrievedAt].sort().at(-1),
    series: {
      ...parseBeaEconomicDepth(quarterly.text,monthly.text,{cutoff}),
      gdp: {
        observations: gdp,
        sourceUrl: QUARTERLY_URL,
        sourceIds: ['A191RL'],
        calculation: 'Published percent change from the preceding quarter in real GDP, annualized (NIPA Table 1.1.1, line 1).',
        dataStatus: 'official',
      },
      pce: {
        observations: pce,
        sourceUrl: MONTHLY_URL,
        sourceIds: ['DPCERG'],
        calculation: '100 * (index / exact year-ago index - 1); headline PCE price index (NIPA Table 2.8.4, line 1).',
        dataStatus: 'official',
        observationType:'calculated',
      },
      pceIndex:measure('DPCERG','Published headline PCE price index, NIPA Table 2.8.4 line 1; index 2017=100, seasonally adjusted.'),
      pceCoreIndex:measure('DPCCRG','Published PCE price index excluding food and energy, NIPA Table 2.8.4 line 25; index 2017=100, seasonally adjusted.'),
      pceCore:measure('DPCCRG','100 × (core PCE price index / exact year-ago month index − 1); NIPA Table 2.8.4 line 25; not a monthly annualized rate.',{observations:pceInflation(raw.DPCCRG),observationType:'calculated'}),
      pceMonthly:monthlyRate('DPCERGM','headline PCE price inflation','Table 2.8.7 line 1'),
      pceCoreMonthly:monthlyRate('DPCCRGM','core PCE price inflation excluding food and energy','Table 2.8.7 line 25'),
      realSpending:real('DPCERX','real personal consumption expenditures'),
      realSpendingMonthly:monthlyRate('DPCERAM','real personal consumption expenditure growth','Table 2.8.1 line 1'),
      realDisposableIncome:real('A067RX','real disposable personal income'),
      realDisposableIncomeMonthly:monthlyRate('A067RM','real disposable personal income growth','Table 2.6 line 43'),
    },
    provenance: [quarterly, monthly].map(({ text: _text, ...metadata }) => metadata),
    coverageNote:'Retains all available observations from the approved quarterly and monthly NIPA files; each measure has its own first available period. Current revised history, first captured on its actual retrieval date. Real-dollar levels are annual rates; monthly percentage changes are not annualized. Reference dates are period starts, not release times.',
    warnings: [],
  };
}
