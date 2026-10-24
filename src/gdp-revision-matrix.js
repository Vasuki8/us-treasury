import {isIsoDate} from './date-window.js';
import {publicationContext} from './publication-history.js';
import {tabularCsv} from './model.js';

const routineStages={Advance:'advance',Second:'second',Preliminary:'second',Third:'third',Final:'third'};
const pairs={secondMinusAdvance:['advance','second'],thirdMinusSecond:['second','third'],thirdMinusAdvance:['advance','third']};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
// Freeze/import canonicalizes object keys. Evidence values and exported bytes stay stable.
const evidenceJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const difference=(first,last)=>Number((last-first).toFixed(12));
export const isGdpRevisionMeasurement=row=>Boolean(row&&row.seriesId==='gdp'&&row.unit==='Percent change from preceding quarter, annualized'&&row.frequency==='Quarterly'&&row.adjustment==='Seasonally adjusted annual rate');
const comparable=(a,b)=>Boolean(isGdpRevisionMeasurement(a)&&isGdpRevisionMeasurement(b)&&finite(a.value)&&finite(b.value));

export const gdpRevisionMatrixMethods='Routine groups use only explicit Advance, Second/Preliminary and Third/Final source labels; raw labels remain unchanged. Initial, Updated, Revised and unrecognized labels are exceptional, never ordinal replacements. Each revision is later minus earlier published real GDP growth for the same reference quarter and the canonical quarterly GDP percent-change-from-preceding-quarter annualized unit and seasonally adjusted annual rate basis, in percentage points (pp). Each pair independently includes quarters with both unique, numeric routine cells and excludes either endpoint marked GDP not open for revision or GDP not revised. Zero changes count. Mean signed is sum of signed revisions / eligible N; mean absolute is sum of absolute revisions / eligible N; median absolute is the median of absolute revisions (middle two averaged for even N). Empty samples are unavailable. Latest retained and latest-minus-first use only retained archive facts by the inclusive publication-day cutoff, separate from routine-stage statistics and current revised NIPA. Publication dates have day precision; exact publication instants are unknown. Only explicitly evidenced update types are labelled; other revision causes are not inferred.';

function summarize(values){
 const sampleN=values.length;
 if(!sampleN)return {sampleN:0,meanSignedPp:null,meanAbsolutePp:null,medianAbsolutePp:null};
 const absolute=values.map(Math.abs).sort((a,b)=>a-b),middle=Math.floor(sampleN/2);
 return {sampleN,meanSignedPp:values.reduce((sum,value)=>sum+value,0)/sampleN,meanAbsolutePp:absolute.reduce((sum,value)=>sum+value,0)/sampleN,medianAbsolutePp:sampleN%2?absolute[middle]:(absolute[middle-1]+absolute[middle])/2};
}

/** Pure archive-only publication-day replay. Original evidence objects are never mutated. */
export function buildGdpRevisionMatrix(archive,{cutoff=''}={}){
 if(cutoff&&!isIsoDate(cutoff))throw new RangeError('Choose a valid publication cutoff date.');
 if(archive?.releases!==undefined&&!Array.isArray(archive.releases))throw new RangeError('Invalid GDP publication archive.');
 const retained=(archive?.releases??[]).filter(row=>row.seriesId==='gdp');
 const seen=new Set();
 for(const row of retained){
  if(typeof row.id!=='string'||!row.id||seen.has(row.id)||!isIsoDate(row.publicationDate)||!isIsoDate(row.period)||!/^\d{4}-(01|04|07|10)-01$/.test(row.period)||typeof row.estimate!=='string'||(!finite(row.value)&&row.value!==null))throw new RangeError('Invalid or duplicate GDP publication fact.');
  seen.add(row.id);
 }
 const sorted=[...retained].sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate)||a.id.localeCompare(b.id));
 const date=cutoff||sorted.at(-1)?.publicationDate||'';
 const publications=sorted.filter(row=>row.publicationDate<=date),groups=new Map();
 for(const row of publications){if(!groups.has(row.period))groups.set(row.period,[]);groups.get(row.period).push(row);}
 const rows=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period,publications])=>{
  const candidates={advance:[],second:[],third:[]},exceptions=[],notes=[];
  if(publications.some(row=>!isGdpRevisionMeasurement(row)))notes.push('Unsupported GDP measurement metadata: raw facts retained, excluded from revision calculations.');
  for(const publication of publications){const stage=Object.hasOwn(routineStages,publication.estimate)?routineStages[publication.estimate]:null;if(stage)candidates[stage].push(publication);else exceptions.push(publication);}
  const cells=Object.fromEntries(Object.entries(candidates).map(([stage,items])=>{
   if(items.length>1)notes.push(`Multiple explicit ${stage} group records; ambiguous cell excluded from routine pairs.`);
   return [stage,items.length===1?items[0]:null];
  }));
  const revisions=Object.fromEntries(Object.entries(pairs).map(([key,[from,to]])=>{
   const a=cells[from],b=cells[to];
   // A later-labelled stage published before its predecessor is not a routine opportunity.
   return [key,comparable(a,b)&&a.publicationDate<b.publicationDate&&!publicationContext(a).confirmation&&!publicationContext(b).confirmation?difference(a.value,b.value):null];
  }));
  const first=publications[0],latest=publications.at(-1),confirmations=publications.filter(row=>publicationContext(row).confirmation);
  return {period,...cells,first,latest,publications,exceptions,confirmations,notes,revisions,latestMinusFirstPp:comparable(first,latest)?difference(first.value,latest.value):null};
 });
 const summaries=Object.fromEntries(Object.keys(pairs).map(key=>[key,summarize(rows.map(row=>row.revisions[key]).filter(finite))]));
 return {cutoff:date,rows,summaries,retainedCount:retained.length,selectedCount:publications.length,quarterCount:rows.length,confirmationCount:rows.reduce((n,row)=>n+row.confirmations.length,0),coverageStart:sorted[0]?.publicationDate??null,coverageEnd:sorted.at(-1)?.publicationDate??null,referenceStart:rows[0]?.period??null,referenceEnd:rows.at(-1)?.period??null,methods:gdpRevisionMatrixMethods};
}

/** One row per reference quarter; full raw cell evidence and pair-specific N travel with exports. */
export function gdpRevisionMatrixCsv(archive,options={}){
 const view=buildGdpRevisionMatrix(archive,options),stages=['advance','second','third','first','latest'];
 const columns=['id','raw_stage','published_value','unit','frequency','adjustment','measurement_eligible','source_value','publication_date','source_url','release_evidence_url','context','evidence_json'];
 return tabularCsv(['reference_quarter','publication_cutoff',...stages.flatMap(stage=>columns.map(column=>`${stage}_${column}`)),'second_minus_advance_pp','third_minus_second_pp','third_minus_advance_pp','latest_minus_first_pp','exceptions_json','confirmations_json','publications_json','cell_notes_json','pair_summaries_json','methods'],view.rows.map(row=>[
  row.period,view.cutoff,...stages.flatMap(stage=>{const cell=row[stage];return cell?[cell.id,cell.estimate,cell.value,cell.unit,cell.frequency,cell.adjustment,isGdpRevisionMeasurement(cell),cell.sourceValue,cell.publicationDate,cell.sourceUrl,cell.releaseEvidenceUrl,publicationContext(cell).label,evidenceJson(cell)]:columns.map(()=>null);}),
  row.revisions.secondMinusAdvance,row.revisions.thirdMinusSecond,row.revisions.thirdMinusAdvance,row.latestMinusFirstPp,evidenceJson(row.exceptions),evidenceJson(row.confirmations),evidenceJson(row.publications),evidenceJson(row.notes),evidenceJson(view.summaries),view.methods,
 ]));
}
