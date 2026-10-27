import {requestBytes,requestText} from './http.mjs';
import {extractZipEntry} from './zip.mjs';
import {easternFields,decodeHtmlText} from './calendar-utils.mjs';
import {creditContextRegistry,BOARD_TERMS_URL,CREDIT_CONTEXT_LIMITATION} from '../../src/credit-context-registry.js';
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE} from '../../src/market-functioning.js';

export const H8_URL='https://www.federalreserve.gov/releases/h8/data/FRB_h8_xml.zip';
export const H41_URL='https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip';
export const SLOOS_URL='https://www.federalreserve.gov/releases/sloos/data/FRB_SLOOS_xml.zip';
export const DSR_URL='https://www.federalreserve.gov/releases/dsr/data/FRB_dsr_xml.zip';
export const DELINQUENCY_URL='https://www.federalreserve.gov/releases/chgdel/data/FRB_CHGDEL_xml.zip';
export const ON_RRP_ENDPOINT='https://markets.newyorkfed.org/api/rp/results/search.json';
export const ON_RRP_START='2024-01-01';
const fail=message=>{throw new Error(`Invalid Board credit/funding XML: ${message}`);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const endDate=now=>{if(!(now instanceof Date)||!finite(now.getTime()))fail('capture date');return easternFields(now.toISOString()).date;};
function dateKey(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!finite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('observation date');return value;}
function attributes(text){
  const result={};
  const residue=text.replace(/([A-Z][A-Z0-9_]*)="([^"<>]*)"/g,(_all,key,value)=>{if(Object.hasOwn(result,key))fail('duplicate metadata attribute');result[key]=value;return '';});
  if(residue.trim())fail('malformed XML metadata attribute');
  return result;
}
const specs={
  householdDebt:{id:'DSR',url:DSR_URL,member:'DSR_data.xml',title:'Household Debt Service Ratios',kind:'ratio',start:'2005-01-01',inception:'2005-01-01',methodology:'credit-bureau-2024',ids:Object.fromEntries([['householdDebtService','DSR_RATIO'],['mortgageDebtService','MORTGAGE_DSR_RATIO'],['consumerDebtService','CONSUMER_DSR_RATIO']].map(([id,code])=>[id,{CURRENCY:'NA',DEBT:'TOTAL',FREQ:'162',SERIES_NAME:code,TYPE:'DSR',UNIT:'Percent',UNIT_MULT:'1'}])),descriptions:{householdDebtService:'Debt service ratio, seasonally adjusted',mortgageDebtService:'Mortgage debt service ratio, seasonally adjusted',consumerDebtService:'Consumer debt service ratio, seasonally adjusted'},note:'Current credit-bureau methodology, quarterly SA aggregate required debt payments / disposable personal income from 2005. Mortgage payments include escrow when bundled. Published total and components are retained at source precision. No splice to the discontinued old DSR or Financial Obligations Ratio; not the median household payment burden or a delinquency/default rate.'},
  loanDelinquency:{id:'CHGDEL',url:DELINQUENCY_URL,member:'CHGDEL_data.xml',title:'Charge-Off and Delinquency Rates on Loans and Leases at Commercial Banks',kind:'ratio',max:100,start:'1991-01-01',ids:Object.fromEntries([['bankCardDelinquency','CONCC','STFBQDCC%STFBAILCC_XEOP_MA.Q'],['bankMortgageDelinquency','RERES','STFBQDSS%STFBAILSS_XEOP_XDO_MA.Q']].map(([id,loan,code])=>[id,{CHGDEL:'DEL',COMPONENT:'RATIO',CURRENCY:'NA',FREQ:'162',LOANTYPE:loan,SA:'SA',SERIES_NAME:code,SIZE:'ALL',UNIT:'Percentage',UNIT_MULT:'1'}])),note:'Quarterly SA delinquency ratios from 1991 at insured U.S.-chartered commercial banks. Delinquent loan dollars are thirty days or more past due and still accruing, plus nonaccrual; percent of matching end-of-quarter loans, not borrower counts. Residential is domestic-office one-to-four-family lending including home-equity lines. Not charge-off flows, all lenders or all household debts; accounting, classification and seasonal revisions may affect history, including Board adjustments for pre-2001 small-bank loan classifications.'},
  bankCredit:{id:'H8',url:H8_URL,member:'H8_data.xml',title:'H.8 Assets and Liabilities of Commercial Banks in the United States',start:'1990-01-01',ids:{
    bankLoans:{BG:'CB',CATEGORY:'A',CURRENCY:'USD',FREQ:'19',H8_UNITS:'LEVEL',ITEM:'1020',SA:'SA',SERIES_NAME:'B1020NCBA',UNIT:'Currency',UNIT_MULT:'1000000'},
    bankDeposits:{BG:'CB',CATEGORY:'L',CURRENCY:'USD',FREQ:'19',H8_UNITS:'LEVEL',ITEM:'1058',SA:'SA',SERIES_NAME:'B1058NCBA',UNIT:'Currency',UNIT_MULT:'1000000'},
  },note:'Latest revised H.8 estimated all-commercial-bank Wednesday stocks from 1990. Benchmarking, seasonal revisions, nonbank structure changes and accounting breaks can affect levels. Published break-adjusted growth rates are different measurements and are not recomputed here.'},
  lendingSurvey:{id:'SLOOS',url:SLOOS_URL,member:'SLOOS_data.xml',title:'Senior Loan Officer Opinion Survey on Bank Lending Practices',start:'1990-01-01',ids:Object.fromEntries([
    ['ciDemandLarge','CILG','DEMAND','SUBLPDCILD_N.Q'],['ciStandardsLarge','CILG','STND','SUBLPDCILS_N.Q'],['ciDemandSmall','CISM','DEMAND','SUBLPDCISD_N.Q'],['ciStandardsSmall','CISM','STND','SUBLPDCISS_N.Q'],
  ].map(([id,loan,measure,code])=>[id,{BANKSIZE:'ALL',CURRENCY:'NA',FREQ:'162',LOANTYPE:loan,MEASURE:measure,PANEL:'DOM',SERIES_NAME:code,TERMS:'NA',UNIT:'Percentage',UNIT_MULT:'1'}])),note:'Latest published SLOOS domestic-bank C&I net response percentages, with native standards history from 1990 and demand history from 1991. Quarter-start dates are canonical survey-round labels for ordering/filtering; the original quarter-end source label is retained as sourcePeriodLabel, even if later than retrieval. Neither date is an actual survey or publication date or a full-quarter measurement. Survey timing, response panels and questions matter; percentages are not weighted loan growth.'},
  fedBalance:{id:'H41',url:H41_URL,member:'H41_data.xml',title:'Factors Affecting Reserve Balances (H.4.1)',start:'2000-01-01',ids:Object.fromEntries([
    ['fedAssets','RESPPMA_N.WW','ASSET','TA','TA','TOTC'],['reserveBalances','RESH4R_N.WW','LIABCAP','OFDRB','RBFRB','TOT'],['tgaBalance','RESPPLLDT_N.WW','LIABCAP','LIAB','DEPUSTG','TOT'],
  ].map(([id,code,category,subcategory,component,distribution])=>[id,{SERIES_NAME:code,FREQ:'19',CATEGORY:category,SUBCATEGORY:subcategory,COMPONENT:component,DISTRIBUTION:distribution,SERIESTYPE:'L',UNIT:'Currency',UNIT_MULT:'1000000',CURRENCY:'USD'}])),note:'Latest revised H.4.1 Wednesday stocks. Total assets are consolidated, less eliminations. Reserve balances and TGA are distinct Federal Reserve liabilities. Weekly averages, district totals and changes are excluded. No asset-minus-liability liquidity proxy is calculated.'},
};

/** Read only exact reviewed SDMX series, metadata and actual source dates. */
function parseBoardXml(input,provider,{now=new Date()}={}){
  const spec=specs[provider],cutoff=endDate(now);
  if(typeof input!=='string'||Buffer.byteLength(input)>192*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(input))fail('XML framing or byte limit');
  const text=input.replace(/<!--([^]*?)-->/g,(_comment,body)=>{if(body.includes('--'))fail('malformed XML comment');return '';});
  if(/<!--|-->/.test(text)||!text.includes(`<message:ID>${spec.id}</message:ID>`)||!/<\/message:MessageGroup>\s*$/.test(text))fail('XML program framing');
  const selected=new Map();
  for(const match of text.matchAll(/<kf:Series\b([^>]*)>([^]*?)<\/kf:Series>/g)){
    const metadata=attributes(match[1]);
    const entry=Object.entries(spec.ids).find(([,expected])=>expected.SERIES_NAME===metadata.SERIES_NAME);
    if(!entry)continue;
    const [id,expected]=entry;
    if(selected.has(id))fail('duplicate selected series');
    if(Object.keys(metadata).length!==Object.keys(expected).length||Object.entries(expected).some(([key,value])=>metadata[key]!==value))fail(`unreviewed metadata for ${id}`);
    const observations=[],seen=new Set(),survey=provider==='lendingSurvey',ratio=spec.kind==='ratio',quarterly=survey||ratio;
    if(spec.descriptions&&decodeHtmlText(match[2].match(/<common:AnnotationType>Short Description<\/common:AnnotationType>\s*<common:AnnotationText>([^]*?)<\/common:AnnotationText>/)?.[1]??'')!==spec.descriptions[id])fail('unreviewed ratio adjustment or description');
    for(const tag of match[2].match(/<frb:Obs\b[^>]*>/g)??[]){
      if(!tag.endsWith('/>'))fail('malformed observation');
      const row=attributes(tag.replace(/^<frb:Obs\b/,'').replace(/\/>$/,'')),date=dateKey(row.TIME_PERIOD);
      if(seen.has(date))fail('duplicate observation date');seen.add(date);
      if(Object.keys(row).length!==3||row.OBS_STATUS!=='A'||!(/^[+-]?\d+(?:\.\d+)?$/).test(row.OBS_VALUE??''))fail('numeric value or observation status');
      const amount=Number(row.OBS_VALUE);
      if(!finite(amount)||(survey?Math.abs(amount)>100:amount<0)||spec.max&&amount>spec.max)fail('numeric amount or percentage');
      if(quarterly?!/^(?:\d{4}-(?:03-31|06-30|09-30|12-31))$/.test(date):new Date(date+'T00:00:00Z').getUTCDay()!==3)fail('quarter label or Wednesday observation date');
      if(spec.inception&&date<spec.inception)fail('observation predates current-methodology inception');
      // SLOOS quarter-end dates label survey rounds; they can be later than
      // retrieval even when that round is already released. Use a quarter-start
      // label for ordering/filtering, retaining the exact source label separately.
      const observationDate=survey?`${date.slice(0,4)}-${String(Number(date.slice(5,7))-2).padStart(2,'0')}-01`:date;
      if(observationDate>=spec.start&&observationDate<=cutoff)observations.push({date:observationDate,value:quarterly?amount:Number((amount/1000).toFixed(10)),sourceValue:row.OBS_VALUE,publishedAt:null,...(survey?{sourcePeriodLabel:date}:{})});
    }
    observations.sort((a,b)=>a.date.localeCompare(b.date));
    if(!observations.length)fail(`missing usable ${id} observations`);
    const definition=creditContextRegistry[id];
    selected.set(id,{observations,sourceIds:[expected.SERIES_NAME],sourceUrl:spec.url,sourceTitle:spec.title,unit:definition.unit,frequency:definition.frequency,adjustment:definition.adjustment,...(survey?{dateConvention:'source-quarter-start-label'}:{}),measure:survey?'Net percentage of domestic-bank respondents':ratio?'Published quarterly aggregate ratio':provider==='fedBalance'?'Wednesday balance-sheet stock':'Wednesday estimated bank balance-sheet stock',calculation:survey?'Published net percentage; source quarter-end TIME_PERIOD retained as sourcePeriodLabel and represented by its quarter-start date for ordering/filtering. Both dates label the survey round, not actual survey or publication dates. No rescaling, interpolation or loan-volume weighting.':ratio?'Published quarterly ratio in percent at source precision; not recomputed, annualized, interpolated or ratio-indexed.':'Published USD millions divided by 1000 for USD billions; no interpolation.',observationType:'official',dataStatus:'official',licenseUrl:BOARD_TERMS_URL,attribution:`Source: Board of Governors of the Federal Reserve System, ${spec.title}.`,coverageNote:spec.note,publicationNote:'The XML prepared time is file metadata, not a verified publication instant. Historical publication timestamps are unavailable; retrieval is recorded separately.'});
  }
  if(selected.size!==Object.keys(spec.ids).length)fail('missing reviewed series');
  return Object.fromEntries(selected);
}
export const parseBankCreditXml=(input,options)=>parseBoardXml(input,'bankCredit',options);
export const parseLendingSurveyXml=(input,options)=>parseBoardXml(input,'lendingSurvey',options);
export const parseFedBalanceXml=(input,options)=>parseBoardXml(input,'fedBalance',options);
export const parseHouseholdDebtXml=(input,options)=>parseBoardXml(input,'householdDebt',options);
export const parseLoanDelinquencyXml=(input,options)=>parseBoardXml(input,'loanDelinquency',options);

function exactFetch(fetchImpl){return async(url,options)=>{const response=await fetchImpl(url,options);if(response.redirected||response.url&&response.url!==url)throw new Error('Unreviewed credit context source URL or redirect');return response;};}
async function collectBoard(provider,{fetchImpl=globalThis.fetch,now=new Date()}={}){
  endDate(now);
  const spec=specs[provider],response=await requestBytes(spec.url,{maxBytes:16*1024*1024,fetchImpl:exactFetch(fetchImpl)});
  const xml=extractZipEntry(response.bytes,spec.member,{maxOutputBytes:192*1024*1024}).toString('utf8');
  const series=parseBoardXml(xml,provider,{now}),{bytes,...provenance}=response;
  return {id:provider,series,fetchedAt:response.retrievedAt,provenance:[{...provenance,filename:spec.member}],coverageNote:spec.note,...(spec.methodology?{methodology:spec.methodology}:{}),warnings:[spec.note,'Latest revised source history is not a history of original releases. Retrieval and reference dates do not establish historical publication times.']};
}
export const collectBankCredit=options=>collectBoard('bankCredit',options);
export const collectLendingSurvey=options=>collectBoard('lendingSurvey',options);
export const collectFedBalance=options=>collectBoard('fedBalance',options);
export const collectHouseholdDebt=options=>collectBoard('householdDebt',options);
export const collectLoanDelinquency=options=>collectBoard('loanDelinquency',options);

export function onRrpUrl(cutoff){dateKey(cutoff);if(cutoff<ON_RRP_START)throw new Error('ON RRP capture predates admitted coverage');return `${ON_RRP_ENDPOINT}?startDate=${ON_RRP_START}&endDate=${cutoff}&operationTypes=Reverse%20Repo&method=fixed&securityType=tsy&term=overnight`;}
const rrpFail=message=>{throw new Error(`Invalid ON RRP operation: ${message}`);};
function dollars(value){if(value===null)return null;if(!Number.isSafeInteger(value)||value<0)rrpFail('numeric dollar amount');return value;}
/** Regular operation awards, not settled amounts or the outstanding RRP liability stock. */
export function parseOnRrp(payload,{now=new Date()}={}){
  const cutoff=endDate(now),seen=new Set(),operations=new Set(),observations=[];
  if(!Array.isArray(payload?.repo?.operations)||!payload.repo.operations.length)rrpFail('missing results');
  for(const row of payload.repo.operations){
    if(!['Repo','Reverse Repo'].includes(row.operationType))rrpFail('unreviewed operation type');
    if(row.operationType!=='Reverse Repo')continue;
    if(typeof row.operationId!=='string'||!row.operationId||operations.has(row.operationId))rrpFail('duplicate or missing operation identifier');operations.add(row.operationId);
    if(typeof row.note!=='string')rrpFail('missing operation note');
    if(/small\s+value\s+exercise|operational\s+readiness\s+testing/i.test(decodeHtmlText(row.note)))continue;
    if(row.term!=='Overnight')continue;
    if(row.auctionStatus!=='Results'||row.operationMethod!=='Fixed Rate'||row.settlementType!=='Same Day'||!['12:44','12:45'].includes(row.releaseTime)||row.closeTime!=='13:15')rrpFail('unreviewed regular operation metadata');
    const date=dateKey(row.operationDate),settlementDate=dateKey(row.settlementDate),maturityDate=dateKey(row.maturityDate);
    const termCalendarDays=(Date.parse(maturityDate+'T00:00:00Z')-Date.parse(settlementDate+'T00:00:00Z'))/86400000;
    if(settlementDate!==date||!Number.isInteger(row.termCalenderDays)||row.termCalenderDays!==termCalendarDays||termCalendarDays<1||termCalendarDays>7)rrpFail('settlement or maturity date');
    if(seen.has(date))rrpFail('duplicate daily regular result');seen.add(date);
    const amount=dollars(row.totalAmtAccepted),submitted=dollars(row.totalAmtSubmitted);
    if(amount!==null&&submitted!==null&&amount>submitted)rrpFail('accepted exceeds submitted amount');
    if(!Array.isArray(row.details)||row.details.length!==1||row.details[0].securityType!=='Treasury'||dollars(row.details[0].amtAccepted)!==amount||dollars(row.details[0].amtSubmitted)!==submitted)rrpFail('Treasury tranche or total mismatch');
    if(date>=ON_RRP_START&&date<=cutoff)observations.push({date,value:amount===null?null:amount/1e9,sourceValue:amount===null?'null':String(amount),publishedAt:null,operationId:row.operationId,settlementDate,maturityDate,termCalendarDays,operationReleaseTime:row.releaseTime,operationCloseTime:row.closeTime,sourceNote:decodeHtmlText(row.note),sourceUpdatedAt:row.lastUpdated??null});
  }
  if(!observations.some(row=>finite(row.value)))rrpFail('no usable regular operations');
  return observations.sort((a,b)=>a.date.localeCompare(b.date));
}
export async function collectOnRrp({fetchImpl=globalThis.fetch,now=new Date()}={}){
  const cutoff=endDate(now),url=onRrpUrl(cutoff),response=await requestText(url,{maxBytes:4*1024*1024,fetchImpl:exactFetch(fetchImpl)});
  const observations=parseOnRrp(JSON.parse(response.text),{now}),{text,...provenance}=response;
  const notice=`${NY_FED_DATA_NOTICE.replace('2026',String(new Date(response.retrievedAt).getUTCFullYear()))} ${NY_FED_PRODUCT_NOTICE}`;
  const coverageNote='Regular fixed-rate Treasury overnight reverse-repo accepted operation amounts from 2024. Explicit small-value exercises are excluded. Accepted trade amounts can differ from settled amounts; source notes are retained. Daily operation dates, settlement/maturity dates and Wednesday H.4.1 balance-sheet stocks are distinct. Missing dates are not filled.';
  return {id:'onRrp',fetchedAt:response.retrievedAt,coverageStart:ON_RRP_START,coverageEnd:cutoff,provenance:[provenance],coverageNote,warnings:[coverageNote,CREDIT_CONTEXT_LIMITATION],series:{onRrpAccepted:{observations,sourceIds:['RRP:regular-overnight:totalAmtAccepted'],sourceUrl:url,sourceTitle:'Reverse Repo Operations',unit:'USD billions',frequency:'Daily',adjustment:'Not seasonally adjusted',measure:'Regular overnight reverse-repo operation accepted trade amount',calculation:'Published totalAmtAccepted in USD dollars divided by 1,000,000,000 for USD billions; Meridian unit conversion. Small-value exercises excluded, no netting with H.4.1 stocks.',observationType:'official',dataStatus:'official',sourceNotice:notice,licenseUrl:NY_FED_TERMS_URL,attribution:'Source: Federal Reserve Bank of New York, Reverse Repo Operations.',coverageNote,publicationNote:'Operation date is distinct from settlement, maturity and retrieval. The source lastUpdated field is retained as source metadata; it is not treated as a verified original publication instant.'}}};
}
