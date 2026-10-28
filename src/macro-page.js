import { readingGroup, supportingDetails } from './page-hierarchy.js';
import { dataStatus } from './data.js';
import { tabularCsv } from './model.js';
import { gdpContributionSummary } from './macro-contributions.js';
import { heading, button, panel, table, chart, emptyState, escapeHtml as esc } from './ui.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const number = (value, digits = 2) => finite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'Unavailable';
const quarter = date => `${date.slice(0, 4)} Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
const definitions = [
  ['fixedInvestment','gdpFixedInvestmentContribution','Fixed investment (within investment)','A007RY'],
  ['inventories','gdpInventoriesContribution','Change in private inventories (within investment)','A014RY'],
  ['consumptionGoods','gdpConsumptionGoodsContribution','Goods (within consumption)','DGDSRY'],
  ['consumptionServices','gdpConsumptionServicesContribution','Services (within consumption)','DSERRY'],
  ['total', 'gdpTotalContribution', 'Real GDP growth', 'A191RL'],
  ['consumption', 'gdpConsumptionContribution', 'Personal consumption expenditures', 'DPCERY'],
  ['investment', 'gdpInvestmentContribution', 'Gross private domestic investment', 'A006RY'],
  ['government', 'gdpGovernmentContribution', 'Government consumption and investment', 'A822RY'],
  ['exports', 'gdpExportsContribution', 'Exports', 'A020RY'],
  ['imports', 'gdpImportsContribution', 'Imports (published contribution sign)', 'A021RY'],
];
const sourceUrl = 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const methodology = 'Published BEA NIPA 1.1.2 accounting contributions; components are percentage points of real GDP quarter-over-quarter growth at an annual rate. Imports retain their published sign. No chained-dollar component sums. Residual = published headline growth minus the five published contributions; rounding limit 0.075 percentage point.';

export function macroPage(source = dataStatus.sources.macroContributions) {
  let summary = null, validationError = '';
  try { summary = gdpContributionSummary(source ?? {}); } catch (error) { validationError = error.message; }
  const status = source?.fetchedAt ? source.status === 'ok' ? 'Captured' : 'CACHED' : 'Unavailable';
  const header = heading('GDP CONTRIBUTIONS', 'Published GDP growth and accounting contributions', button('COMPARE CONTRIBUTORS', 'data-compare="gdpConsumptionContribution,gdpInvestmentContribution,gdpGovernmentContribution"') + button('CSV MACRO', `data-export-macro${!source?.quarterly?.length ? ' disabled title="No GDP contribution capture is available"' : ''}`));
  const capture = `<p class="panel-note">${esc(status)} · Retrieved ${esc(source?.fetchedAt ?? 'Unavailable')}. Release date: unknown for individual historical observations. Reference quarters and retrieval dates are separate.</p>`;
  const pending = source?.status === 'loading' ? '<div class="loading" role="status">GDP contribution capture is loading.</div>' : '';
  const growthText = summary && finite(summary.total) ? `Real GDP growth was ${esc(number(summary.total, 1))}% at an annual rate in ${esc(quarter(summary.date))}.` : `Headline growth is unavailable${summary ? ` for ${esc(quarter(summary.date))}` : ''}.`;
  const driverText = summary?.complete ? (!summary.largestPositive && !summary.largestNegative ? 'No positive or negative contribution was reported for these components.' : [summary.largestPositive ? `${esc(summary.largestPositive.label)} contributed ${esc(number(summary.largestPositive.value))} percentage points.` : 'No positive contribution was reported.', summary.largestNegative ? `${esc(summary.largestNegative.label)} contributed ${esc(number(summary.largestNegative.value))} percentage points.` : 'No negative contribution was reported.'].join(' ')) : 'The latest quarter has missing components; a complete contribution explanation is unavailable.';
  const observed = summary ? `<div class="explain"><p><strong>WHAT CHANGED.</strong> ${growthText} ${finite(summary.growthChange) ? `Growth changed by ${esc(number(summary.growthChange))} percentage points from ${esc(quarter(summary.previousDate))}.` : 'A matching preceding-quarter growth comparison is unavailable.'}</p><p><strong>WHAT CONTRIBUTED.</strong> ${driverText}</p></div>` : emptyState('GDP contribution data unavailable.', validationError || 'No validated official capture is available.');
  const readings=summary?readingGroup('LATEST GDP READINGS',`<div class="metrics"><div class="metric"><span class="metric-name">Real GDP growth</span><strong class="metric-value">${finite(summary.total)?esc(number(summary.total,1))+'%':'Unavailable'}</strong><span class="metric-period">${esc(quarter(summary.date))}</span><span class="metric-basis">Percent q/q annualized · seasonally adjusted</span></div><div class="metric"><span class="metric-name">Growth change · exact preceding quarter</span><strong class="metric-value">${esc(number(summary.growthChange))}</strong><span class="metric-period">${summary.previousDate?esc(quarter(summary.previousDate)):'Prior quarter unavailable'}</span><span class="metric-basis">Percentage points · annualized growth-rate change</span></div></div>`,'Published growth and accounting contributions use different units. Missing components remain unavailable; no economic causation is inferred.'):'';
  const components = summary ? table(['PUBLISHED COMPONENT', 'CONTRIBUTION / PP', 'CHANGE FROM PRIOR / PP'], summary.components.map(item => `<tr><th scope="row">${esc(item.label)}</th><td class="num">${esc(number(item.value))}</td><td class="num">${esc(number(item.change))}</td></tr>`).join('') + `<tr><th scope="row">Sum of published contributions</th><td class="num">${esc(number(summary.contributionSum))}</td><td>Calculated</td></tr><tr><th scope="row">Headline minus contribution sum</th><td class="num">${esc(number(summary.reconciliationResidual))}</td><td>Rounding residual</td></tr>`, 'BEA published GDP growth contributions and changes from the exact preceding quarter, in percentage points at an annual rate') : '';
  const latestDetails=source?.quarterly?.at(-1);
  const detailRows=[['Consumption goods','consumptionGoods'],['Consumption services','consumptionServices'],['Fixed investment','fixedInvestment'],['Change in private inventories','inventories']].map(([name,key])=>`<tr><th scope="row">${name}</th><td class="num">${esc(number(latestDetails?.[key]))}</td><td>${key.startsWith('consumption')?'Within published consumption':'Within published gross private domestic investment'}</td></tr>`).join('');
  const detail=panel('D','PUBLISHED DEMAND & INVESTMENT DETAIL',table(['PUBLISHED SUBCOMPONENT','CONTRIBUTION / PP','PARENT ACCOUNTING GROUP'],detailRows,'Published GDP subcomponent contributions; do not add these to their parent groups'),'','These published percentage-point contributions explain the accounting composition within parent groups. They are alternatives to parent totals in a decomposition, never extra terms in the headline sum. Inventories are distinct from fixed investment. Missing subcomponents remain unavailable.');
  return header + capture + pending + (source?.error ? `<p class="panel-note amber">${esc(source.error)}</p>` : '')
    + readings + `<div class="grid g11 workspace-analysis">${panel('01', 'GDP: WHAT CHANGED & CONTRIBUTED', observed + components, '', 'Total growth is percent q/q annualized. Contributions and changes are percentage points, seasonally adjusted at annual rates. Published accounting contributions do not establish economic causation.')}${panel('02', 'HISTORICAL REAL GDP GROWTH', summary ? chart(['gdpTotalContribution'], { height: 220, range: 12 }) : emptyState('Growth history unavailable.'), '', 'Published BEA growth, percent q/q annualized; latest revised history, not first-release vintages.')}</div>`
    + supportingDetails('macro:demand-detail', 'Published demand & investment detail', detail)
    + supportingDetails('macro:methods', 'GDP contribution methods & limitations', panel('04', 'WHY IT MATTERS & LIMITATIONS', `<div class="explain"><p><strong>WHY IT MATTERS.</strong> Contributions distinguish consumption, investment, government and trade within measured real GDP growth. Changes in those published contributions describe the accounting sources of a change in the growth rate.</p><p><strong>LIMITATIONS.</strong> Accounting contributions do not establish economic causation. Investment includes inventories. Imports retain BEA’s published sign; a decline in imports can contribute positively to measured growth. Never sum chained-dollar GDP components to explain growth.</p><p><strong>Methodology.</strong> ${esc(methodology)}</p><p>${esc(source?.coverageNote ?? 'Coverage is unavailable until an official capture succeeds.')}</p><p>Missing values remain unavailable. Changes use the exact preceding quarter; annual and benchmark updates can revise earlier quarters. Actual historical release dates and first-reported values are not provided by this feed.</p><p>Source: <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">U.S. Bureau of Economic Analysis, NIPA Table 1.1.2 ↗</a>. Official observations and calculated residuals carry separate export labels.</p></div>`));
}

export function cpiEffectsCoveragePanel(source=dataStatus.sources.macroContributions){
  const reason=source?.cpiCategoryEffects?.reason??'Official BLS CPI category effects are unavailable. No approximate category effects have been substituted.';
  return panel('CPI','OFFICIAL CPI CATEGORY EFFECTS',`<div class="explain"><p><strong>UNAVAILABLE.</strong> ${esc(reason)}</p><p>Exact official one-month effects belong to CPI table 6 and 12-month effects to table 7. We do not approximate official effects by multiplying relative-importance weights and category inflation. Seasonal adjustment and reference periods must match; overlapping parent and child categories cannot be added.</p><p><a href="https://www.bls.gov/news.release/cpi.t06.htm" target="_blank" rel="noopener noreferrer">BLS one-month effects ↗</a> · <a href="https://www.bls.gov/news.release/cpi.t07.htm" target="_blank" rel="noopener noreferrer">BLS 12-month effects ↗</a></p></div>`);
}

export function macroContributionsCsv(source = {}) {
  source ??= {};
  const headers = ['data_type', 'series_id', 'name', 'period', 'date', 'value', 'unit', 'frequency', 'adjustment', 'observation_type', 'data_status', 'source', 'source_url', 'source_series', 'release_date', 'retrieved_at', 'calculation', 'coverage_note', 'reconciliation_residual', 'availability_reason'];
  const rows = [];
  for (const row of source.quarterly ?? []) {
    for (const [key, id, label, code] of definitions) {
      if(['fixedInvestment','inventories','consumptionGoods','consumptionServices'].includes(key)&&!source.series?.[id])continue;
      const series = source.series?.[id];
      const observation = series?.observations?.find(item => item.date === row.date);
      rows.push(['GDP published observation', id, label, quarter(row.date), row.date, row[key], key === 'total' ? 'Percent q/q annualized' : 'Percentage points q/q annualized', 'Quarterly', 'Seasonally adjusted annual rate', 'official', source.status === 'ok' ? 'official' : source.fetchedAt ? 'cached' : 'unavailable', 'U.S. Bureau of Economic Analysis', series?.sourceUrl ?? sourceUrl, (series?.sourceIds ?? [code]).join('; '), observation?.publishedAt ?? null, source.fetchedAt ?? null, series?.calculation ?? methodology, source.coverageNote ?? '', row.reconciliationResidual, '']);
    }
    rows.push(['GDP calculated residual', 'gdpContributionResidual', 'GDP growth minus published contribution sum', quarter(row.date), row.date, row.reconciliationResidual, 'Percentage points q/q annualized', 'Quarterly', 'Seasonally adjusted annual rate', 'calculated', source.status === 'ok' ? 'official' : source.fetchedAt ? 'cached' : 'unavailable', 'U.S. Bureau of Economic Analysis; Meridian calculation', sourceUrl, definitions.map(item => item[3]).join('; '), null, source.fetchedAt ?? null, methodology, source.coverageNote ?? '', row.reconciliationResidual, row.complete === false ? 'One or more official contributions are missing' : '']);
  }
  const cpi = source.cpiCategoryEffects ?? {};
  rows.push(['Unavailable CPI effects', 'cpiCategoryEffects', 'Official BLS CPI category effects', '', '', null, 'Percentage points of CPI change; official effects unavailable', 'Monthly', 'One-month and 12-month bases must remain distinct', 'unavailable', 'unavailable', 'U.S. Bureau of Labor Statistics', (cpi.sourceUrls ?? ['https://www.bls.gov/news.release/cpi.t06.htm', 'https://www.bls.gov/news.release/cpi.t07.htm']).join('; '), '', null, null, cpi.methodology ?? 'No approximation from relative-importance weights; only official published effects are admitted.', '', null, cpi.reason ?? 'No official CPI effects capture has been admitted']);
  return tabularCsv([...headers,'capture_provenance_json'],rows.map(row=>[...row,JSON.stringify(row[1]==='cpiCategoryEffects'?[]:source.provenance??[])]));
}
