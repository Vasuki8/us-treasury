import {escapeHtml as esc,panel,table,button,emptyState} from './ui.js';
import {indicatorHref} from './workspace-context.js';
import {supportingDetails} from './page-hierarchy.js';

const historyLabels={'latest-release-context':'Latest release context','statement-history':'Monthly statement history','current-history':'Current retained history'};
const safeSource=url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:null;}catch{return null;}};
function publicationLabel(value){
 if(value.status==='unsupported')return 'Publication archive not covered for this measurement.';
 if(value.status==='ready')return `Separate publication archive loaded: ${value.factCount} retained facts; publication days ${value.firstDate??'unavailable'}–${value.lastDate??'unavailable'}.`;
 return value.status==='error'?`Publication archive unavailable: ${value.error??'source load failed'}.`:value.status==='loading'?'Separate publication archive loading.':'Separate publication archive supported, not loaded in this view.';
}

export function coverageInventoryPanel(inventory,{state={},frozen=false,showExport=true}={}){
 const rows=inventory.rows.map(row=>{
  const name=frozen?esc(row.name):`<a href="${esc(indicatorHref(row.id,state))}">${esc(row.name)}</a>`,url=safeSource(row.source.url);
  const publicationHref=row.publications.seriesId?`#/research?view=publications&publicationSeries=${encodeURIComponent(row.publications.seriesId)}`:null;
  const details=`<p>${esc(row.definition)}</p><p>Observation type: ${esc(row.observationType)}. Reference history: ${esc(historyLabels[row.historyType]??row.historyType)}. A current source edition is not a record of what was first published.</p><p>${esc(row.calculation)}</p><p>${esc(publicationLabel(row.publications))}${!frozen&&publicationHref?` <a href="${esc(publicationHref)}">Inspect publication evidence ↗</a>`:''}</p>${url?`<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a></p>`:''}${row.coverageNote?`<p>${esc(row.coverageNote)}</p>`:''}${row.sourceNotice?`<p>${esc(row.sourceNotice)}</p>`:''}`;
  return `<tr><th scope="row">${name}<span class="table-code muted">${esc(row.code)} · ${esc(row.topic)}</span>${row.error?`<span class="table-code amber">${esc(row.error)}</span>`:''}${supportingDetails(`coverage:${row.id}`,'Definition, history type & evidence',details)}</th><td><span class="mono">${esc(row.firstReference??'Unavailable')} → ${esc(row.lastReference??'Unavailable')}</span><span class="table-code">${row.usableCount} / ${row.totalCount} usable / retained</span></td><td class="mono">${esc(row.lastReference??'Unavailable')}</td><td>${esc(row.frequency)}<span class="table-code muted">${esc(row.unit)} · ${esc(row.adjustment)}</span><span class="table-code">${esc(row.observationType)}</span></td><td>${esc(row.source.name??'Source not supplied')}<span class="table-code ${row.captureStatus==='cached'?'amber':'muted'}">${esc(row.captureStatus.toUpperCase())}</span><span class="table-code mono">${esc(row.retrievedAt??'No successful retrieval')}</span></td></tr>`;
 }).join('');
 return panel('C',frozen?'FROZEN COVERAGE INVENTORY':'COVERAGE INVENTORY',`<p class="panel-note">${inventory.rows.length} matching measurements / ${inventory.totalRegistered} registered at this capture. Reference coverage and usable counts include missing and suppressed observations separately. Coverage dates and successful retrieval do not establish historical publication dates.</p>`+(rows?table(['MEASUREMENT / EVIDENCE','RETAINED REFERENCE COVERAGE','LATEST REFERENCE','FREQUENCY / UNIT / BASIS','SOURCE / COLLECTION'],rows,'Retained measurement coverage, including unavailable series'):emptyState('No measurements match these filters.','Clear the search, topic or frequency filters to show the full inventory.')),!frozen&&showExport?button('CSV COVERAGE','data-export-coverage','link-button'):'','Counts describe the retained reference history; official/calculated observation type and separate publication evidence remain distinct.','coverage-inventory');
}
