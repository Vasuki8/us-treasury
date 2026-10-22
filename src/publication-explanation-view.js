import {selectPublicationHistory} from './publication-history.js';
import {tabularCsv} from './model.js';

/** No matching by date alone: a release can discuss several different quarters. */
export function publicationExplanation(row,archive){
 const matches=(archive?.explanations??[]).filter(item=>item.publicationId===row.id&&item.seriesId===row.seriesId&&item.period===row.period&&item.estimate===row.estimate&&item.publicationDate===row.publicationDate);
 if(matches.length>1)throw new Error('Ambiguous duplicate publication explanation.');
 return matches[0]??null;
}

export function publicationExplanationRows(publications,explanations,cutoff,period){
 return selectPublicationHistory(publications,cutoff,period).releases.map(row=>({publication:row,explanation:publicationExplanation(row,explanations)}));
}

export function publicationExplanationsCsv(publications,explanations,cutoff,period){
 return tabularCsv(['series_id','reference_period','publication_id','estimate','value','unit','publication_date','publication_date_precision','publication_instant','explanation_status','source_value','previous_source_value','text_type','summary','details_json','annual_update_json','source_title','source_section','source_url','retrieved_at','provenance_json','license_url','attribution','interpretation'],publicationExplanationRows(publications,explanations,cutoff,period).map(({publication:row,explanation:item})=>[
  row.seriesId,row.period,row.id,row.estimate,row.value,row.unit,row.publicationDate,'day',null,item?.kind??'not-reviewed',item?.sourceValue??'',item?.previousValue??'',item?.textType??'',item?.summary??'',item?JSON.stringify(item.details):'',item?.annualUpdate?JSON.stringify(item.annualUpdate):'',item?.sourceTitle??'',item?.sourceSection??'',item?.sourceUrl??'',item?.provenance.at(-1)?.retrievedAt??'',item?JSON.stringify(item.provenance):'',item?.licenseUrl??'',item?.attribution??'',item?'Meridian paraphrase of the cited BEA explanation. Revision contributors are distinct from growth contributors; no exact numerical component decomposition is calculated. Annual-update scope is separate from quarter-specific evidence.':'No reviewed BEA explanation retained for this publication. Missing explanations are not inferred from numerical changes.'
 ]));
}
