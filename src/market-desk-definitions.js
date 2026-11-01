// Reviewed official-public measurement scope: docs/sources/market-desks-source-review.md.
export const MARKET_BOARD_TERMS='https://www.federalreserve.gov/disclaimer.htm';
export const OFR_TERMS='https://www.financialresearch.gov/legal-notices/';
export const MARKET_DESK_START='2024-07-03';
export const FED_QT_URL='https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip';
export const DEALER_DETAIL_METADATA_URL='https://markets.newyorkfed.org/api/pd/list/timeseries.json';
export const DEALER_DETAIL_BREAKS_URL='https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json';
export const TRI_PARTY_URL='https://www.newyorkfed.org/medialibrary/Research/Interactives/Data/tri-party-repo/tri-party-repo_data';
export const DKW_URL='https://www.federalreserve.gov/econres/notes/feds-notes/DKW_updates.csv';
const board={name:'Board of Governors of the Federal Reserve System',url:'https://www.federalreserve.gov/'};
const nyfed={name:'Federal Reserve Bank of New York',url:'https://www.newyorkfed.org/'};
const ofr={name:'Office of Financial Research',url:'https://www.financialresearch.gov/short-term-funding-monitor/'};
const ecb={name:'European Central Bank',url:'https://data.ecb.europa.eu/'};
const definition=(id,code,name,agency,extra={})=>({id,code,name,short:name,topic:'Market functioning',agency,frequency:'Weekly',dateConvention:'source-wednesday',format:'billions',unit:'USD billions',precision:3,adjustment:'Not seasonally adjusted',periodType:'stock',comparisonClass:'amount',observationType:'official',source:nyfed,definition:name,...extra});
export const fedQtDefinitions=Object.fromEntries([
 ['fedTreasurySecurities','RESPPALGUO_N.WW','Federal Reserve Treasury securities','ASSET','ORH','USTS'],
 ['fedMbs','RESPPALGASMO_N.WW','Federal Reserve mortgage-backed securities','ASSET','ORH','MBSSHOR'],
 ['fedAgencyDebt','RESPPALGAO_N.WW','Federal Reserve agency debt securities','ASSET','ORH','FADS'],
 ['fedCurrency','RESTBC_N.WW','Currency in circulation','LIABCAP','OFDRB','CIC'],
 ['fedPrimaryCredit','RESPPALDP_N.WW','Primary credit','ASSET','LCF','LNPC'],
 ['fedSecondaryCredit','RESPPALDQ_N.WW','Secondary credit','ASSET','LCF','LNSC'],
 ['fedSeasonalCredit','RESPPALDS_N.WW','Seasonal credit','ASSET','LCF','LNSEAC'],
 ['fedSwapStock','RESH4SCS_N.WW','Central bank liquidity swap stock','ASSET','SWAP','CBL'],
 ['fedBtfp','H0.RESPPALDK_N.WW','Bank Term Funding Program · discontinued','ASSET','LCF','LNBTFP'],
 ['fedRepoStock','RESPPALGTR_N.WW','Fed repurchase agreement stock','ASSET','ZZZZ','RP'],
 ['fedReverseRepoStock','RESPPLLR_N.WW','Fed reverse-repurchase agreement stock','LIABCAP','LIAB','RRP'],
 ['fedRrpForeign','RESPPLLRF_N.WW','Fed foreign-official reverse repo stock','LIABCAP','LIAB','RRPF'],
 ['fedRrpOther','RESPPLLRD_N.WW','Fed other reverse repo stock','LIABCAP','LIAB','RRPO'],
].map(([id,code,name,category,subcategory,component])=>[id,{id,code,name,metadata:{SERIES_NAME:code,FREQ:'19',CATEGORY:category,SUBCATEGORY:subcategory,COMPONENT:component,DISTRIBUTION:'TOT',SERIESTYPE:'L',UNIT:'Currency',UNIT_MULT:'1000000',CURRENCY:'USD'}}]));
export const dealerDetailDefinitions=Object.fromEntries([
 ['dealerNetBills',['PDPOSGS-B'],'Dealer net Treasury bills'],
 ['dealerNetFrn',['PDPOSGS-BFRN'],'Dealer net Treasury FRNs'],
 ['dealerNetCouponsLe3',['PDPOSGSC-L2','PDPOSGSC-G2L3'],'Dealer net coupons ≤3 years'],
 ['dealerNetCoupons3to6',['PDPOSGSC-G3L6'],'Dealer net coupons 3–6 years'],
 ['dealerNetCoupons6to11',['PDPOSGSC-G6L7','PDPOSGSC-G7L11'],'Dealer net coupons 6–11 years'],
 ['dealerNetCouponsGt11',['PDPOSGSC-G11L21','PDPOSGSC-G21'],'Dealer net coupons >11 years'],
 ['dealerNetTips',['PDPOSTIPS-L2','PDPOSTIPS-G2','PDPOSTIPS-G6L11','PDPOSTIPS-G11'],'Dealer net TIPS'],
 ['dealerNetAgencyMbs',['PDPOSMBS-TOT'],'Dealer net agency MBS'],
].map(([id,codes,name])=>[id,{id,codes,code:codes.join('+'),name}]));
export const DEALER_DETAIL_CODES=[...new Set(Object.values(dealerDetailDefinitions).flatMap(d=>d.codes))];
export const DEALER_DETAIL_URL=`https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/${DEALER_DETAIL_CODES.join('_')}.json`;
export const moneyRateDefinitions={tgcr:{code:'TGCR:percentRate',name:'Tri-Party General Collateral Rate Data',path:'secured/tgcr',inception:'2018-04-02'},bgcr:{code:'BGCR:percentRate',name:'Broad General Collateral Rate Data',path:'secured/bgcr',inception:'2018-04-02'},obfr:{code:'OBFR:percentRate',name:'Overnight Bank Funding Rate',path:'unsecured/obfr',inception:'2016-03-01'}};
export const ofrRepoDefinitions=Object.fromEntries([
 ['ofrDvpMeanRate','REPO-DVP_AR_TOT-P','DVP Service Average Rate: Total (Preliminary)','Percent','Interest Rate'],
 ['ofrDvpTransactionVolume','REPO-DVP_TV_TOT-P','DVP Service Transaction Volume: Total (Preliminary)','USD','Transaction Volume'],
 ['ofrDvpOutstandingVolume','REPO-DVP_OV_TOT-P','DVP Service Outstanding Volume: Total (Preliminary)','USD','Outstanding Volume'],
 ['ofrGcfMeanRate','REPO-GCF_AR_TOT-P','GCF Repo Service Average Rate: Total (Preliminary)','Percent','Interest Rate'],
 ['ofrGcfTransactionVolume','REPO-GCF_TV_TOT-P','GCF Repo Service Transaction Volume: Total (Preliminary)','USD','Transaction Volume'],
 ['ofrGcfOutstandingVolume','REPO-GCF_OV_TOT-P','GCF Repo Service Outstanding Volume: Total (Preliminary)','USD','Outstanding Volume'],
 ['ofrTriMeanRate','REPO-TRIV1_AR_TOT-P','Tri-Party Average Rate, excluding Federal Reserve transactions: Total (Preliminary)','Percent','Interest Rate'],
 ['ofrTriTransactionVolume','REPO-TRIV1_TV_TOT-P','Tri-Party Transaction Volume, excluding Federal Reserve transactions: Total (Preliminary)','USD','Transaction Volume'],
].map(([id,code,name,nativeUnit,subtype])=>[id,{id,code,name,nativeUnit,subtype,dataset:'repo',frequency:'Daily',vintage:'Preliminary'}]));
export const ofrMmfDefinitions=Object.fromEntries([
 ['mmfTotalInvestments','MMF-MMF_TOT-M','Money Market Mutual Fund Investments: Total'],
 ['mmfTreasuryInvestments','MMF-MMF_T_TOT-M','Money Market Mutual Fund Investments in U.S. Treasury Securities'],
 ['mmfAgencyInvestments','MMF-MMF_AG_TOT-M','Money Market Mutual Fund Investments in Federal Agency and GSE Securities'],
 ['mmfRepoInvestments','MMF-MMF_RP_TOT-M','Money Market Mutual Fund Investments in Repurchase Agreements'],
 ['mmfFedRepoInvestments','MMF-MMF_RP_wFR-M','Money Market Mutual Fund Investments in Repurchase Agreements with the Federal Reserve'],
].map(([id,code,name])=>[id,{id,code,name,nativeUnit:'USD',subtype:'Outstanding Volume',dataset:'mmf',frequency:'Monthly',vintage:'Monthly Revisions - Complete Series'}]));
export const triPartyDefinitions={triPartyReportedTotal:{code:'volume_haircut_concentration:21',group:21,name:'Tri-party reported total including separate Fed and Sponsored GC'},triPartySponsoredGc:{code:'volume_haircut_concentration:22',group:22,name:'Tri-party Sponsored GC snapshot'},triPartyFederalReserve:{code:'volume_haircut_concentration:23',group:23,name:'Tri-party Federal Reserve snapshot'},triPartyCollateralValue:{code:'volume_haircut_concentration:19+20',groups:[19,20],name:'Ordinary tri-party collateral value excluding Fed and Sponsored GC'}};
export const dkwDefinitions=Object.fromEntries(['5','10','5f5'].flatMap(horizon=>[
 [`dkwInflationExpected${horizon}`,'exp.inflation','Expected inflation'],[`dkwInflationRisk${horizon}`,'inflation.risk.prem','Inflation risk premium'],[`dkwTipsLiquidity${horizon}`,'tips.liq.prem','TIPS liquidity premium'],[`dkwInflationComp${horizon}`,'ic.fitted','Fitted inflation compensation'],
].map(([id,column,name])=>[id,{id,code:`${column}.${horizon}`,name:`DKW ${horizon==='5f5'?'5-to-10-year':horizon+'-year'} ${name.toLowerCase()}`,horizon}])));
export const fedProjectionDefinitions={
 fedFx:{fxUsdJpy:{id:'fxUsdJpy',code:'RXI_N.B.JA',name:'USD/JPY reference spot',unit:'JPY per USD'}},
 ecbFx:{fxUsdEur:{id:'fxUsdEur',code:'EXR.D.USD.EUR.SP00.A',name:'EUR/USD reference spot',unit:'USD per EUR'},fxGbpEur:{id:'fxGbpEur',code:'EXR.D.GBP.EUR.SP00.A',name:'EUR/GBP reference spot',unit:'GBP per EUR'},fxJpyEur:{id:'fxJpyEur',code:'EXR.D.JPY.EUR.SP00.A',name:'EUR/JPY reference spot',unit:'JPY per EUR'}},
 ecbPolicy:{ecbDepositRate:{id:'ecbDepositRate',code:'FM.D.U2.EUR.4F.KR.DFR.LEV',name:'ECB deposit facility rate',unit:'Percent'}},fedSep:{},
};
export const fedProjectionRegistry=Object.fromEntries(Object.entries(fedProjectionDefinitions).flatMap(([agency,rows])=>Object.entries(rows).map(([id,d])=>[id,definition(id,d.code,d.name,agency,{source:agency==='fedFx'?board:ecb,frequency:'Daily',dateConvention:'source-effective-date',format:agency==='ecbPolicy'?'percent':'number',unit:d.unit,precision:4,periodType:agency==='ecbPolicy'?'rate':'exchange-rate',comparisonClass:'rate',definition:agency==='ecbPolicy'?'Published ECB deposit facility rate, percent; an administered policy rate rather than an OIS rate. Negative values are valid.':`Published central-bank reference exchange rate in ${d.unit}. A dated reference fixing, not a live executable FX quote.`})])));
export const marketDeskDefinitions={fedQt:fedQtDefinitions,dealerDetails:dealerDetailDefinitions,moneyRates:moneyRateDefinitions,repoOperations:{standingRepoAccepted:{code:'RP:regular-overnight:totalAmtAccepted',name:'Regular overnight Fed repo accepted amount'}},ofrRepo:ofrRepoDefinitions,ofrMmf:ofrMmfDefinitions,nyfedTriParty:triPartyDefinitions,dkwInflation:dkwDefinitions,...fedProjectionDefinitions};
export const marketDeskRegistry={
 ...Object.fromEntries(Object.entries(fedQtDefinitions).map(([id,d])=>[id,definition(id,d.code,d.name,'fedQt',{source:board,topic:'Policy',definition:'H.4.1 exact Wednesday balance-sheet stock, published USD millions divided by 1000. Securities holdings are H.4.1 reported values, not SOMA adjusted par. A change in holdings is not a separately measured exact securities runoff. Missing/discontinued observations remain null.'})])),
 ...Object.fromEntries(Object.entries(dealerDetailDefinitions).map(([id,d])=>[id,definition(id,d.code,d.name,'dealerDetails',{observationType:d.codes.length>1?'calculated':'official',definition:'Signed net primary-dealer position stock at fair value on Wednesday; published USD millions divided by 1000. SBN2024 regime only, from 2024-07-03. Grouped buckets require every component on the exact date; suppressed components remain missing. Positions are not transactions, risk limits or whole-market holdings.'})])),
 ...Object.fromEntries(Object.entries(moneyRateDefinitions).map(([id,d])=>[id,definition(id,d.code,d.name,'moneyRates',{frequency:'Daily',dateConvention:'source-effective-date',format:'percent',unit:'Percent',precision:2,periodType:'rate',comparisonClass:'rate',definition:'Published NYFed overnight volume-weighted median rate in percent. Distribution percentiles and USD billions of underlying transactions retain their own fields. Effective dates differ from publication dates; rates are not forward term/OIS quotes.'})])),
 standingRepoAccepted:definition('standingRepoAccepted','RP:regular-overnight:totalAmtAccepted','Regular overnight Fed repo accepted amount','repoOperations',{frequency:'Daily',dateConvention:'source-operation-date',periodType:'operation',definition:'Sum of accepted USD trade amounts in separate regular overnight NYFed repo operations sharing an operation date, divided by 1 billion. Readiness/small-value exercises are excluded. Operations, settlement, maturity and H.4.1 stocks are distinct.'}),
 ...Object.fromEntries([...Object.entries(ofrRepoDefinitions),...Object.entries(ofrMmfDefinitions)].map(([id,d])=>[id,definition(id,d.code,d.name,d.dataset==='repo'?'ofrRepo':'ofrMmf',{source:ofr,frequency:d.frequency,dateConvention:d.dataset==='mmf'?'source-month-end':'source-business-date',unit:d.nativeUnit==='USD'?'USD billions':'Percent',format:d.nativeUnit==='USD'?'billions':'percent',periodType:d.subtype==='Transaction Volume'?'flow':d.nativeUnit==='USD'?'stock':'rate',comparisonClass:d.nativeUnit==='USD'?'amount':'rate',precision:d.nativeUnit==='USD'?3:2,definition:d.dataset==='mmf'?'OFR aggregate of SEC Form N-MFP month-end reported fund investments, native USD divided by 1 billion. A monthly holding stock, not daily flows or a complete daily MMF AUM measure. Current revised vintage.':`OFR-collected repo aggregate, ${d.vintage.toLowerCase()}; ${d.subtype.toLowerCase()}. Mean rates use volume weights and differ from NYFed medians. Transaction volume differs from outstanding volume. Published disclosure edits remain null. TRIV1 excludes Federal Reserve transactions; no splice to TRI.`})])),
 ...Object.fromEntries(Object.entries(triPartyDefinitions).map(([id,d])=>[id,definition(id,d.code,d.name,'nyfedTriParty',{frequency:'Monthly',dateConvention:'source-snapshot-date',observationType:d.groups?'calculated':'official',definition:'NYFed monthly seventh-business-day snapshot, collateral market value before haircut in USD billions; not daily transaction flow. November 2025 regime excludes Fed/Sponsored GC from ordinary groups and reports them separately. Reported Total includes those separate groups. No splice to pre-November observations.'})])),
 ...Object.fromEntries(Object.entries(dkwDefinitions).map(([id,d])=>[id,definition(id,d.code,d.name,'dkwInflation',{source:board,frequency:'Daily',dateConvention:'source-business-date',unit:'Percentage points',format:'percentagePoints',precision:3,periodType:'model-estimate',comparisonClass:'rate',observationType:'model-estimate',definition:'Published D’Amico–Kim–Wei staff term-structure model output, updated by Kim, Walsh and Wei. Daily estimated values, updated monthly; not an official statistical release or an observed expectation. Fitted inflation compensation = expected inflation + inflation risk premium − TIPS liquidity premium. Native percentage points, no annualization or scale conversion. Latest revised full-sample model vintage.'})])),
 ...fedProjectionRegistry,
};
