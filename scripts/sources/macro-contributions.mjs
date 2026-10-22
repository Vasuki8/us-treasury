import { requestText } from './http.mjs';
import { parseBea } from './bea.mjs';
import { validateContributionQuarter } from '../../src/macro-contributions.js';

const sourceUrl = 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const definitions = [
  ['total', 'gdpTotalContribution', 'A191RL', 'Published real GDP percent change from the preceding quarter at an annual rate; NIPA Table 1.1.2 line 1'],
  ['consumption', 'gdpConsumptionContribution', 'DPCERY', 'Published personal consumption expenditure contribution; NIPA Table 1.1.2 line 2'],
  ['investment', 'gdpInvestmentContribution', 'A006RY', 'Published gross private domestic investment contribution, including inventory investment; NIPA Table 1.1.2 line 7'],
  ['government', 'gdpGovernmentContribution', 'A822RY', 'Published government consumption and gross investment contribution; NIPA Table 1.1.2 line 22'],
  ['exports', 'gdpExportsContribution', 'A020RY', 'Published exports contribution; NIPA Table 1.1.2 line 16'],
  ['imports', 'gdpImportsContribution', 'A021RY', 'Published imports contribution sign retained without negation; NIPA Table 1.1.2 line 19'],
];
const coverageNote = 'Official BEA NIPA Table 1.1.2 published contributions to real GDP growth. Quarterly observations are seasonally adjusted annual rates; components are percentage points and total growth is percent. Latest revised history is captured, not historical first-release vintages. Reference quarter dates are distinct from retrieval dates; individual release dates are unavailable.';

export function parseMacroContributions(text, { cutoff = '9999-12-31', limit = 36 } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !Number.isInteger(limit) || limit < 1 || limit > 400) throw new Error('Invalid macro contribution coverage');
  const series = {}, maps = {};
  for (const [key, id, code, explanation] of definitions) {
    const observations = parseBea(text, code, 'Q').filter(item => item.date <= cutoff).slice(-limit);
    if (!observations.length) throw new Error(`No usable BEA contribution observations: ${code}`);
    maps[key] = new Map(observations.map(item => [item.date, item.value]));
    series[id] = { observations, sourceUrl, sourceIds: [code], calculation: `${explanation}; ${key === 'total' ? 'percent' : 'percentage points'} at an annual rate, seasonally adjusted; official published values, no chained-dollar summation`, dataStatus: 'official' };
  }
  const dates = [...new Set(Object.values(maps).flatMap(map => [...map.keys()]))].sort();
  const quarterly = dates.map(date => {
    const row = { date, ...Object.fromEntries(Object.entries(maps).map(([key, map]) => [key, map.get(date) ?? null])) };
    const validation = validateContributionQuarter(row);
    return { ...row, reconciliationResidual: validation.residual, complete: validation.complete };
  });
  return { series, quarterly, coverageStart: dates[0], coverageEnd: dates.at(-1), coverageNote };
}

export async function collectMacroContributions({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid macro contribution capture date');
  const response = await requestText(sourceUrl, { fetchImpl: async (url, options) => {
    const result = await fetchImpl(url, options);
    if (result.redirected || (result.url && result.url !== sourceUrl)) throw new Error('Unreviewed BEA contribution redirect');
    return result;
  } });
  const parsed = parseMacroContributions(response.text, { cutoff: now.toISOString().slice(0, 10) });
  const { text: _text, ...metadata } = response;
  const cpiCategoryEffects = { status: 'unavailable', reason: 'The official BLS CPI one-month and 12-month effects tables returned HTTP 403 during the 21 October 2026 access review. No category effects observations have been admitted.', accessReviewedOn: '2026-10-21', sourceUrls: ['https://www.bls.gov/news.release/cpi.t06.htm', 'https://www.bls.gov/news.release/cpi.t07.htm'], observations: [], methodology: 'Only official published BLS effects would be displayed. Relative-importance weights multiplied by inflation rates are not substituted for exact official effects.' };
  return { id: 'macroContributions', fetchedAt: response.retrievedAt, ...parsed, cpiCategoryEffects, provenance: [metadata], warnings: [coverageNote, cpiCategoryEffects.reason] };
}
