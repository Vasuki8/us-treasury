import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,DEALER_METRICS,FUNDING_RATE_STARTS,fundingRateFootnotes} from '../src/market-functioning.js';
const start='2024-07-03';
const dealer='https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json';
const breaks='https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json';
const titles={sofr:'Secured Overnight Financing Rate Data',effr:'Effective Federal Funds Rate',sofrEffrSpread:'Secured Overnight Financing Rate Data; Effective Federal Funds Rate'};
const ratePath={sofr:'/api/rates/secured/sofr/search.json',effr:'/api/rates/unsecured/effr/search.json'};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const observationJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const marketPolicies=[{
 id:'nyfed-market-functioning',agency:'marketFunctioning',reviewedOn:'2026-10-26',commercialUse:true,
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
  return url.origin==='https://markets.newyorkfed.org'&&url.searchParams.size===2&&date(url.searchParams.get('endDate'))&&kinds.some(kind=>url.pathname===ratePath[kind]&&[start,FUNDING_RATE_STARTS[kind]].includes(url.searchParams.get('startDate'))&&url.searchParams.get('endDate')>=url.searchParams.get('startDate'));
 }catch{return false;}
}
export function assertMarketData(source){
 if(!source)return;
 // A first failed collector has no admitted observations or capture to inspect.
 if(!source.fetchedAt&&!Object.keys(source.series??{}).length)return;
 if(source.structuralBreak!=='SBN2024'||source.coverageStart!==start||!date(source.coverageEnd)||source.coverageEnd<start)throw new Error('Unreviewed market-functioning structural regime or coverage');
 const inputs=new Set((source.provenance??[]).map(row=>row.url));
 if(![dealer,breaks].every(url=>inputs.has(url))||inputs.size!==4||[...inputs].some(url=>!matchesMarketFeed(url,'nyfed-market'))||['sofr','effr'].some(kind=>[...inputs].filter(url=>matchesMarketFeed(url,`nyfed-${kind}`)).length!==1))throw new Error('Incomplete or unreviewed market-functioning response provenance');
 const rateInputs=Object.fromEntries(['sofr','effr'].map(id=>{
  const rows=new Map((source.fundingRates?.[id]??[]).map(row=>[row.date,row]));
  for(const row of source.series?.[id]?.observations??[]){
   if(rows.has(row.date)&&observationJson(rows.get(row.date))!==observationJson(row))throw new Error('Contradictory duplicate funding rate observations');
   rows.set(row.date,row);
  }
  return [id,rows];
 }));
 const checkRows=(id,rows,url)=>{
  const rate=['sofr','effr'].includes(id),queryStart=rate?new URL(url).searchParams.get('startDate'):id==='sofrEffrSpread'?[...inputs].filter(input=>input.includes('/api/rates/')).map(input=>new URL(input).searchParams.get('startDate')).sort().at(-1):start;
  let previous='';
  for(const row of rows??[]){
   if(Object.hasOwn(row,'sourceUrl')||Object.hasOwn(row,'sourceUrls'))throw new Error('Unreviewed per-observation funding or dealer source override');
   if(!date(row.date)||row.date<=previous||row.publishedAt!==null||row.date<queryStart||id==='sofrEffrSpread'&&row.date<FUNDING_RATE_STARTS.sofr||row.date>source.coverageEnd||row.suppressed===true&&row.value!==null||row.revisionIndicator!==undefined&&!['','Y','r'].includes(row.revisionIndicator))throw new Error('Invalid market observation timing, suppression or revision flag');
   previous=row.date;
   if(!rate){
    if(id==='sofrEffrSpread'){
     const notes=['sofr','effr'].flatMap(kind=>(rateInputs[kind].get(row.date)?.footnotes??[]).map(note=>`${kind.toUpperCase()}: ${note}`));
     if(JSON.stringify(row.footnotes??[])!==JSON.stringify(notes)||Object.hasOwn(row,'footnoteId')||Object.hasOwn(row,'percentileSourceValues'))throw new Error('Funding spread must retain the notes of its exact-date source inputs');
    }
    continue;
   }
   if(row.value!==null&&(typeof row.value!=='number'||!Number.isFinite(row.value)))throw new Error('Invalid funding rate value');
   for(const field of ['volumeInBillions','percentile1','percentile25','percentile75','percentile99'])if(row[field]!=null&&(typeof row[field]!=='number'||!Number.isFinite(row[field])||field==='volumeInBillions'&&row[field]<0))throw new Error('Invalid funding distribution statistic');
   const expected=fundingRateFootnotes(id.toUpperCase(),row.footnoteId,row.revisionIndicator);
   if((Object.hasOwn(row,'footnotes')||Object.hasOwn(row,'footnoteId')||queryStart===FUNDING_RATE_STARTS[id])&&JSON.stringify(row.footnotes??[])!==JSON.stringify(expected))throw new Error('Funding source footnote or revision meaning differs from the published definition');
   if([2,3].includes(row.footnoteId)&&['percentile1','percentile25','percentile75','percentile99'].some(field=>row[field]!=null)||row.footnoteId===3&&row.volumeInBillions!=null)throw new Error('Funding distribution statistics contradict the source contingency footnote');
   if(Object.hasOwn(row,'percentileSourceValues')){
    const raw=row.percentileSourceValues;
    if(id!=='sofr'||row.footnoteId!==2||!raw||Array.isArray(raw)||Object.keys(raw).length!==4||['percentile1','percentile25','percentile75','percentile99'].some(field=>raw[field]!=='NA'||row[field]!==null))throw new Error('Invalid published funding percentile missing markers');
   }
  }
 };
 for(const [id,item] of Object.entries(source.series??{})){
  const rate=Object.hasOwn(titles,id),title=rate?titles[id]:'Primary Dealer Statistics';
  const required=[NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE,...(rate?[NY_FED_REFERENCE_RATE_NOTICE]:[])];
  if(item.sourceTitle!==title||item.licenseUrl!==NY_FED_TERMS_URL||required.some(notice=>!item.sourceNotice?.includes(notice)))throw new Error('Required New York Fed title, copyright or redistribution notice missing');
  for(const url of [item.sourceUrl,...(item.sourceUrls??[])]){
   if(!inputs.has(url))throw new Error('Market-functioning input lacks captured provenance');
   if(url.includes('/api/rates/')&&new URL(url).searchParams.get('endDate')!==source.coverageEnd)throw new Error('Funding query and captured coverage differ');
  }
  if(['sofr','effr'].includes(id)&&(!matchesMarketFeed(item.sourceUrl,`nyfed-${id}`)||item.sourceUrls?.length))throw new Error('Funding rate must retain its own reviewed input');
  if(id==='sofrEffrSpread'&&(!Array.isArray(item.sourceUrls)||item.sourceUrls.length!==2||item.sourceUrl!==item.sourceUrls[0]||!matchesMarketFeed(item.sourceUrls[0],'nyfed-sofr')||!matchesMarketFeed(item.sourceUrls[1],'nyfed-effr')||item.observationType!=='calculated'||!item.calculation?.includes('Meridian')))throw new Error('Funding difference must retain distinct inputs and calculated labeling');
  checkRows(id,item.observations,item.sourceUrl);
 }
 for(const [id,rows]of Object.entries(source.fundingRates??{})){
  if(!['sofr','effr'].includes(id)||!Array.isArray(rows))throw new Error('Unreviewed supplemental funding rate series');
  checkRows(id,rows,[...inputs].find(url=>matchesMarketFeed(url,`nyfed-${id}`)));
 }
}
