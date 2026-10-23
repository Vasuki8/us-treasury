import { fiscalGdpCsv } from './fiscal-gdp-view.js';
import { evidenceBrief,nextCatalysts } from './research-brief.js';
import {watchlistMonitor,monitorUpdateLabel} from './watchlist-monitor.js';
import { fiscalGdpContext } from './economic-depth.js';
import { creditContextCsv,fomcDocumentsCsv,creditWindowSources } from './credit-context-page.js';
import {series,dataStatus,releases} from './data.js';
import {routeFor} from './router.js';
import {coverageFamilies} from './macro-registry.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {calendarScope} from './calendar-scope.js';
import {asKnownOn} from './vintages.js';
import {vintagesCsv,normalizedCutoff} from './vintages-page.js';
import {refinancingCsv} from './refinancing-page.js';
import {yieldCurvesCsv} from './yields-page.js';
import {auctionsCsv} from './auctions-page.js';
import {ownershipCsv} from './ownership-page.js';
import {macroContributionsCsv} from './macro-page.js';
import {marketFunctioningCsv} from './market-functioning-page.js';
import {fiscalFinancingCsv} from './research-exports.js';
import {selectPublicationHistory,publicationCsv,publicationContext} from './publication-history.js';
import {periodLabel,transformSeries} from './model.js';
import {publicationExplanationRows,publicationExplanationsCsv} from './publication-explanation-view.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from './claims-publication-history.js';
import {matchReleaseEvidence,selectReleaseEvidence,releaseDelivery} from './release-evidence.js';
import {currentAccountContext,currentAccountCsv} from './current-account-view.js';
import {currentAccountGdpCsv,currentAccountGdpHistoryCsv} from './current-account-gdp-view.js';
import {currentAccountGdpBreakdownCsv} from './current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingCsv} from './current-account-gdp-trailing-view.js';
import {viewRange} from './workspace-context.js';

const moduleIds={credit:['bankLoans','bankDeposits','ciStandardsLarge','onRrpAccepted'],overview:['unrate','cpi','gdp','yield'],labor:['payroll','unrate','underemployment','weeklyHours'],fiscal:['receipts','outlays','netInterest','primaryDeficit'],refinancing:['marketableDebt'],yields:['yield','realYield10','spread2s10s','inflationComp10'],auctions:['auctionOfferingMonthly'],ownership:['foreignTreasuryHoldings','fedTreasuryHoldings','somaTreasuryHoldings'],macro:['gdpTotalContribution','gdpConsumptionContribution','gdpInvestmentContribution','gdpGovernmentContribution'],market:['dealerNetTreasury','dealerRepo','dealerFailsDeliver','sofr']};
const sourceIds={credit:['bankCredit','lendingSurvey','fedBalance','onRrp','householdDebt','loanDelinquency'],fiscal:['fiscal','treasury'],refinancing:['refinancing'],yields:['yields','treasury'],auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning']};
const attachment=(name,content)=>({name,content,type:'text/csv'});
const measurementFields=['name','unit','frequency','adjustment','definition','observationType','format','precision','periodType','dateConvention','measure','calculation'];
const strings=values=>[...new Set(values.filter(value=>typeof value==='string'&&value.trim()))];

function capturedMeasurement(current,source,item,id,agency){
 const measurement=Object.fromEntries(measurementFields.map(key=>[key,item[key]??source[key]??current[key]]));
 const sourceUrl=item.sourceUrl??source.sourceUrl??current.source.url;
 return {...current,...item,...measurement,id,agency,
  source:{...current.source,seriesIds:item.sourceIds??[],url:sourceUrl},sourceUrl,
  sourceUrls:strings([sourceUrl,...(source.sourceUrls??[]),...(item.sourceUrls??[])]),
  sourceNotice:strings([source.sourceNotice,item.sourceNotice]).join(' '),
  redistributionNotice:strings([source.redistributionNotice,item.redistributionNotice]).join(' '),
  attribution:strings([source.attribution,item.attribution]).join(' '),
  licenseUrl:item.licenseUrl??source.licenseUrl??item.termsUrl??source.termsUrl??'',
  termsUrl:item.termsUrl??source.termsUrl??item.licenseUrl??source.licenseUrl??'',
  sourceTitle:item.sourceTitle??source.sourceTitle??'',coverageNote:item.coverageNote??source.coverageNote??'',
  fetchedAt:item.fetchedAt??source.fetchedAt,provenance:source.provenance,dataStatus:'captured-as-known',error:null};
}

/** Build explicitly scoped frozen inputs; never promise a mutable URL is a saved result. */
export function buildPinContext(state,{historyState,catalog=series,sources=dataStatus.sources,snapshot=dataStatus,events=releases,now=new Date(),changes={},checkpoint={},failures=[]}={}){
 let selected=state.page==='indicator'?[state.seriesId]:state.page==='macroCoverage'?[state.macroMeasure]:state.page==='watchlist'?state.saved:moduleIds[state.page]??state.selected;
 let capturedCatalog=catalog,capturedSources=sources;
 const context={page:state.page,route:routeFor(state),moduleSources:Object.fromEntries((sourceIds[state.page]??[]).filter(id=>sources[id]).map(id=>[id,sources[id]])),attachments:[],scope:'Selected registered measurements; explicitly retained supplementary inputs and CSVs when present.'};
 const assumptions={comparison:state.page==='explore'&&state.exploreMode==='compare'?state.comparison:'native',transform:state.page==='indicator'?state.transform:'level',missingDates:'No interpolation or frequency aggregation; unmatched dates remain unavailable.'};
 if(state.page==='overview'){
  selected=['gdp','pceCoreMonthly','payroll','policyTargetUpper'];
  context.overviewTopicReadings=['gdp','realSpendingMonthly','pceCoreMonthly','pceCore','payroll','unrate','claimsAdvance','continuedClaimsAdvance','policyTargetLower','policyTargetUpper','effr','yield','spread2s10s','publicDebt','interestRevenueRatio'].filter(id=>catalog[id]).map(id=>{const item=catalog[id];return {id,name:item.name,unit:item.unit,frequency:item.frequency,adjustment:item.adjustment,definition:item.definition,observationType:item.observationType,calculation:item.calculation,latest:item.observations.at(-1)??null,prior:item.observations.at(-2)??null,fetchedAt:item.fetchedAt,source:item.source,provenance:item.provenance};});
  context.overviewChartInputs=['pceMonthly','pceCoreMonthly','payroll','realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction'].filter(id=>catalog[id]).map(id=>{const item=catalog[id],shown=transformSeries(item,'level',12);return {id,name:item.name,unit:item.unit,frequency:item.frequency,adjustment:item.adjustment,calculation:item.calculation,fetchedAt:item.fetchedAt,source:item.source,provenance:item.provenance,observations:shown.observations};});
  context.overviewBrief=evidenceBrief({catalog,sources,changes:changes.rows??[],failures});context.overviewCheckpoint=checkpoint;
  context.overviewFollowing=watchlistMonitor(state.saved??[],{catalog,events,now}).map(({id,current,nextEvent})=>({id,name:current.name,status:current.dataStatus,update:monitorUpdateLabel(id,changes,checkpoint),nextEvent}));
  context.nextCatalysts=nextCatalysts(events,{now});context.calendarStatus=snapshot.calendar;
  context.scope='Four primary chart measurements plus frozen topic readings, chart inputs, factual update brief and selected upcoming schedule context. All values and clocks are retained; no current data is substituted on reopening.';
 }
 if(state.page==='macroCoverage')context.familyReadings=coverageFamilies[state.macroFamily].ids.map(id=>({id,name:catalog[id].name,unit:catalog[id].unit,definition:catalog[id].definition,latest:catalog[id].observations.at(-1)??null,fetchedAt:catalog[id].fetchedAt,source:catalog[id].source}));
 if(state.page==='macroCoverage'&&state.macroFamily==='external'){
  const source=sources.beaIta??{},result=currentAccountContext(source),dates=[result.previousDate,result.date].filter(Boolean);
  context.currentAccountInputs={...source,series:Object.fromEntries(Object.entries(source.series??{}).map(([id,item])=>[id,{...item,observations:item.observations.filter(row=>dates.includes(row.date))}]))};
  context.currentAccountSummary=result;
  const gdp=sources.bea??{};
  context.currentAccountGdpDenominator={...gdp,series:Object.fromEntries(Object.entries(gdp.series??{}).filter(([id])=>id==='nominalGdp').map(([id,item])=>[id,{...item,observations:item.observations.filter(row=>dates.includes(row.date))}]))};
  const historySources=Object.fromEntries([['beaIta','currentAccountBalance'],['bea','nominalGdp']].map(([agency,id])=>{const original=sources[agency]??{};return [agency,{...original,series:original.series?.[id]?{[id]:original.series[id]}:{}}];}));
  context.currentAccountGdpHistory={version:1,range:viewRange(state),sources:historySources};
  const breakdownItaIds=['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'];
  context.currentAccountGdpBreakdown={version:1,range:viewRange(state),sources:{beaIta:{...source,series:Object.fromEntries(breakdownItaIds.filter(id=>source.series?.[id]).map(id=>[id,source.series[id]]))},bea:historySources.bea}};
  context.currentAccountGdpTrailing={version:1,range:viewRange(state),inputContext:'currentAccountGdpBreakdown'};
  context.attachments=[attachment('current-account-current-prior.csv',currentAccountCsv(source)),attachment('current-account-gdp.csv',currentAccountGdpCsv(sources)),attachment('current-account-gdp-history.csv',currentAccountGdpHistoryCsv(sources,viewRange(state))),attachment('current-account-gdp-breakdown.csv',currentAccountGdpBreakdownCsv(sources,viewRange(state))),attachment('current-account-gdp-trailing.csv',currentAccountGdpTrailingCsv(sources,viewRange(state)))];
  context.scope='Selected focused history, latest topic readings, exact current/prior ITA/GDP context, and full retained current-account total, four component balances and nominal GDP input histories for the selected historical ratio, breakdown and trailing-four-quarter windows. Trailing calculations reuse the full breakdown inputs, including pre-window lookback, without duplicating histories. Retains independent source metadata/retrievals, ITA table release date, original scoped CSVs, reconciliation residuals and missing-quarter evidence. NIPA trade remains distinct; other full measurement histories are not frozen.';
 }
 if(state.page==='refinancing'){
  Object.assign(assumptions,{horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock,interpretation:'Hypothetical higher/lower-rate refinancing sensitivity, not a rate forecast; observed instruments are separate from future issuance assumptions.'});
  context.attachments=[attachment('refinancing-observed.csv',refinancingCsv(sources.refinancing)),attachment('refinancing-scenarios.csv',refinancingCsv(sources.refinancing,{scenario:true,horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock}))];
 }
 if(state.page==='fiscal'){context.attachments=[attachment('fiscal-financing.csv',fiscalFinancingCsv(sources.fiscal)),attachment('fiscal-gdp-ratios.csv',fiscalGdpCsv(sources))];context.fiscalRatios=fiscalGdpContext(sources);const dates=context.fiscalRatios?.deficitToGdp?.denominatorPeriods??[];context.fiscalNominalGdpInput={...sources.bea,series:{nominalGdp:{...sources.bea?.series?.nominalGdp,observations:(sources.bea?.series?.nominalGdp?.observations??[]).filter(row=>dates.includes(row.date))}}};}
 if(state.page==='credit'){
  context.moduleSources=creditWindowSources(sources);
  context.attachments=[attachment('credit-context.csv',creditContextCsv(sources)),attachment('fomc-references.csv',fomcDocumentsCsv(snapshot.calendar?.sources?.fomc))];
  context.scope='Primary selected measurements and the compact credit page: exact three-year chart and CSV inputs for each source group, with original definitions, receipt provenance and policy references. Full retained histories remain available in indicator details.';
 }
 if(state.page==='yields')context.attachments=[attachment('yield-curve-overlays.csv',yieldCurvesCsv(sources.yields,state))];
 if(state.page==='auctions')context.attachments=[attachment('auction-results.csv',auctionsCsv(sources.auctions,{securityType:state.auctionType,auctionId:state.auctionId})),attachment('auction-peers.csv',auctionsCsv(sources.auctions,{securityType:state.auctionType,auctionId:state.auctionId,benchmark:true}))];
 if(state.page==='ownership')context.attachments=[attachment('debt-ownership.csv',ownershipCsv(sources.ownership))];
 if(state.page==='macro')context.attachments=[attachment('macro-contributions.csv',macroContributionsCsv(sources.macroContributions))];
 if(state.page==='market')context.attachments=[attachment('market-functioning.csv',marketFunctioningCsv(sources.marketFunctioning))];
 if(state.page==='calendar'){
  const scope=calendarScope(state,{events,catalog,now}),event=scope.selected;
  if(!event)throw new Error('No calendar releases match the current filters. Choose another window or clear the filters before pinning.');
  selected=calendarRelatedIds(event);Object.assign(context,{calendar:snapshot.calendar,releases:scope.filtered,selectedEvent:event,calendarScope:{month:scope.month,day:state.day??'all',topic:state.calendarTopic??'All topics',watchOnly:Boolean(state.watchOnly),saved:state.watchOnly?[...(state.saved??[])]:[],eventIds:scope.filtered.map(item=>item.id),window:scope.window},calendarReplay:'Frozen current context only; historical calendar replay is unavailable.'});
 }
 let pinState={...state,comparison:assumptions.comparison,transform:assumptions.transform};
 if(state.page==='vintages'){
  if(historyState?.status!=='ready')throw new Error('Verified capture history must load before pinning.');
  const cutoff=normalizedCutoff(state.vintageCutoff??historyState.latestCaptureAt,historyState.history),id=state.vintageSeries,known=asKnownOn(historyState.history,cutoff);
  const entry=Object.entries(known.sources).find(([,source])=>source.series?.[id]);
  if(!entry)throw new Error('Historical observations are unavailable at this capture cutoff.');
  const [agency,source]=entry,item=source.series[id];
  capturedCatalog={[id]:capturedMeasurement(catalog[id],source,item,id,agency)};
  capturedSources=known.sources;selected=[id];pinState={...pinState,page:'indicator',seriesId:id,window:'all',startDate:'',endDate:'',transform:'level',comparison:'native'};
  Object.assign(context,{captureCutoff:cutoff,selectedCaptureHistory:historyState.history});context.attachments=[attachment('captured-by-values.csv',vintagesCsv(historyState.history,{seriesId:id,cutoff}))];
 }
 selected=[...new Set(selected??[])].filter(id=>Object.hasOwn(capturedCatalog,id)).slice(0,4);
 if(!selected.length)throw new Error('Select at least one available registered measurement to pin.');
 return {state:{...pinState,selected},catalog:capturedCatalog,sources:capturedSources,snapshot:{generatedAt:snapshot.generatedAt,checkedAt:snapshot.checkedAt},context,assumptions};
}

export function buildReleasePin(state,{archive,publicationState,explanationArchive,explanationStatus,events=releases}={}){
 if(publicationState?.status!=='ready'||!archive)throw new Error('Load the selected official publication archive before freezing.');
 const event=events.find(row=>row.id===state.eventId)??null;
 if(state.eventId&&!event)throw new Error('This event is outside retained calendar coverage.');
 const selection={seriesId:state.publicationSeries,period:state.publicationPeriod??'',publicationCutoff:state.publicationCutoff??''};
 const view=event?matchReleaseEvidence(event,archive,selection):selectReleaseEvidence(archive,selection);
 if(view.status!=='verified')throw new Error(view.reason??'Verified release evidence unavailable.');
 const row=view.actual,args=row.seriesId==='gdp'?buildPublicationPin(archive,row.publicationDate,row.period,{explanationArchive,explanationStatus}):buildClaimsPublicationPin(archive,row.seriesId,row.publicationDate,row.period);
 Object.assign(args.context,{releaseEvidence:view,releaseSchedule:event,releaseDelivery:releaseDelivery(event,row),releaseRoute:routeFor(state)});
 return args;
}

export function buildPublicationPin(archive,cutoff,period,options){
 const view=selectPublicationHistory(archive,cutoff,period),row=view.latest;
 if(!row)throw new Error('No official publication is available by this date.');
 const quarter=periodLabel({frequency:'Quarterly'},row.period);
 const evidence=options?{publicationExplanationStatus:options.explanationStatus??'unavailable',publicationExplanations:options.explanationStatus==='ready'?publicationExplanationRows(archive,options.explanationArchive,cutoff,view.period).flatMap(item=>item.explanation?[item.explanation]:[]):[]}:{};
 const explanationFiles=options?.explanationStatus==='ready'?[attachment('gdp-revision-explanations.csv',publicationExplanationsCsv(archive,options.explanationArchive,cutoff,view.period))]:[];
 const captured={...series.gdp,name:`Real GDP · ${quarter} ${row.estimate} estimate`,sourceUrls:[row.sourceUrl],lastAttemptAt:null,warnings:[],coverageNote:`Official publication estimate for ${quarter}, published ${row.publicationDate}; selected dated workbook evidence through ${view.cutoff}. Retrieval is separate from publication; this is a historical published value, not the latest NIPA series.`,source:{name:'U.S. Bureau of Economic Analysis',url:row.sourceUrl,seriesIds:row.sourceIds},sourceUrl:row.sourceUrl,sourceTitle:row.sourceTitle,licenseUrl:row.licenseUrl,attribution:row.attribution,calculation:row.calculation,fetchedAt:row.provenance.at(-1).retrievedAt,provenance:row.provenance,dataStatus:'official',publicationNote:`Official publication date ${row.publicationDate}, day precision; exact publication instant unavailable.`,observations:[{date:row.period,value:row.value,sourceValue:row.sourceValue,publishedAt:null}],error:null};
 return {state:{page:'indicator',seriesId:'gdp',selected:['gdp'],window:'all',transform:'level',comparison:'native'},catalog:{gdp:captured},sources:{},snapshot:{generatedAt:dataStatus.generatedAt},context:{publicationCutoff:view.cutoff,publicationPeriod:view.period,publicationSourceContext:publicationContext(row),publicationReleases:view.releases,...evidence,attachments:[attachment('gdp-publication-history.csv',publicationCsv(archive,cutoff,view.period)),...explanationFiles]},assumptions:{publicationDatePrecision:'day',scope:'Selected official GDP publication estimates; separate from current GDP and local capture replay.'}};
}

export function buildClaimsPublicationPin(archive,seriesId,cutoff='',period=''){
 const view=selectClaimsPublicationHistory(archive,seriesId,cutoff,period),row=view.latest;
 if(!row)throw new Error('No official claims publication is available for this week and cutoff.');
 const current=series[seriesId],label=seriesId==='continuedClaimsAdvance'?'Continued claims':'Initial claims';
 const captured={
  ...current,name:`${label} · week ending ${row.period} · ${row.estimate} published ${row.publicationDate}`,
  definition:'Selected archived official national seasonally adjusted claims publication fact for this reference week. Advance and same-release prior comparison roles remain distinct. Not the current release context or latest revised historical series.',
  measure:`Archived official claims publication; week ending ${row.period}; release role ${row.releaseStage}.`,
  short:label+' · archived publication',comparisonClass:'count',frequency:row.frequency,unit:row.unit,adjustment:row.adjustment,
  source:{name:'U.S. Department of Labor, Employment and Training Administration',url:row.sourceUrl,seriesIds:row.sourceIds},
  sourceUrl:row.sourceUrl,sourceUrls:[row.sourceUrl],sourceTitle:row.sourceTitle,licenseUrl:row.licenseUrl,attribution:row.attribution,calculation:row.calculation,
  sourceNotice:'',lastAttemptAt:null,warnings:[],dataStatus:'official',error:null,fetchedAt:row.provenance.at(-1)?.retrievedAt,provenance:row.provenance,
  publicationNote:`Official publication date ${row.publicationDate}, day precision; exact publication instant is unknown.`,
  coverageNote:`Selected archived claims publication for week ending ${row.period}, published ${row.publicationDate}; role ${row.releaseStage}. Later publications after ${view.cutoff} are excluded.`,
  observations:[{date:row.period,value:row.value,sourceValue:row.sourceValue,publishedAt:row.publicationDate,publicationDatePrecision:'day',releaseStage:row.releaseStage,previouslyPublishedSourceValue:row.previouslyPublishedSourceValue,footnotes:row.footnotes,seasonalAdjustmentNote:row.seasonalAdjustmentNote,seasonalAdjustmentKind:row.seasonalAdjustmentKind??null}],
 };
 return {state:{page:'indicator',seriesId,selected:[seriesId],window:'all',transform:'level',comparison:'native'},catalog:{[seriesId]:captured},sources:{},snapshot:{generatedAt:dataStatus.generatedAt},context:{publicationSeries:seriesId,publicationCutoff:view.cutoff,publicationPeriod:view.period,publicationSelectedId:row.id,publicationReleases:view.releases,attachments:[attachment('claims-publication-history.csv',claimsPublicationCsv(archive,seriesId,cutoff,view.period))]},assumptions:{publicationDatePrecision:'day',scope:'Selected archived claims publication facts for one measurement and reference week. Same-release priors are not original advances; later annual revisions are unavailable. Publication replay is separate from retrieval replay.'}};
}
