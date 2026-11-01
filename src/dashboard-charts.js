import {getSeries,latest,periodLabel,transformSeries,resolveDateWindow} from './model.js';
import {chart,panel,button,escapeHtml as esc} from './ui.js';
import {formatDisplayValue} from './display-format.js';
import {indicatorHref} from './workspace-context.js';
import {dashboardChartRange,normalizeDashboardChartSettings,pceHorizonChartCatalog} from './dashboard-chart-data.js';

function definitions(input={},lookup=getSeries){
 const settings=normalizeDashboardChartSettings(input);
 const growth=['gdp','privateDomesticDemandGrowth'].map(lookup).filter(Boolean);
 const family=settings.inflationFamily==='headline'?'headlinePce':'corePce';
 const scoped=pceHorizonChartCatalog({lookup})['pce-horizons'].catalog;
 const inflation=['Yoy','3m','1m'].map(suffix=>scoped[family+suffix]);
 return [
  {id:'growth',title:'Real GDP vs. Private Domestic Final Demand',preset:settings.growth,range:dashboardChartRange(settings.growth,growth),series:growth},
  {id:'inflation',title:'PCE Inflation Horizons: Momentum Breakdown',preset:settings.inflation,range:dashboardChartRange(settings.inflation,inflation),series:inflation,family:settings.inflationFamily},
 ];
}

/** Supplemental frozen evidence records the displayed chart, never a live lookup. */
export function overviewChartEvidence(settings={},catalog,preview='gdp'){
 const lookup=catalog?id=>catalog[id]:getSeries;
 const charts=definitions(settings,lookup);
 if(preview!=='gdp'&&lookup(preview)){
  const selected=lookup(preview);
  charts[0]={...charts[0],title:selected.name,range:dashboardChartRange(charts[0].preset,[selected]),series:[selected]};
 }
 return charts.map(definition=>{
  const window=resolveDateWindow(definition.range,definition.series);
  return {...definition,series:definition.series.map(measure=>({...measure,
   observations:transformSeries(measure,'level',definition.range,window).observations.map(row=>structuredClone(row)),
  }))};
 });
}

function windows(id,current){
 const presets=id==='growth'?['2y','5y','10y','all']:['1y','3y','5y','all'];
 return `<div class="dashboard-range" role="group" aria-label="${id==='growth'?'Growth chart':'Inflation chart'} time range">`
  +presets.map(preset=>button(preset==='all'?'MAX':preset.toUpperCase(),
   `data-dashboard-range="${id}" data-preset="${preset}" aria-pressed="${current===preset}"`,'action')).join('')+'</div>';
}

function measurementNotes(measures){
 const failures=[...new Set(measures.filter(Boolean).flatMap(s=>[s.error,s.dataStatus==='cached'?`${s.name}: cached after a failed source refresh.`:'',s.coverageNote&&/partial|suppressed|not (?:directly )?comparable/i.test(s.coverageNote)?s.coverageNote:'']).filter(Boolean))];
 return failures.map(note=>`<p class="panel-note amber" role="status">${esc(note)}</p>`).join('');
}

function reading(measure){
 const row=latest(measure);
 return `${esc(measure?.short??'Unavailable')} <strong>${esc(formatDisplayValue(measure,row?.value))}</strong> · ${esc(row?periodLabel(measure,row.date):'Reference unavailable')}`;
}

export function overviewComparisonCharts(state,{settings={},preview='gdp',controls=''}={}){
 const [growth,inflation]=definitions(settings),normalized=normalizeDashboardChartSettings(settings);
 const selected=preview==='gdp'?growth.series:[getSeries(preview)].filter(Boolean);
 const ids=selected.map(s=>s.id),range=dashboardChartRange(growth.preset,selected);
 const title=preview==='gdp'?growth.title:getSeries(preview)?.name??growth.title;
 const kind=preview==='gdp'?'combo':preview==='payroll'?'bar':'line';
 const growthBody=controls+`<p class="panel-note dashboard-chart-summary">${selected.map(reading).join(' <span aria-hidden="true">/</span> ')}</p>`
  +measurementNotes(selected)+chart(ids,{kind,height:275,range,legend:true,endLabels:true});
 const growthLinks=`<div class="dashboard-chart-links">${selected.map(s=>`<a class="link-button" href="${esc(indicatorHref(s.id,state))}">${esc(s.short)} history</a>`).join('')}</div>`;
 const growthPanel=panel('',title,growthBody+growthLinks,windows('growth',growth.preset),
  preview==='gdp'?'Percent q/q annualized · seasonally adjusted. GDP includes inventories, government and net exports; private domestic final demand excludes them. Same scale; exact reference dates and source gaps retained.':'Native units · chart window is independent of the research window. Exact reference dates and source gaps retained.','workspace-preview dashboard-comparison');
 const familyControls=`<div class="dashboard-family" role="group" aria-label="PCE inflation family">`
  +['core','headline'].map(family=>button(family==='core'?'Core PCE':'Headline PCE',
   `data-dashboard-family="${family}" aria-pressed="${normalized.inflationFamily===family}"`)).join('')+'</div>';
 const inflationBody=familyControls+`<p class="panel-note dashboard-chart-summary">${inflation.series.map(reading).join(' <span aria-hidden="true">/</span> ')}</p>`+measurementNotes(inflation.series)
  +chart(inflation.series.map(s=>s.id),{height:275,range:inflation.range,legend:true,endLabels:true})
   .replace('data-chart ', 'data-chart data-chart-catalog="pce-horizons" ')
  +`<div class="dashboard-chart-links"><a class="link-button" href="${esc(indicatorHref(normalized.inflationFamily==='core'?'pceCoreIndex':'pceIndex',state))}">Inspect source index & data</a></div>`;
 const inflationPanel=panel('',inflation.title,inflationBody,windows('inflation',inflation.preset),
  'Percent · annual rate. YoY is the 12-month change; calculated 3M and 1M annualized rates compound exact seasonally adjusted index endpoints. These are different horizons, not forecasts. Chart windows are independent of the research window.','workspace-preview dashboard-comparison dashboard-inflation');
 return growthPanel+inflationPanel;
}
