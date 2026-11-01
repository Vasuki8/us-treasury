// Calendar references establish listed dates, not captured decisions or release instants.
const calendarUrl='https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const publicationEvidence='Official calendar document reference; the linked document contents have not been captured or parsed.';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

/** Validate a complete, retained FOMC calendar without consulting live data or a clock. */
export function validateFrozenFomcCalendar(context){try{
 if(!keys(context,['version','asOf','source'])||context.version!==1||!instant(context.asOf))return false;
 const source=context.source;
 if(!keys(source,['id','agency','events','documents','coveredYears','fetchedAt','provenance','coverageNote','warnings','status','lastAttemptAt','error','failure'])||source.id!=='fomc'||source.agency!=='Board of Governors of the Federal Reserve System'||!['ok','error'].includes(source.status)||!instant(source.fetchedAt)||source.fetchedAt>context.asOf||!text(source.coverageNote,3000)||!Array.isArray(source.warnings)||source.warnings.length>16||source.warnings.some(row=>!text(row,2000)))return false;
 if(source.lastAttemptAt!==undefined&&(!instant(source.lastAttemptAt)||source.lastAttemptAt>context.asOf))return false;
 if(source.status==='ok'){
  if(source.error!==undefined&&source.error!==null||source.failure!==undefined&&source.failure!==null||source.lastAttemptAt!==undefined&&source.lastAttemptAt>source.fetchedAt)return false;
 }else{
  if(!text(source.error,2000)||!instant(source.lastAttemptAt)||source.lastAttemptAt<source.fetchedAt)return false;
  if(source.failure!==undefined&&source.failure!==null){const failure=source.failure;if(!keys(failure,['kind','status','requestedUrl','url','redirected'])||failure.kind!=='http'||!Number.isInteger(failure.status)||failure.status<100||failure.status>599||failure.requestedUrl!==calendarUrl||failure.url!==calendarUrl||failure.redirected!==false)return false;}
 }
 if(!Array.isArray(source.provenance)||source.provenance.length!==1)return false;
 const receipt=source.provenance[0];
 if(!keys(receipt,['url','sha256','retrievedAt','lastModified'])||receipt.url!==calendarUrl||typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256)||receipt.retrievedAt!==source.fetchedAt||!instant(receipt.retrievedAt)||receipt.lastModified!==undefined&&receipt.lastModified!==null&&!text(receipt.lastModified,200))return false;
 const years=source.coveredYears;
 if(!Array.isArray(years)||years.length<1||years.length>2||years.some((year,i)=>!Number.isInteger(year)||year<2021||year>2100||i&&year!==years[i-1]+1))return false;
 const events=source.events,documents=source.documents;
 if(!Array.isArray(events)||!events.length||events.length>64||!Array.isArray(documents)||documents.length>96)return false;
 const eventKeys=['id','sourceId','program','seriesId','seriesIds','topic','name','agency','date','time','scheduledAt','datePrecision','period','periodLabel','sourceUrl','scheduleBasis'];
 const ids=new Set(),meetings=new Map(),minutes=new Map();let previous='';
 for(const row of events){
  const decision=row?.program==='fomc-decision',isMinutes=row?.program==='fomc-minutes';
  if(!keys(row,[...eventKeys,...(decision?['meetingStartDate','meetingDate','projectionsAssociated']:['meetingDate','documentUrl'])])||!decision&&!isMinutes||ids.has(row.id)||!day(row.date)||row.id!==row.program+'-'+row.date||row.sourceId!=='fomc'||row.seriesId!=='policyTargetUpper'||!Array.isArray(row.seriesIds)||row.seriesIds.length!==2||row.seriesIds[0]!=='policyTargetUpper'||row.seriesIds[1]!=='policyTargetLower'||row.topic!=='Policy'||row.agency!=='Federal Reserve'||row.time!==null||row.scheduledAt!==null||row.datePrecision!=='day'||row.scheduleBasis!=='listed-date'||row.period!==null||row.periodLabel!==null||row.sourceUrl!==calendarUrl||!day(row.meetingDate)||!years.includes(Number(row.meetingDate.slice(0,4))))return false;
  const order=row.date+'|'+row.id;if(order<=previous)return false;previous=order;ids.add(row.id);
  if(decision){
   if(row.meetingDate!==row.date||!day(row.meetingStartDate)||row.meetingStartDate>row.date||row.meetingStartDate.slice(0,7)!==row.date.slice(0,7)||typeof row.projectionsAssociated!=='boolean'||row.name!==('FOMC meeting decision'+(row.projectionsAssociated?' · projections meeting':'')))return false;
   meetings.set(row.date,row);
  }else{
   if(row.date<row.meetingDate||row.name!=='FOMC minutes'||minutes.has(row.meetingDate))return false;
   minutes.set(row.meetingDate,row);
  }
 }
 if(years.some(year=>{const count=[...meetings.keys()].filter(date=>Number(date.slice(0,4))===year).length;return count<1||count>16;}))return false;
 const seen=new Set();let previousDocument='';
 for(const row of documents){
  if(!keys(row,['kind','meetingDate','documentDate','url','sourceUrl','datePrecision','publicationEvidence'])||!['decision','minutes','projections'].includes(row.kind)||!day(row.meetingDate)||!day(row.documentDate)||row.sourceUrl!==calendarUrl||row.datePrecision!=='day'||row.publicationEvidence!==publicationEvidence||!meetings.has(row.meetingDate))return false;
  const key=row.meetingDate+'|'+row.kind,code=row.meetingDate.replaceAll('-',''),path=row.kind==='decision'?'/newsevents/pressreleases/monetary'+code+'a.htm':'/monetarypolicy/fomc'+(row.kind==='minutes'?'minutes':'projtabl')+code+'.htm';
  if(seen.has(key)||key<=previousDocument||row.url!=='https://www.federalreserve.gov'+path)return false;seen.add(key);previousDocument=key;
  if(row.kind==='minutes'){
   const reference=minutes.get(row.meetingDate);if(row.documentDate<row.meetingDate||!reference||reference.date!==row.documentDate||reference.documentUrl!==row.url)return false;
  }else if(row.documentDate!==row.meetingDate||row.kind==='projections'&&!meetings.get(row.meetingDate).projectionsAssociated)return false;
 }
 for(const [meetingDate,row]of minutes)if(!meetings.has(meetingDate)||!seen.has(meetingDate+'|minutes')||!documents.some(document=>document.kind==='minutes'&&document.meetingDate===meetingDate&&document.documentDate===row.date&&document.url===row.documentUrl))return false;
 return true;
 }catch{return false;}}
