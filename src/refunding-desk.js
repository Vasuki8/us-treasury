export const REFUNDING_INDEX='https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents/';
export const REFUNDING_TERMS='https://home.treasury.gov/subfooter/site-policies-and-notices';
export const refundingDeskRegistry=Object.fromEntries([
 ['refundingPackage','Quarterly refunding package','official-announcement'],['refundingNewCash','Quarterly refunding new cash','official-announcement'],['refundingNearBorrowing','Near-quarter borrowing estimate','official-projection'],['refundingNextBorrowing','Next-quarter borrowing estimate','official-projection'],
].map(([id,name,observationType])=>[id,{id,code:id,name,short:name,agency:'treasuryRefunding',topic:'Fiscal',frequency:'Quarterly',dateConvention:'announcement-date',unit:'USD billions',format:'billions',precision:1,periodType:'announcement',comparisonClass:'amount',adjustment:'Not seasonally adjusted',observationType,source:{name:'U.S. Treasury Quarterly Refunding',url:REFUNDING_INDEX},definition:'Official Treasury quarterly-refunding announcement or projection in USD billions, recorded at the dated announcement. Forecast quarter and assumed cash balance remain separate named table fields. Announced sizes are not completed auction results; TBAC recommendations are not Treasury decisions.'}]));
export const refundingText=html=>String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replaceAll('&nbsp;',' ').replaceAll('&amp;','&').replace(/\s+/g,' ').trim();
const isoMonth={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
const shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const periodIndex=p=>{const m=/^([A-Z][a-z]{2})-(\d{2})$/.exec(p);if(!m||!shortMonths.includes(m[1]))throw Error('Invalid refunding month');return (2000+Number(m[2]))*12+shortMonths.indexOf(m[1]);};
export function matchesRefundingDocumentUrl(value){try{const u=new URL(value);return u.origin==='https://home.treasury.gov'&&!u.username&&!u.password&&!u.search&&!u.hash&&(value===REFUNDING_INDEX||/^\/news\/press-releases\/[a-z0-9]+$/.test(u.pathname)||/^\/system\/files\/221\/(?:TBACRecommendedFinancingTableByRefundingQuarter|TreasuryPresentationToTBAC)[A-Za-z0-9_-]*\.pdf$/.test(u.pathname)||/^\/system\/files\/221\/Tentative-Buyback-Schedule[A-Za-z0-9_-]*\.(?:xml|pdf)$/.test(u.pathname));}catch{return false;}}
function refundingAnchors(html){
 if(typeof html!=='string'||html.length>300000)throw Error('Invalid refunding index');
 const matches=[...html.matchAll(/<a\b[^>]*href\s*=\s*["']?([^\s"'>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi)];
 return matches.map((m,i)=>({url:new URL(m[1],REFUNDING_INDEX).href,label:refundingText(m[2]),following:refundingText(html.slice(m.index+m[0].length,matches[i+1]?.index??html.length))}));
}
function buybackPublications(anchors){
 const versions=anchors.filter(a=>/^Buyback Schedule:/.test(a.label)).map(a=>{
  const format=/^Buyback Schedule: (XML|PDF)(?: Format)?$/.exec(a.label),date=/^\((?:Last updated|Updated) on ([A-Z][a-z]+) (\d{1,2}), (\d{4})\)/i.exec(a.following);
  if(!format||!matchesRefundingDocumentUrl(a.url)||!/^\/system\/files\/221\/Tentative-Buyback-Schedule[A-Za-z0-9_-]*\.(?:xml|pdf)$/.test(new URL(a.url).pathname)||!new URL(a.url).pathname.endsWith('.'+format[1].toLowerCase()))throw Error('Unreviewed buyback publication');
  const documentDate=date?`${date[3]}-${String(isoMonth[date[1][0].toUpperCase()+date[1].slice(1).toLowerCase()]).padStart(2,'0')}-${date[2].padStart(2,'0')}`:null;
  if(date&&!validDate(documentDate)||!date&&a.following.startsWith('(')||[...a.following.matchAll(/\((?:Last updated|Updated) on /gi)].length>1)throw Error('Invalid buyback publication date');
  return{url:a.url,format:format[1].toLowerCase(),documentDate};
 });
 if(!versions.length||versions.length>8||new Set(versions.map(v=>v.url)).size!==versions.length||versions.length>1&&versions.some(v=>!v.documentDate))throw Error('Ambiguous buyback publication versions');
 return versions;
}
function latestBuybackPublication(versions){
 const sorted=[...versions].sort((a,b)=>(b.documentDate??'').localeCompare(a.documentDate??'')),latest=sorted.filter(v=>v.documentDate===sorted[0].documentDate);
 if(latest.length===1)return latest[0];
 // Same dated XML/PDF renditions of one named schedule prefer the native XML.
 if(latest.length===2&&new Set(latest.map(v=>v.format)).size===2&&latest[0].url.replace(/\.(xml|pdf)$/,'')===latest[1].url.replace(/\.(xml|pdf)$/,''))return latest.find(v=>v.format==='xml');
 throw Error('Ambiguous latest buyback publication');
}
export function refundingDocumentLinks(html,{legacyBuybacks=false}={}){
 const anchors=refundingAnchors(html),find=(label,path)=>{const found=anchors.filter(a=>label.test(a.label));if(found.length!==1||!matchesRefundingDocumentUrl(found[0].url)||!path.test(new URL(found[0].url).pathname))throw Error('Ambiguous or unreviewed official refunding document');return found[0].url;},versions=buybackPublications(anchors);
 const legacy=versions.filter(v=>v.format==='xml');if(legacyBuybacks&&legacy.length!==1)throw Error('Ambiguous captured XML publication');
 const links={borrowing:find(/^Financing Estimates:/,/^\/news\/press-releases\//),policy:find(/^Policy Statement:/,/^\/news\/press-releases\//),recommended:find(/^TBAC Recommended Financing Table/,/\/TBACRecommendedFinancingTableByRefundingQuarter[^/]*\.pdf$/),presentation:find(/^Treasury Presentation to TBAC/,/\/TreasuryPresentationToTBAC[^/]*\.pdf$/),buybacks:(legacyBuybacks?legacy[0]:latestBuybackPublication(versions)).url};
 if(new Set(Object.values(links)).size!==5)throw Error('Duplicate refunding document roles');return links;
}
export function refundingBuybackPublication(source){
 try{
  const versions=buybackPublications(refundingAnchors(source.documents.index)),latest=latestBuybackPublication(versions),receipts=source.provenance.filter(r=>versions.some(v=>v.url===r.url));
  if(receipts.length!==1)throw Error('Ambiguous captured buyback receipt');
  const captured=versions.find(v=>v.url===receipts[0].url);
  return{status:captured.url!==latest.url?'superseded':captured.documentDate?'latest-linked':'undated-capture',documentDate:captured.documentDate,latestDocumentDate:latest.documentDate,sourceUrl:captured.url,latestSourceUrl:latest.url};
 }catch{return{status:'undated-capture',documentDate:null,latestDocumentDate:null,sourceUrl:null,latestSourceUrl:null};}
}
export function parseTbacRecommendedGrid(grid,text){
 if(!grid||!Number.isFinite(grid.width)||!Number.isFinite(grid.height)||grid.width<300||grid.width>1500||grid.height<300||grid.height>1500||!Array.isArray(grid.cells)||grid.cells.length<100||grid.cells.length>1000)throw Error('Unreviewed TBAC PDF grid');
 const cells=grid.cells;for(const c of cells)if(Object.keys(c).sort().join(',')!=='text,width,x,y'||typeof c.text!=='string'||!c.text.trim()||c.text.length>1000||![c.x,c.y,c.width].every(Number.isFinite)||c.x<0||c.y<0||c.width<0||c.x+c.width>grid.width+1||c.y>grid.height)throw Error('Invalid TBAC PDF cell');
 if(cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim()!==text||!text.startsWith('TBAC RECOMMENDED US TREASURY FINANCING SCHEDULE FOR ')||!text.includes('* BILLIONS OF DOLLARS'))throw Error('TBAC PDF text/grid mismatch');
 const center=c=>c.x+c.width/2,years=cells.filter(c=>/^\d+-Year$/.test(c.text)).sort((a,b)=>a.x-b.x),kinds=['Notes','Notes','Notes','Notes','Notes','Bonds','Bonds','TIPS','TIPS','TIPS','FRN'];
 const labels=['2-Year','3-Year','5-Year','7-Year','10-Year','20-Year','30-Year','5-Year','10-Year','30-Year','2-Year'];
 if(years.length!==11||years.some((c,i)=>c.text!==labels[i]||Math.abs(c.y-years[0].y)>2||i&&center(c)-center(years[i-1])<25))throw Error('Unreviewed TBAC column header');
 for(const [i,c]of years.entries()){const below=cells.filter(n=>Math.abs(center(n)-center(c))<8&&c.y-n.y>5&&c.y-n.y<25&&n.text===kinds[i]);if(below.length!==1)throw Error('Unreviewed TBAC security header');}
 const roles=[['Historical Reference','historical reference'],['Recommendations for this Refunding','TBAC recommendation'],['Provisional Indications for Next Refunding','provisional TBAC indication']];
 const offsets=roles.map(([anchor])=>text.indexOf(anchor));if(offsets.some((n,i)=>n<0||i&&n<=offsets[i-1]))throw Error('Unreviewed TBAC row sections');
 const periods=cells.filter(c=>/^[A-Z][a-z]{2}-\d{2}$/.test(c.text));if(periods.length!==12)throw Error('Unreviewed TBAC row count');let previous=-1;const counts=[0,0,0];
 const rows=periods.map(p=>{const month=periodIndex(p.text);if(previous!==-1&&month!==previous+1)throw Error('Nonconsecutive TBAC months');previous=month;if(p.x>=years[0].x||p.y>=years[0].y-25)throw Error('Invalid TBAC row position');const native=cells.filter(c=>/^\d+(?:\.\d+)?$/.test(c.text)&&Math.abs(c.y-p.y)<2).sort((a,b)=>a.x-b.x),values=Array(11).fill(null);if(native.length<8||native.length>11)throw Error('Invalid TBAC row cells');for(const c of native){const distances=years.map(h=>Math.abs(center(h)-center(c))),i=distances.indexOf(Math.min(...distances));if(distances[i]>15||values[i]!==null||!Number.isFinite(Number(c.text)))throw Error('Unmapped or duplicate TBAC cell');values[i]=Number(c.text);}if(values.slice(0,7).some(v=>v===null)||values[10]===null)throw Error('Missing TBAC nominal/FRN cell');const at=text.indexOf(p.text),role=offsets.reduce((n,o,i)=>at>o?i:n,-1);if(role<0)throw Error('Missing TBAC row role');counts[role]++;return{period:p.text,values,sourceValue:[p.text,...native.map(c=>c.text)].join(' '),observationType:roles[role][1],unit:'USD billions'};});
 if(counts.join(',')!=='6,3,3')throw Error('Unreviewed TBAC section lengths');return rows;
}
const dated=(text,anchor)=>{const at=text.indexOf(anchor),m=/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/.exec(text.slice(at));if(at<0||!m)throw Error('Unreviewed refunding publication date');const d=`${m[3]}-${String(isoMonth[m[1]]).padStart(2,'0')}-${m[2].padStart(2,'0')}`;if(!validDate(d))throw Error('Invalid publication date');return d;};
const number=s=>{if(typeof s!=='string'||!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)||!Number.isFinite(Number(s.replaceAll(',',''))))throw Error('Invalid native refunding amount');return Number(s.replaceAll(',',''));};
function parseBuybackPdf(documents){
 const {buybacks:text,buybacksGrid:grid}=documents;
 if(!grid||grid.width!==612||grid.height!==792||!Array.isArray(grid.cells)||grid.cells.length<100||grid.cells.length>1000)throw Error('Unreviewed buyback PDF grid');
 const cells=grid.cells;
 for(const c of cells)if(Object.keys(c).sort().join(',')!=='text,width,x,y'||typeof c.text!=='string'||!c.text.trim()||c.text.length>1000||![c.x,c.y,c.width].every(Number.isFinite)||c.x<0||c.y<0||c.width<0||c.x+c.width>grid.width+1||c.y>grid.height)throw Error('Invalid buyback PDF cell');
 if(cells.map(c=>c.text).join(' ').replace(/\s+/g,' ').trim()!==text)throw Error('Buyback PDF text/grid mismatch');
 const title=cells.filter(c=>c.y>=690).map(c=>c.text).join(' '),quarter=/^Tentative Schedule of Treasury Buyback Operations ([A-Z][a-z]+) (\d{4}) Refunding Quarter For Publication ([A-Z][a-z]+ \d{1,2}, \d{4})$/.exec(title);
 if(!quarter||![2,5,8,11].includes(isoMonth[quarter[1]]))throw Error('Unreviewed buyback PDF title');
 const documentDate=dated(title,'For Publication'),publication=latestBuybackPublication(buybackPublications(refundingAnchors(documents.index)));
 if(publication.format!=='pdf'||publication.documentDate!==documentDate)throw Error('Mismatched buyback PDF publication');
 const bounds=[[40,95],[100,145],[150,212],[215,265],[268,335],[338,405],[410,458],[465,502],[508,570]],column=c=>bounds.findIndex(([lo,hi])=>c.x>=lo&&c.x+c.width<=hi);
 const header=['Announcement Date1','Operation Date2','Operation Time (ET)','Settlement Date','Operation Type','Security Type & Maturity Range','Maturity Date Range','Minimum Purchase Amount','Maximum Purchase Amount'];
 const headerCells=cells.filter(c=>c.y>650&&c.y<690);
 if(headerCells.some(c=>column(c)<0)||header.some((label,i)=>headerCells.filter(c=>column(c)===i).sort((a,b)=>b.y-a.y).map(c=>c.text).join(' ')!==label))throw Error('Unreviewed buyback PDF columns');
 const footnotes=cells.filter(c=>c.y<80).map(c=>c.text).join(' ').replace(/\s+/g,' ').trim();
 if(!/^1 A preliminary list of eligible CUSIPs will be disclosed at 11:00 am ET on the Announcement Date\. 2 The final list of eligible CUSIPs will be disclosed at 11:00 am ET on the Operation Date\.(?: \*Operation is scheduled within the [A-Z][a-z]+ \d{4} refunding quarter\.)?$/.test(footnotes))throw Error('Unreviewed buyback PDF footnotes');
 const nativeDate=s=>{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s),date=m?`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:null;if(!validDate(date))throw Error('Invalid native buyback date');return date;};
 const amount=s=>{const m=/^(= or > )?\$(\d+(?:\.\d+)?) (million|billion)$/.exec(s);if(!m)throw Error('Unreviewed native buyback maximum');const value=number(m[2])*(m[3]==='billion'?1e9:1e6);if(!Number.isSafeInteger(value)||value<=0)throw Error('Invalid native buyback maximum');return{maximumDollars:String(value),maximumBillions:value/1e9,maximumOperator:m[1]?'>=':'=',maximumSourceValue:s};};
 const body=cells.filter(c=>c.y>=80&&c.y<=650),anchors=body.filter(c=>column(c)===0).sort((a,b)=>b.y-a.y);
 if(anchors.length<1||anchors.length>100||body.some(c=>column(c)<0)||anchors.some((c,i)=>i&&anchors[i-1].y-c.y<20))throw Error('Unreviewed buyback PDF rows');
 const used=new Set(),keys=new Set();let previous='';
 const rows=anchors.map(anchor=>{
  const rowCells=body.filter(c=>Math.abs(c.y-anchor.y)<10),fields=bounds.map((_,i)=>rowCells.filter(c=>column(c)===i).sort((a,b)=>b.y-a.y||a.x-b.x).map(c=>c.text).join(' '));
  for(const c of rowCells){if(used.has(c))throw Error('Ambiguous buyback PDF row');used.add(c);}
  const [announcement,operation,time,settlement,purpose,bucket,maturity,minimum,maximum]=fields,prior=operation.endsWith('*'),date=nativeDate(operation.replace(/\*$/,'')),announcementDate=nativeDate(announcement),settlementDate=nativeDate(settlement),range=/^(\d{2}\/\d{2}\/\d{4}) - (\d{2}\/\d{2}\/\d{4})$/.exec(maturity),key=date+'|'+bucket;
  if(!/^1:40 pm –\s?2:00 pm$/.test(time)||!['Liquidity Support','Cash Management'].includes(purpose)||! /^(?:Nominal Coupons (?:\d+Mo|\d+Y)|TIPS \d+Y) to \d+Y$/.test(bucket)||!range||minimum!=='$0'||announcementDate>date||date>=settlementDate||date<previous||keys.has(key))throw Error('Invalid native buyback operation');
  const maturityStartDate=nativeDate(range[1]),maturityEndDate=nativeDate(range[2]);if(maturityStartDate<=settlementDate||maturityStartDate>=maturityEndDate)throw Error('Invalid buyback maturity range');
  previous=date;keys.add(key);
  return{date,announcementDate,settlementDate,bucket,purpose,...amount(maximum),minimumDollars:'0',maturityStartDate,maturityEndDate,quarterRole:prior?'previous refunding quarter':'stated refunding quarter',sourceValue:fields.join(' | '),observationType:'tentative operation schedule, not result'};
 });
 if(used.size!==body.length||rows.some(r=>r.quarterRole==='previous refunding quarter')!==footnotes.includes('*Operation'))throw Error('Unmapped buyback PDF content');
 const quarterStart=Number(quarter[2])*12+isoMonth[quarter[1]]-1,publicationMonth=Number(documentDate.slice(0,4))*12+Number(documentDate.slice(5,7))-1;
 const priorQuarter=new Date(Date.UTC(Number(quarter[2]),isoMonth[quarter[1]]-4,1)),priorQuarterName=Object.keys(isoMonth)[priorQuarter.getUTCMonth()]+' '+priorQuarter.getUTCFullYear();
 if(publicationMonth<quarterStart-1||publicationMonth>quarterStart+2||footnotes.includes('*Operation')&&!footnotes.endsWith(`*Operation is scheduled within the ${priorQuarterName} refunding quarter.`)||rows.some(r=>{const month=Number(r.date.slice(0,4))*12+Number(r.date.slice(5,7))-1;return r.quarterRole==='previous refunding quarter'?month!==quarterStart:month<quarterStart||month>quarterStart+3;}))throw Error('Mismatched buyback refunding quarter');
 return{calendarName:`${quarter[1]} ${quarter[2]} Refunding Tentative Buyback Calendar · published ${documentDate}`,startDate:rows[0].date,endDate:rows.at(-1).date,rows,documentDate,sourceFormat:'pdf',sourceUrl:publication.url,versionStatus:'latest-linked'};
}
export function parseRefundingDocuments(documents){
 const {borrowing,policy,recommended,survey,buybacks}=documents;if([borrowing,policy,recommended,survey,buybacks].some(t=>typeof t!=='string'||t.length>300000))throw Error('Invalid refunding documents');
 const borrowingDate=dated(borrowing,'Treasury Announces Marketable Borrowing Estimates'),policyDate=dated(policy,'Quarterly Refunding Statement');
 const estimates=[...borrowing.matchAll(/During the ([A-Za-z]+)[–-]([A-Za-z]+) (\d{4}) quarter, Treasury expects to borrow \$([\d,.]+) billion in privately-held net marketable debt, assuming an end-of-([A-Za-z]+) cash balance of \$([\d,.]+) billion/g)].map(m=>({period:`${m[1]}–${m[2]} ${m[3]}`,endDate:`${m[3]}-${String(isoMonth[m[2]]).padStart(2,'0')}-${String(new Date(Date.UTC(Number(m[3]),isoMonth[m[2]],0)).getUTCDate())}`,borrowing:number(m[4]),assumedCash:number(m[6]),sourceValues:[m[4],m[6]],observationType:'official-projection',unit:'USD billions'}));
 if(estimates.length!==2)throw Error('Unreviewed borrowing forecast structure');
 const forecastMatches=[...borrowing.matchAll(/During the ([A-Za-z]+)[–-]([A-Za-z]+) (\d{4}) quarter, Treasury expects to borrow \$([\d,.]+) billion in privately-held net marketable debt, assuming an end-of-([A-Za-z]+) cash balance of \$([\d,.]+) billion/g)];
 const quarterStarts=forecastMatches.map(m=>Number(m[3])*12+isoMonth[m[1]]-1);if(forecastMatches.some(m=>![1,4,7,10].includes(isoMonth[m[1]])||isoMonth[m[2]]!==isoMonth[m[1]]+2||m[5]!==m[2])||quarterStarts[1]!==quarterStarts[0]+3||estimates.some(r=>!validDate(r.endDate)||!Number.isFinite(r.borrowing)||!Number.isFinite(r.assumedCash)))throw Error('Invalid borrowing forecast horizons');
 const announcementMonth=Number(borrowingDate.slice(0,4))*12+Number(borrowingDate.slice(5,7))-1;if(announcementMonth<quarterStarts[0]||announcementMonth>quarterStarts[0]+2)throw Error('Mismatched borrowing forecast publication period');
 const offering=/offering \$([\d,.]+) billion of Treasury securities to refund approximately \$([\d,.]+) billion/.exec(policy),cash=/raise new cash from private investors of approximately \$([\d,.]+) billion/.exec(policy);if(!offering||!cash||Math.abs(number(offering[1])-number(offering[2])-number(cash[1]))>.100001)throw Error('Refunding package does not reconcile');
 const tenors=['2-Year','3-Year','5-Year','7-Year','10-Year','20-Year','30-Year','FRN'];
 const couponTable=[...policy.matchAll(/\b([A-Z][a-z]{2})-(\d{2}) ((?:\d+\s+){7}\d+)\b(?=\s+[A-Za-z])/g)].map(m=>({period:`${m[1]}-${m[2]}`,values:m[3].trim().split(/\s+/).map(number),sourceValue:m[0],unit:'USD billions'}));if(couponTable.length!==6)throw Error('Unreviewed Treasury coupon schedule');
 if(!policy.includes('2-Year 3-Year 5-Year 7-Year 10-Year 20-Year 30-Year FRN')||!policy.includes('in billions of dollars'))throw Error('Unreviewed coupon table units/header');
 for(let i=0;i<couponTable.length;i++){if(i&&periodIndex(couponTable[i].period)!==periodIndex(couponTable[i-1].period)+1)throw Error('Invalid coupon schedule months');couponTable[i].observationType=periodIndex(couponTable[i].period)<Number(policyDate.slice(0,4))*12+Number(policyDate.slice(5,7))-1?'historical auction size':'anticipated auction size';couponTable[i].status=couponTable[i].observationType;}
 if(couponTable.filter(r=>r.observationType==='historical auction size').length!==3)throw Error('Unreviewed coupon schedule horizons');
 const recommendations=parseTbacRecommendedGrid(documents.recommendedGrid,recommended);
 const surveyRows=[...survey.matchAll(/FY (\d{4}) (Deficit|Privately-Held Net Marketable Borrowing\*?) ([\d,]+) ([\d,]+) ([\d,]+)/g)].map(m=>({fiscalYear:Number(m[1]),measure:m[2].replace('*',''),p25:number(m[3]),median:number(m[4]),p75:number(m[5]),sourceValues:m.slice(3,6),unit:'USD billions',observationType:'officially published primary-dealer survey aggregate'}));if(surveyRows.length!==6||surveyRows.some(r=>r.p25>r.median||r.median>r.p75))throw Error('Unreviewed public dealer survey');
 const asOf=/Estimates as of: ([A-Z][a-z]{2}-\d{2})/.exec(survey),normalization=/normalized[^]*?assumed Fiscal Year (\d{4}) cash balance of \$([\d,]+) billion, held constant in out years/.exec(survey);if(!asOf||!normalization||!survey.includes('25th Median 75th')||!survey.includes('Primary Dealer'))throw Error('Unreviewed public survey labels');const month=periodIndex(asOf[1]);const fiscalYears=[...new Set(surveyRows.map(r=>r.fiscalYear))];if(fiscalYears.length!==3||fiscalYears.some((y,i)=>i&&y!==fiscalYears[i-1]+1)||surveyRows.some((r,i)=>r.measure!==(i<3?'Deficit':'Privately-Held Net Marketable Borrowing')||r.fiscalYear!==fiscalYears[i%3]))throw Error('Unreviewed fiscal survey horizons');
 if(documents.buybacksFormat!==undefined&&!['xml','pdf'].includes(documents.buybacksFormat)||documents.buybacksGrid&&documents.buybacksFormat!=='pdf')throw Error('Unreviewed buyback document format');
 let buybackTable;
 if(documents.buybacksFormat==='pdf')buybackTable=parseBuybackPdf(documents);
 else{
 const tag=(text,name)=>{const matches=[...text.matchAll(new RegExp(`<${name}>([^<]+)</${name}>`,'g'))];if(matches.length!==1)throw Error('Missing or duplicate buyback field');return matches[0][1];};
 if(/<!DOCTYPE|<!ENTITY|&[a-z#]/i.test(buybacks)||!/^\s*<BuyBackCalendar>[\s\S]*<\/BuyBackCalendar>\s*$/.test(buybacks))throw Error('Unreviewed buyback XML');
 const operations=[...buybacks.matchAll(/<BuybackCalendarDate>([\s\S]*?)<\/BuybackCalendarDate>/g)].map(m=>({date:tag(m[1],'OperationDate'),announcementDate:tag(m[1],'AnnouncementDate'),settlementDate:tag(m[1],'SettlementDate'),bucket:tag(m[1],'PurchaseBucketName'),purpose:tag(m[1],'OperationType'),maximumDollars:tag(m[1],'MaximumPurchaseAmountDollars'),maximumBillions:Number(tag(m[1],'MaximumPurchaseAmountDollars'))/1e9,observationType:'tentative operation schedule, not result'}));if(!operations.length||operations.length>100)throw Error('Unreviewed buyback operation count');
 const calendarName=tag(buybacks,'BuybackCalendarName'),startDate=tag(buybacks,'StartDate'),endDate=tag(buybacks,'EndDate');if(!/Tentative Buyback Calendar/.test(calendarName)||!validDate(startDate)||!validDate(endDate)||startDate>endDate)throw Error('Invalid tentative calendar');const keys=new Set();for(const r of operations){const key=r.date+'|'+r.bucket;if(keys.has(key)||![r.date,r.announcementDate,r.settlementDate].every(validDate)||r.announcementDate>r.date||r.date>=r.settlementDate||r.date<startDate||r.date>endDate||!/^\d+$/.test(r.maximumDollars)||!Number.isSafeInteger(Number(r.maximumDollars))||Number(r.maximumDollars)<=0||!['Liquidity Support','Cash Management'].includes(r.purpose))throw Error('Invalid tentative buyback operation');keys.add(key);}
 buybackTable={calendarName,startDate,endDate,rows:operations};
 if(documents.buybacksFormat==='xml'){const publication=latestBuybackPublication(buybackPublications(refundingAnchors(documents.index)));if(publication.format!=='xml')throw Error('Superseded newly captured XML');Object.assign(buybackTable,{documentDate:publication.documentDate,sourceFormat:'xml',sourceUrl:publication.url,versionStatus:publication.documentDate?'latest-linked':'undated-capture'});}
 }
 return {borrowingDate,policyDate,package:number(offering[1]),newCash:number(cash[1]),estimates,couponTable:{tenors,rows:couponTable},recommendations:{tenors:[...tenors.slice(0,7),'5-Year TIPS','10-Year TIPS','30-Year TIPS','FRN'],rows:recommendations},survey:{asOfMonth:`${Math.floor(month/12)}-${String(month%12+1).padStart(2,'0')}`,datePrecision:'month',normalizationFiscalYear:Number(normalization[1]),normalizationCash:number(normalization[2]),rows:surveyRows,note:'Published Treasury presentation, longer-term borrowing estimates, primary-dealer 25th/median/75th percentiles. Normalized to the presentation’s assumed year-end cash balance. Fiscal-year borrowing is not a quarterly forecast.'},buybacks:buybackTable};
}
export function validateRefundingDeskSource(source){try{
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 if(source?.id!=='treasuryRefunding'||!['ok','cached','error'].includes(source.status)||!Number.isFinite(Date.parse(source.fetchedAt))||!source.documents||!Array.isArray(source.provenance)||source.provenance.length!==6)return false;
 const links=refundingDocumentLinks(source.documents.index,{legacyBuybacks:source.documents.buybacksFormat===undefined}),urls=[REFUNDING_INDEX,...Object.values(links)],expected=parseRefundingDocuments(source.documents);
 if(JSON.stringify(canonical(expected))!==JSON.stringify(canonical(source.tables))||new Set(source.provenance.map(r=>r.url)).size!==6||source.provenance.some(r=>!urls.includes(r.url)||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isFinite(Date.parse(r.retrievedAt))||Date.parse(r.retrievedAt)>Date.parse(source.fetchedAt))||!source.provenance.some(r=>r.retrievedAt===source.fetchedAt)||expected.policyDate>source.fetchedAt.slice(0,10)||expected.borrowingDate>source.fetchedAt.slice(0,10)||expected.buybacks.documentDate&&expected.buybacks.documentDate>source.fetchedAt.slice(0,10))return false;
 if(buybackPublications(refundingAnchors(source.documents.index)).some(v=>v.documentDate&&v.documentDate>source.fetchedAt.slice(0,10))||expected.buybacks.documentDate&&expected.buybacks.documentDate>source.provenance.find(r=>r.url===links.buybacks).retrievedAt.slice(0,10))return false;
 const values=[expected.package,expected.newCash,expected.estimates[0].borrowing,expected.estimates[1].borrowing];
 return Object.keys(source.series??{}).length===4&&Object.entries(refundingDeskRegistry).every(([id,d],i)=>{const s=source.series[id],r=s?.observations?.[0];return s?.observations?.length===1&&s.unit===d.unit&&s.frequency===d.frequency&&s.adjustment===d.adjustment&&s.calculation===d.definition&&s.observationType===d.observationType&&JSON.stringify(s.sourceIds)===JSON.stringify([id])&&s.sourceUrl===(i<2?links.policy:links.borrowing)&&s.licenseUrl===REFUNDING_TERMS&&s.attribution==='Source: U.S. Department of the Treasury.'&&r.date===(i<2?expected.policyDate:expected.borrowingDate)&&r.value===values[i]&&r.sourceValue===String(values[i])&&r.publishedAt===null&&Object.keys(r).sort().join(',')==='date,publishedAt,sourceValue,value';});
 }catch{return false;}}
