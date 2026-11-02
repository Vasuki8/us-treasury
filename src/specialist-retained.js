import {refundingDocumentLinks} from './refunding-desk.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value??'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function documentEvidence(source,role){
 let sourceUrl=null;try{sourceUrl=refundingDocumentLinks(source?.documents?.index)[role]??null;}catch{}
 const receipts=(source?.provenance??[]).filter(r=>r.url===sourceUrl&&r.sha256&&r.retrievedAt);
 return {sourceUrl,receipts};
}

/** Derive facts from the supplied retained statement only; never amend its capture. */
export function retainedBorrowingActuals(source){
 const evidence=documentEvidence(source,'borrowing'),publicationDate=source?.tables?.borrowingDate,rows=[],text=source?.documents?.borrowing;
 if(!evidence.receipts.length||!validDate(publicationDate))return {...evidence,publicationDate:publicationDate??null,rows,coverage:'Retained borrowing statement date and matching source receipt required; historical actuals unavailable.'};
 if(typeof text!=='string')return {...evidence,publicationDate,rows,coverage:'Native borrowing statement text unavailable in retained capture.'};
 const pattern=/During the ([A-Z][a-z]+)[–-]([A-Z][a-z]+) (\d{4}) quarter, Treasury borrowed \$([\d,]+(?:\.\d+)?) billion in privately-held net marketable debt and ended the quarter with a cash balance of \$([\d,]+(?:\.\d+)?) billion\./g;
 for(const match of text.matchAll(pattern)){
  const first=months.indexOf(match[1]),end=months.indexOf(match[2]),year=Number(match[3]),borrowing=Number(match[4].replaceAll(',','')),closingCash=Number(match[5].replaceAll(',',''));
  if(![0,3,6,9].includes(first)||end!==first+2||!finite(borrowing)||!finite(closingCash))continue;
  const endDate=new Date(Date.UTC(year,end+1,0)).toISOString().slice(0,10);if(endDate>=publicationDate)continue;
  const existing=rows.find(r=>r.endDate===endDate);if(existing){if(existing.borrowing!==borrowing||existing.closingCash!==closingCash)return {...evidence,publicationDate,rows:[],coverage:'Conflicting completed-quarter values in retained statement; actual borrowing is ambiguous.'};continue;}
  rows.push({period:`${match[1]}–${match[2]} ${year}`,endDate,borrowing,closingCash,publicationDate,unit:'USD billions',observationType:'official-actual',sourceValue:match[0],somaRunoff:null,netBillIssuance:null,netCouponIssuance:null});
 }
 return {...evidence,publicationDate,rows,coverage:rows.length?'Actual borrowing and closing cash from the exact retained statement. SOMA, bill and coupon decomposition and earlier quarters are not retained.':'No exact completed-quarter borrowing/cash paragraph retained. Forecasts are not actuals.'};
}

/** One dated refunding package, using its announcement month rather than reopenings. */
export function refundingPackageComposition(source){
 const evidence=documentEvidence(source,'policy'),date=source?.tables?.policyDate,table=source?.tables?.couponTable;
 const period=validDate(date)?`${months[Number(date.slice(5,7))-1].slice(0,3)}-${date.slice(2,4)}`:null,matches=table?.rows?.filter(r=>r.period===period)??[],row=matches.length===1?matches[0]:null;
 const rows=['3-Year','10-Year','30-Year'].map(tenor=>{const index=table?.tenors?.indexOf(tenor)??-1,value=index>=0?row?.values?.[index]:null;return {tenor,value:finite(value)?value:null,unit:'USD billions',observationType:row?.observationType??row?.status??'Treasury policy schedule',sourceValue:row?.sourceValue??null};});
 const complete=Boolean(row&&evidence.receipts.length&&rows.every(r=>finite(r.value)));
 return {...evidence,date:date??null,period,rows,total:complete?rows.reduce((n,r)=>n+r.value,0):null,coverage:'Current announcement-month 3Y / 10Y / 30Y package only. Anticipated auction sizes remain anticipated; a multi-quarter decision history, bill-share corridor and WAM history are not retained.'};
}
