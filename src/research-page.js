import {humanDate,humanTimestamp} from './ui-time.js';
import { readingGroup, supportingDetails } from './page-hierarchy.js';
import {frozenObservationPages} from './frozen-table.js';
import {renderLaborEvidence,renderPcePriceContributions} from './economic-evidence.js';
import {pceBaseEffectsView} from './pce-base-effects.js';
import {heading,panel,button,table,emptyState,chart,escapeHtml as esc} from './ui.js';
import {formatValue,periodLabel,isRoundedSourceObservation} from './model.js';
import {packagePanels,researchPackageAttachments} from './research-packages.js';
import {selectPublicationHistory,publicationContext} from './publication-history.js';
import {publicationExplanation} from './publication-explanation-view.js';
import {publicationExplanationPanel} from './publication-explanation-panel.js';
import {claimsPublicationView} from './claims-publication-view.js';
import {cpiPublicationIds} from './cpi-publication-history.js';
import {cpiPublicationView} from './cpi-publication-view.js';
import {gdpRevisionMatrixPanel} from './gdp-revision-matrix-view.js';
import {fundingDistributionPanels} from './funding-distribution-view.js';
import {buildCoverageInventory} from './coverage-inventory.js';
import {coverageInventoryPanel} from './coverage-inventory-view.js';
import {currentAccountPanel} from './current-account-view.js';
import {currentAccountGdpPanel} from './current-account-gdp-view.js';
import {currentAccountGdpHistoryPanel} from './current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownPanel} from './current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingPanel} from './current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonPanel} from './current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsPanel} from './current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffectsPanel} from './current-account-gdp-balance-effects-view.js';
import {currentAccountGdpComponentEffectsPanel} from './current-account-gdp-component-effects-view.js';
import {currentAccountGdpAllComponentEffectsPanel} from './current-account-gdp-all-component-effects-view.js';
import {workspaceSummary} from './research-workspaces.js';
import {evaluateResearchQuestion} from './research-questions.js';
import {questionEditorFields} from './question-editor.js';
import {contextualHref,workspaceReturn} from './workspace-context.js';
import {series,releases} from './data.js';
import {stitchDeskContracts} from './stitch-desk-contracts.js';
import {stitchFrozenSources,stitchEvidenceCatalog} from './stitch-evidence.js';
import {specialistDeskPage} from './specialist-desks-page.js';

const views={workspaces:'SAVED VIEWS',packages:'Saved snapshots',changes:'CAPTURE CHANGES',publications:'PUBLICATION HISTORY'};
const val=value=>value===null||value===undefined?'—':String(value);
const kinds={'first-capture':'First captured coverage','historical-backfill':'Historical backfill','new-period':'Newly captured period','value-change':'Observed value change','metadata-change':'Metadata changed','observation-metadata-change':'Observation notes / metadata changed','coverage-removal':'Removed coverage'};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function moduleEvidence(value){
 if(!record(value))return value;
 return Object.fromEntries(Object.entries(value).map(([key,source])=>[key,record(source)?{fetchedAt:source.fetchedAt,coverageNote:source.coverageNote,provenance:source.provenance,retainedInJson:true}:source]));
}
function sourceAnchor(url,label='Official source ↗'){
 try{const parsed=new URL(url);if(parsed.protocol==='https:'&&/^(?:[a-z0-9-]+\.)*(?:bea\.gov|bls\.gov|treasury\.gov|treasurydirect\.gov|federalreserve\.gov|newyorkfed\.org|census\.gov|doleta\.gov|dol\.gov)$/.test(parsed.hostname)&&!parsed.username&&!parsed.password)return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;}catch{/* Unverified links remain inert text. */}
 return `<span>${esc(url??'Source URL unavailable')}</span>`;
}

function questionEditor(row,library,drafts){
 const q=row.researchQuestion??{},entry=drafts?.[row.id];
 let summary='',review='';
 if(row.researchQuestion){
  const baselinePackage=(library.packages??[]).find(pkg=>pkg.id===q.baselinePackageId),result=evaluateResearchQuestion(q,{catalog:series,baselinePackage,events:releases});
  const counts=result.evidence.reduce((all,item)=>(all[item.kind]=(all[item.kind]??0)+1,all),{});
  const changes=result.evidence.slice(-10).reverse().map(item=>`<li>${esc(item.seriesId)} · ${esc(item.period)} · ${esc(item.label)} · ${esc(item.previousValue??'not retained')} → ${esc(item.value??'unavailable')} ${esc(item.unit)}</li>`).join('');
  const conditions=result.conditions.map(item=>`<p class="small">${esc(item.seriesId)} ${esc(item.operator)} ${esc(item.threshold)} ${esc(item.unit)}: <strong>${esc(item.status==='not-met'?'Not met':item.status==='met'?'Met':'Unavailable')}</strong> · latest ${esc(item.value??'unavailable')} at ${esc(item.observationDate??'unknown')} · baseline ${esc(item.previousValue??'unavailable')} at ${esc(item.previousObservationDate??'unknown')}. ${item.crossed===null?'Threshold crossing unavailable.':item.crossed?`Threshold crossed: ${item.crossing==='entered'?'entered':'left'} the condition since the frozen baseline.`:'No threshold crossing since the frozen baseline.'}</p>`).join('');
  summary=`<p><strong>${esc(q.hypothesis)}</strong>${result.review.due?' <span class="pill">Review due</span>':''}</p><p class="panel-note">${result.baselineAvailable?`Frozen baseline: ${esc(q.baselinePackageId)}. New reference periods: ${counts['new-reference-period']??0}; observed same-period changes: ${counts['same-period-change']??0}; historical backfills: ${counts['historical-backfill']??0}.`:'Frozen baseline unavailable. Save the question to capture a baseline; no historical values are substituted.'} ${q.reviewDate?'Review date: '+esc(q.reviewDate)+'. ':''}${q.reviewEvent?'Review event: '+esc(q.reviewEvent)+(result.review.eventDate?' · '+esc(result.review.eventDate):' · event date not retained')+'.':''}</p>`;
  review=conditions+(changes?`<ul>${changes}</ul><p class="small muted">Latest ${Math.min(10,result.evidence.length)} of ${result.evidence.length} retained-input differences. Same-period changes do not establish an official revision, publication time or cause.</p>`:'');
 }
 const editor=entry?.editing?supportingDetails(`research:workspace:${row.id}:question`,'Edit research question',`<div class="actions">${button('CLOSE EDITOR',`data-close-question="${esc(row.id)}"${entry.status==='pending'?' disabled':''}`,'link-button')}</div>`+questionEditorFields(row,entry),{open:true}):`<div class="actions">${button(row.researchQuestion?'EDIT QUESTION':'ADD RESEARCH QUESTION',`id="question-edit-${esc(row.id)}" data-edit-question="${esc(row.id)}"`,'link-button')}</div>`;
 return summary+(review?supportingDetails(`research:workspace:${row.id}:review`,'Review conditions & captured changes',review):'')+editor;
}
function workspaceList(library,drafts){
 const rows=(library.workspaces??[]).map(row=>{
  const status=library.durability?.workspaces?.[row.id];
  const management=supportingDetails(`research:workspace:${row.id}:manage`,'Edit saved view',`<label for="workspace-label-${esc(row.id)}">Saved view name<input id="workspace-label-${esc(row.id)}" value="${esc(row.name)}" maxlength="80" class="workspace-label"></label><div class="actions">${button('RENAME',`data-rename-workspace="${esc(row.id)}"`)}${button('REMOVE SAVED VIEW',`data-remove-workspace="${esc(row.id)}" aria-label="Remove saved view ${esc(row.name)}"`,'link-button')}</div>`);
  return `<article class="research-workspace-card"><div class="research-workspace-heading"><h3>${esc(row.name)}</h3><div class="actions">${button
  ('OPEN SAVED VIEW',`data-open-workspace="${esc(row.id)}"`)}</div></div><p>${esc(workspaceSummary(row))}</p><p class="small muted">Saved ${esc
  (humanDate(row.createdAt))} ${status?`<span class="pill">${esc({durable:'Saved',session:'Session-only',failed:'Save failed'}[status.status]
  ??'Save status unavailable')}</span>`:''}</p>${questionEditor(row,library,drafts)}${management}</article>`;
 }).join('');
 const portable=supportingDetails('research:settings','Portable settings',
  (`<p class="panel-note">Export or import named watchlists, saved view configurations and `+
  `display preferences. Existing lists and views are preserved; different records sharing an `+
  `ID are imported as separate copies. Saved snapshot packages are transferred `+
  `separately.</p><div class="actions">${button('EXPORT SETTINGS',
  'data-export-settings')}</div><label for="research-settings-import">Import settings (JSON)<input `+
  `id="research-settings-import" type="file" accept=".json,application/json"></label>`));
 return panel('01','SAVED VIEWS',(`<p class="panel-note">Saved Views reopen the latest snapshot with your selection, dates `+
  `and assumptions. Use Save View to retain a reusable configuration or Save snapshot to `+
  `preserve observations and evidence. A research question can also retain evidence roles, `+
  `review timing and a frozen comparison baseline.</p>`)
  +(rows?`<div class="research-workspace-list">${rows}</div>`:emptyState('No saved views yet.',
  ('Open an indicator, comparison or research module and choose Save → Save View. Use Follow '+
  'on an indicator to add it to your watchlist.'))))+portable;
}

function frozenExplanations(context){
 if(!Array.isArray(context.publicationExplanations))return '';
 const text=value=>typeof value==='string'?value:'Unavailable';
 const entries=context.publicationExplanations.filter(item=>record(item)&&['period','estimate','publicationDate','summary','sourceUrl'].every(key=>typeof item[key]==='string'));
 const body=entries.map(item=>`<article class="publication-explanation"><h3>${esc(item.period)} · ${esc(item.estimate)} · ${esc(humanDate
  (item.publicationDate))}</h3><p>${esc(item.summary)}</p>${Array.isArray(item.details)?`<ul>${item.details.filter(text=>
  typeof text==='string').map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}<p class="panel-note">${sourceAnchor(item.sourceUrl,
  'Retained explanation source ↗')} ${esc(text(item.attribution))} ${esc(text(item.sourceSection))} ${Array.isArray(item.provenance)?
  `Retrieved: ${esc(humanTimestamp(text(item.provenance.at(-1)?.retrievedAt)))}.`:''}</p>${record(item.annualUpdate)
  &&typeof item.annualUpdate.summary==='string'?`<p class="panel-note">Separate annual-update scope: ${esc(item.annualUpdate.summary)}</p>`:''
  }</article>`).join('');
 return panel('04','FROZEN BEA EXPLANATIONS',`<p class="panel-note">These are retained paraphrases and source claims from this package, independent of the current archive. Imported claims are not authenticated. Publication and retrieval dates remain separate. Capture status: ${esc(text(context.publicationExplanationStatus))}. Full evidence and original CSV are retained with the package.</p>`+(body||emptyState('No reviewed explanation was retained in this package.','No current explanation is substituted.')));
}

function frozenOverview(context){
 if(!Array.isArray(context.overviewTopicReadings))return '';
 const entries=context.overviewTopicReadings.filter(item=>record(item)&&typeof item.name==='string'&&record(item.latest));
 const rows=entries.map(item=>`<tr><th scope="row">${esc(item.name)}</th><td class="num">${Number.isFinite(item.latest.value)?esc
  (item.latest.value.toLocaleString('en-US',{maximumFractionDigits:3})):'Unavailable'}</td><td>${esc(item.unit)}</td><td>${esc(item.latest.date)
  }</td><td>${esc(humanTimestamp(item.fetchedAt))}</td></tr>`).join('');
 const brief=Array.isArray(context.overviewBrief)?context.overviewBrief.filter(record).map(item=>`<li>${esc(item.kind)} · ${esc(item.name)} · reference ${esc(item.period??'Unknown')} · publication ${esc(item.publicationDate??'Unknown')}</li>`).join(''):'';
 const catalysts=Array.isArray(context.nextCatalysts)?context.nextCatalysts.filter(record).map(item=>`<li>${esc(item.name)} · ${esc(item.date)}${
  item.time?` · ${esc(item.time)}`:''}${item.periodLabel?` · ${esc(item.periodLabel)}`:''}</li>`).join(''):'';
 return panel('O','FROZEN OVERVIEW CONTEXT',table(['RETAINED READING',{label:'VALUE',numeric:true},'UNIT','REFERENCE PERIOD','RETRIEVED'],rows,'Frozen Overview readings; current observations are never substituted')+`<details><summary>Retained brief and scheduled catalysts</summary><ul>${brief}${catalysts}</ul><p>Schedule context is frozen as it appeared then; it does not verify publication. Complete source receipts, chart inputs and formulas remain in the package JSON.</p></details>`);
}

function frozenDeliveryViews(pkg){
 let html='';
 for(const [id,value]of Object.entries(pkg.context.economicEvidence??{})){
  const range=value.window.mode==='observations'?value.window.count:{preset:'custom',startDate:value.window.startDate,endDate:value.window.endDate};
  html+=id==='laborEvidence'?renderLaborEvidence(value.source,{range,frozen:true}):renderPcePriceContributions(value.source,{range,frozen:true});
 }
 if(pkg.context.pceBaseEffects){const value=pkg.context.pceBaseEffects;html+=pceBaseEffectsView(value.indexSeries,value.model.assumptions,{frozen:true});}
 for(const [key,label,render] of [
  ['coverageInventory','coverage inventory',value=>coverageInventoryPanel(buildCoverageInventory(value.catalog,{...value.filters,registeredCount:value.registeredCount,publicationContexts:value.publicationContexts}),{frozen:true})],
  ['gdpRevisionMatrix','GDP revision matrix',value=>gdpRevisionMatrixPanel(value.archive,{cutoff:value.cutoff,frozen:true})],
  ['fundingDistributions','funding distributions',value=>fundingDistributionPanels(pkg.context.moduleSources?.marketFunctioning??{},value.range,{frozen:true})],
 ]){
  const value=pkg.context[key];if(!value)continue;
  try{if(value.version!==1&&!(key==='fundingDistributions'&&value.version===2))throw new Error('Unsupported retained method version.');html+=render(value);}
  catch(error){html+=emptyState(`Frozen ${label} unavailable.`,error.message);}
 }
 return html;
}

function frozenViewer(pkg){
 const panels=pkg.context.coverageInventory||pkg.context.gdpRevisionMatrix?[]:packagePanels(pkg).filter(item=>!pkg.context.fundingDistributions||item.series.id!=='sofr'),range=pkg.request.range;
 const histories=panels.map(item=>{
  const s=item.series,rows=frozenObservationPages(item.observations).map((page,index)=>`<details class="frozen-table-page"${index===0?' open':''}><summary>Rows ${page.start}–${page.end} of ${page.total} · ${esc(page.rows[0].date)} to ${esc(page.rows.at(-1).date)} · latest first</summary>${table(['REFERENCE DATE',{label:'FROZEN VALUE',numeric:true}],page.rows.map(row=>`<tr><th scope="row">${esc(row.date)}</th><td class="num">${esc(row.value===null?'—':pkg.request.transform==='change'||pkg.request.comparison!=='native'?`${row.value} ${item.unit}`:formatValue(s,row.value))}${row.footnotes?.length?`<span class="table-code muted">${esc(row.footnotes.join('; '))}</span>`:''}</td></tr>`).join(''),'Frozen observations, newest first; every retained displayed row is accessible')}</details>`).join('');
  return panel('',s.name,chart(pkg.request.ids,{range,transform:pkg.request.transform,comparison:pkg.request.comparison,panelId:s.id,cursorGroup:'frozen-package',height:180})+`<p class="panel-note">Frozen ${esc(s.frequency)} · ${esc(item.unit)} · ${esc(s.adjustment)}. ${esc(item.formula??s.calculation??'')} ${item.baselineDate?`Baseline: ${esc(item.baselineDate)} / ${esc(item.baselineValue)}.`:''}</p>${supportingDetails(`research:package:${pkg.id}:series:${s.id}`, 'Frozen definition & source', `<p>${esc(s.definition)}</p><p class="panel-note">Retrieval: ${esc(s.fetchedAt??'Unavailable')}. ${sourceAnchor(s.sourceUrl??s.source?.url)} · Source IDs: ${esc(s.source?.seriesIds?.join('; ')??'Unavailable')}.</p>`)}${supportingDetails(`research:package:${pkg.id}:observations:${s.id}`, `Frozen table · ${item.observations.length} displayed observations · latest first`, rows, {className:'frozen-observations'})}`,'',s.sourceNotice??'');
 }).join('');
 const frozenSources=stitchFrozenSources(pkg.context),frozenState=pkg.context.stitchRenderState;
 const frozenDesk=pkg.context.stitchEvidence&&stitchDeskContracts[frozenState?.page]?specialistDeskPage(frozenState,{sources:frozenSources,catalog:stitchEvidenceCatalog(frozenSources),calendar:pkg.context.stitchCalendar?{sources:{fomc:pkg.context.stitchCalendar.source}}:{},now:new Date(pkg.context.stitchCalendar?.asOf??pkg.createdAt)}).replace(/<button\b/g,'<button disabled').replace(/<(input|select)\b/g,'<$1 disabled'):'';
 const deskReplay=frozenDesk?supportingDetails(`research:package:${pkg.id}:stitch-desk`,'Frozen desk · retained charts and tables',`<p class="panel-note">Read-only saved composition. Controls are disabled; generated CSVs below use these frozen inputs and assumptions. Indicator links open current data.</p>${frozenDesk}`,{open:true}):'';
 const attachments=researchPackageAttachments(pkg);
 const attachmentActions=attachments.map((file,index)=>button(file.name,`data-package-attachment="${index}"`,'link-button')).join('');
 const evidence={snapshot:pkg.snapshot,assumptions:pkg.assumptions,sources:pkg.sources,context:{...pkg.context,moduleSources:moduleEvidence(pkg.context.moduleSources),attachments:attachments.map(({name,type,generated})=>({name,type,retainedInJson:!generated,...(generated?{csvMode:'generated-full-retained-v1'}:{})}))}};
 const text=JSON.stringify(evidence,null,2),excerpt=text.slice(0,14000);
 const contextual=frozenOverview(pkg.context)+(pkg.context.currentAccountInputs?currentAccountPanel(pkg.context.currentAccountInputs,{frozen:true}):'')+(pkg.context.currentAccountGdpDenominator?currentAccountGdpPanel({beaIta:pkg.context.currentAccountInputs,bea:pkg.context.currentAccountGdpDenominator},{frozen:true}):'')+(pkg.context.currentAccountGdpHistory?currentAccountGdpHistoryPanel(pkg.context.currentAccountGdpHistory.sources,pkg.context.currentAccountGdpHistory.range,{frozen:true}):'')+(pkg.context.currentAccountGdpBreakdown?currentAccountGdpBreakdownPanel(pkg.context.currentAccountGdpBreakdown.sources,pkg.context.currentAccountGdpBreakdown.range,{frozen:true}):'')+(pkg.context.currentAccountGdpTrailing?currentAccountGdpTrailingPanel(pkg.context[pkg.context.currentAccountGdpTrailing.inputContext].sources,pkg.context.currentAccountGdpTrailing.range,{frozen:true}):'')+(pkg.context.currentAccountGdpComparison?currentAccountGdpComparisonPanel(pkg.context[pkg.context.currentAccountGdpComparison.inputContext].sources,pkg.context.currentAccountGdpComparison.range,{measure:pkg.context.currentAccountGdpComparison.measure,frozen:true}):'')+(pkg.context.currentAccountGdpContributions?currentAccountGdpContributionsPanel(pkg.context[pkg.context.currentAccountGdpContributions.inputContext].sources,pkg.context.currentAccountGdpContributions.range,{frozen:true,packageId:pkg.id}):'')+(pkg.context.currentAccountGdpBalanceEffects?currentAccountGdpBalanceEffectsPanel(pkg.context[pkg.context.currentAccountGdpBalanceEffects.inputContext].sources,pkg.context.currentAccountGdpBalanceEffects.range,{frozen:true,packageId:pkg.id}):'')+(pkg.context.currentAccountGdpComponentEffects?currentAccountGdpComponentEffectsPanel(pkg.context[pkg.context.currentAccountGdpComponentEffects.inputContext].sources,pkg.context.currentAccountGdpComponentEffects.range,{frozen:true,measure:pkg.context.currentAccountGdpComponentEffects.measure,packageId:pkg.id}):'')+(pkg.context.currentAccountGdpAllComponentEffects?currentAccountGdpAllComponentEffectsPanel(pkg.context[pkg.context.currentAccountGdpAllComponentEffects.inputContext].sources,pkg.context.currentAccountGdpAllComponentEffects.range,{frozen:true,packageId:pkg.id}):'');
 return panel('02',`READ-ONLY / ${pkg.name}`,readingGroup('Saved snapshot basis',
  (`<div class="context-strip"><span>Saved <b>${esc(humanTimestamp(pkg.createdAt))}</b></span><span>WINDOW <b>${esc(pkg.resolvedWindow.label)
  }</b></span><span>VALUES <b>${esc(pkg.request.comparison==='native'?pkg.request.transform:pkg.request.comparison)
  }</b></span></div><p class="panel-note">Frozen inputs, observations, methods and exports `+
  `are independent of the current snapshot. A checksum detects changed content; it does not `+
  `authenticate an agency or an imported file. Imported source claims remain unverified; this `+
  `viewer never fetches package URLs.</p>`))+`${supportingDetails(`research:package:${pkg.id}:checksum`, 'Checksum integrity',
   `<p>Checksum SHA-256: <span class="mono break-all">${esc(pkg.checksum.value)}</span></p>`)}<div class="actions">${button('DOWNLOAD JSON',
  `data-package-json="${esc(pkg.id)}"`)}${button('CSV FROZEN VALUES',`data-package-csv="${esc(pkg.id)}"`)}</div>`)
  +frozenDeliveryViews(pkg)+deskReplay+histories+(contextual?supportingDetails(`research:package:${pkg.id}:context`, 'Frozen contextual analyses', contextual, {open:true}):'')+panel('03','FROZEN ASSUMPTIONS & SOURCE EVIDENCE',`<p class="panel-note">Full module inputs, definitions, original retrieval provenance, rights notices and assumptions are retained in the portable JSON. Publication dates are separate from retrieval dates; unknown publication instants remain unknown. ${pkg.context.auctionExports?.version===1?'Both auction specialist CSVs are generated from complete frozen inputs with the recorded security filter and selected auction. All response receipts remain in JSON; each opted-in CSV row carries its actual response-page receipt.':pkg.context.fundingDistributions?.version===2?'The specialist CSV is generated with the recorded full-retained method from complete frozen inputs, independently of the selected window.':'Specialist CSV files preserve their original export scope.'}</p><div class="actions">${attachmentActions}</div>${supportingDetails(`research:package:${pkg.id}:evidence`, 'Inspect evidence and assumptions', `<pre class="research-json">${esc(excerpt)}${text.length>excerpt.length?'\n… Complete evidence is retained in DOWNLOAD JSON.':''}</pre>`)}`)+frozenExplanations(pkg.context);
}

function packageList(state,library){
 const packages=library.packages??[],selected=packages.find(pkg=>pkg.id===state.packageId);
 const rows=packages.map(pkg=>`<tr><th scope="row">${esc(pkg.name)}<span class="table-code muted">${esc(humanTimestamp(pkg.createdAt))}</span>${
  library.durability?.packages?.[pkg.id]?`<span class="pill">${esc({durable:'Saved',session:'Session-only',failed:'Save failed'
  }[library.durability.packages[pkg.id].status])}</span>`:''}</th><td>${esc(pkg.request.ids.join(', '))}<span class="table-code muted">${esc
  (pkg.resolvedWindow.label)}</span></td><td><div class="actions">${button('Open saved snapshot',`data-open-package="${esc(pkg.id)}"`)}${button
  ('JSON',`data-package-json="${esc(pkg.id)}"`)}${button('REMOVE',`data-remove-package="${esc(pkg.id)}" aria-label="Remove saved snapshot ${esc
  (pkg.name)}"`,'link-button')}</div></td></tr>`).join('');
 const index=panel('01','Saved snapshot library',(`<p class="panel-note">Save snapshot creates a new immutable record; a later refresh cannot `+
  `overwrite it. Download JSON for durable independent storage and reconstruction in another `+
  `browser. A dashboard URL alone cannot carry this evidence.</p>`)+(rows?table(['Name / saved','MEASUREMENTS / WINDOW','ACTIONS'],rows,
  'Immutable frozen research results'):emptyState('No saved snapshots in this browser.',
  'Open Save on a research view and choose Save snapshot, or import a downloaded saved snapshot.')));
 return (selected?supportingDetails('research:package-library','Saved snapshot library',index,
  {meta:`${packages.length} saved snapshots · switch & manage`}):index)
  +(selected?frozenViewer(selected):state.packageId?emptyState('Saved snapshot unavailable in this browser.',
  'Import its JSON file to reconstruct the saved snapshot. Current observations are never substituted.'):'' );
}

function changeView(state,{changes={},checkpoint={},failures=[]}){
 const since=state.changeSince||checkpoint.since||'',rows=changes.rows??[],page=Math.max(1,Math.min(Math.ceil(rows.length/50)||1,state.changePage||1)),offset=(page-1)*50;
 const controls=(`<div class="toolbar research-controls"><label for="change-since">Since retrieval `+
  `(UTC)<input type="datetime-local" id="change-since" step="0.001" value="${esc(since.replace(/Z$/,
  ''))}"></label>${button('ALL RETAINED CAPTURES','data-review-all-changes')}${button('MARK CURRENT SNAPSHOT READ',
  'data-mark-changes')}${button(checkpoint.enabled?'DISABLE UPDATES ON RETURN':'ENABLE UPDATES ON RETURN',
  checkpoint.enabled?'data-disable-changes':'data-enable-changes')}</div><p class="panel-note">Scope: ${esc(changes.ids?.join(', ')
  ??'selected measurements')}. Uses your watchlist when populated, otherwise the current selection. Alerts work when `+
  `this browser returns or reloads; they send no background or external notifications. Checkpoint: ${esc(humanTimestamp(checkpoint.since)||'Not set')}.</p>`);
 let content;
 if(changes.status==='error')content=emptyState('Capture evidence unavailable.',changes.error??'Archive retrieval failed.',button('RETRY','data-retry-changes'));
 else if(changes.status!=='ready')content=emptyState('Loading selected source archives.','Verified capture evidence is required before showing changes.');
 else if(!rows.length)content=emptyState('No captured changes in this scope after the cutoff.','Repeated successful retrievals with unchanged values are confirmations, not new economic releases.');
 else content=table(['CAPTURE FACT / SERIES','REFERENCE DATE','PREVIOUS → CAPTURED','RETRIEVAL EVIDENCE'],rows.slice(offset,offset
  +50).map(row=>`<tr><th scope="row">${esc(kinds[row.kind]
  ??row.kind)}<span class="table-code">${esc(row.seriesId)} · ${esc(row.sourceId)}</span>${row.changedFields?.length?
  `<span class="table-code muted">Fields: ${esc(row.changedFields.join('; '))}</span>`:''}</th><td>${esc(row.period||'Metadata / coverage')
  }</td><td>${esc(val(row.previousValue))} → ${esc(val(row.value))}<span class="table-code muted">${esc(row.unit)}</span>${row.comparable?'':
  '<span class="table-code amber">Changed measurement; not directly comparable.</span>'}</td><td><a href="${esc(contextualHref({page:'vintages',
  vintageSeries:row.seriesId,vintageCutoff:row.capturedAt},state))}">${esc(humanTimestamp(row.capturedAt))
  }</a><span class="table-code muted">Publication: ${esc(humanDate(row.publicationDate))}</span></td></tr>`).join(''),
  'Changes between genuine source retrievals')+`<div class="toolbar">${button('PREVIOUS',`data-change-page="${page-1}"${page<=1?' disabled':''}`)
  }<span>${offset+1}–${Math.min(offset+50,rows.length)} of ${rows.length} capture facts</span>${button('NEXT',`data-change-page="${page+1}"${
  offset+50>=rows.length?' disabled':''}`)}${button('CSV ALL IN SCOPE','data-export-changes')}</div>`;
 const errors=failures.length?`<div class="empty-state amber" role="status"><strong>Collection failures / cached sources</strong>${failures.map
  (item=>`<p>${esc(item.id)}: ${esc(item.error)}. Last successful retrieval: ${esc(item.fetchedAt??'Unavailable')}. Attempt: ${esc(humanTimestamp
  (item.lastAttemptAt)||'Unavailable')}.</p>`).join('')}</div>`:'';
 return panel('01','DATA UPDATES ON RETURN',controls)+errors+panel('02','WHAT CHANGED SINCE THE CHECKPOINT',content,'','Capture evidence does not verify a release or its cause. Historical backfills, new periods, observed value changes, metadata updates and removals are distinct. Revision explanations and benchmark causes remain unknown without separate official evidence.');
}

function publicationView(state,archive={releases:[]},explanations,explanationState){
 let result;try{result=selectPublicationHistory(archive,state.publicationCutoff,state.publicationPeriod);}catch(error){return emptyState('Invalid publication selection.',error.message);}
 const quarter=date=>periodLabel({frequency:'Quarterly'},date),latest=result.latest;
 const options=[...result.periods].reverse().map(period=>`<option value="${esc(period)}"${result.period===period?' selected':''}>${esc(quarter(period))}</option>`).join('');
 const rows=result.releases.map((row,index)=>{
  const context=publicationContext(row),item=publicationExplanation(row,explanations),delta=context.confirmation?'Confirmation; no GDP revision':index?`${(row.value-result.releases[index-1].value).toFixed(1)} pp`:'First estimate in workbook';
  const updateType=item?.kind==='annual-update'?'annual update':item?.kind==='comprehensive-update'?'comprehensive update':null;
  const sourceContext=item?updateType?`${row.publicationDate.slice(0,4)} ${updateType}`:item.kind==='first-publication'?'First publication; release context below':'BEA revision explanation below':context.label;
  return `<tr><th scope="row">${esc(row.estimate)}</th><td>${esc(humanDate(row.publicationDate))}</td><td class="num">${esc(row.value.toFixed(1))
  }%</td><td class="num">${esc(delta)}</td><td>${esc(sourceContext)}${context.evidenceUrl?`<span class="table-code">${sourceAnchor
  (context.evidenceUrl,'Update scope ↗')}</span>`:''}</td><td>${sourceAnchor(row.releaseEvidenceUrl,row.releaseEvidenceUrl?.endsWith('.xlsx')?
  'Workbook evidence ↗':'Dated release ↗')}${supportingDetails(`research:publications:gdp:source:${row.id??`${row.period}:${row.publicationDate
  }:${row.estimate}`}`,'Source receipt',`<p class="panel-note">Retrieved: ${esc(row.provenance.at(-1)?.retrievedAt??'Unavailable')
  }. This is collection time, separate from the publication day.</p>`)}</td></tr>`;
 }).join('');
 const coverage=result.periods.length?`${quarter(result.periods[0])}–${quarter(result.periods.at(-1))}`:'Unavailable';
 return panel('01','OFFICIAL GDP PUBLICATION HISTORY',
  (latest?`<p class="publication-result publication-selected-result"><strong>Real GDP growth · ${esc(quarter(result.period))}: ${esc
  (latest.value.toFixed(1))}%</strong> · ${esc(latest.estimate)} · reported ${esc(humanDate(latest.publicationDate))} (day precision). ${esc
  (publicationContext(latest).confirmation?'GDP confirmation; no new GDP revision.':`Change from first estimate in this workbook: ${
  (latest.value-result.first.value).toFixed(1)} pp.`)}</p>`:emptyState('No selected publication existed by this date.',
  'Later estimates and current values are not substituted.'))+(`<p class="panel-note publication-selected-basis">Percent quarter over quarter · seasonally `+
  `adjusted annual rate. Reference quarter and publication day are distinct; current revised `+
  `NIPA data are separate.</p>`)+(`<div class="toolbar research-controls"><label for="publication-period">Reference `+
  `quarter<select id="publication-period" aria-label="Reference quarter"${options?'':' disabled'}>${options
  }</select></label><label for="publication-cutoff">Published by date<input type="date" `+
  `id="publication-cutoff" value="${esc(result.cutoff)}"></label>${button('CSV THIS QUARTER',
  `data-export-publications${result.releases.length?'':' disabled'}`)}${button('Save snapshot',
  `data-pin-publication${latest?'':' disabled'}`)}</div>`)+(rows?table(['SOURCE STAGE','PUBLICATION DATE',{label:'REAL GDP GROWTH',numeric:true},
  {label:'CHANGE IN REPORTED GROWTH',numeric:true},'SOURCE CONTEXT','OFFICIAL EVIDENCE'],rows,
  'Official GDP publications for one quarter at the selected date cutoff'):'')
  +(`<p class="panel-note">Changes are calculated percentage-point differences between rounded `+
  `rates for the same quarter. Final does not mean permanently unrevisable. `+
  `GDP-not-open/not-revised rows are confirmations, not new numeric revisions. Publication `+
  `dates have day precision; causes require separate agency evidence.</p>${supportingDetails('research:publications:gdp:methods',
   'GDP publication methods, coverage & evidence',
   (`<p class="panel-note">Archive: ${esc(result.retainedCount)} official records / ${esc(result.periods.length)} quarters (${esc(coverage)
  }). Publication-date coverage: ${esc(result.coverageStart??'Unavailable')}–${esc(result.coverageEnd??'Unavailable')
  }. Values are quarter-over-quarter real GDP growth at a seasonally adjusted annual rate. `+
  `The selected quarter has retained evidence through ${esc(result.quarterCoverageEnd
  ??'Unavailable')}; later publications are outside this archive.</p><p class="panel-note">Historical methods `+
  `and definitions may change. BEA's historical stages (including Preliminary, Final, Initial `+
  `and Updated) are retained as published. Missing routine stages are not invented. Reviewed `+
  `annual and comprehensive update explanations are identified separately. General update `+
  `scope does not establish quarter-specific causes; other revision types and causes are not `+
  `inferred. These agency-authored publication vintages are separate from Meridian's `+
  `Retrieval History and the latest revised NIPA series. Date-only release evidence cannot `+
  `prove an exact server-publication instant. Source cells, original strings, retrieval `+
  `hashes and BEA attribution accompany the scoped CSV and frozen-result JSON. `+
  `Supplemental-profile and calendar historical replay remain unavailable.</p>`))}`));
}

export function researchPage(state,{library={},questionDrafts={},changes={},checkpoint={},failures=[],publicationArchive={releases:[]},publicationState,publicationExplanations,explanationState}={}){
 const view=Object.hasOwn(views,state.researchView)?state.researchView:'workspaces';
 const origin=workspaceReturn(state),back=origin?`<nav class="workspace-return" aria-label="Research origin"><a class="action" href="${esc(origin.href)}">${esc(origin.label)}</a></nav>`:'';
 const warning=library.sessionOnly||library.warning?`<p class="panel-note amber" role="status">${esc(library.warning??'')} ${library.sessionOnly
  &&!library.warning?.includes('session-only')?'Research changes are session-only.':''} ${view==='workspaces'?
  'Export settings to recover Saved Views and watchlists before reloading.':view==='packages'?
  'Download JSON for each Saved snapshot before reloading.':'Export settings for saved configurations; use Download JSON for frozen evidence.'}</p>`:'';
 const importFile=(`<div class="research-import"><label for="research-import">Import saved snapshot `+
  `(JSON)<input id="research-import" type="file" accept=".json,application/json"></label><p `+
  `class="small muted">Files remain in this browser. Checksum integrity is separate from `+
  `source authenticity. Existing saved snapshots are never overwritten.</p></div>`);
 const publicationSelector=`<div class="toolbar research-controls"><label for="publication-series">Publication measurement<select id="publication-series">${[['gdp','Real GDP growth'],['claimsAdvance','Initial claims'],['continuedClaimsAdvance','Continued claims'],['cpiMonthly','Headline CPI · monthly SA'],['cpiCoreMonthly','Core CPI · monthly SA'],['cpi','Headline CPI · 12-month NSA'],['cpiCore','Core CPI · 12-month NSA']].map(([id,label])=>`<option value="${id}"${(state.publicationSeries??'gdp')===id?' selected':''}>${label}</option>`).join('')}</select></label>${(!state.publicationSeries||state.publicationSeries==='gdp')?`<div class="actions">${[['quarter','ONE QUARTER'],['matrix','REVISION MATRIX']].map(([id,label])=>button(label,`data-publication-mode="${id}" aria-pressed="${(state.publicationMode??'quarter')===id}"`,'action')).join('')}</div>`:''}</div>`;
 const publications=()=>publicationSelector+(publicationState&&publicationState.status!=='ready'?publicationState.status==='error'?emptyState('Official publication archive unavailable.',publicationState.error,button('RETRY','data-retry-publications')):emptyState('Loading official publication history.','The archive loads only when this view needs it.'):cpiPublicationIds.includes(state.publicationSeries)?cpiPublicationView(state,{archive:publicationArchive,publicationState}):state.publicationSeries&&state.publicationSeries!=='gdp'?claimsPublicationView(state,publicationArchive,sourceAnchor):state.publicationMode==='matrix'?gdpRevisionMatrixPanel(publicationArchive,{cutoff:state.publicationCutoff}):publicationView(state,publicationArchive,publicationExplanations,explanationState)+publicationExplanationPanel(publicationArchive,publicationExplanations,state.publicationCutoff,state.publicationPeriod,explanationState,sourceAnchor));
 return back+heading(views[view],'Research · saved configurations, frozen evidence and publication history')+`<div class="workspace-basis">`
  +warning+(state.researchError?`<div class="empty-state amber" role="alert">${esc(state.researchError)}</div>`:'')
  +`</div><div class="workspace-analysis">`+(view==='workspaces'?workspaceList(library,questionDrafts):view==='packages'?packageList(state,
  library):view==='changes'?changeView(state,{changes,checkpoint,failures}):publications())+`</div>`
  +(view==='packages'?supportingDetails('research:import','Advanced · import a saved snapshot',importFile):'');
}
