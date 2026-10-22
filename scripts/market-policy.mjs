import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,DEALER_METRICS} from '../src/market-functioning.js';
const start='2024-07-03';
const dealer='https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json';
const breaks='https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json';
const titles={sofr:'Secured Overnight Financing Rate Data',effr:'Effective Federal Funds Rate',sofrEffrSpread:'Secured Overnight Financing Rate Data; Effective Federal Funds Rate'};
const ratePath={sofr:'/api/rates/secured/sofr/search.json',effr:'/api/rates/unsecured/effr/search.json'};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export const marketPolicies=[{
 id:'nyfed-market-functioning',agency:'marketFunctioning',reviewedOn:'2026-10-21',commercialUse:true,
 basis:'Dataset-specific conditional business redistribution under New York Fed Terms of Use, retaining original titles, copyright, source links, rate disclaimers, downstream conditions and Meridian calculation labels',terms:[NY_FED_TERMS_URL],feed:'nyfed-market',
 seriesFeeds:{...Object.fromEntries(Object.keys(DEALER_METRICS).map(id=>[id,'nyfed-dealers'])),sofr:'nyfed-sofr',effr:'nyfed-effr',sofrEffrSpread:'nyfed-sofr'},
 series:{...Object.fromEntries(Object.entries(DEALER_METRICS).map(([id,value])=>[id,[value.key]])),sofr:['SOFR:percentRate'],effr:['EFFR:percentRate'],sofrEffrSpread:['SOFR:percentRate','EFFR:percentRate']},
}];
export function matchesMarketFeed(value,feed){
 try{
  const url=new URL(value);if(url.username||url.password||url.hash)return false;
  if(feed==='nyfed-dealers')return url.href===dealer;
  if(!['nyfed-market','nyfed-sofr','nyfed-effr'].includes(feed))return false;
  if(feed==='nyfed-market'&&[dealer,breaks].includes(url.href))return true;
  const kinds=feed==='nyfed-sofr'?['sofr']:feed==='nyfed-effr'?['effr']:['sofr','effr'];
  return url.origin==='https://markets.newyorkfed.org'&&kinds.some(kind=>url.pathname===ratePath[kind])&&url.searchParams.size===2&&url.searchParams.get('startDate')===start&&date(url.searchParams.get('endDate'))&&url.searchParams.get('endDate')>=start;
 }catch{return false;}
}
export function assertMarketData(source){
 if(!source)return;
 // A first failed collector has no admitted observations or capture to inspect.
 if(!source.fetchedAt&&!Object.keys(source.series??{}).length)return;
 if(source.structuralBreak!=='SBN2024'||source.coverageStart!==start||!date(source.coverageEnd))throw new Error('Unreviewed market-functioning structural regime or coverage');
 const inputs=new Set((source.provenance??[]).map(row=>row.url));
 if(![dealer,breaks].every(url=>inputs.has(url))||inputs.size!==4)throw new Error('Incomplete market-functioning response provenance');
 for(const [id,item] of Object.entries(source.series??{})){
  const rate=Object.hasOwn(titles,id),title=rate?titles[id]:'Primary Dealer Statistics';
  const required=[NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE,...(rate?[NY_FED_REFERENCE_RATE_NOTICE]:[])];
  if(item.sourceTitle!==title||item.licenseUrl!==NY_FED_TERMS_URL||required.some(notice=>!item.sourceNotice?.includes(notice)))throw new Error('Required New York Fed title, copyright or redistribution notice missing');
  for(const url of [item.sourceUrl,...(item.sourceUrls??[])]){
   if(!inputs.has(url))throw new Error('Market-functioning input lacks captured provenance');
   if(url.includes('/api/rates/')&&new URL(url).searchParams.get('endDate')!==source.coverageEnd)throw new Error('Funding query and captured coverage differ');
  }
  if(id==='sofrEffrSpread'&&(!Array.isArray(item.sourceUrls)||item.sourceUrls.length!==2||!matchesMarketFeed(item.sourceUrls[0],'nyfed-sofr')||!matchesMarketFeed(item.sourceUrls[1],'nyfed-effr')||item.observationType!=='calculated'||!item.calculation?.includes('Meridian')))throw new Error('Funding difference must retain distinct inputs and calculated labeling');
  for(const row of item.observations??[]){
   if(Object.hasOwn(row,'sourceUrl')||Object.hasOwn(row,'sourceUrls'))throw new Error('Unreviewed per-observation funding or dealer source override');
   if(row.publishedAt!==null||row.date<start||row.date>source.coverageEnd||row.suppressed===true&&row.value!==null||row.revisionIndicator!==undefined&&!['','Y'].includes(row.revisionIndicator))throw new Error('Invalid market observation timing, suppression or revision flag');
  }
 }
}
