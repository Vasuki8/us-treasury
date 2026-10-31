import {cpiPublicationIds} from './cpi-publication-history.js';
import {supportingDetails} from './page-hierarchy.js';
import {getSeries,latest,formatValue,formatChange,periodLabel,transformSeries,observationCoverageLabel} from './model.js';
import {displayCurrencyUnit,displayUnitLabel,formatDisplayValue,formatDisplayChange} from './display-format.js';
import {escapeHtml as esc,button,heading,panel,chart,table,emptyState,sourceLink,seriesStatus,sentenceCase} from './ui.js';
import {viewRange,workspaceReturn,indicatorHref,contextualHref} from './workspace-context.js';
import {rangeControls,coverageSummary,measureLabel,changeLabel} from './research-controls.js';
import {relatedIndicators} from './related.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import {routeFor} from './router.js';
import {historyStatusMessage} from './vintages-page.js';
import {vintageMeasurementsComparable} from './vintages.js';
import {yieldTimingPanel} from './calendar-presentation.js';
import {releases} from './data.js';
import {humanDate,humanTimestamp,publicationDate,scheduledReleaseDate} from './ui-time.js';

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
    const notes=[...(original?.footnotes??[]),observationCoverageLabel(original),
      original?.suppressed?'SUPPRESSED · withheld by source':'',
      original?.revisionIndicator==='Y'?'SOURCE REVISION FLAG · reason unknown':''].filter(Boolean).join('; ')||'—';
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
  const observation=latest(current),previous=current.observations.at(-2);
  const published=publicationDate(current,observation,releases),scheduled=scheduledReleaseDate(current,observation,releases);
  const currencyUnit=displayCurrencyUnit([current]),options={currencyUnit};
  const change=measurementChange(current),changeText=change.text.replace(formatChange(current),formatDisplayChange(current,options));
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
  const payrollChange=current.id==='payroll'
    ?`${priorReadingLabel(current)}: ${formatDisplayValue(current,previous?.value,options)}`:changeText;
  const chartControls=`<div class="toolbar">${rangeControls(state,[current.id])}`
    +'<label for="transform-select">View <select id="transform-select">'
    +`<option value="level"${state.transform==='level'?' selected':''}>${esc(measureLabel(current))}</option>`
    +`<option value="change"${state.transform==='change'?' selected':''}>${esc(changeLabel(current))}</option>`
    +'</select></label></div>';
  const chartBody=chartControls+chart([current.id],{height:260,transform:state.transform,range:viewRange(state)})
    +coverageSummary(transformed)+(state.transform==='change'?'<p class="panel-note">'
      +'Changes use the immediately preceding retained observation before the selected window is applied; '
      +'the first displayed change can reference an observation outside the window. Missing observations remain gaps.</p>':'');
  return `<div class="radar-page radar-indicator">${back?`<nav class="return-context" aria-label="Return to workspace">${link(back.label,back.href)}</nav>`:''}`
    +heading(current.name,`${current.code} · ${current.source.name} · ${current.adjustment}`,actions)
    +`<div class="indicator-desk"><div class="workspace-basis"><section class="indicator-snapshot" aria-label="Latest retained reading">`
    +`<div class="indicator-reading"><p class="indicator-latest-label">`
    +`Latest retained reading — independent of the selected history window and transformation</p>`
    +`<div class="indicator-native-reading"><strong class="big-value">${esc(formatDisplayValue(current,observation?.value,options))}</strong>`
    +`<span>${currencyUnit?'Display unit':'Native unit'}<br><b>${esc(displayUnitLabel(current,options))}</b></span></div>`
    +`<p class="indicator-reference">Observation <b>${esc(observation?periodLabel(current,observation.date):'—')}</b></p>`
    +`<p class="indicator-change">${esc(payrollChange)}</p><p class="indicator-prior">Prior `
    +`<b>${esc(formatDisplayValue(current,previous?.value,options))}</b> · `
    +`${esc(previous?periodLabel(current,previous.date):'Unavailable')}</p></div>`
    +`<dl class="indicator-provenance"><dt>Source freshness</dt>`
    +`<dd>${current.dataStatus==='cached'?'Cached':current.dataStatus==='official'?'Captured':'Unavailable'}</dd>`
    +(published?`<dt>Published</dt><dd>${esc(humanDate(published))}</dd>`:'')
    +(!published&&scheduled?`<dt>Scheduled release</dt><dd>${esc(humanDate(scheduled))} · publication not confirmed</dd>`:'')
    +`<dt>Retrieved</dt><dd>${esc(humanTimestamp(current.fetchedAt)||'No successful retrieval')}</dd></dl></section>`
    +`<p class="panel-note indicator-definition">${esc(current.definition)}</p>`
    +(current.coverageNote&&criticalCoverage?`<p class="panel-note amber">${esc(current.coverageNote)}</p>`:'')
    +(current.error?`<p class="panel-note amber" role="status">${esc(current.error)}</p>`:'')
    +claimsContextLinks(current,state)
    +(cpiPublicationIds.includes(current.id)?`<p class="panel-note indicator-publication-link">${link('VERIFIED RELEASE & PUBLICATION EVIDENCE ↗',contextualHref({page:'release',publicationSeries:current.id,publicationPeriod:observation?.date??''},state))}<br>Published CPI rates use the dated release, with monthly seasonally adjusted and twelve-month unadjusted bases. This chart retains its current index-derived history.</p>`:'')
    +(['gdp','claimsAdvance','continuedClaimsAdvance','claims','continuedClaims'].includes(current.id)?`<p class="panel-note indicator-publication-link">${link('VERIFIED RELEASE & PUBLICATION EVIDENCE ↗',contextualHref({page:'release',publicationSeries:current.id==='gdp'?'gdp':current.id.includes('ontinued')?'continuedClaimsAdvance':'claimsAdvance',publicationPeriod:observation?.date??'',publicationCutoff:current.agency==='dolAdvance'?observation?.publishedAt??'':''},state))}</p>`:'')
    +'</div><div class="workspace-analysis"><div class="indicator-chart">'
    +panel('01',`${current.code} / ${current.agency==='dolAdvance'?'Latest release context':'Historical series'}`,chartBody,'',
      `${current.frequency} · ${transformed.unit} · ${seriesStatus(current)}`)+'</div>'
    +`<section class="panel indicator-evidence"><div class="tabs" role="tablist" aria-label="Indicator detail sections">${tabs.map(([id,label])=>button(label,`role="tab" id="detail-tab-${id}" aria-controls="detail-content" aria-selected="${activeTab===id}" tabindex="${activeTab===id?0:-1}" data-tab="${id}"`,'')).join('')}</div><div class="tab-panel" id="detail-content" role="tabpanel" tabindex="0" aria-labelledby="detail-tab-${activeTab}">${content}</div></section>`
    +`</div></div><nav class="context-strip related-series" aria-label="Related indicators"><span class="muted">Related</span>`
    +related.seriesIds.map(id=>link(getSeries(id).short,indicatorHref(id,state))).join('')
    +(related.module?link(related.module.label,related.module.href):'')+'</nav>'
    +(current.id==='yield'?supportingDetails('indicator:yield-timing','Rates guidance · ongoing Treasury publication timing',yieldTimingPanel()):'')
    +supportingDetails(`indicator:source:${current.id}`,'About this data',
      panel('02','Series information',metadata+detailMethodology(current),button('Copy link','data-copy-link','link-button')))
    +`</div>`;
}
