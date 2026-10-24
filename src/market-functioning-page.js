import {fundingChartCatalog} from './funding-distribution.js';
import {fundingDistributionPanels} from './funding-distribution-view.js';
import {viewRange} from './workspace-context.js';
import {rangeControls,coverageSummary} from './research-controls.js';
import {transformSeries,resolveDateWindow} from './model.js';
import {supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {DEALER_METRICS,dealerWeeklyChanges,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_TERMS_URL,MARKET_FUNCTIONING_LIMITATION} from './market-functioning.js';
import {tabularCsv} from './model.js';
import {heading,button,panel,chart,table,emptyState,escapeHtml as esc} from './ui.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const definitions={
  dealerNetTreasury:['Net dealer Treasury position','USD billions','Weekly'],dealerRepo:['Dealer repo financing','USD billions','Weekly'],dealerReverseRepo:['Dealer reverse-repo financing','USD billions','Weekly'],dealerFailsDeliver:['Failed deliveries','USD billions','Weekly'],dealerFailsReceive:['Failed receipts','USD billions','Weekly'],
  sofr:['SOFR','Percent','Daily'],effr:['EFFR','Percent','Daily'],sofrEffrSpread:['SOFR − EFFR','Basis points','Daily'],
};
const format=(id,value)=>!finite(value)?'—':definitions[id][1]==='USD billions'?`$${value.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})}B`:definitions[id][1]==='Percent'?`${value.toFixed(2)}%`:`${value.toFixed(1)} bp`;
const captured=source=>source?.fetchedAt?(source.status==='ok'?'CAPTURED':'CACHED'):'UNAVAILABLE';
const latest=(source,id)=>source?.series?.[id]?.observations?.at(-1);
function sourceNotice(source,id){
  let provided=source?.series?.[id]?.sourceNotice??source?.sourceNotice??'';
  for(const required of [NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE,...(['sofr','effr','sofrEffrSpread'].includes(id)?[NY_FED_REFERENCE_RATE_NOTICE]:[])])if(!provided.includes(required))provided+=(provided?' ':'')+required;
  return provided;
}

function headline(source,id){
  const row=latest(source,id);
  return `<a class="metric" href="#/series/${id}"><span class="metric-name">${esc(definitions[id][0])}</span><strong class="metric-value">${esc(format(id,row?.value))}</strong><span class="metric-change">${row?.suppressed?'SUPPRESSED':row?.revisionIndicator==='Y'?'REVISED':id==='sofrEffrSpread'?'Calculated metric':'Official observation'}</span><span class="metric-period">${esc(row?.date??'Unavailable')} · ${esc(definitions[id][1])}</span></a>`;
}

function dealerTable(source,ids){
  const changes=new Map(dealerWeeklyChanges(source).map(row=>[row.id,row]));
  return table(['INDICATOR / BASIS','LATEST','EXACT PRIOR-WEEK CHANGE','REFERENCE DATE'],ids.map(id=>{
    const current=latest(source,id),change=changes.get(id);
    return `<tr><th scope="row">${esc(definitions[id][0])}<span class="table-code muted">${esc(DEALER_METRICS[id].measure)}</span></th><td class="num">${esc(format(id,current?.value))}${current?.suppressed?'<span class="table-code amber">SUPPRESSED</span>':''}</td><td class="num">${esc(format(id,change?.change))}</td><td class="mono">${esc(current?.date??'Unavailable')}</td></tr>`;
  }).join(''),'Dealer measures in USD billions; weekly stock and cumulative fails retain their separate reporting basis.');
}

export function marketFunctioningPage(source=dataStatus.sources.marketFunctioning,state={}){
  const range=viewRange(state),{catalog}=fundingChartCatalog(source),window=resolveDateWindow(range,Object.values(catalog));
  const spread=transformSeries(catalog.sofrEffrSpread,'level',range,window);
  const spreadChart=chart(['sofrEffrSpread'],{height:200,range}).replace('data-chart data-series','data-chart data-chart-catalog="funding" data-series');
  const hasData=Object.values(source?.series??{}).some(series=>series.observations?.length);
  const rates=['sofr','effr','sofrEffrSpread'];
  const rateTable=table(['FUNDING CONTEXT','LATEST','EFFECTIVE DATE','SOURCE FLAGS'],rates.map(id=>{const row=latest(source,id);return `<tr><th scope="row">${esc(definitions[id][0])}<span class="table-code muted">${id==='sofrEffrSpread'?'Calculated same-date difference':'Published volume-weighted median rate'}</span></th><td class="num">${esc(format(id,row?.value))}</td><td class="mono">${esc(row?.date??'Unavailable')}</td><td>${row?.revisionIndicator==='Y'?'REVISED':'No revision flag supplied'}${finite(row?.volumeInBillions)?` · underlying volume $${esc(row.volumeInBillions)}B`:''}</td></tr>`;}).join(''));
  return heading('FUNDING & MARKET FUNCTIONING','Official dealer aggregates and funding reference rates · partial indicators',button('CSV INDICATORS · FULL RETAINED','data-export-market'))
    +`<p class="panel-note"><strong>WHAT CHANGED.</strong> ${esc(captured(source))} · last successful retrieval ${esc(source?.fetchedAt??'No successful capture')} · latest attempt ${esc(source?.lastAttemptAt??'Not recorded')}. Coverage ${esc(source?.coverageStart??'unknown')} through ${esc(source?.coverageEnd??'unknown')}. Exact release timestamps are unknown; reference dates and retrieval dates remain separate.${source?.error?` <span class="amber">${esc(source.error)}</span>`:''}</p>`
    +`<p class="panel-note">${esc(MARKET_FUNCTIONING_LIMITATION)} Suppressed latest values remain missing; older observations are not substituted.</p>`
    +(hasData?`<section class="metrics" aria-label="Funding and dealer indicators">${['dealerNetTreasury','dealerFailsDeliver','dealerFailsReceive','sofr','effr','sofrEffrSpread'].map(id=>headline(source,id)).join('')}</section>`:emptyState('No verified market-functioning capture is available.','Source errors and missing values remain visible; no sample observations are substituted.'))
    +`<div class="grid g11">${panel('01','DEALER POSITION & FINANCING STOCKS',hasData?dealerTable(source,['dealerNetTreasury','dealerRepo','dealerReverseRepo']):emptyState('Dealer stocks unavailable.'),'','Wednesday positions and outstanding financing, USD billions. Nominal Treasury securities excluding TIPS. Repo and reverse repo describe separate dealer financing directions; they are not netted into a score.')}${panel('02','CUMULATIVE WEEKLY SETTLEMENT FAILS',hasData?dealerTable(source,['dealerFailsDeliver','dealerFailsReceive']):emptyState('Settlement fails unavailable.'),'','Cumulative weekly dollar amounts. A fail can recur while unsettled; delivery and receipt sides are not added into unique failures or treated as issuer defaults.')}</div>`
    +panel('03','DAILY FUNDING-RATE CONTEXT',hasData?rateTable:emptyState('Funding rates unavailable.'),'','SOFR is secured Treasury repo funding; EFFR is unsecured federal-funds funding. The same-effective-date difference is descriptive, not an exact credit or liquidity decomposition.')
    +panel('W','SHARED FUNDING HISTORY WINDOW',rangeControls(state,Object.keys(catalog),{catalog})+'<p class="panel-note">The date window applies to both funding distributions and the median-rate spread. CSV INDICATORS exports the full retained history, including published percentile fields, independently of this window. Generic selected-series CSV exports do not include distribution bands.</p>')
    +fundingDistributionPanels(source,range)
    +panel('05','SOFR − EFFR',spread.error?emptyState('Funding spread unavailable.',spread.error):spreadChart+coverageSummary(spread),'','Basis points · Meridian calculation from published medians, exact matching dates only. This is a difference between distinct markets, not a transaction-rate distribution of their spread.')
    +panel('06','SOURCE CREDIT & REUSE CONDITIONS',`<div class="explain"><p>${esc(NY_FED_DATA_NOTICE)}</p><p>${esc(NY_FED_REFERENCE_RATE_NOTICE)}</p><p>${esc(NY_FED_PRODUCT_NOTICE)}</p><p>USD-billion conversions and the SOFR−EFFR difference are Meridian calculations. Source data are available without charge and remain subject to the same <a href="${NY_FED_TERMS_URL}" target="_blank" rel="noopener noreferrer">New York Fed Terms of Use ↗</a>, including disclaimers and limitations. These notices accompany CSV exports.</p></div>`)
    +supportingDetails('market:methods','Interpretation, publication schedules & limitations',panel('07','WHAT CONTRIBUTED, WHY IT MATTERS & LIMITATIONS',`<div class="explain"><p><strong>WHAT CONTRIBUTED.</strong> These separate indicators describe dealer inventory, financing, settlement delays and funding costs. Their changes are presented on each measure’s own period and basis. This module does not infer a single cause or add stocks and weekly amounts together.</p><p><strong>WHY IT MATTERS.</strong> Inventory and financing describe part of intermediary activity, fails describe unsettled obligations, and reference rates provide funding-cost context. They help frame further research; concurrent changes do not establish causation.</p><p><strong>LIMITATIONS.</strong> Net positions include the source’s immediate, forward and when-issued coverage. Revisions and source contingencies may apply.</p><p>Dealer statistics are usually published Thursday around 4:15 p.m. Eastern for the previous week. SOFR is usually published around 8 a.m. Eastern and EFFR around 9 a.m. for the preceding business day, with possible same-day revisions. These schedules do not verify historical release timestamps.</p><p><a href="https://www.newyorkfed.org/markets/counterparties/primary-dealers-statistics" target="_blank" rel="noopener noreferrer">Primary Dealer Statistics ↗</a> · <a href="https://www.newyorkfed.org/markets/reference-rates/sofr" target="_blank" rel="noopener noreferrer">Secured Overnight Financing Rate Data ↗</a> · <a href="https://www.newyorkfed.org/markets/reference-rates/effr" target="_blank" rel="noopener noreferrer">Effective Federal Funds Rate ↗</a></p></div>`));
}

export function marketFunctioningCsv(source){
  const headers=['series_id','name','date','value','unit','frequency','measure','observation_type','missing','suppressed','revision_indicator','source_value','volume_in_billions','percentile_1','percentile_25','percentile_75','percentile_99','retrieved_at','last_attempt_at','capture_status','publication_date','source_series','source_url','source_urls','calculation','coverage_note','source_notice','license_url','source_title','capture_provenance_json'];
  const rows=Object.entries(definitions).flatMap(([id,[name,unit,frequency]])=>{
    const series=source?.series?.[id];
    return (series?.observations??[]).map(row=>[id,name,row.date,finite(row.value)?row.value:null,unit,frequency,series.measure??DEALER_METRICS[id]?.measure??(id==='sofrEffrSpread'?'Same-date difference between distinct funding markets':'Published daily volume-weighted median rate'),series.observationType??(id==='sofrEffrSpread'?'calculated':'official'),!finite(row.value),Boolean(row.suppressed),row.revisionIndicator??'',row.sourceValue??null,row.volumeInBillions??null,row.percentile1??null,row.percentile25??null,row.percentile75??null,row.percentile99??null,source?.fetchedAt??null,source?.lastAttemptAt??null,captured(source),row.publishedAt??null,(series.sourceIds??[]).join('; '),row.sourceUrl??series.sourceUrl,(row.sourceUrls??series.sourceUrls??[row.sourceUrl??series.sourceUrl]).filter(Boolean).join('; '),series.calculation??'',series.coverageNote??source?.coverageNote??MARKET_FUNCTIONING_LIMITATION,sourceNotice(source,id),series.licenseUrl??source?.licenseUrl??NY_FED_TERMS_URL,series.sourceTitle??null,JSON.stringify(source?.provenance??[])]);
  });
  return tabularCsv(headers,rows);
}
