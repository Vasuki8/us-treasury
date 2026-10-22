import {isIsoDate} from './date-window.js';
import {tabularCsv} from './model.js';

/** Day precision is intentional: a release date does not prove a server publication instant. */
export function selectPublicationHistory(archive,cutoff='',period='',{seriesId,periodLabel='quarter'}={}){
 const retained=[...(archive?.releases??[])].filter(row=>seriesId===undefined||row.seriesId===seriesId).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate)||a.period.localeCompare(b.period));
 const periods=[...new Set(retained.map(row=>row.period))].sort();
 const date=cutoff||retained.at(-1)?.publicationDate||'';
 if(date&&!isIsoDate(date))throw new RangeError('Choose a valid publication cutoff date.');
 if(period&&!periods.includes(period))throw new RangeError(`Choose a ${periodLabel} contained in the official publication archive.`);
 const selected=period||[...new Set(retained.filter(row=>row.publicationDate<=date).map(row=>row.period))].sort().at(-1)||periods[0]||'';
 const quarter=retained.filter(row=>row.period===selected),releases=quarter.filter(row=>row.publicationDate<=date);
 return {cutoff:date,period:selected,periods,releases,first:releases[0]??null,latest:releases.at(-1)??null,coverageStart:retained[0]?.publicationDate??null,coverageEnd:retained.at(-1)?.publicationDate??null,quarterCoverageEnd:quarter.at(-1)?.publicationDate??null,retainedCount:retained.length};
}

/** The workbook explicitly distinguishes GDP confirmations from new GDP revisions. */
export function publicationContext(row){
 const note=(row.sourcePublicationDate??'').replace(/\s+/g,' ').trim();
 if(/GDP not open for revision/i.test(note))return {confirmation:true,label:'GDP not open for revision — unchanged GDP confirmation'};
 if(/GDP not revised/i.test(note))return {confirmation:true,label:'GDP not revised — unchanged GDP confirmation'};
 // BEA explicitly documents this one annual-update date and open quarter range.
 if(row.sourceUrl==='https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx'&&row.estimate==='Revised'&&row.publicationDate==='2026-09-30'&&row.period>='2021-01-01'&&row.period<='2026-01-01')return {confirmation:false,label:'2026 annual update',evidenceUrl:'https://www.bea.gov/information-updates-national-regional-economic-accounts'};
 return {confirmation:false,label:'Published estimate; revision cause/type not inferred'};
}

export function publicationCsv(archive,cutoff,period){
 return tabularCsv(['series_id','reference_period','estimate','value','unit','publication_date','publication_date_precision','publication_instant','retrieved_at','source_url','release_evidence_url','source_series','source_value','source_date_text','source_cells_json','provenance_json','source_title','license_url','attribution','calculation','interpretation'],selectPublicationHistory(archive,cutoff,period).releases.map(row=>{
  const context=publicationContext(row),note=context.confirmation?' '+context.label+'.':context.evidenceUrl?' '+context.label+'. Evidence: '+context.evidenceUrl+'.':'';
  return [row.seriesId,row.period,row.estimate,row.value,row.unit,row.publicationDate,'day',null,row.provenance.at(-1)?.retrievedAt,row.sourceUrl,row.releaseEvidenceUrl,row.sourceIds.join('; '),row.sourceValue,row.sourcePublicationDate,JSON.stringify(row.sourceCells),JSON.stringify(row.provenance),row.sourceTitle,row.licenseUrl,row.attribution,row.calculation,'Official selected publication history. Date-only release evidence; current revised history and Meridian retrieval history are separate.'+note];
 }));
}
