import {cpiPublicationIds} from './cpi-publication-history.js';
import {supportingDetails} from './page-hierarchy.js';
import {getSeries,latest,formatValue,periodLabel,transformSeries,observationCoverageLabel} from './model.js';
import {displayCurrencyUnit,formatDisplayValue} from './display-format.js';
import {escapeHtml as esc,button,heading,panel,chart,table,emptyState,sourceLink,seriesStatus,sentenceCase} from './ui.js';
import {viewRange,workspaceReturn,indicatorHref,contextualHref} from './workspace-context.js';
import {rangeControls,coverageSummary,measureLabel,changeLabel} from './research-controls.js';
import {relatedIndicators} from './related.js';
import {measurementChange} from './measurement-change.js';
import {historyStatusMessage} from './vintages-page.js';
import {vintageMeasurementsComparable} from './vintages.js';
import {yieldTimingPanel} from './calendar-presentation.js';
import {releases} from './data.js';
import {humanDate,humanTimestamp,publicationDate,scheduledReleaseDate} from './ui-time.js';
import {indicatorStats,indicatorContext,indicatorFamily} from './stitch-indicator-context.js';
import {familyLedger,familyRelated,familyExportDock,familyChartSelection,indicatorFamilyChartCatalog} from './stitch-family-view.js';
import {normalizeSourceNotes} from './source-notes.js';

const link=(label,href,className='action')=>`<a class="${esc(className)}" href="${esc(href)}">`
  +`${esc(sentenceCase(label.replace(/ ↗/g,'')))}</a>`;
const number=(value,precision=2)=>value==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:precision,minimumFractionDigits:precision}).format(value);
const valueForPanel=(item,value,transform='level')=>transform==='level'?formatValue(item.series,value):value==null?'—':`${number(value,item.series.precision)} ${item.unit}`;

function detailData(item, state) {
  if(item.error)return emptyState('Date window unavailable.',item.error);
  if (!item.observations.length) return emptyState('No observations available.', item.series.error ?? 'The official source has no available observations in this snapshot.', link('EXPLORE DATA ↗', '#/explore'));
  const originals = new Map(item.series.observations.map(observation => [observation.date, observation]));
  const rows = [...item.observations].reverse().map(observation => {
    const original = originals.get(observation.date);
    const notes=normalizeSourceNotes([...(original?.footnotes??[]),observationCoverageLabel(original),
      original?.suppressed?'SUPPRESSED · withheld by source':'',
      original?.revisionIndicator==='Y'?'SOURCE REVISION FLAG · reason unknown':'']).join('; ')||'—';
    const published=publicationDate(item.series,original,releases);
    return `<tr><th scope="row"><time datetime="${esc(observation.date)}">`
      +`${esc(periodLabel(item.series,observation.date))}</time></th>`
      +`<td class="num">${esc(valueForPanel(item,observation.value,state.transform))}</td>`
      +`<td class="mono muted">${esc(humanDate(published)||'—')}</td><td class="muted">${esc(notes)}</td></tr>`;
  }).join('');
  return `<p class="panel-note">${esc(state.transform==='change'?changeLabel(item.series):measureLabel(item.series))}`
    +` · ${esc(item.unit)} · most recent first.</p>`
    +table(['Observation period',{label:state.transform==='change'?'Period change':'Value',numeric:true},'Published','Source notes'],
      rows,'Official indicator observations and source footnotes');
}

function detailRevisions(current, { historyState = { status:'idle' }, revisions = [] } = {},state={}) {
  if (historyState.status !== 'ready') return historyStatusMessage(historyState);
  if (!revisions.length) return emptyState('No observed value changes have been captured.', 'This does not establish whether earlier published values were revised. First captured and first released are distinct; see Retrieval History for retrieval cutoffs.');
  const rows = [...revisions].reverse().map(revision => {
    const first = { ...current, ...revision.firstMetadata }, latest = { ...current, ...revision.latestMetadata };
    const comparison = vintageMeasurementsComparable(first, latest) ? 'Same captured measurement and definition.' : 'Not directly comparable: measurement or definition changed between captures. Cause unknown.';
    return `<tr><th scope="row">${esc(periodLabel(latest, revision.date))}</th><td class="num">${esc(formatValue(first, revision.firstCaptured.value))}<span class="table-code muted">${esc(first.unit)}</span></td><td class="num">${esc(formatValue(latest, revision.latest.value))}<span class="table-code muted">${esc(latest.unit)}</span></td><td>${esc(revision.firstCaptured.capturedAt)}</td><td>${esc(revision.latest.capturedAt)}</td><td>Unknown</td><td>${esc(comparison)}</td></tr>`;
  }).join('');
  return `<p class="panel-note">Observed changes between immutable retrieval captures. Each value retains its captured measurement metadata. First captured does not mean first reported. Release dates, revision explanations and benchmark classification are unknown without independent release evidence.</p>${table(['OBSERVATION PERIOD', {label:'FIRST CAPTURED VALUE',numeric:true}, {label:'LATEST CAPTURED VALUE',numeric:true}, 'FIRST RETRIEVED / UTC', 'LATEST RETRIEVED / UTC','REVISION REASON','MEASUREMENT COMPARISON'], rows, 'Observed captured value changes')}<a class="action" href="${esc(contextualHref({page:'vintages',vintageSeries:current.id},state))}">RETRIEVAL HISTORY</a>`;
}

function detailMethodology(current) {
  return `<div class="explain"><p><strong>Frequency and units.</strong> ${esc(current.frequency)} · ${esc(current.unit)} · ${esc(current.adjustment)}.</p><p><strong>Calculation.</strong> ${esc(current.calculation ?? 'No calculation metadata is available.')}</p>${current.coverageNote ? `<p><strong>Coverage.</strong> ${esc(current.coverageNote)}</p>` : ''}<p><strong>Observation and publication dates.</strong> The observation period describes when activity was measured. Retrieval is when the source was captured. ${esc(current.publicationNote ?? 'Historical publication dates are not supplied by this feed and remain unknown.')}</p><p><strong>Period change.</strong> Each observation is compared with the immediately preceding observation. Missing observations remain missing; no values are filled. Changes in percentage measures use percentage points; yield changes use basis points.</p><p><strong>Source.</strong> ${sourceLink(current)} · ${esc((current.source.seriesIds ?? []).join(', ') || current.code)}. ${esc(seriesStatus(current))}; retrieved ${esc(current.fetchedAt ?? 'unavailable')}.${current.error ? ` ${esc(current.error)}` : ''}</p><p>Source footnotes, including preliminary estimates, are preserved in the data table. Revision history records immutable retrieval captures; release dates are shown only when independently verified.</p></div>`;
}

function claimsContextLinks(current,state) {
  const pairs={claims:['claimsAdvance','VIEW LATEST RELEASE CONTEXT ↗'],continuedClaims:['continuedClaimsAdvance','VIEW LATEST RELEASE CONTEXT ↗'],claimsAdvance:['claims','VIEW REVISED HISTORY ↗'],continuedClaimsAdvance:['continuedClaims','VIEW REVISED HISTORY ↗']};
  const pair=pairs[current.id];
  const publicationSeries=current.agency==='dolAdvance'?current.id:pair?.[0];
  return pair?`<nav class="context-strip" aria-label="Claims history and latest release">${link(pair[1],indicatorHref(pair[0],state))}${link('ARCHIVED PUBLICATIONS ↗',contextualHref({page:'research',researchView:'publications',publicationSeries},state))}<span class="muted">Revised history and latest release context have separate captures and can show different reference weeks.</span></nav>`:'';
}


export function indicatorPage(state,historyContext={}) {
  const current=getSeries(state.seriesId)??getSeries('unrate');
  const observation=latest(current),family=indicatorFamily(current);
  const published=publicationDate(current,observation,releases),scheduled=scheduledReleaseDate(current,observation,releases);
  const currencyUnit=displayCurrencyUnit([current]),options={currencyUnit};
  const transformed=transformSeries(current,state.transform,viewRange(state));
  const available=transformed.observations.length>0;
  const related=relatedIndicators(current.id),back=workspaceReturn(state);
  const tabs=[['data','DATA TABLE'],['methodology','METHODOLOGY'],['revisions','RETRIEVAL HISTORY']];
  const activeTab=tabs.some(([id])=>state.tab===id)?state.tab:'data';
  const content=activeTab==='methodology'?detailMethodology(current):activeTab==='revisions'?detailRevisions(current,historyContext,state):detailData(transformed,state);
  const actions=button(state.saved.includes(current.id)?'★ FOLLOWING':'☆ FOLLOW',`data-save="${esc(current.id)}" aria-pressed="${state.saved.includes(current.id)}"`)
    +button(state.selected.includes(current.id)?'VIEW COMPARISON':'ADD TO COMPARISON',`data-add-compare="${esc(current.id)}"${state.selected.length>=4&&!state.selected.includes(current.id)?' disabled title="Remove a selected series before adding another."':''}`)
    +button('DOWNLOAD CSV',`data-export${transformed.error?' disabled title="Choose a valid date window."':!available?' disabled title="No observations in the selected window."':''}`);
  const metadata=`<dl class="facts"><dt>Series</dt><dd class="mono cyan">${esc(current.code)}</dd><dt>Source IDs</dt>`
    +`<dd class="mono">${esc((current.source.seriesIds??[]).join(', ')||'—')}</dd><dt>Measurement</dt>`
    +`<dd>${esc(current.observationType==='calculated'?'Derived':measureLabel(current))}</dd></dl>`;
  const criticalCoverage=['dol','dolAdvance'].includes(current.agency)||observation?.partial||observation?.suppressed
    ||/\b(?:partial|suppressed)\b|\bnot (?:directly )?comparable\b/i.test(current.coverageNote??'');
  const chartControls=`<div class="toolbar">${rangeControls(state,[current.id])}`
    +'<label for="transform-select">View <select id="transform-select">'
    +`<option value="level"${state.transform==='level'?' selected':''}>${esc(measureLabel(current))}</option>`
    +`<option value="change"${state.transform==='change'?' selected':''}>${esc(changeLabel(current))}</option>`
    +'</select></label></div>';
  const familySelection=state.transform==='level'?familyChartSelection(current,family):null;
  const chartIds=familySelection?.ids.length?familySelection.ids:state.transform==='level'&&current.id==='payroll'?['payroll','payrollAverage3m']:
    state.transform==='level'&&['unrate','underemployment'].includes(current.id)?[current.id,current.id==='unrate'?'underemployment':'unrate']:[current.id];
  const chartCatalog=familySelection?.catalog?indicatorFamilyChartCatalog()[familySelection.catalog]?.catalog:null;
  const chartBasis=[...new Set(chartIds.map(id=>chartCatalog?chartCatalog[id]:getSeries(id)).filter(Boolean).map(s=>
    `${s.frequency} · ${transformSeries(s,state.transform,viewRange(state)).unit} · ${s.adjustment} · ${seriesStatus(s)}`))].join(' / ');
  const chartMarkup=chart(chartIds,{height:300,kind:chartIds.length>1&&current.id==='payroll'?'combo':current.id==='payroll'?'bar':'line',transform:state.transform,range:viewRange(state),legend:true,endLabels:true});
  const chartBody=chartControls+(familySelection?.catalog?chartMarkup.replace('data-chart ',`data-chart data-chart-catalog="${familySelection.catalog}" `):chartMarkup)
    +(familySelection?.ids.length?`<p class="panel-note indicator-chart-basis">${esc(familySelection.note)}</p>`:'')
    +(chartIds.length>1?'<p class="panel-note">The overlay provides context. The table and CSV retain the selected indicator.'+(['unrate','underemployment'].includes(current.id)?' U-3 and U-6 have different denominators.':'')+'</p>':'')
    +coverageSummary(transformed)+(state.transform==='change'?'<p class="panel-note">'
      +'Changes use the immediately preceding retained observation before the selected window is applied; '
      +'the first displayed change can reference an observation outside the window. Missing observations remain gaps.</p>':'');
  const desk=current.topic==='Labor'?{label:'Labor market',href:'#/economy/labor'}:current.topic==='Inflation'?{label:'Inflation',href:'#/economy?family=prices'}:related.module??{label:'Explore data',href:'#/explore'};
  const relatedIds=familyRelated(family,current.id,related.seriesIds);
  const title=family==='unemployment'?'Unemployment rate · U-3 & U-6':family==='earnings'?'Average hourly earnings · CES':current.name;
  const provenance=`<div class="indicator-provenance-bar"><span>${esc(current.source.name)}</span><span class="mono">Series: ${esc(current.code)}</span><dl class="indicator-provenance"><dt>Source freshness</dt><dd>${current.dataStatus==='cached'?'Cached':current.dataStatus==='official'?'Captured':'Unavailable'}</dd>${published?`<dt>Published</dt><dd>${esc(humanDate(published))}</dd>`:'<dt>Published</dt><dd>Not verified in retained history</dd>'}${scheduled?`<dt>Scheduled release</dt><dd>${esc(humanDate(scheduled))} · publication not confirmed</dd>`:''}<dt>Retrieved</dt><dd>${esc(humanTimestamp(current.fetchedAt)||'No successful retrieval')}</dd></dl></div>`;
  const lineage=`<section class="indicator-lineage"><header><h2>Source & calculation lineage</h2>${button('Copy link','data-copy-link','link-button')}</header><dl class="facts"><dt>Official source</dt><dd>${sourceLink(current)}</dd><dt>Source IDs</dt><dd class="mono">${esc((current.source.seriesIds??[]).join(', ')||current.code)}</dd><dt>Retrieval</dt><dd>${esc(current.fetchedAt??'Unknown')}</dd><dt>Latest attempt</dt><dd>${esc(current.lastAttemptAt??'Unknown')}</dd><dt>Calculation</dt><dd>${esc(current.calculation||'No calculation metadata is available.')}</dd><dt>Latest source input</dt><dd>${esc(observation?.sourceValue??'Not retained') }${observation?.baseDate?` · base ${esc(observation.baseDate)}: ${esc(observation.baseValue??'Unavailable')}`:''}</dd>${observation?.sourceSha256?`<dt>Source receipt SHA-256</dt><dd class="mono indicator-source-digest">${esc(observation.sourceSha256)}</dd>`:''}</dl><p class="panel-note">Source receipt hashes identify retained inputs when supplied. They do not certify an economic estimate or establish its first publication.</p>${current.sourceNotice?`<p class="panel-note">${esc(current.sourceNotice)}</p>`:''}</section>`;
  const evidence=`<section class="panel indicator-evidence"><header class="panel-head"><h2>Historical observations & retrieval revisions</h2><p class="panel-note">${esc(current.name)} · original reference periods, source footnotes and captured revision coverage.</p></header><div class="tabs" role="tablist" aria-label="Indicator detail sections">${tabs.map(([id,label])=>button(label,`role="tab" id="detail-tab-${id}" aria-controls="detail-content" aria-selected="${activeTab===id}" tabindex="${activeTab===id?0:-1}" data-tab="${id}"`,'')).join('')}</div><div class="tab-panel" id="detail-content" role="tabpanel" tabindex="0" aria-labelledby="detail-tab-${activeTab}">${content}</div></section>`;
  return `<div class="stitch-indicator" data-indicator-family="${family}"><div class="radar-page radar-indicator"><nav class="indicator-breadcrumbs${back?' return-context':''}" aria-label="${back?'Return to workspace':'Indicator breadcrumb'}">${link(back?.label??'Back to '+desk.label,back?.href??desk.href,'indicator-back')}<span>Workspace / Economy / ${esc(desk.label)} / <b>${esc(current.code)}</b></span></nav>`
    +heading(title,`${current.code} · ${current.source.name} · ${current.adjustment}`,actions)
    +`<p class="panel-note indicator-definition">${esc(current.definition)}</p>`
    +`<div class="indicator-desk">${provenance}${indicatorStats(current,state,options)}`
    +(current.coverageNote&&criticalCoverage?`<p class="panel-note amber">${esc(current.coverageNote)}</p>`:'')
    +(current.error?`<p class="panel-note amber" role="status">${esc(current.error)}</p>`:'')
    +claimsContextLinks(current,state)
    +(cpiPublicationIds.includes(current.id)?`<p class="panel-note indicator-publication-link">${link('VERIFIED RELEASE & PUBLICATION EVIDENCE ↗',contextualHref({page:'release',publicationSeries:current.id,publicationPeriod:observation?.date??''},state))}<br>Published CPI rates use the dated release, with monthly seasonally adjusted and twelve-month unadjusted bases. This chart retains its current index-derived history.</p>`:'')
    +(['gdp','claimsAdvance','continuedClaimsAdvance','claims','continuedClaims'].includes(current.id)?`<p class="panel-note indicator-publication-link">${link('VERIFIED RELEASE & PUBLICATION EVIDENCE ↗',contextualHref({page:'release',publicationSeries:current.id==='gdp'?'gdp':current.id.includes('ontinued')?'continuedClaimsAdvance':'claimsAdvance',publicationPeriod:observation?.date??'',publicationCutoff:current.agency==='dolAdvance'?observation?.publishedAt??'':''},state))}</p>`:'')
    +'<div class="indicator-chart">'
    +panel('01',`${current.code} / ${current.agency==='dolAdvance'?'Latest release context':'Historical series'}`,chartBody,'',
      chartBasis)+'</div>'
    +indicatorContext(current,state)
    +familyLedger(current,family)
    +(family==='other'?evidence:'')
    +`</div><section class="indicator-related" aria-label="Related indicators"><header><h2>Related indicators & macro pairings</h2>${related.module?link(related.module.label,related.module.href,'link-button'):''}</header><div class="indicator-related-grid">`
    +relatedIds.map(id=>{const s=getSeries(id);return `<a class="indicator-related-card" href="${esc(indicatorHref(id,state))}"><span>${esc(s.code)}</span><strong>${esc(formatDisplayValue(s,latest(s)?.value))}</strong><b>${esc(s.short)}</b><small>${esc(periodLabel(s,latest(s)?.date))} · ${esc(s.unit)}</small><small>${esc(measurementChange(s).text)}</small></a>`;}).join('')+'</div></section>'
    +(current.id==='yield'?supportingDetails('indicator:yield-timing','Rates guidance · ongoing Treasury publication timing',yieldTimingPanel()):'')
    +`<section class="indicator-method-grid" data-page-disclosure="indicator:source:${esc(current.id)}" aria-label="About this data"><div class="indicator-methodology"><h2>About this data · methodology & coverage</h2>${metadata}${detailMethodology(current)}</div><div>${familyExportDock(current,{disabled:Boolean(transformed.error||!available)})}${lineage}</div></section>`
    +(family!=='other'?supportingDetails(`indicator:full-history:${current.id}`,'Full selected history, methodology & retrieval revisions',evidence,{open:activeTab!=='data',className:'indicator-full-history'}):'')+'</div></div>';
}
