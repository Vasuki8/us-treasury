import {isIsoDate} from './date-window.js';
import {tabularCsv} from './model.js';

/** Day precision is intentional: a release date does not prove a server publication instant. */
export function selectPublicationHistory(archive,cutoff=''){
 const retained=[...(archive?.releases??[])].sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
 const date=cutoff||retained.at(-1)?.publicationDate||'';
 if(date&&!isIsoDate(date))throw new RangeError('Choose a valid publication cutoff date.');
 const releases=retained.filter(row=>row.publicationDate<=date);
 return {cutoff:date,releases,latest:releases.at(-1)??null,coverageEnd:retained.at(-1)?.publicationDate??null};
}

export function publicationCsv(archive,cutoff){
 return tabularCsv(['series_id','reference_period','estimate','value','unit','publication_date','publication_date_precision','publication_instant','retrieved_at','source_url','release_evidence_url','source_series','source_value','source_date_text','source_cells_json','provenance_json','source_title','license_url','attribution','calculation','interpretation'],selectPublicationHistory(archive,cutoff).releases.map(row=>[row.seriesId,row.period,row.estimate,row.value,row.unit,row.publicationDate,'day',null,row.provenance.at(-1)?.retrievedAt,row.sourceUrl,row.releaseEvidenceUrl,row.sourceIds.join('; '),row.sourceValue,row.sourcePublicationDate,JSON.stringify(row.sourceCells),JSON.stringify(row.provenance),row.sourceTitle,row.licenseUrl,row.attribution,row.calculation,'Official selected publication history. Date-only release evidence; current revised history and Meridian retrieval history are separate.']));
}
