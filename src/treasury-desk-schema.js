import {DTS_DESK_BASE,TIC_HOLDERS_URL,TREASURY_DESK_TERMS,treasuryDeskDefinitions} from './treasury-desk-definitions.js';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const equal=(a,b)=>a===b||finite(a)&&finite(b)&&Math.abs(a-b)<1e-8;
const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const cashLabels={dtsCash:'Treasury General Account (TGA) Closing Balance',dtsDeposits:'Total TGA Deposits (Table II)',dtsWithdrawals:'Total TGA Withdrawals (Table II) (-)'};
export function treasuryDeskNumber(value){if(value==='null'||value===null||value==='N/A'||value==='—')return null;if(typeof value!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value)))throw Error('Invalid Treasury desk native value');return Number(value);}
export function dtsNativeValue(value){if(value!=='null'&&(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))throw Error('Invalid DTS native USD-million value');return treasuryDeskNumber(value);}
export const dtsSubjectValue=components=>{if(!Array.isArray(components)||components.length!==6)throw Error('Invalid statutory debt components');const n=components.map(dtsNativeValue);return n.every(finite)?(n[0]+n[1]-n[2]-n[3]-n[4]+n[5])/1000:null;};
export function treasuryDeskFeedRequest(value){try{
 const u=new URL(value);if(u.username||u.password||u.hash)return null;if(value===TIC_HOLDERS_URL)return{kind:'ticHolders'};
 const endpoint=['debt_subject_to_limit','operating_cash_balance'].find(e=>u.origin+u.pathname===DTS_DESK_BASE+e);if(!endpoint)return null;
 const keys=[...u.searchParams.keys()].sort();if(keys.join(',')!=='filter,page[number],page[size],sort'||u.searchParams.get('sort')!=='record_date,src_line_nbr'||u.searchParams.get('page[size]')!=='1000')return null;
 const filter=/^record_date:gte:(\d{4}-\d{2}-\d{2}),record_date:lte:(\d{4}-\d{2}-\d{2})$/.exec(u.searchParams.get('filter')),page=u.searchParams.get('page[number]');if(!filter||!date(filter[1])||!date(filter[2])||!/^([1-9]|1[0-2])$/.test(page))return null;
 const start=new Date(filter[2]+'T00:00:00Z');start.setUTCFullYear(start.getUTCFullYear()-3);if(start.toISOString().slice(0,10)!==filter[1])return null;
 return{kind:'dtsDesk',endpoint,start:filter[1],end:filter[2],page:Number(page)};
 }catch{return null;}}
export function validateTreasuryDeskSource(source){try{
 const defs=treasuryDeskDefinitions[source?.id];if(!defs||!['ok','cached','error'].includes(source.status)||!Number.isFinite(Date.parse(source.fetchedAt))||typeof source.coverageNote!=='string'||!source.coverageNote.length||!Array.isArray(source.provenance)||!source.provenance.length)return false;
 const receipts=source.provenance,requests=receipts.map(r=>treasuryDeskFeedRequest(r.url));
 if(new Set(receipts.map(r=>r.url)).size!==receipts.length||receipts.some((r,i)=>requests[i]?.kind!==source.id||!Number.isFinite(Date.parse(r.retrievedAt))||Date.parse(r.retrievedAt)>Date.parse(source.fetchedAt)||!/^[a-f0-9]{64}$/.test(r.sha256))||!receipts.some(r=>r.retrievedAt===source.fetchedAt))return false;
 if(source.id==='ticHolders'&&receipts.length!==1)return false;
 if(source.id==='dtsDesk'){
  const first=requests[0];if(requests.some(r=>r.start!==first.start||r.end!==first.end||r.end>source.fetchedAt.slice(0,10)))return false;
  for(const endpoint of ['debt_subject_to_limit','operating_cash_balance']){const pages=requests.filter(r=>r.endpoint===endpoint).map(r=>r.page).sort((a,b)=>a-b);if(!pages.length||pages.some((p,i)=>p!==i+1))return false;}
 }
 if(Object.keys(source.series??{}).length!==Object.keys(defs).length)return false;let commonDates;
 for(const[id,d]of Object.entries(defs)){
  const s=source.series[id],request=treasuryDeskFeedRequest(s?.sourceUrl),receipt=receipts.find(r=>r.url===s?.sourceUrl);if(!s||s.unit!==d.unit||s.frequency!==d.frequency||s.adjustment!==d.adjustment||s.observationType!==d.observationType||s.calculation!==d.definition||s.licenseUrl!==TREASURY_DESK_TERMS||s.attribution!=='Source: U.S. Department of the Treasury.'||!receipt||request?.kind!==source.id||JSON.stringify(s.sourceIds)!==JSON.stringify([d.code])||!Array.isArray(s.observations)||!s.observations.length||s.observations.length>1200)return false;
  if(source.id==='dtsDesk'&&(request.page!==1||request.endpoint!==(cashLabels[id]?'operating_cash_balance':'debt_subject_to_limit')))return false;
  const dates=s.observations.map(r=>r.date);if(commonDates&&JSON.stringify(dates)!==JSON.stringify(commonDates))return false;commonDates??=dates;let prev='';
  for(const r of s.observations){
   if(!date(r.date)||r.date<=prev||r.date>source.fetchedAt.slice(0,10)||r.publishedAt!==null||r.value!==null&&!finite(r.value))return false;prev=r.date;
   const expectedKeys=['date','value','sourceValue','publishedAt',...(id==='debtSubjectLimit'?['components']:cashLabels[id]?['nativeField','accountType']:[])].sort().join(',');if(Object.keys(r).sort().join(',')!==expectedKeys)return false;
   let expected;
   if(source.id==='dtsDesk'&&(r.date<request.start||r.date>request.end))return false;
   if(id==='debtSubjectLimit'){if(r.sourceValue!==null)return false;expected=dtsSubjectValue(r.components);}
   else if(id==='statutoryHeadroom'){if(r.sourceValue!==null)return false;const a=source.series.statutoryDebtLimit.observations.find(x=>x.date===r.date),b=source.series.debtSubjectLimit.observations.find(x=>x.date===r.date);expected=finite(a?.value)&&finite(b?.value)?a.value-b.value:null;}
   else{if(cashLabels[id]&&(r.nativeField!=='open_today_bal'||r.accountType!==cashLabels[id]))return false;const n=source.id==='dtsDesk'?dtsNativeValue(r.sourceValue):treasuryDeskNumber(r.sourceValue);expected=n===null?null:n/(source.id==='dtsDesk'?1000:1);}
   if(source.id==='ticHolders'){const end=new Date(Date.UTC(Number(r.date.slice(0,4)),Number(r.date.slice(5,7)),0)).toISOString().slice(0,10);if(r.date!==end||typeof r.sourceValue!=='string'||!/^\d+\.\d$/.test(r.sourceValue))return false;}
   if(!equal(r.value,expected))return false;
  }
 }
 if(source.id==='ticHolders')for(let i=1;i<commonDates.length;i++){const a=commonDates[i-1],b=commonDates[i];if(Number(b.slice(0,4))*12+Number(b.slice(5,7))!==Number(a.slice(0,4))*12+Number(a.slice(5,7))+1)return false;}
 return true;
 }catch{return false;}}
