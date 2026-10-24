import {selectPublicationHistory} from './publication-history.js';
import {tabularCsv} from './model.js';
export const cpiPublicationIds=Object.freeze(['cpiMonthly','cpiCoreMonthly','cpi','cpiCore']);
export function selectCpiPublicationHistory(archive,{seriesId='cpiMonthly',cutoff='',period=''}={}){
 if(!cpiPublicationIds.includes(seriesId))throw RangeError('Choose a reviewed CPI publication measurement.');
 const view=selectPublicationHistory(archive,cutoff,period,{seriesId,periodLabel:'month'});
 const rows=view.releases.map((publication,index)=>{
  const previous=view.releases[index-1]??null,comparable=Boolean(previous&&['unit','frequency','adjustment'].every(key=>previous[key]===publication[key]));
  return {publication,previous,comparable,change:comparable?Number((publication.value-previous.value).toFixed(12)):null,comparisonNote:comparable?'Same measurement and reference month across editions; cause of difference is not inferred.':'No comparable earlier retained publication for this month.'};
 });
 return {...view,seriesId,rows,firstPublished:view.releases.find(row=>row.releaseStage==='published')??null};
}
export function cpiPublicationCsv(archive,options={}){
 return tabularCsv(['series_id','reference_month','release_role','estimate','value','unit','adjustment','publication_date','publication_date_precision','publication_instant','retrieved_at','source_value','same_month_publication_difference_pp','comparison_note','source_cells_json','source_url','release_evidence_url','source_series','provenance_json','source_title','license_url','attribution','calculation','source_notes'],selectCpiPublicationHistory(archive,options).rows.map(({publication:r,change,comparisonNote})=>[r.seriesId,r.period,r.releaseStage,r.estimate,r.value,r.unit,r.adjustment,r.publicationDate,r.publicationDatePrecision,r.publishedAt,r.provenance.at(-1)?.retrievedAt,r.sourceValue,change,comparisonNote,JSON.stringify(r.sourceCells),r.sourceUrl,r.releaseEvidenceUrl,r.sourceIds.join('; '),JSON.stringify(r.provenance),r.sourceTitle,r.licenseUrl,r.attribution,r.calculation,r.footnotes.join('; ')]));
}
