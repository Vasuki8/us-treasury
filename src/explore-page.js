import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {buildCoverageInventory} from './coverage-inventory.js';
import {coverageInventoryPanel} from './coverage-inventory-view.js';
import {series,releases} from './data.js';
import {seriesPreview} from './workspace-preview.js';
import {globalSearch,globalSearchPanel} from './global-search.js';
import {groupSearchMeasurements} from './search.js';
import {routeFor} from './router.js';
import {getSeries,filterSeries,latest,formatValue,formatChange,periodLabel,compareSeries,observationCoverageLabel} from './model.js';
import {measurementChange} from './measurement-change.js';
import {viewRange,workspaceReturn,indicatorHref} from './workspace-context.js';
import {rangeControls,coverageSummary} from './research-controls.js';
import {escapeHtml as esc,button,heading,panel,chart,emptyState,seriesStatus} from './ui.js';
const allSeries=()=>Object.values(series);
const options=(values,selected)=>values.map(value=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(value)}</option>`).join('');
const link=(label,href,className='action')=>`<a class="${esc(className)}" href="${esc(href)}">${esc(label)}</a>`;

function selectionTray(state) {
  const chips=state.selected.map(id=>{
    const item=getSeries(id);
    return `<span class="series-chip"><span>${esc(item.short)} <span class="mono muted">${esc(item.code)}</span></span>`+
      button('×',`data-remove="${esc(id)}" aria-label="Remove ${esc(item.name)}"`,'link-button')+'</span>';
  }).join('');
  return `<div class="series-tray radar-selection-tray"><span class="small muted">Selected ${state.selected.length}/4</span>${chips}`+
    button('Compare selected','data-explore-mode="compare"','action primary')+'</div>';
}

function catalogCoverage(current,observation) {
  if(!current.coverageNote)return {warning:'',note:''};
  // Keep interpretation-critical limitations inline; only ordinary history prose is disclosed.
  const critical=['dol','dolAdvance'].includes(current.agency)||observation?.partial||observation?.suppressed||
    /\b(?:partial|suppressed)\b|\bnot (?:directly )?comparable\b/i.test(current.coverageNote);
  return critical?{warning:`<span class="table-code catalog-coverage">${esc(current.coverageNote)}</span>`,note:''}
    :{warning:'',note:`<p>${esc(current.coverageNote)}</p>`};
}

const catalogTopics=['Growth','Inflation','Labor','Housing','Policy','Rates','Fiscal','Ownership',
  'Market functioning','Credit','Household finances'];
const catalogHeadlines=['gdp','privateDomesticDemandGrowth','realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction',
  'cpi','cpiCore','cpiMonthly','pce','pceCore','unrate','payroll','claims','participation','wages','openings',
  'housingStarts','housingPermits','policyTargetUpper','fedAssets','yield','nominalYield2','spread2s10s',
  'debt','receiptsTtm','outlaysTtm','netInterestTtm','foreignTreasuryHoldings','fedTreasuryHoldings',
  'sofr','effr','bankLoans','bankDeposits','householdDebtService'];
const headlineRank=id=>catalogHeadlines.includes(id)?catalogHeadlines.indexOf(id):catalogHeadlines.length;

function catalogTrend(current){
 const rows=current.observations.slice(-12),values=rows.map(row=>row.value).filter(Number.isFinite);
 if(!values.length)return '<span class="muted">Unavailable</span>';
 const low=Math.min(...values),span=Math.max(...values)-low||1;let gap=true;
 const path=rows.map((row,index)=>{
  if(!Number.isFinite(row.value)){gap=true;return '';}
  const command=gap?'M':'L';gap=false;
  return `${command}${(index/Math.max(1,rows.length-1)*100).toFixed(2)} ${(27-(row.value-low)/span*24).toFixed(2)}`;
 }).join(' ');
 return `<svg class="catalog-spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="${esc(current.short)} · last ${rows.length} retained observations · ${esc(current.unit)}"><path d="${path}"/></svg>`;
}

function catalogRow({primary:current,variants},state){
  const observation=latest(current),coverage=observationCoverageLabel(observation),notes=catalogCoverage(current,observation);
  const checkbox=item=>`<input type="checkbox" data-select="${esc(item.id)}" aria-label="Select ${esc(item.name)}"`+
    `${state.selected.includes(item.id)?' checked':''}>`;
  const variantsList=variants.length?`<p>Separate source evidence · ${variants.length}</p>`+
    variants.map(item=>`<p><label>${checkbox(item)} `+
      `${link(item.name,indicatorHref(item.id,state),'')} · ${esc(item.code)} · ${esc(item.source.name)}</label></p>`).join(''):'';
  const evidence=notes.note||variantsList?'<details class="catalog-coverage-details" '+
    `data-page-disclosure="explore:source-evidence:${esc(current.id)}"><summary>Notes &amp; source evidence</summary>`+
    notes.note+variantsList+'</details>':'';
  const period=observation?`<time datetime="${esc(observation.date)}">${esc(periodLabel(current,observation.date))}</time>`:'Unavailable';
  return `<tr data-catalog-series="${esc(current.id)}"${state.selected.includes(current.id)?' class="selected-row"':''}>`+
    `<td>${checkbox(current)}</td><th scope="row">${link(current.name,indicatorHref(current.id,state),'')}`+
    `<button type="button" class="catalog-preview-button" data-workspace-preview="${esc(current.id)}" `+
    `aria-label="Preview ${esc(current.name)}" aria-controls="catalog-preview" `+
    `aria-pressed="${state.previewId===current.id}">Preview</button>`+
    `<span class="table-code mono muted">${esc(current.code)} · ${esc(seriesStatus(current))}`+
    `${current.error?` · ${esc(current.error)}`:''}</span>`+
    `<span class="table-code catalog-identity-meta">${esc(current.frequency)} · ${esc(current.source.name)}</span>`+
    `${coverage?`<span class="table-code catalog-coverage">${esc(coverage)}</span>`:''}${notes.warning}${evidence}</th>`+
    `<td class="num catalog-reading"><strong>${esc(formatValue(current,observation?.value))}</strong>`+
    `<span class="table-code catalog-unit">${esc(current.unit)}</span>`+
    `<span class="table-code catalog-period sr-only"><span class="sr-only">Reference period </span>${period}</span></td>`+
    `<td class="num catalog-change" title="${esc(measurementChange(current).text)}">${esc(formatChange(current))}</td><td class="catalog-reference">${period}</td>`+
    `<td class="catalog-frequency">${esc(current.frequency)}</td><td class="muted catalog-source">${esc(current.source.name)}</td><td class="catalog-trend">${catalogTrend(current)}</td></tr>`;
}

function catalog(state,context) {
  const matching=filterSeries({query:state.query,topic:state.topic,frequency:state.frequency});
  const grouped=groupSearchMeasurements(matching).sort((a,b)=>
    catalogTopics.indexOf(a.primary.topic)-catalogTopics.indexOf(b.primary.topic)||
    headlineRank(a.primary.id)-headlineRank(b.primary.id)||a.primary.name.localeCompare(b.primary.name));
  const pages=Math.max(1,Math.ceil(grouped.length/25)),page=Math.max(1,Math.min(pages,state.catalogPage||1)),start=(page-1)*25;
  let priorTopic;
  const rows=grouped.slice(start,start+25).map(group=>{
    const topic=group.primary.topic,topicRow=topic===priorTopic?'':
      `<tr class="catalog-topic" data-catalog-topic="${esc(topic)}"><th colspan="8" scope="rowgroup">${esc(topic)}</th></tr>`;
    priorTopic=topic;return topicRow+catalogRow(group,state);
  }).join('');
  const pageLink=(label,target)=>`<a class="action" href="${esc(routeFor({...state,page:'explore',catalogPage:target}))}" `+
    `data-catalog-page="${target}">${label}</a>`;
  const paging=grouped.length?`<nav class="catalog-pagination" aria-label="Catalog pages">`+
    `${page>1?pageLink('Previous',page-1):''}<span class="muted">${start+1}–${Math.min(start+25,grouped.length)} of `+
    `${grouped.length} · Page ${page} of ${pages}</span>${page<pages?pageLink('Next',page+1):''}</nav>`:'';
  const table=rows?'<div class="table-wrap catalog-table-wrap"><table class="catalog-table">'+
    '<caption class="sr-only">Official series catalog, including unavailable indicators</caption><thead><tr>'+
    '<th scope="col"><span class="sr-only">Select</span></th><th scope="col">Series name &amp; code</th>'+
    '<th scope="col" class="num">Latest</th><th scope="col" class="num">Change</th><th scope="col">Period</th><th scope="col" class="catalog-frequency">Freq</th>'+
    `<th scope="col" class="catalog-source">Source</th><th scope="col">Recent trend</th></tr></thead><tbody>${rows}</tbody></table></div>`:
    emptyState('No series match your filters.','Search a series name, code, topic or agency, or clear the filters.',
      button('Clear filters','data-reset-filters'));
  const filters='<div class="filter-body"><label for="topic-filter">Topic<select id="topic-filter">'+
    options(['All topics',...catalogTopics],state.topic)+'</select></label>'+
    '<label for="frequency-filter">Frequency<select id="frequency-filter">'+
    options(['All frequencies',...new Set(allSeries().map(item=>item.frequency))],state.frequency)+'</select></label></div>';
  const results=globalSearch(state.query,{catalog:allSeries(),events:context.events??releases,library:context.library??{}});
  return panel('01','Series catalog','<div class="panel-body catalog-search-bar"><label class="catalog-search-label" for="catalog-search">Search everything</label>'+
    '<input id="catalog-search" class="searchbox" type="search" placeholder="Indicators, pages, scheduled events or saved research…" '+
    `value="${esc(state.query)}"></div>${globalSearchPanel(results,{includeIndicators:false})}`+
    (state.query.trim()?'<h3 class="chart-caption">Indicators · topic and frequency filters apply below</h3>':'')+
    '<div class="catalog-filter-bar" data-page-disclosure="explore:catalog-filters" role="group" aria-label="Catalog filters">'+
    `<div class="catalog-filters">${filters}${button('Clear filters','data-reset-filters')}</div></div>`+
    selectionTray(state)+table+paging+'<p class="panel-note catalog-trend-note">Recent trends use up to 12 retained observations in each series’ original frequency and native units. Missing values remain gaps; the time span varies by frequency.</p>',`<span class="small muted" id="catalog-result-count">${matching.length} series</span>`);
}

function comparison(state) {
  const result = compareSeries(state.selected, state.comparison, viewRange(state));
  const selected = state.selected.map((id, index) => {
    const current = getSeries(id);
    return `<div class="builder-series"><span class="mono ${index % 2 ? 'cyan' : 'amber'}">${index + 1} / ${esc(current.code)}</span><h3>${link(current.name,indicatorHref(id,state),'')}</h3></div>`;
  }).join('');
  let workspace;
  if (!state.selected.length) workspace = emptyState('No series selected.', 'Choose up to four series from the catalog.', button('OPEN CATALOG', 'data-explore-mode="catalog"'));
  else if (result.error) {
    const dateError=Boolean(result.window?.error),unsupportedIndex=/cannot be ratio-indexed/i.test(result.error);
    const remedies=dateError?button('RESET DATE RANGE','data-comparison-reset-range')+button('EDIT START DATE','data-focus-field="window-start"')+button('EDIT END DATE','data-focus-field="window-end"'):button('USE NATIVE VALUES','data-comparison-mode="native"')+(unsupportedIndex?button('CHANGE FROM BASELINE','data-comparison-mode="difference"'):'')+button('EDIT SELECTION','data-explore-mode="catalog"');
    workspace=`<div class="comparison-error" role="alert">${emptyState(dateError?'Correct the comparison date range.':unsupportedIndex?'Indexed comparison is unsupported.':'These measurements cannot share this baseline.',result.error,remedies)}</div>`;
  }
  else if (state.comparison === 'indexed') workspace = `<p class="panel-note">Index (common baseline = 100) · eligible positive levels only · baseline ${esc(result.panels[0]?.baselinePeriod??result.panels[0]?.baselineDate)}${state.alignment==='quarter'?` · source baseline dates: ${result.panels.map(item=>esc(item.series.short)+' '+esc(item.baselineDate)).join('; ')}`:''} · original observation dates thereafter · no fill or frequency aggregation</p>${chart(state.selected, { height: 275, range: viewRange(state), comparison: 'indexed' })}${result.panels.map(coverageSummary).join('')}`;
  else workspace = result.panels.map(item => `<section class="comparison-panel"><h3 class="chart-caption"><span class="swatch"></span>${esc(item.series.short)} · ${esc(item.unit)} · ${esc(item.series.frequency)}</h3>${state.comparison==='difference'?`<p class="panel-note">Change from baseline ${esc(item.baselineDate)} · ${esc(item.formula??'current value minus baseline value in the displayed units')}</p>`:''}${chart(state.selected, { height: 150, range: viewRange(state),comparison:state.comparison,panelId:item.series.id,cursorGroup:"comparison" })}${coverageSummary(item)}</section>`).join('');
  const controls = `<div class="toolbar"><label for="alignment-select">Baseline alignment<select id="alignment-select"><option value="exact"${state.alignment!=='quarter'?' selected':''}>Exact source date</option><option value="quarter"${state.alignment==='quarter'?' selected':''}>Declared reference quarter</option></select></label><label for="comparison-select">Comparison <select id="comparison-select"><option value="native"${state.comparison === 'native' ? ' selected' : ''}>Native units · separate panels</option><option value="indexed"${state.comparison === 'indexed' ? ' selected' : ''}>Index · eligible positive levels</option><option value="difference"${state.comparison==='difference'?' selected':''}>Change from baseline · separate units</option></select></label>${rangeControls(state,state.selected)}</div>`;
  return `<div class="radar-comparison-desk">${selectionTray(state)}${readingGroup('Selected measurement basis',`<div class="comparison-reading-notes">${state.selected.map(id=>{const item=getSeries(id);return `<p><strong>${esc(item.short)}</strong> · ${esc(item.unit)} · ${esc(item.frequency)} · ${esc(seriesStatus(item))}${item.coverageNote ? `<br><span class="amber">${esc(item.coverageNote)}</span>` : ''}${item.error ? `<br><span class="amber">${esc(item.error)}</span>` : ''}</p>`;}).join('')}</div>`)}`+panel('','COMPARISON WORKSPACE',controls+`<p class="panel-note comparison-export-context">DISPLAYED WINDOW · ${esc(result.window?.label??'Selected window')} · ${state.comparison==='indexed'?'INDEXED':state.comparison==='difference'?'BASELINE DIFFERENCE':'NATIVE'} values · NO FILL · CSV includes displayed units and retrieval provenance.</p>`+workspace,'','Original dates and units remain intact. Reference-quarter mode matches the baseline only, using declared start/end conventions; it does not aggregate flows, turn stocks into flows or remap survey rounds. Linked cursor still uses exact source dates, with no interpolation or frequency aggregation.')+supportingDetails('explore:comparison-details','Selected series links, comparison safeguards & CSV details',`${panel('','SELECTED SERIES',`<div class="builder-list">${selected || '<p class="muted">Select series in the catalog to compare.</p>'}<p class="small muted">Native units and observation dates are preserved. Rates and growth cannot be ratio indexed.</p></div>`,button('EDIT','data-explore-mode="catalog"','link-button'))}`+panel('', 'CSV DETAILS', `<div class="context-strip"><span>FORMAT <b class="mono">LONG CSV</b></span><span>SCOPE <b class="mono">DISPLAYED WINDOW</b></span><span>VALUES <b class="mono">${state.comparison === 'indexed' ? 'INDEXED' : state.comparison==='difference'?'BASELINE DIFFERENCE':'NATIVE'}</b></span><span>ALIGNMENT <b class="mono">NO FILL</b></span></div><p class="panel-note">CSV exports match the displayed date window, values and units. Comparison baselines, formulas, per-series status and retrieval provenance accompany each row.</p>`))+`</div>`;
}

function comparisonStarters(){return `<nav class="comparison-starters" aria-label="Starter comparisons"><span class="small muted">START WITH A QUESTION</span>${[['Inflation momentum','cpiMonthly,cpiCoreMonthly,pceMonthly,pceCoreMonthly'],['Labor breadth','unrate,underemployment,participation'],['Policy versus funding','policyTargetLower,policyTargetUpper,effr,sofr'],['Real income versus spending','realDisposableIncomeMonthly,realSpendingMonthly']].map(([label,ids])=>link(label,'#/explore?mode=compare&selected='+ids)).join('')}</nav>`;}

function inventory(state,context){
 const result=buildCoverageInventory(series,{...state,publicationContexts:context.publicationContexts});
 return `<section class="panel coverage-filters"><div class="panel-body"><label class="catalog-search-label" for="catalog-search">Search measurement coverage</label><input id="catalog-search" class="searchbox" type="search" placeholder="Name, code, topic or source…" value="${esc(state.query)}"></div><div class="catalog-filters"><div class="filter-body"><label for="topic-filter">Topic<select id="topic-filter">${options(['All topics',...new Set(allSeries().map(x=>x.topic))],state.topic)}</select></label><label for="frequency-filter">Frequency<select id="frequency-filter">${options(['All frequencies',...new Set(allSeries().map(x=>x.frequency))],state.frequency)}</select></label></div>${button('CLEAR FILTERS','data-reset-filters')}<span class="small muted" id="catalog-result-count">${result.rows.length} MEASUREMENTS</span></div></section>${coverageInventoryPanel(result,{state,showExport:false})}`;
}

function catalogPreview(id,state){
 const current=getSeries(id),recent=[...current.observations.slice(-4)].reverse();
 const lineage=`<p class="catalog-preview-lineage"><span class="mono">Series ID: ${esc(current.code)}</span> · ${esc(current.source.name)}</p>`;
 return seriesPreview(id,state,{title:'Selected series preview',controls:lineage})
  +`<section class="catalog-recent-observations" aria-label="Recent preview observations"><h3>Recent observations</h3>${recent.length?`<table><caption class="sr-only">Last four retained ${esc(current.short)} observations, native units</caption><tbody>${recent.map(row=>`<tr><th scope="row"><time datetime="${esc(row.date)}">${esc(periodLabel(current,row.date))}</time></th><td class="num">${esc(formatValue(current,row.value))}</td></tr>`).join('')}</tbody></table>`:'<p class="panel-note">No observations retained.</p>'}</section>`;
}

export function explorePage(state,context={}) {
  const previewId=getSeries(context.workspacePreview)?context.workspacePreview:'unrate';
  state={...state,previewId};
  const back=workspaceReturn(state),result=compareSeries(state.selected,state.exploreMode==='compare'?state.comparison:'native',viewRange(state));
  const catalogDesk=`<div class="catalog-workspace">${catalog(state,context)}`
    +`<aside id="catalog-preview" tabindex="-1" data-preview-active="${Boolean(context.workspacePreview)}" aria-label="Series preview">`
    +button('Back to catalog','data-preview-close','action preview-return')+catalogPreview(previewId,state)+'</aside></div>';
  const content=state.exploreMode==='coverage'?inventory(state,context):state.exploreMode==='compare'?comparison(state):catalogDesk;
  const actions=state.exploreMode==='coverage'?button('CSV coverage','data-export-coverage')
    :button('CSV selected',`data-export${state.selected.length&&!result.error?'':' disabled'}`);
  const tabs=[['catalog','Series catalog'],['compare','Compare series'],['coverage','Coverage inventory']];
  const starters=state.exploreMode==='coverage'?'':state.exploreMode==='compare'?comparisonStarters()
    :supportingDetails('explore:catalog-starters','Starter comparisons · explore a question',comparisonStarters(),{className:'catalog-starters'});
  return `<div class="radar-page radar-explore stitch-explore" data-explore-view="${state.exploreMode}">`
    +(back?`<nav class="return-context" aria-label="Return to workspace">${link(back.label,back.href)}</nav>`:'')
    +heading('Explore macroeconomic series',`${allSeries().length} registered measurements · Macroeconomic, labor, price and Treasury indicators from retained official sources.`,actions)
    +`<div class="tabs explore-tabs" role="tablist" aria-label="Explore views">${tabs.map(([id,label])=>button(label,
      `role="tab" id="explore-tab-${id}" aria-controls="explore-content" aria-selected="${state.exploreMode===id}" `
      +`data-explore-mode="${id}"`,'')).join('')}</div>`
    +`<div id="explore-content" class="tab-panel workspace-analysis" role="tabpanel" `
    +`aria-labelledby="explore-tab-${state.exploreMode}">${content}</div>${starters}</div>`;
}
