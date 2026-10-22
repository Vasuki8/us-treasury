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
import {periodLabel} from './model.js';

const moduleIds={overview:['unrate','cpi','gdp','yield'],labor:['payroll','unrate','underemployment','weeklyHours'],fiscal:['receipts','outlays','netInterest','primaryDeficit'],refinancing:['marketableDebt'],yields:['yield','realYield10','spread2s10s','inflationComp10'],auctions:['auctionOfferingMonthly'],ownership:['foreignTreasuryHoldings','fedTreasuryHoldings','somaTreasuryHoldings'],macro:['gdpTotalContribution','gdpConsumptionContribution','gdpInvestmentContribution','gdpGovernmentContribution'],market:['dealerNetTreasury','dealerRepo','dealerFailsDeliver','sofr']};
const sourceIds={fiscal:['fiscal','treasury'],refinancing:['refinancing'],yields:['yields','treasury'],auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning']};
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
  fetchedAt:source.fetchedAt,provenance:source.provenance,dataStatus:'captured-as-known',error:null};
}

/** Build explicitly scoped frozen inputs; never promise a mutable URL is a saved result. */
export function buildPinContext(state,{historyState,catalog=series,sources=dataStatus.sources,snapshot=dataStatus,events=releases,now=new Date()}={}){
 let selected=state.page==='indicator'?[state.seriesId]:state.page==='macroCoverage'?[state.macroMeasure]:state.page==='watchlist'?state.saved:moduleIds[state.page]??state.selected;
 let capturedCatalog=catalog,capturedSources=sources;
 const context={page:state.page,route:routeFor(state),moduleSources:Object.fromEntries((sourceIds[state.page]??[]).filter(id=>sources[id]).map(id=>[id,sources[id]])),attachments:[],scope:'Selected registered measurements; explicitly retained supplementary inputs and CSVs when present.'};
 const assumptions={comparison:state.page==='explore'&&state.exploreMode==='compare'?state.comparison:'native',transform:state.page==='indicator'?state.transform:'level',missingDates:'No interpolation or frequency aggregation; unmatched dates remain unavailable.'};
 if(state.page==='macroCoverage')context.familyReadings=coverageFamilies[state.macroFamily].ids.map(id=>({id,name:catalog[id].name,unit:catalog[id].unit,definition:catalog[id].definition,latest:catalog[id].observations.at(-1)??null,fetchedAt:catalog[id].fetchedAt,source:catalog[id].source}));
 if(state.page==='refinancing'){
  Object.assign(assumptions,{horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock,interpretation:'Hypothetical higher/lower-rate refinancing sensitivity, not a rate forecast; observed instruments are separate from future issuance assumptions.'});
  context.attachments=[attachment('refinancing-observed.csv',refinancingCsv(sources.refinancing)),attachment('refinancing-scenarios.csv',refinancingCsv(sources.refinancing,{scenario:true,horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock}))];
 }
 if(state.page==='fiscal')context.attachments=[attachment('fiscal-financing.csv',fiscalFinancingCsv(sources.fiscal))];
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

export function buildPublicationPin(archive,cutoff,period){
 const view=selectPublicationHistory(archive,cutoff,period),row=view.latest;
 if(!row)throw new Error('No official publication is available by this date.');
 const quarter=periodLabel({frequency:'Quarterly'},row.period);
 const captured={...series.gdp,name:`Real GDP · ${quarter} ${row.estimate} estimate`,sourceUrls:[row.sourceUrl],lastAttemptAt:null,warnings:[],coverageNote:`Official publication estimate for ${quarter}, published ${row.publicationDate}; selected dated workbook evidence through ${view.cutoff}. Retrieval is separate from publication; this is a historical published value, not the latest NIPA series.`,source:{name:'U.S. Bureau of Economic Analysis',url:row.sourceUrl,seriesIds:row.sourceIds},sourceUrl:row.sourceUrl,sourceTitle:row.sourceTitle,licenseUrl:row.licenseUrl,attribution:row.attribution,calculation:row.calculation,fetchedAt:row.provenance.at(-1).retrievedAt,provenance:row.provenance,dataStatus:'official',publicationNote:`Official publication date ${row.publicationDate}, day precision; exact publication instant unavailable.`,observations:[{date:row.period,value:row.value,sourceValue:row.sourceValue,publishedAt:null}],error:null};
 return {state:{page:'indicator',seriesId:'gdp',selected:['gdp'],window:'all',transform:'level',comparison:'native'},catalog:{gdp:captured},sources:{},snapshot:{generatedAt:dataStatus.generatedAt},context:{publicationCutoff:view.cutoff,publicationPeriod:view.period,publicationSourceContext:publicationContext(row),publicationReleases:view.releases,attachments:[attachment('gdp-publication-history.csv',publicationCsv(archive,cutoff,view.period))]},assumptions:{publicationDatePrecision:'day',scope:'Selected official GDP publication estimates; separate from current GDP and local capture replay.'}};
}
