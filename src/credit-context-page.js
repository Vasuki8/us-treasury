import {dataStatus} from './data.js';
import {creditContextRegistry,creditContextGroups,BOARD_TERMS_URL,CREDIT_CONTEXT_LIMITATION} from './credit-context-registry.js';
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE} from './market-functioning.js';
import {tabularCsv} from './model.js';
import {heading,button,panel,chart,table,emptyState,escapeHtml as esc} from './ui.js';
import {resolveDateWindow,windowObservations} from './date-window.js';

/** The compact page, its CSV and its frozen inputs share exact source dates. */
export function creditWindowSources(sources){
 const result={};
 for(const group of creditContextGroups){
  const source=sources?.[group.id];if(!source)continue;
  const window=resolveDateWindow({preset:'3y'},group.ids.map(id=>source.series?.[id]));
  result[group.id]={...source,series:Object.fromEntries(Object.entries(source.series??{}).map(([id,item])=>[id,{...item,observations:windowObservations(item.observations??[],window),coverageNote:`${item.coverageNote??source.coverageNote??''} Compact page/export window: 3Y ${window.startDate??'unavailable'} through ${window.endDate??'unavailable'}; full retained history remains in indicator detail.`}]))};
 }
 return result;
}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const status=source=>source?.fetchedAt?(source.status==='ok'?'CAPTURED':'CACHED'):'UNAVAILABLE';
const format=(id,value)=>!finite(value)?'Unavailable':creditContextRegistry[id].format==='billions'?`$${value.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})}B`:`${value.toFixed(creditContextRegistry[id].precision)}%`;
function notice(source){const text=source?.series?.onRrpAccepted?.sourceNotice??'';return text||`${NY_FED_DATA_NOTICE} ${NY_FED_PRODUCT_NOTICE}`;}
function metrics(source,ids){return `<section class="metrics" aria-label="Banking and policy observations">${ids.map(id=>{const definition=creditContextRegistry[id],row=source?.series?.[id]?.observations?.at(-1);return `<a class="metric" href="#/series/${id}"><span class="metric-name">${esc(definition.name)}</span><strong class="metric-value">${esc(format(id,row?.value))}</strong><span class="metric-period">${esc(row?.date??'No reference date')} · ${esc(definition.frequency)}</span><span class="metric-change">${esc(definition.unit)}</span></a>`;}).join('')}</section>`;}
function groupPanel(group,index,sources){
  const source=sources?.[group.id],hasData=group.ids.some(id=>source?.series?.[id]?.observations?.length);
  const credit=group.id==='onRrp'?`<p>${esc(notice(source))}</p><p><a href="https://www.newyorkfed.org/markets/desk-operations/reverse-repo" target="_blank" rel="noopener noreferrer">Reverse Repo Operations ↗</a> · <a href="${NY_FED_TERMS_URL}" target="_blank" rel="noopener noreferrer">Terms of Use ↗</a></p>`:`<p>Source: Board of Governors of the Federal Reserve System. <a href="${esc(creditContextRegistry[group.ids[0]].source.url)}" target="_blank" rel="noopener noreferrer">${esc(source?.series?.[group.ids[0]]?.sourceTitle??group.label)} ↗</a> · <a href="${BOARD_TERMS_URL}" target="_blank" rel="noopener noreferrer">Board source terms ↗</a></p>`;
  return panel(String(index+1).padStart(2,'0'),group.label,`<p class="coverage-warning">${esc(status(source))} · Retrieved ${esc(source?.fetchedAt??'not recorded')}.${source?.error?` <strong class="amber">${esc(source.error)}</strong>`:''}</p>${hasData?metrics(source,group.ids):emptyState('No verified capture is available.','Missing observations remain unavailable.')}<p class="panel-note">${esc(group.note)}</p>${hasData?chart(group.ids,{height:190,range:{preset:'3y'}}):''}<details><summary>Definitions, source and collection evidence</summary>${group.ids.map(id=>`<p><strong>${esc(creditContextRegistry[id].name)}.</strong> ${esc(creditContextRegistry[id].definition)}</p>`).join('')}<p>${esc(source?.coverageNote??'Reference dates, publication dates and retrieval times are separate.')}</p>${credit}</details>`);
}

export function fomcContext(source){
  const documents=[...(source?.documents??[])].sort((a,b)=>b.documentDate.localeCompare(a.documentDate)||a.kind.localeCompare(b.kind));
  const rows=documents.map(row=>`<tr><th scope="row">${esc(row.kind==='decision'?'Policy decision':row.kind==='minutes'?'Meeting minutes':'Summary of Economic Projections')}</th><td class="mono">${esc(row.documentDate)}</td><td class="mono">${esc(row.meetingDate)}</td><td><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Official document ↗</a></td></tr>`).join('');
  return panel(String(creditContextGroups.length+1).padStart(2,'0'),'FOMC decisions, minutes & projections',`<p>${esc(status(source))} · Calendar retrieved ${esc(source?.fetchedAt??'not recorded')}.${source?.error?` <strong class="amber">${esc(source.error)}</strong>`:''}</p>${rows?table(['Official material','Listed document date','Meeting decision date','Source'],rows):emptyState('No official FOMC document references captured.')}<p>Dates have day precision. Minutes use the explicit release date listed by the Board, which differs from the meeting date. These are official calendar links; the linked contents have not been ingested as verified publication results or numeric projections. Participant projections are conditional assessments, not market pricing or a promise of future policy.</p><p>Source: Board of Governors of the Federal Reserve System. <a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" target="_blank" rel="noopener noreferrer">FOMC calendar and official materials ↗</a></p>`,source?.documents?.length?button('Download policy references','data-export-fomc'): '');
}
export function creditContextPage(sources=dataStatus.sources,calendarSource=dataStatus.calendar?.sources?.fomc){
  return heading('Credit & policy transmission','How do bank balances, lending conditions and Federal Reserve funding context differ?',button('Download data','data-export-credit'))
    +`<p class="section-copy">${esc(CREDIT_CONTEXT_LIMITATION)}</p>`
    +`<p class="section-copy">Charts and data downloads show the latest three years per source group, using exact dates. Open a measurement for its full retained history.</p>`+creditContextGroups.map((group,index)=>groupPanel(group,index,sources)).join('')
    +fomcContext(calendarSource);
}

export function creditContextCsv(sources){
  sources=creditWindowSources(sources);
  const headers=['series_id','name','date','source_period_label','date_convention','value','unit','frequency','adjustment','period_type','definition','missing','source_value','publication_date','retrieved_at','capture_status','operation_id','settlement_date','maturity_date','term_calendar_days','operation_release_time','operation_close_time','source_note','source_updated_at','source_series','source_url','source_title','attribution','source_notice','license_url','calculation','coverage_note','capture_provenance_json'];
  const rows=Object.entries(creditContextRegistry).flatMap(([id,definition])=>{const source=sources?.[definition.agency],series=source?.series?.[id];return (series?.observations??[]).map(row=>[id,definition.name,row.date,row.sourcePeriodLabel??(definition.agency==='lendingSurvey'?row.date:null),series.dateConvention??(definition.agency==='lendingSurvey'?'source-quarter-end-label':definition.dateConvention),finite(row.value)?row.value:null,definition.unit,definition.frequency,definition.adjustment,definition.periodType,series.definition??definition.definition,!finite(row.value),row.sourceValue??null,row.publishedAt??null,source.fetchedAt,status(source),row.operationId??null,row.settlementDate??null,row.maturityDate??null,row.termCalendarDays??null,row.operationReleaseTime??null,row.operationCloseTime??null,row.sourceNote??null,row.sourceUpdatedAt??null,(series.sourceIds??[]).join('; '),series.sourceUrl??definition.source.url,series.sourceTitle??null,series.attribution??(definition.agency==='onRrp'?'Source: Federal Reserve Bank of New York, Reverse Repo Operations.':'Source: Board of Governors of the Federal Reserve System.'),definition.agency==='onRrp'?notice(source):'',series.licenseUrl??(definition.agency==='onRrp'?NY_FED_TERMS_URL:BOARD_TERMS_URL),series.calculation??'',series.coverageNote??source.coverageNote??'',JSON.stringify(source.provenance??[])]);});
  return tabularCsv(headers,rows);
}
export function fomcDocumentsCsv(source){
  return tabularCsv(['kind','meeting_date','listed_document_date','date_precision','document_url','source_calendar_url','retrieved_at','capture_status','publication_evidence','attribution','license_url','capture_provenance_json'],(source?.documents??[]).map(row=>[row.kind,row.meetingDate,row.documentDate,row.datePrecision,row.url,row.sourceUrl,source?.fetchedAt??null,status(source),row.publicationEvidence,'Source: Board of Governors of the Federal Reserve System.',BOARD_TERMS_URL,JSON.stringify(source?.provenance??[])]));
}
