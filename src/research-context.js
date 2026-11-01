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
import {asKnownOn,normalizeVintageTimestamp} from './vintages.js';
import {vintagesCsv,normalizedCutoff} from './vintages-page.js';
import {refinancingCsv} from './refinancing-page.js';
import {yieldCurvesCsv,yieldOverlayDates} from './yields-page.js';
import {H15_TREASURY_CMT_URL} from './yields.js';
import {auctionSelection} from './auctions-page.js';
import {ownershipCsv} from './ownership-page.js';
import {macroContributionsCsv} from './macro-page.js';
import {fiscalFinancingCsv} from './research-exports.js';
import {selectPublicationHistory,publicationCsv,publicationContext} from './publication-history.js';
import {periodLabel,transformSeries,resolveDateWindow,windowObservations,BLS_DATA_NOTICE} from './model.js';
import {cpiPublicationIds,selectCpiPublicationHistory,cpiPublicationCsv} from './cpi-publication-history.js';
import {buildGdpRevisionMatrix,gdpRevisionMatrixCsv} from './gdp-revision-matrix.js';
import {buildCoverageInventory,coverageInventoryCsv} from './coverage-inventory.js';
import {publicationExplanationRows,publicationExplanationsCsv} from './publication-explanation-view.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from './claims-publication-history.js';
import {matchReleaseEvidence,selectReleaseEvidence,releaseDelivery} from './release-evidence.js';
import {currentAccountContext,currentAccountCsv} from './current-account-view.js';
import {currentAccountGdpCsv,currentAccountGdpHistoryCsv} from './current-account-gdp-view.js';
import {currentAccountGdpBreakdownCsv} from './current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingCsv} from './current-account-gdp-trailing-view.js';
import {resolveCurrentAccountComparisonMeasure} from './current-account-gdp-comparison.js';
import {resolveCurrentAccountComponentEffectMeasure} from './current-account-gdp-component-effects.js';
import {viewRange} from './workspace-context.js';
import {pceScenarioOptions} from './workspace-context.js';
import {economicEvidenceContext} from './economic-evidence.js';
import {pceBaseEffectsContext} from './pce-base-effects.js';
import {overviewChartEvidence} from './dashboard-charts.js';
import {pceHorizonChartCatalog} from './dashboard-chart-data.js';
import {stitchDeskContracts,stitchPageSources} from './stitch-desk-contracts.js';
import {createStitchEvidence,stitchEvidenceSourceIds,validateStitchLegacySources} from './stitch-evidence.js';
import {fxScenario} from './specialist-desks.js';
import {validateFrozenFomcCalendar} from './fomc-calendar-validation.js';

const moduleIds={credit:['bankLoans','bankDeposits','ciStandardsLarge','onRrpAccepted'],overview:['gdp','pceCoreMonthly','payroll','policyTargetUpper'],labor:['payroll','unrate','underemployment','weeklyHours'],fiscal:['receipts','outlays','netInterest','primaryDeficit'],refinancing:['marketableDebt'],yields:['yield','realYield10','spread2s10s','inflationComp10'],auctions:['auctionOfferingMonthly'],ownership:['foreignTreasuryHoldings','fedTreasuryHoldings','somaTreasuryHoldings'],macro:['gdpTotalContribution','gdpConsumptionContribution','gdpInvestmentContribution','gdpGovernmentContribution'],market:['dealerNetTreasury','dealerRepo','dealerFailsDeliver','sofr']};
const sourceIds={overview:['macroContributions'],credit:['bankCredit','lendingSurvey','fedBalance','onRrp','householdDebt','loanDelinquency'],fiscal:['fiscal','treasury'],refinancing:['refinancing'],yields:['yields','treasury'],auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning']};
const attachment=(name,content)=>({name,content,type:'text/csv'});
const measurementFields=['name','unit','frequency','adjustment','definition','observationType','format','precision','periodType','dateConvention','measure','calculation'];
const strings=values=>[...new Set(values.filter(value=>typeof value==='string'&&value.trim()))];

export function freezeCandidates(state,{catalog=series,events=releases,now=new Date()}={}){
 let ids=state.page==='indicator'?[state.seriesId]:['macroCoverage','labor'].includes(state.page)?[state.macroMeasure]:state.page==='watchlist'?state.saved:state.page==='vintages'?[state.vintageSeries]:moduleIds[state.page]??state.selected;
 if(state.page==='calendar')ids=calendarRelatedIds(calendarScope(state,{events,catalog,now}).selected);
 if(state.page==='explore'&&state.exploreMode==='coverage')ids=buildCoverageInventory(catalog,state).rows.map(row=>row.id);
 return [...new Set(stitchDeskContracts[state.page]?.ids??ids??[])].filter(id=>Object.hasOwn(catalog,id));
}

function yieldPinInputs(state,catalog,sources){
 const ids=moduleIds.yields.filter(id=>catalog[id]),range=viewRange(state),window=resolveDateWindow(range,ids.map(id=>catalog[id]));
 if(window.error)throw new Error(window.error);
 const scopedRows=rows=>{
  const selected=windowObservations(rows,window),prior=selected.length?rows.findLast(row=>row.date<selected[0].date):null;
  return prior?[prior,...selected]:selected;
 };
 const receipts=(item,rows,provenance=item.provenance??[])=>{
  const urls=new Set([item.sourceUrl,...(item.sourceUrls??[]),...rows.flatMap(row=>[row.sourceUrl,...(row.sourceUrls??[])])].filter(Boolean));
  const matched=provenance.filter(row=>urls.has(row.url));
  return matched.length?matched:provenance;
 };
 const scopedCatalog={...catalog,...Object.fromEntries(ids.map(id=>{
  const item=catalog[id],observations=scopedRows(item.observations);
  return [id,{...item,observations,provenance:receipts(item,observations)}];
 }))};
 const overlayDates=yieldOverlayDates(sources.yields,state),curves=(sources.yields?.curveHistory??[]).filter(row=>overlayDates.includes(row.date));
 const scope='Frozen yield inputs retain the analysis window and one preceding observation for change lookback, exact selected curve overlays, windowed spread-chart inputs, and current rate readings with their previous observations at their own reference dates. The full website history is not included unless All is requested. Current revised history and actual retrieval receipts do not reconstruct original publication vintages.';
 const currentIds=['spread2s10s','spread3m10y','realYield10','inflationComp10','policyTargetLower','policyTargetUpper','effr','sofr'];
 const currentReadings=currentIds.filter(id=>catalog[id]).map(id=>{
  const item=catalog[id],observations=item.observations.slice(-2);
  return {...item,observations,provenance:receipts(item,observations)};
 });
 const moduleSources=Object.fromEntries(['treasury','yields'].filter(id=>sources[id]).map(id=>{
  const original=sources[id],seriesIds=id==='treasury'?['yield']:['spread2s10s','spread3m10y'];
  const series=Object.fromEntries(seriesIds.filter(key=>original.series?.[key]).map(key=>[key,{...original.series[key],observations:scopedRows(original.series[key].observations)}]));
  const rows=Object.values(series).flatMap(item=>item.observations),urls=new Set(Object.values(series).flatMap(item=>[item.sourceUrl,...(item.sourceUrls??[]),...item.observations.flatMap(row=>[row.sourceUrl,...(row.sourceUrls??[])])]));
  if(id==='yields')for(const curve of curves){for(const row of original.provenance??[])if(row.url.includes(`.csv/${curve.date.slice(0,4)}/all`))urls.add(row.url);for(const supplement of Object.values(curve.nominalSupplements??{}))urls.add(supplement.sourceUrl);}
  const dates=[...rows.map(row=>row.date),...(id==='yields'?curves.map(row=>row.date):[])].sort();
  const metadata=Object.fromEntries(['id','status','fetchedAt','lastAttemptAt','error','warnings','sourceNotice','licenseUrl','termsUrl','attribution','sourceTitle'].filter(key=>original[key]!==undefined).map(key=>[key,original[key]]));
  let h15GapEvidence;
  if(id==='yields'){
   const overlayDates=curves.filter(row=>row.nominalSupplements).map(row=>row.date),required=new Set([...overlayDates,...rows.filter(row=>row.sourceUrls?.includes(H15_TREASURY_CMT_URL)).map(row=>row.date)]);
   if(required.size){const supporting=original.h15GapEvidence?.curves?.filter(row=>required.has(row.date))??[];if(supporting.length!==required.size)throw new Error('Missing scoped H15 yield input evidence');h15GapEvidence={version:2,scope:'selected-inputs',overlayDates,curves:structuredClone(supporting)};}
  }
  return [id,{...metadata,series,coverageStart:dates[0]??null,coverageEnd:dates.at(-1)??null,coverageNote:scope,provenance:(original.provenance??[]).filter(row=>urls.has(row.url)),...(id==='yields'?{curveHistory:curves,methodologyBreaks:original.methodologyBreaks??[],...(h15GapEvidence?{h15GapEvidence}:{})}:{})}];
 }));
 return {catalog:scopedCatalog,sources:{...sources,...moduleSources},moduleSources,scope,overlayDates,currentReadings,window:{...window,range}};
}

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
  inputProvenanceScope:item.inputProvenanceScope??source.inputProvenanceScope,
  fetchedAt:item.fetchedAt??source.fetchedAt,provenance:item.provenance??source.provenance,dataStatus:'captured-as-known',error:null};
}

/** Build explicitly scoped frozen inputs; never promise a mutable URL is a saved result. */
export function buildPinContext(state,{historyState,catalog=series,sources=dataStatus.sources,snapshot=dataStatus,events=releases,now=new Date(),changes={},checkpoint={},failures=[],publicationContexts={},overviewChartSettings,overviewPreview}={}){
 let selected=state.page==='indicator'?[state.seriesId]:['macroCoverage','labor'].includes(state.page)?[state.macroMeasure]:state.page==='watchlist'?state.saved:moduleIds[state.page]??state.selected;
 if(stitchDeskContracts[state.page])selected=stitchDeskContracts[state.page].ids;
 let capturedCatalog=catalog,capturedSources=sources;
 const context={page:state.page,route:routeFor(state,{legacyWindow:true}),
  moduleSources:Object.fromEntries((sourceIds[state.page]??[]).filter(id=>sources[id]).map(id=>[id,sources[id]])),
  attachments:[],scope:'Selected registered measurements; explicitly retained supplementary inputs and CSVs when present.'};
 const assumptions={comparison:state.page==='explore'&&state.exploreMode==='compare'?state.comparison:'native',transform:state.page==='indicator'?state.transform:'level',missingDates:'No interpolation or frequency aggregation; unmatched dates remain unavailable.'};
 const stitchEvidence=createStitchEvidence(state,sources,viewRange(state));
 if(stitchEvidence){
  context.stitchEvidence=stitchEvidence;
  const keys=['page','seriesId','window','startDate','endDate','range','fxScenario','fxFedShock','fxForeignShock','fxHorizon','specialistView','specialistRange'];
  context.stitchRenderState=Object.fromEntries(keys.filter(key=>state[key]!==undefined).map(key=>[key,state[key]]));
  const oldSources=[...(stitchDeskContracts[state.page]?.sources??[]),...(state.page==='indicator'?[catalog[state.seriesId]?.agency]:[]),...(state.page==='ownership'?['ownership']:[])].filter(id=>!stitchEvidenceSourceIds.includes(id)&&sources[id]);
  Object.assign(context.moduleSources,Object.fromEntries(oldSources.map(id=>[id,sources[id]])));
  if(!validateStitchLegacySources(context))throw Error('Specialist supporting inputs require complete native measurements, reviewed source receipts and calculation lineage before freezing');
  context.scope+=' '+stitchEvidence.scope;
  if(state.page==='fxBasis'){const m=fxScenario(sources,state);assumptions.fxScenario={type:'user-scenario',scenario:m.scenario,fedShockBps:m.fedShockBps,foreignShockBps:m.foreignShockBps,horizonMonths:m.horizonMonths,observedBasis:'Unavailable: official reference spot and administered policy rates do not establish market FX forwards, OIS or cross-currency basis.'};}
  if(state.page==='fomc'){
   const calendar={version:1,asOf:now.toISOString(),source:snapshot.calendar?.sources?.fomc};
   if(!validateFrozenFomcCalendar(calendar))throw Error('Complete verified FOMC date-only calendar must be retained before freezing this desk');
   context.stitchCalendar=calendar;
  }
 }
 if(state.page==='explore'&&state.exploreMode==='coverage'){
  const inventory=buildCoverageInventory(catalog,{...state,publicationContexts});
  if(!inventory.rows.length)throw new Error('No matching measurement coverage is available to freeze.');
  selected=inventory.rows.slice(0,4).map(row=>row.id);
  const publicationIds=new Set(inventory.rows.map(row=>row.publications.seriesId).filter(Boolean));
  const retainedPublications=Object.fromEntries(Object.entries(publicationContexts).map(([family,value])=>[family,{status:value.status,error:value.error??null,archive:{version:1,releases:(value.archive?.releases??[]).filter(row=>publicationIds.has(row.seriesId)).map(row=>({id:row.id,seriesId:row.seriesId,period:row.period,publicationDate:row.publicationDate,estimate:row.estimate,releaseStage:row.releaseStage,provenance:row.provenance}))}}]));
  context.coverageInventory={version:1,catalog:inventory.inputs,filters:inventory.filters,registeredCount:inventory.totalRegistered,publicationContexts:retainedPublications};
  context.attachments.push(attachment('coverage-inventory.csv',coverageInventoryCsv(inventory)));
  context.scope='Coverage inventory retains the filtered measurement metadata, original reference dates/values/suppression flags, source receipts and loaded publication-coverage inputs, plus its exact CSV. The compatible primary CSV retains up to four registered measurements; it is not the complete coverage inventory. Reference coverage is not publication-vintage coverage.';
 }
 if(state.page==='overview'){
  context.overviewComparisonCharts=overviewChartEvidence(overviewChartSettings,catalog,overviewPreview);
  const overviewReadings=['gdp','privateDomesticDemandGrowth','gdpInventoriesContribution','realSpendingMonthly','pceCoreMonthly','pceCore','payroll','weeklyHours','unrate','claimsAdvance','continuedClaimsAdvance','policyTargetLower','policyTargetUpper','effr','yield','spread2s10s','publicDebt','interestRevenueRatio','netInterestTtm'].map(id=>catalog[id]).filter(Boolean);
  overviewReadings.push(pceHorizonChartCatalog({lookup:id=>catalog[id]})['pce-horizons'].catalog.corePce1m);
  context.overviewTopicReadings=overviewReadings.map(item=>({id:item.id,name:item.name,unit:item.unit,frequency:item.frequency,adjustment:item.adjustment,definition:item.definition,observationType:item.observationType,calculation:item.calculation,latest:item.observations.at(-1)??null,prior:item.observations.at(-2)??null,fetchedAt:item.fetchedAt,dataStatus:item.dataStatus,error:item.error,source:item.source,provenance:item.provenance}));
  context.overviewChartInputs=['pceMonthly','pceCoreMonthly','payroll','payrollAverage3m','realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction'].filter(id=>catalog[id]).map(id=>{const item=catalog[id],shown=transformSeries(item,'level',12);return {id,name:item.name,unit:item.unit,frequency:item.frequency,adjustment:item.adjustment,calculation:item.calculation,fetchedAt:item.fetchedAt,dataStatus:item.dataStatus,error:item.error,source:item.source,provenance:item.provenance,observations:shown.observations};});
  context.overviewBrief=evidenceBrief({catalog,sources,changes:changes.rows??[],failures,publicationContexts});context.overviewCheckpoint=checkpoint;
  context.overviewFollowing=watchlistMonitor(state.saved??[],{catalog,events,now}).map(({id,current,nextEvent})=>({id,name:current.name,status:current.dataStatus,update:monitorUpdateLabel(id,changes,checkpoint),nextEvent}));
  context.nextCatalysts=nextCatalysts(events,{now});context.calendarStatus=snapshot.calendar;
  context.scope='The primary CSV retains four registered measurements. Supplemental context retains all Overview topic readings, including private domestic demand, inventory contribution, weekly hours, trailing net interest and the calculated one-month annualized core PCE diagnostic independently of chart selections; monthly inflation and three-month-average payroll chart inputs; supporting activity and income; contribution-source evidence; factual evidence and selected upcoming schedules. Values, calculation metadata and clocks are retained independently of current data; the frozen viewer presents context rather than an exact visual replay.';
 }
 if(['macroCoverage','labor'].includes(state.page))context.familyReadings=coverageFamilies[state.page==='labor'?'labor':state.macroFamily].ids.map(id=>({id,name:catalog[id].name,unit:catalog[id].unit,frequency:catalog[id].frequency,adjustment:catalog[id].adjustment,definition:catalog[id].definition,observationType:catalog[id].observationType,dataStatus:catalog[id].dataStatus,latest:catalog[id].observations.at(-1)??null,prior:catalog[id].observations.at(-2)??null,fetchedAt:catalog[id].fetchedAt,source:catalog[id].source}));
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
  context.currentAccountGdpComparison={version:1,range:viewRange(state),measure:resolveCurrentAccountComparisonMeasure(state.macroMeasure),inputContext:'currentAccountGdpBreakdown'};
  context.currentAccountGdpContributions={version:1,range:viewRange(state),inputContext:'currentAccountGdpBreakdown'};
  context.currentAccountGdpBalanceEffects={version:1,method:'symmetric-two-order-v1',range:viewRange(state),inputContext:'currentAccountGdpBreakdown'};
  context.currentAccountGdpComponentEffects={version:1,method:'symmetric-two-order-v1',measure:resolveCurrentAccountComponentEffectMeasure(state.macroMeasure),range:viewRange(state),inputContext:'currentAccountGdpBreakdown'};
  context.currentAccountGdpAllComponentEffects={version:1,method:'symmetric-two-order-v1',range:viewRange(state),inputContext:'currentAccountGdpBreakdown'};
  context.attachments=[attachment('current-account-current-prior.csv',currentAccountCsv(source)),attachment('current-account-gdp.csv',currentAccountGdpCsv(sources)),attachment('current-account-gdp-history.csv',currentAccountGdpHistoryCsv(sources,viewRange(state))),attachment('current-account-gdp-breakdown.csv',currentAccountGdpBreakdownCsv(sources,viewRange(state))),attachment('current-account-gdp-trailing.csv',currentAccountGdpTrailingCsv(sources,viewRange(state),{comparisonMeasure:context.currentAccountGdpComparison.measure}))];
  context.scope='Selected focused history, latest topic readings, exact current/prior ITA/GDP context, and full retained current-account total, four component balances and nominal GDP input histories for the selected historical ratio, breakdown and trailing-four-quarter windows. The selected quarterly-versus-trailing comparison reuses these inputs and the trailing CSV, including pre-window lookback, without duplicating histories or source evidence. Quarterly and trailing-four-quarter change contributions can be reconstructed from the retained breakdown inputs, recorded version-1 method and endpoint window; a contributions CSV is generated on request, not retained as an original attachment. Separate balance and GDP-denominator effects are reconstructed from the same retained inputs and recorded symmetric-two-order-v1 method, which allocates interaction equally as a Meridian accounting convention rather than an official BEA or causal attribution. The recorded selected component and endpoint window independently reconstruct its quarterly and trailing-four-quarter balance, GDP-denominator and combined-change history charts and CSV from these same six retained input histories. An independent optional context reconstructs the side-by-side all-four-component comparison for both horizons from the same six retained histories and its recorded endpoint window. Effects CSVs are generated on request; all five original attachments remain unchanged. Retains independent source metadata/retrievals, ITA table release date, original scoped CSVs, reconciliation residuals and missing-quarter evidence. NIPA trade remains distinct; other full measurement histories are not frozen.';
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
 if(state.page==='yields'){
  const retained=yieldPinInputs(state,catalog,sources);
  capturedCatalog=retained.catalog;capturedSources=retained.sources;
  Object.assign(context,{moduleSources:retained.moduleSources,scope:retained.scope,yieldAnalysisWindow:retained.window,yieldOverlayDates:retained.overlayDates,yieldCurrentReadings:retained.currentReadings});
  context.attachments=[attachment('yield-curve-overlays.csv',yieldCurvesCsv(sources.yields,state))];
 }
 if(state.page==='auctions'){
  const {type,selected}=auctionSelection(sources.auctions,state.auctionType,state.auctionId);
  context.auctionExports={version:1,securityType:type,auctionId:selected?.id??'',csvMode:'generated-full-retained-v1'};
  context.scope='Complete auction source, original response receipts and monthly offering inputs are retained independently of the selected security filter and analysis window. Both specialist CSVs are generated from these frozen inputs with the recorded security type, selected auction and versioned method; duplicated CSV content is not stored. Explicit response-page lineage resolves each row to its actual capture receipt. Retrieval does not reconstruct historical publication vintages.';
 }
 if(state.page==='ownership'){
  context.attachments=[attachment('debt-ownership.csv',ownershipCsv(sources.ownership,{z1Periods:36,somaPeriods:104}))];
  context.scope='Complete ownership source and full selected-series inputs are retained. The supplementary CSV contains the last 36 Z.1 observations matching the ownership page chart and last 104 SOMA observations, with exact prior-quarter and prior-week changes calculated from the full histories. The SOMA page chart retains its existing 36-observation view. Ordinary Ownership CSV downloads retain all source periods. Current revised history and actual retrieval receipts do not reconstruct original publication vintages.';
 }
 if(state.page==='macro')context.attachments=[attachment('macro-contributions.csv',macroContributionsCsv(sources.macroContributions))];
 if(state.page==='market'){
  context.fundingDistributions={version:2,range:viewRange(state),csvMode:'generated-full-retained-v1'};
  context.scope='Primary registered measurements plus the complete full-retained market-functioning source, independent of the selected window. Funding distribution panels retain their exact date window, published median/percentile/volume fields and source notices. The specialist CSV is generated on download from these frozen inputs with the versioned generated full-retained CSV method; duplicated CSV content is not stored.';
 }
 if(state.page==='calendar'){
  const scope=calendarScope(state,{events,catalog,now}),event=scope.selected;
  if(!event)throw new Error('No calendar releases match the current filters. Choose another window or clear the filters before pinning.');
  selected=calendarRelatedIds(event);Object.assign(context,{calendar:snapshot.calendar,releases:scope.filtered,selectedEvent:event,calendarScope:{view:scope.view,month:scope.month,day:state.day??'all',topic:state.calendarTopic??'All topics',watchOnly:Boolean(state.watchOnly),saved:state.watchOnly?[...(state.saved??[])]:[],eventIds:scope.filtered.map(item=>item.id),window:scope.window},calendarReplay:'Frozen current context only; historical calendar replay is unavailable.'});
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
  const selectedCaptureHistory={version:1,captures:historyState.history.captures.filter(row=>row.sourceId===agency&&normalizeVintageTimestamp(row.capturedAt)<=cutoff).map(row=>({...row,series:Object.hasOwn(row.series,id)?{[id]:row.series[id]}:{},removedSeries:row.removedSeries.filter(key=>key===id)}))};
  Object.assign(context,{captureCutoff:cutoff,selectedCaptureHistory});context.attachments=[attachment('captured-by-values.csv',vintagesCsv(selectedCaptureHistory,{seriesId:id,cutoff}))];
 }
 if(state.page==='labor'||state.page==='macroCoverage'&&state.macroFamily==='labor'){
  const evidence=economicEvidenceContext(sources.laborEvidence,{range:viewRange(state)});context.economicEvidence={laborEvidence:evidence};context.attachments.push(...evidence.attachments);
 }
 if(state.page==='macroCoverage'&&state.macroFamily==='prices'){
  const evidence=economicEvidenceContext(sources.pcePriceContributions,{range:viewRange(state)});context.economicEvidence={pcePriceContributions:evidence};context.attachments.push(...evidence.attachments);
  context.pceBaseEffects=pceBaseEffectsContext(catalog[state.pceBaseIndex??'pceIndex'],pceScenarioOptions(state));context.attachments.push(...context.pceBaseEffects.attachments);
  assumptions.conditionalPce=pceScenarioOptions(state);
 }
 if(state.freezeSelection!==undefined){
  const candidates=freezeCandidates(state,{catalog,events,now});
  if(!Array.isArray(state.freezeSelection)||state.freezeSelection.length<1||state.freezeSelection.length>4||new Set(state.freezeSelection).size!==state.freezeSelection.length||state.freezeSelection.some(id=>!candidates.includes(id)))throw new Error('Choose one to four measurements from the freeze preview.');
  selected=state.freezeSelection;
 }
 selected=[...new Set(selected??[])].filter(id=>Object.hasOwn(capturedCatalog,id)).slice(0,4);
 if(state.page==='watchlist')context.watchlist={version:1,id:state.activeWatchlistId??null,name:state.watchlists?.find(row=>row.id===state.activeWatchlistId)?.name??'My watchlist',membership:[...(state.saved??[])],frozenIds:[...selected],omittedIds:(state.saved??[]).filter(id=>!selected.includes(id)),scope:'Membership and ordering are contextual settings. Only frozenIds have retained observations in the primary package; omitted measurements are not frozen.'};
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
 const row=view.actual,args=row.seriesId==='gdp'?buildPublicationPin(archive,row.publicationDate,row.period,{explanationArchive,explanationStatus}):cpiPublicationIds.includes(row.seriesId)?buildCpiPublicationPin(archive,row.seriesId,row.publicationDate,row.period):buildClaimsPublicationPin(archive,row.seriesId,row.publicationDate,row.period);
 Object.assign(args.context,{releaseEvidence:view,releaseSchedule:event,
  releaseDelivery:releaseDelivery(event,row),releaseRoute:routeFor(state,{legacyWindow:true})});
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

export function buildCpiPublicationPin(archive,seriesId,cutoff='',period=''){
 const view=selectCpiPublicationHistory(archive,{seriesId,cutoff,period}),row=view.latest;
 if(!row)throw new Error('No retained CPI publication is available for this month and cutoff.');
 const current=series[seriesId],label=`${seriesId==='cpi'||seriesId==='cpiMonthly'?'Headline':'Core'} CPI · ${seriesId.includes('Monthly')?'monthly SA':'12-month NSA'}`;
 // Published facts use the archived response, independently of live API row lineage.
 const captured={...current,inputProvenanceScope:undefined,lastAttemptAt:null,short:label,name:`${label} · ${row.period} · ${row.estimate} published ${row.publicationDate}`,definition:'Published CPI-U, U.S. city average percentage from this dated BLS Table A edition. Monthly seasonally adjusted and twelve-month not-seasonally-adjusted rates are distinct. This is not a calculation from current rounded index levels.',measure:label,observationType:'official',precision:1,frequency:row.frequency,unit:row.unit,adjustment:row.adjustment,calculation:row.calculation,source:{name:'U.S. Bureau of Labor Statistics',url:row.sourceUrl,seriesIds:row.sourceIds},sourceUrl:row.sourceUrl,sourceUrls:[row.sourceUrl],sourceTitle:row.sourceTitle,sourceNotice:BLS_DATA_NOTICE,licenseUrl:row.licenseUrl,attribution:row.attribution,fetchedAt:row.provenance.at(-1)?.retrievedAt,provenance:row.provenance,dataStatus:'official',error:null,warnings:row.footnotes??[],coverageNote:`Selected retained publication fact for ${row.period}, published ${row.publicationDate}, role ${row.releaseStage}. Later editions after ${view.cutoff} are excluded. Differences from current index-derived history are not automatically revisions.`,publicationNote:`Publication day ${row.publicationDate}; exact publication instant unknown.`,observations:[{date:row.period,value:row.value,sourceValue:row.sourceValue,publishedAt:null,publicationDate:row.publicationDate,publicationDatePrecision:'day',releaseStage:row.releaseStage,footnotes:row.footnotes}]};
 return {state:{page:'indicator',seriesId,selected:[seriesId],window:'all',transform:'level',comparison:'native'},catalog:{[seriesId]:captured},sources:{},snapshot:{generatedAt:dataStatus.generatedAt},context:{publicationSeries:seriesId,publicationCutoff:view.cutoff,publicationPeriod:view.period,publicationSelectedId:row.id,publicationReleases:view.releases,attachments:[attachment('cpi-publication-history.csv',cpiPublicationCsv(archive,{seriesId,cutoff,period:view.period}))]},assumptions:{publicationDatePrecision:'day',scope:'Selected published CPI rate and its same-reference-month retained editions. Printed prior-month comparisons are labelled separately from original publications; published rates are not substituted with current index calculations.'}};
}

export function buildGdpMatrixPin(archive,cutoff=''){
 const matrix=buildGdpRevisionMatrix(archive,{cutoff}),period=matrix.rows.at(-1)?.period;
 if(!period)throw new Error('No GDP publication is retained by this cutoff.');
 const args=buildPublicationPin(archive,matrix.cutoff,period);
 args.context.gdpRevisionMatrix={version:1,cutoff:matrix.cutoff,archive};
 args.context.attachments.push(attachment('gdp-revision-matrix.csv',gdpRevisionMatrixCsv(archive,{cutoff:matrix.cutoff})));
 args.context.scope='GDP revision matrix reconstructed from retained official publication inputs and this publication-day cutoff. Routine pair statistics use independent eligible-quarter counts. Primary CSV is the selected latest quarter; the original matrix CSV retains the complete selected matrix and evidence.';
 return args;
}
