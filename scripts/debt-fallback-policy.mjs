import {isDeepStrictEqual} from 'node:util';
import {normalizeVintageTimestamp} from '../src/vintages.js';
import {DTS_DEBT_DATE,DTS_DEBT_URL,DTS_DEBT_SHA256,DTS_DEBT_VALUES,DTS_PRIMARY_VALUES,DTS_DEBT_FIELDS,DTS_DEBT_NOTE} from '../src/debt-fallback.js';

const primaryEndpoint='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny';
const receiptFields=new Set(['url','sha256','retrievedAt','lastModified']);
const fail=()=>{throw new Error('Unreviewed rounded debt fallback scope, value or provenance');};
const timestamp=value=>{try{return normalizeVintageTimestamp(value);}catch{fail();}};
const declares=value=>value?.sourceUrl===DTS_DEBT_URL||value?.sourceUrls?.includes?.(DTS_DEBT_URL)||value?.provenance?.some?.(receipt=>receipt.url===DTS_DEBT_URL)||value?.inputProvenance?.some?.(receipt=>receipt.url===DTS_DEBT_URL);
const marked=row=>declares(row)||row?.sourceSha256===DTS_DEBT_SHA256||row?.reconciliation==='official-rounded-fallback'||row?.sourceSeriesId?.startsWith?.('DTS:')||Object.hasOwn(row??{},'fallbackSourceValues');
function primaryUrl(value){
 try{const url=new URL(value);return !url.username&&!url.password&&!url.hash&&url.origin+url.pathname===primaryEndpoint;}catch{return false;}
}
function assertRow(row,field,receipts){
 const pdf=receipts[1];
 if(row.date!==DTS_DEBT_DATE||row.sourceValue!==DTS_DEBT_VALUES[field]||row.sourceUnit!=='USD millions'||row.sourcePrecisionUSD!==1000000||row.sourceSeriesId!==DTS_DEBT_FIELDS[field]
  ||row.sourceUrl!==DTS_DEBT_URL||row.sourceSha256!==DTS_DEBT_SHA256||row.retrievedAt!==pdf.retrievedAt||row.publishedAt!==null
  ||row.reconciliation!=='official-rounded-fallback'||row.reconciliationResidualUSD!==-10000000000
  ||!isDeepStrictEqual(row.primarySourceValues,DTS_PRIMARY_VALUES)||!isDeepStrictEqual(row.fallbackSourceValues,DTS_DEBT_VALUES)||!isDeepStrictEqual(row.footnotes,[DTS_DEBT_NOTE])
  ||!isDeepStrictEqual(row.inputProvenance,receipts)||Object.hasOwn(row,'sourceUrls')||Object.hasOwn(row,'provenance'))fail();
}

/** One reviewed PDF and raw conflict; scoped exports need not retain omitted days. */
export function assertDebtFallbackData(snapshot){
 for(const [agency,source]of Object.entries(snapshot.sources??{})){
  let declared=false;
  const roots=(source.provenance??[]).filter(receipt=>receipt.url===DTS_DEBT_URL);
  for(const [id,series]of Object.entries(source.series??{})){
   const rows=series.observations??[],fallbackRows=Array.isArray(rows)?rows.filter(marked):[];
   const supported=agency==='treasury'&&id==='debt'||agency==='fiscal'&&id==='publicDebt';
   if(supported&&Array.isArray(rows)&&rows.some(row=>!marked(row)&&Object.hasOwn(row,'primarySourceValues')&&(row.reconciliation!=='source-residual-quarantined'||row.value!==null)))fail();
   if(!declares(series)&&!fallbackRows.length)continue;
   if(!supported||!primaryUrl(series.sourceUrl)||!isDeepStrictEqual(series.sourceUrls,[series.sourceUrl,DTS_DEBT_URL])||!Array.isArray(rows)
    ||new Set(rows.map(row=>row.date)).size!==rows.length||!Array.isArray(series.provenance)||series.provenance.length!==2||roots.length!==1)fail();
   const receipts=series.provenance;
   if(receipts[0]?.url!==series.sourceUrl||receipts[1]?.url!==DTS_DEBT_URL||receipts[1]?.sha256!==DTS_DEBT_SHA256)fail();
   for(const receipt of receipts){
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||Object.keys(receipt).some(key=>!receiptFields.has(key))||!/^[a-f0-9]{64}$/.test(receipt.sha256)
     ||receipt.lastModified!==undefined&&receipt.lastModified!==null&&typeof receipt.lastModified!=='string'
     ||!(source.provenance??[]).some(root=>isDeepStrictEqual(root,receipt))||timestamp(receipt.retrievedAt)>timestamp(source.fetchedAt))fail();
   }
   if(timestamp(series.fetchedAt)!==receipts.map(receipt=>timestamp(receipt.retrievedAt)).sort().at(-1))fail();
   declared=true;
   const field=agency==='treasury'?'tot_pub_debt_out_amt':'debt_held_public_amt';
   for(const row of rows.filter(row=>marked(row)||row.date===DTS_DEBT_DATE)){
    assertRow(row,field,receipts);
    if(row.value!==Number(DTS_DEBT_VALUES[field])/1000000)fail();
   }
   for(const row of agency==='fiscal'?source.fiscal?.debtBreakdown??[]:[]){
    if(!marked(row)&&row.date!==DTS_DEBT_DATE)continue;
    assertRow(row,field,receipts);
    if(!isDeepStrictEqual(row.sourceValues,DTS_PRIMARY_VALUES)||row.publicDebt!==29.5233||row.intragovernmentalDebt!==7.314865||row.grossDebt!==36.838165)fail();
   }
  }
  if((declares(source)||(source.fiscal?.debtBreakdown??[]).some(marked))&&!declared)fail();
 }
}
