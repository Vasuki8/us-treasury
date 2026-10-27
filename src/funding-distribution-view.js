import {NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_TERMS_URL} from './market-functioning.js';
import {fundingDistributionHistory} from './funding-distribution.js';
import {coverageSummary} from './research-controls.js';
import {panel,emptyState,escapeHtml as esc} from './ui.js';

/** Native charts, rebound by the caller to the same retained source in live and frozen views. */
export function fundingDistributionPanels(source={},range={preset:'all'},{frozen=false}={}) {
 const result=fundingDistributionHistory(source,range);
 return `<div class="grid g11">${result.panels.map((item,index)=>{
  const name=item.series.short;
  const content=result.error?emptyState('Funding distribution unavailable.',result.error):!item.observations.length?emptyState('No retained effective dates in this window.','Choose another window; missing observations are not filled.')
   :`<div class="chart" data-chart data-chart-catalog="funding" data-series="${item.series.id}" data-kind="funding-distribution" data-transform="level" data-comparison="native" data-height="240" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">${esc(name)} published transaction-rate distribution · ${frozen?'frozen captured inputs':'captured inputs'}</p></div>`;
  const legend=`<p class="panel-note"><span class="swatch"></span> Median · <span class="swatch" style="opacity:.26"></span> p25–p75 inner · <span class="swatch" style="opacity:.12"></span> p1–p99 outer · Percent</p>`;
  const notes=[...new Set(item.series.observations.filter(row=>row.footnotes?.length).map(row=>`${row.footnoteId!=null?`Footnote ${row.footnoteId}: `:''}${row.footnotes.join(' ')}`))].join(' ');
  return panel(`04${index?'B':'A'}`,`${frozen?'FROZEN ':''}${name} RATE DISTRIBUTION`,`${frozen?'<p class="panel-note">Frozen published fields · recorded source inputs only.</p>':''}${legend}${content}${coverageSummary(item)}`,'',`${name==='SOFR'?'Secured Treasury repo':'Unsecured federal funds'} transaction-rate distributions on each effective day, not confidence intervals or time-series quantiles. Missing endpoints create gaps only in that band; medians remain independently available. Volume is in USD billions; revision flags are preserved. No percentile differences are calculated between markets.${notes?` ${notes}`:''}`);
 }).join('')}</div>${frozen?`<div class="panel-note"><p>${esc(NY_FED_DATA_NOTICE)}</p><p>${esc(NY_FED_REFERENCE_RATE_NOTICE)}</p><p>${esc(NY_FED_PRODUCT_NOTICE)}</p><p>Source: Federal Reserve Bank of New York · <a href="${NY_FED_TERMS_URL}" target="_blank" rel="noopener noreferrer">New York Fed Terms of Use ↗</a>. Reference dates are effective dates, not verified release times.</p></div>`:''}`;
}
