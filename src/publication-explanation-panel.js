import {panel,button,emptyState,escapeHtml as esc} from './ui.js';
import {periodLabel} from './model.js';
import {publicationExplanationRows} from './publication-explanation-view.js';

const kinds={'first-publication':'First publication · release context',revision:'Estimate revision','no-revision':'No GDP revision','annual-update':'Annual update · quarter-specific explanation'};

export function publicationExplanationPanel(publications,archive,cutoff,period,state,sourceAnchor){
 const note='<p class="panel-note">Meridian paraphrases of dated BEA releases and technical notes. These explain revisions to the same quarter, separately from contributors to economic growth. They do not calculate an exact numerical decomposition. First-publication context is labelled separately. General annual-update scope does not establish the cause of every quarter’s revision. Publication dates have day precision; retrieval dates do not indicate when a release became available.</p>';
 let body;
 if(state?.status==='error')body=emptyState('BEA revision explanations unavailable.',state.error??'Narrative evidence could not be loaded. Numerical publication history remains available.',button('RETRY EXPLANATIONS','data-retry-publication-explanations'));
 else if(state&&state.status!=='ready')body=emptyState('Loading BEA revision explanations.','Numerical publication history remains available.');
 else {
  let rows;try{rows=publicationExplanationRows(publications,archive,cutoff,period);}catch(error){if(error instanceof RangeError)return '';throw error;}
  const known=rows.filter(item=>item.explanation),missing=rows.length-known.length;
  body=`<p class="panel-note">Reviewed explanations in this selection: ${known.length} of ${rows.length} publications. ${missing?`${missing} publication${missing===1?' has':'s have'} explanations not reviewed; causes remain unknown.`:''} Coverage is a selected set of dated releases, not the full historical archive.</p>`;
  if(!known.length)body+=emptyState('No reviewed BEA explanation retained for this selection.','No cause is inferred from numerical changes. The publication workbook remains the evidence for published values.');
  body+=known.map(({publication:row,explanation:item})=>`<article class="publication-explanation" aria-labelledby="explanation-${esc(row.id)}"><header><h3 id="explanation-${esc(row.id)}">${esc(periodLabel({frequency:'Quarterly'},row.period))} · ${esc(row.estimate)} · ${esc(row.publicationDate)}</h3><span class="coverage-badge">${esc(kinds[item.kind]??item.kind)}</span></header><p>${esc(item.summary)}</p>${item.details.length?`<details><summary>BEA source details</summary><ul>${item.details.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></details>`:''}${item.annualUpdate?`<p class="panel-note"><strong>Separate annual-update scope:</strong> ${esc(item.annualUpdate.summary)}</p>`:''}<p class="panel-note">${esc(item.attribution)} ${sourceAnchor(item.sourceUrl,item.sourceTitle+' ↗')} · ${esc(item.sourceSection)}. Released: ${esc(item.publicationDate)} (day precision). Retrieved: ${esc(item.provenance.at(-1)?.retrievedAt??'Unavailable')}. ${sourceAnchor(item.licenseUrl,'Reuse terms ↗')}</p></article>`).join('');
  if(rows.length)body+=`<div class="actions">${button('CSV REVISION EXPLANATIONS','data-export-publication-explanations')}</div>`;
 }
 return panel('02','BEA REVISION EXPLANATIONS',note+body);
}
