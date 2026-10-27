import {creditContextRegistry,BOARD_TERMS_URL} from '../src/credit-context-registry.js';
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';
const reviewedOn='2026-10-22';
const files={
  householdDebt:{feed:'board-dsr-current',url:'https://www.federalreserve.gov/releases/dsr/data/FRB_dsr_xml.zip',filename:'DSR_data.xml',title:'Household Debt Service Ratios',kind:'ratio',start:'2005-01-01',methodology:'credit-bureau-2024',ids:{householdDebtService:['DSR_RATIO'],mortgageDebtService:['MORTGAGE_DSR_RATIO'],consumerDebtService:['CONSUMER_DSR_RATIO']}},
  loanDelinquency:{feed:'board-consumer-delinquency',url:'https://www.federalreserve.gov/releases/chgdel/data/FRB_CHGDEL_xml.zip',filename:'CHGDEL_data.xml',title:'Charge-Off and Delinquency Rates on Loans and Leases at Commercial Banks',kind:'ratio',start:'1991-01-01',ids:{bankCardDelinquency:['STFBQDCC%STFBAILCC_XEOP_MA.Q'],bankMortgageDelinquency:['STFBQDSS%STFBAILSS_XEOP_XDO_MA.Q']}},
  bankCredit:{feed:'board-h8-credit',url:'https://www.federalreserve.gov/releases/h8/data/FRB_h8_xml.zip',filename:'H8_data.xml',title:'H.8 Assets and Liabilities of Commercial Banks in the United States',start:'1990-01-01',ids:{bankLoans:['B1020NCBA'],bankDeposits:['B1058NCBA']}},
  lendingSurvey:{feed:'board-sloos-credit',url:'https://www.federalreserve.gov/releases/sloos/data/FRB_SLOOS_xml.zip',filename:'SLOOS_data.xml',title:'Senior Loan Officer Opinion Survey on Bank Lending Practices',start:'1990-01-01',ids:{ciDemandLarge:['SUBLPDCILD_N.Q'],ciStandardsLarge:['SUBLPDCILS_N.Q'],ciDemandSmall:['SUBLPDCISD_N.Q'],ciStandardsSmall:['SUBLPDCISS_N.Q']}},
  fedBalance:{feed:'board-h41-context',url:'https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip',filename:'H41_data.xml',title:'Factors Affecting Reserve Balances (H.4.1)',ids:{reserveBalances:['RESH4R_N.WW'],tgaBalance:['RESPPLLDT_N.WW'],fedAssets:['RESPPMA_N.WW']}},
};
const rrpFeed='nyfed-onrrp',rrpCode='RRP:regular-overnight:totalAmtAccepted';
const fail=message=>{throw new Error(`Unreviewed credit context: ${message}`);};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export const creditContextPolicies=[...Object.entries(files).map(([agency,spec])=>({id:spec.feed,agency,reviewedOn,commercialUse:true,basis:'Board-authored public-domain statistical fields only, with exact program identity, attribution, native reporting basis, source dates and calculation labels. Excludes logos, marks, imagery and third-party material.',terms:[BOARD_TERMS_URL],feed:spec.feed,series:spec.ids})),{
  id:'nyfed-regular-onrrp',agency:'onRrp',reviewedOn,commercialUse:true,basis:'Conditional business copying and redistribution under New York Fed Terms of Use. Original Reverse Repo Operations title, copyright, source/terms links, downstream same-conditions notice and no-endorsement notice retained. Regular accepted operation amounts only; no liability-stock or net-liquidity equivalence.',terms:[NY_FED_TERMS_URL],feed:rrpFeed,series:{onRrpAccepted:[rrpCode]},
}];

export function matchesCreditContextFeed(value,feed){
  try{
    const url=new URL(value);if(url.username||url.password||url.hash)return false;
    const file=Object.values(files).find(row=>row.feed===feed);
    if(file)return url.href===file.url;
    if(feed!==rrpFeed)return false;
    return url.origin==='https://markets.newyorkfed.org'&&url.pathname==='/api/rp/results/search.json'&&url.searchParams.size===6&&url.searchParams.get('startDate')==='2024-01-01'&&date(url.searchParams.get('endDate'))&&url.searchParams.get('endDate')>='2024-01-01'&&url.searchParams.get('operationTypes')==='Reverse Repo'&&url.searchParams.get('method')==='fixed'&&url.searchParams.get('securityType')==='tsy'&&url.searchParams.get('term')==='overnight';
  }catch{return false;}
}

export function assertCreditContextData(snapshot){
  for(const [agency,source]of Object.entries(snapshot.sources??{})){
    const policy=creditContextPolicies.find(row=>row.agency===agency);if(!policy)continue;
    const entries=Object.entries(source.series??{});
    if(!entries.length&&!source.fetchedAt)continue;
    if(entries.length!==Object.keys(policy.series).length||entries.some(([id])=>!Object.hasOwn(policy.series,id)))fail(`${agency} series scope`);
    if(!Number.isFinite(Date.parse(source.fetchedAt))||source.provenance?.length!==1)fail(`${agency} missing capture provenance`);
    const provenance=source.provenance[0],spec=files[agency];
    if(spec?.methodology&&source.methodology!==spec.methodology)fail(`${agency} methodology`);
    if(!matchesCreditContextFeed(provenance.url,policy.feed)||!/^[a-f0-9]{64}$/.test(provenance.sha256)||!Number.isFinite(Date.parse(provenance.retrievedAt))||spec&&provenance.filename!==spec.filename)fail(`${agency} response provenance`);
    for(const [id,item]of entries){
      const definition=creditContextRegistry[id],expected=policy.series[id];
      if(item.sourceIds?.length!==expected.length||item.sourceIds.some((code,i)=>code!==expected[i])||!matchesCreditContextFeed(item.sourceUrl,policy.feed)||item.sourceUrl!==provenance.url||item.sourceUrls?.length)fail(`${agency}/${id} identifier or source override`);
      if(item.unit!==definition.unit||item.frequency!==definition.frequency||item.adjustment!==definition.adjustment||item.observationType!=='official')fail(`${agency}/${id} measurement metadata`);
      if(spec){
        if(item.sourceTitle!==spec.title||item.licenseUrl!==BOARD_TERMS_URL||item.attribution!==`Source: Board of Governors of the Federal Reserve System, ${spec.title}.`||item.sourceNotice||item.redistributionNotice)fail(`${agency}/${id} Board attribution or source terms`);
      }else{
        const year=new Date(source.fetchedAt).getUTCFullYear();
        if(item.sourceTitle!=='Reverse Repo Operations'||item.licenseUrl!==NY_FED_TERMS_URL||item.attribution!=='Source: Federal Reserve Bank of New York, Reverse Repo Operations.'||![NY_FED_DATA_NOTICE.replace('2026',String(year)),NY_FED_PRODUCT_NOTICE].every(notice=>item.sourceNotice?.includes(notice)))fail('ON RRP required redistribution notices');
        if(source.coverageStart!=='2024-01-01'||!date(source.coverageEnd)||new URL(item.sourceUrl).searchParams.get('endDate')!==source.coverageEnd)fail('ON RRP coverage');
      }
      let previous='';
      if(!Array.isArray(item.observations)||!item.observations.length)fail(`${agency}/${id} missing observations`);
      for(const row of item.observations){
        if(!date(row.date)||row.date<=previous||row.date<(spec?.start??(agency==='onRrp'?'2024-01-01':'2000-01-01'))||row.date>source.fetchedAt.slice(0,10)||row.publishedAt!==null||Object.hasOwn(row,'sourceUrl')||Object.hasOwn(row,'sourceUrls'))fail(`${agency}/${id} observation date, clock or source override`);
        previous=row.date;
        if(row.value!==null&&(typeof row.value!=='number'||!Number.isFinite(row.value)))fail(`${agency}/${id} numeric amount`);
        if(spec?.kind==='ratio'){
          if(!/^\d{4}-(?:03-31|06-30|09-30|12-31)$/.test(row.date)||!/^\d+(?:\.\d+)?$/.test(row.sourceValue)||row.value!==Number(row.sourceValue)||row.value<0||agency==='loanDelinquency'&&row.value>100)fail(`${agency} source quarter or published ratio`);
        }else if(agency==='lendingSurvey'){
          const modern=item.dateConvention==='source-quarter-start-label';
          if(modern){
            if(!date(row.sourcePeriodLabel)||!/^\d{4}-(?:03-31|06-30|09-30|12-31)$/.test(row.sourcePeriodLabel)||row.date!==`${row.sourcePeriodLabel.slice(0,4)}-${String(Number(row.sourcePeriodLabel.slice(5,7))-2).padStart(2,'0')}-01`)fail('SLOOS source quarter label and canonical date mismatch');
          }else if(![undefined,'source-quarter-end-label'].includes(item.dateConvention)||Object.hasOwn(row,'sourcePeriodLabel')||!/^\d{4}-(?:03-31|06-30|09-30|12-31)$/.test(row.date))fail('SLOOS legacy source quarter label');
          if(typeof row.sourceValue!=='string'||!/^[+-]?\d+(?:\.\d+)?$/.test(row.sourceValue)||row.value!==Number(row.sourceValue)||Math.abs(row.value)>100)fail('SLOOS source quarter label or net percentage');
        }else if(agency==='onRrp'){
          const days=(Date.parse(row.maturityDate+'T00:00:00Z')-Date.parse(row.settlementDate+'T00:00:00Z'))/86400000;
          if(!row.operationId||row.settlementDate!==row.date||!date(row.maturityDate)||days!==row.termCalendarDays||days<1||days>7||!['12:44','12:45'].includes(row.operationReleaseTime)||row.operationCloseTime!=='13:15'||row.date>source.coverageEnd)fail('ON RRP operation metadata');
          if(row.value!==null&&(!/^\d+$/.test(row.sourceValue)||!Number.isSafeInteger(Number(row.sourceValue))||row.value!==Number(row.sourceValue)/1e9))fail('ON RRP dollar conversion');
          if(row.value===null&&row.sourceValue!=='null')fail('ON RRP missing source amount');
        }else if(new Date(row.date+'T00:00:00Z').getUTCDay()!==3||!/^\d+(?:\.\d+)?$/.test(row.sourceValue)||row.value!==Number((Number(row.sourceValue)/1000).toFixed(10)))fail('Board Wednesday stock or amount conversion');
      }
    }
  }
}

export const fomcCalendarPolicy={reviewedOn,commercialUse:true,basis:'Board public-domain factual FOMC meeting dates and dated official decision/minutes/projection references with Board attribution; day precision only. Calendar references are not captured document contents or numeric forecasts.',terms:[BOARD_TERMS_URL],programs:{'fomc-decision':['policyTargetUpper','policyTargetLower'],'fomc-minutes':['policyTargetUpper','policyTargetLower']}};
export const matchesFomcCalendarFeed=value=>value==='https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
export function assertFomcCalendarData(source){
  if(!source)return;
  const records=source.events??[],provenance=source.provenance??[];
  if(!source.fetchedAt&&!records.length)return;
  if(provenance.length!==1||!matchesFomcCalendarFeed(provenance[0].url)||!/^[a-f0-9]{64}$/.test(provenance[0].sha256))fail('FOMC source provenance');
  const seen=new Set();
  for(const row of records){
    if(seen.has(row.id)||!Object.hasOwn(fomcCalendarPolicy.programs,row.program)||row.sourceId!=='fomc'||row.id!==`${row.program}-${row.date}`||!date(row.date)||row.time!==null||row.scheduledAt!==null||row.datePrecision!=='day'||row.scheduleBasis!=='listed-date'||row.sourceUrl!==provenance[0].url||row.seriesId!=='policyTargetUpper'||JSON.stringify(row.seriesIds)!==JSON.stringify(['policyTargetUpper','policyTargetLower'])||['actual','publishedAt','consensus','forecast'].some(key=>Object.hasOwn(row,key)))fail('FOMC date precision, clock or program scope');
    seen.add(row.id);
    if(row.program==='fomc-decision'&&(row.meetingDate!==row.date||!date(row.meetingStartDate)||row.meetingStartDate>row.date||typeof row.projectionsAssociated!=='boolean'))fail('FOMC meeting date or projections association');
    if(row.program==='fomc-minutes'&&(!date(row.meetingDate)||row.date<row.meetingDate||!source.documents?.some(item=>item.kind==='minutes'&&item.meetingDate===row.meetingDate&&item.documentDate===row.date&&item.url===row.documentUrl)))fail('FOMC explicit minutes reference');
  }
  const docs=new Set();
  for(const row of source.documents??[]){
    const key=`${row.kind}/${row.meetingDate}`,code=row.meetingDate?.replaceAll('-',''),paths={decision:`/newsevents/pressreleases/monetary${code}a.htm`,minutes:`/monetarypolicy/fomcminutes${code}.htm`,projections:`/monetarypolicy/fomcprojtabl${code}.htm`};
    if(!Object.hasOwn(paths,row.kind)||docs.has(key)||!date(row.meetingDate)||!date(row.documentDate)||row.url!==`https://www.federalreserve.gov${paths[row.kind]}`||row.sourceUrl!==provenance[0].url||row.datePrecision!=='day'||!records.some(event=>event.program==='fomc-decision'&&event.date===row.meetingDate))fail('FOMC document scope, source or date');
    if(row.kind!=='minutes'&&row.documentDate!==row.meetingDate||row.kind==='minutes'&&row.documentDate<row.meetingDate||row.kind==='projections'&&!records.some(event=>event.program==='fomc-decision'&&event.date===row.meetingDate&&event.projectionsAssociated===true))fail('FOMC document date or associated projections meeting');
    docs.add(key);
  }
}
