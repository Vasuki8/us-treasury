import {selectPublicationHistory} from './publication-history.js';
import {tabularCsv} from './model.js';

export const claimsPublicationIds=Object.freeze(['claimsAdvance','continuedClaimsAdvance']);
/** A retained prior comparison is never promoted to an original advance. */
export function selectClaimsPublicationHistory(archive,seriesId,cutoff='',period=''){
 if(!claimsPublicationIds.includes(seriesId))throw new RangeError('Choose a reviewed claims publication measurement.');
 const view=selectPublicationHistory(archive,cutoff,period,{seriesId,periodLabel:'week'});
 const rows=view.releases.map((publication,index)=>{
  const previous=view.releases[index-1],sameMeasurement=previous&&['unit','frequency','adjustment'].every(key=>previous[key]===publication[key]);
  const seasonalBoundary=previous&&publication.seasonalAdjustmentKind==='applied-update'&&previous.publicationDate<publication.publicationDate;
  const comparable=Boolean(sameMeasurement&&!seasonalBoundary);
  const comparisonNote=!previous?'No preceding retained publication for this week.':seasonalBoundary?'Difference not calculated across a source-noted seasonal adjustment update; revision causes are not inferred.':!sameMeasurement?'Captured measurement metadata differs; no comparable difference is calculated.':'Difference between published values for the same measurement and week; revision cause is not inferred.';
  return {publication,previous:previous??null,change:comparable?Number((publication.value-previous.value).toFixed(12)):null,comparable,comparisonNote};
 });
 return {...view,seriesId,rows,firstAdvance:view.releases.find(row=>row.releaseStage==='advance')??null};
}

export function claimsPublicationCsv(archive,seriesId,cutoff='',period=''){
 const view=selectClaimsPublicationHistory(archive,seriesId,cutoff,period);
 return tabularCsv(['series_id','reference_week','release_stage','estimate','value','unit','publication_date','publication_date_precision','publication_instant','retrieved_at','source_value','previously_published_source_value','change_from_previous_publication_thousands','measurement_comparable','comparison_note','seasonal_adjustment_note','seasonal_adjustment_kind','source_url','release_evidence_url','source_series','source_notes','provenance_json','source_title','license_url','attribution','calculation','interpretation'],view.rows.map(({publication:row,change,comparable,comparisonNote})=>[
  row.seriesId,row.period,row.releaseStage,row.estimate,row.value,row.unit,row.publicationDate,'day',null,row.provenance.at(-1)?.retrievedAt,row.sourceValue,row.previouslyPublishedSourceValue,change,comparable,comparisonNote,row.seasonalAdjustmentNote,row.seasonalAdjustmentKind,row.sourceUrl,row.releaseEvidenceUrl,row.sourceIds.join('; '),row.footnotes.join('; '),JSON.stringify(row.provenance),row.sourceTitle,row.licenseUrl,row.attribution,row.calculation,'Archived official release facts for one measurement and reference week. Advance and same-release prior comparisons are separate roles. An earliest retained prior is not an original advance. Later annual revisions and unretained releases are unavailable. Publication-day replay is distinct from retrieval replay; exact publication instant is unknown.'
 ]));
}
