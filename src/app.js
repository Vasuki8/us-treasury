import {createResearchSaveDrafts,researchSaveScope,renderResearchSave,filterFreezeCandidates,positionResearchSave,installResearchSaveDismissal} from './research-save.js';
import {createQuestionDrafts,filterQuestionPicker,saveResearchQuestion,questionFieldId} from './question-drafts.js';
import {rememberStableFocus,restoreStableFocus} from './stable-focus.js';
import { fiscalGdpCsv } from './fiscal-gdp-view.js';
import { creditContextCsv,fomcDocumentsCsv } from './credit-context-page.js';
import {currentAccountCsv} from './current-account-view.js';
import {currentAccountGdpCsv,currentAccountGdpHistoryCsv} from './current-account-gdp-view.js';
import {currentAccountGdpHistoryChartCatalog} from './current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownCsv,currentAccountGdpBreakdownChartCatalog} from './current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingCsv,currentAccountGdpTrailingChartCatalog} from './current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonCsv,currentAccountGdpComparisonChartCatalog} from './current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsCsv,currentAccountGdpContributionsChartCatalog} from './current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffectsCsv} from './current-account-gdp-balance-effects-view.js';
import {currentAccountGdpComponentEffectsCsv} from './current-account-gdp-component-effects-view.js';
import {CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS} from './current-account-gdp-component-effects.js';
import {CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES} from './current-account-gdp-comparison.js';
import { moveFollowed } from './watchlist-monitor.js';
import { relevantRefreshIds } from './research-status.js';
import { releases, dataStatus,series } from './data.js';
import {hydrateSource} from './data.js';
import {createSourceLoader} from './source-loader.js';
import {createSourceController,requiredSourceIds} from './source-controller.js';
import {revealedCalendarState} from './calendar-scope.js';
import { filterSeries, getSeries, latest, toCsv,periodLabel } from './model.js';
import {formatDisplayValue,formatDisplayChange} from './display-format.js';
import {normalizeDashboardChartSettings,pceHorizonChartCatalog} from './dashboard-chart-data.js';
import {fiscalFinancingCsv} from './research-exports.js';
import {refinancingCsv} from './refinancing-page.js';
import {yieldCurvesCsv} from './yields-page.js';
import {nearestCurveDate} from './yields.js';
import {auctionsCsv} from './auctions-page.js';
import {ownershipCsv} from './ownership-page.js';
import {macroContributionsCsv} from './macro-page.js';
import {vintagesCsv,normalizedCutoff} from './vintages-page.js';
import {marketFunctioningCsv} from './market-functioning-page.js';
import {mountCompactNavigation,syncCompactNavigation} from './compact-navigation.js';
import { renderPage } from './pages.js';
import {workspaceNavigation} from './research-navigation.js';
import { escapeHtml as esc, sourceNotice } from './ui.js';
import {pageSourceScope} from './page-source-scope.js';
import {humanTimestamp} from './ui-time.js';
import { mountFreshnessBanner } from './freshness-controller.js';
import { renderCharts,captureChartInspection } from './charts.js';
import { parseRoute, routeFor,destinationChanged,entryWindow } from './router.js';
import {readPreferences,writePreferences,normalizePreferences,saveNamedWatchlist,selectNamedWatchlist,removeNamedWatchlist} from './storage.js';
import {exportResearchSettings,importResearchSettings,mergeResearchSettings,MAX_RESEARCH_SETTINGS_BYTES} from './research-settings.js';
import {parseResearchQuestion} from './research-questions.js';
import { createHistoryLoader } from './history-loader.js';
import { createHistoryController, preserveHistoryView } from './history-controller.js';
import {viewRange,indicatorHref,createWorkspaceMemory,updateWorkspaceSelection} from './workspace-context.js';
import {createOverviewDisclosureMemory} from './overview-disclosures.js';
import {watchDisclosureCharts} from './page-hierarchy.js';
import {coverageFamilies} from './macro-registry.js';
import {exactIndicatorMatch} from './global-search.js';
import {createWorkspace,openWorkspace,MAX_RESEARCH_JSON_BYTES} from './research-workspaces.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageCsv,researchPackageAttachment} from './research-packages.js';
import {createResearchLibrary} from './research-library.js';
import {buildPinContext,freezeCandidates,buildPublicationPin,buildClaimsPublicationPin,buildReleasePin,buildCpiPublicationPin,buildGdpMatrixPin} from './research-context.js';
import {captureChanges,changesCsv,readChangeCheckpoint,writeChangeCheckpoint} from './capture-changes.js';
import {createPublicationLoader} from './publication-loader.js';
import {createClaimsPublicationLoader} from './claims-publication-loader.js';
import {createCpiPublicationLoader} from './cpi-publication-loader.js';
import {createPublicationController} from './publication-controller.js';
import {publicationCsv,selectPublicationHistory} from './publication-history.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv,claimsPublicationIds} from './claims-publication-history.js';
import {cpiPublicationIds,selectCpiPublicationHistory,cpiPublicationCsv} from './cpi-publication-history.js';
import {gdpRevisionMatrixCsv} from './gdp-revision-matrix.js';
import {buildCoverageInventory,coverageInventoryCsv} from './coverage-inventory.js';
import {fundingChartCatalog} from './funding-distribution.js';
import {createPublicationExplanationLoader} from './publication-explanation-loader.js';
import {publicationExplanationsCsv} from './publication-explanation-view.js';
import {economicEvidenceCsv,economicEvidenceChartCatalog} from './economic-evidence.js';
import {pceBaseEffectsCsv,pceBaseEffectsChartCatalog,buildPceBaseEffects} from './pce-base-effects.js';
import {pceScenarioOptions} from './workspace-context.js';

const root = document.getElementById('app');
const main = document.getElementById('main-content');
const status = document.getElementById('app-status');
mountCompactNavigation(document.querySelector('.functionbar'));
// Recheck source age while keeping native disclosure state independent of routes.

let storage;
try { storage = window.localStorage; } catch { /* Session remains usable without persistence. */ }
let state = { ...parseRoute(location.hash), ...readPreferences(storage) };
const freshnessController=mountFreshnessBanner(document.getElementById('data-freshness'),dataStatus,{getOptions:()=>({compact:true,relevantIds:relevantRefreshIds(state,series)})});
const researchLibrary=await createResearchLibrary(storage);
let changeCheckpoint=readChangeCheckpoint(storage,dataStatus.generatedAt),changeState={status:'idle',ids:[],history:null,error:null},changeKey='',activeWorkspaceId=null,researchLabel='',pinBusy=false;
let changeRowsCache=null;
let publicationArchive=null,publicationState={status:'idle',error:null};
const publicationLoader=createPublicationLoader();
const claimsPublicationLoader=createClaimsPublicationLoader();
const cpiPublicationLoader=createCpiPublicationLoader();
const publicationController=createPublicationController({gdpLoader:publicationLoader,claimsLoader:claimsPublicationLoader,cpiLoader:cpiPublicationLoader,getRoute:()=>state,onChange:()=>preserveHistoryView(main,()=>render())});
let publicationExplanations=null,explanationState={status:'idle',error:null};
const explanationLoader=createPublicationExplanationLoader();
const workspaceMemory=createWorkspaceMemory();
const researchDisclosures=createOverviewDisclosureMemory();
const saveDrafts=createResearchSaveDrafts(),questionDrafts=createQuestionDrafts();
installResearchSaveDismissal(main,document,{capture:()=>saveDrafts.capture(main)});
main.addEventListener('toggle',event=>{if(event.target.matches?.('.context-save')){saveDrafts.capture(main);positionResearchSave(main);}prepareReadableTables(main);},true);
if('scrollRestoration' in history)history.scrollRestoration='manual';
const historyLoader = createHistoryLoader(dataStatus.historyArchive);
const historyController = createHistoryController(historyLoader, {
  getRoute:() => state,
  onChange:() => preserveHistoryView(main, () => render()),
});
const sourceController=createSourceController(createSourceLoader(dataStatus.sourceArchive),{
  getRoute:()=>state,getLibrary:()=>researchLibrary.getState(),hydrate:hydrateSource,
  onChange:()=>preserveHistoryView(main,()=>render()),
});
const pageNames = {release:'Release evidence',credit:'Credit & banking',research:"Saved research",macroCoverage:'Economy',overview:'Overview',labor:'Labor Market',indicator:'Indicator Detail',calendar:'Calendar',explore:'Explore Data',watchlist:'Watchlist',fiscal:'Fiscal pressure',refinancing:'Refinancing risk',yields:'Rates & curves',auctions:'Auction demand',ownership:'Debt ownership',macro:'GDP contributions',vintages:'Retrieval history',market:'Market functioning'};

document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  main.focus();
});

function announce(message) { status.textContent=message; }
function rememberWorkspace(){
  const active=document.activeElement;
  workspaceMemory.remember(state,{left:window.scrollX,top:window.scrollY,focusHref:main.contains(active)&&active.tagName==='A'?active.getAttribute('href'):null,focusElement:main.contains(active)&&active.tagName==='A'?active:null});
}
function downloadCsv(content,filename,notice){
  const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce(notice);actionFeedback(notice);
}
function persist() {
  state={...state,...normalizePreferences(state)};
  state.storageAvailable=writePreferences(storage,state);
  return state.storageAvailable;
}

function applyAppearance() {
  root.dataset.theme=state.theme;
  root.dataset.density=state.density;
  document.documentElement.dataset.theme=state.theme;
  document.querySelector('meta[name="theme-color"]').content=state.theme==='Graphite'?'#131517':'#f9f9f8';
  const dark=state.theme==='Graphite',themeButton=document.getElementById('theme-toggle');
  themeButton.querySelector('[data-theme-label]').textContent=dark?'Dark':'Light';
  themeButton.querySelector('[data-theme-sun]').hidden=dark;
  themeButton.querySelector('[data-theme-moon]').hidden=!dark;
  themeButton.setAttribute('aria-label',`${dark?'Dark':'Light'} theme. Switch to ${dark?'Light':'Dark'} theme.`);
  themeButton.setAttribute('title',`Switch to ${dark?'Light':'Dark'} theme`);
  document.getElementById('density-select').value=state.density;
  const mobileDensity=document.getElementById('density-select-mobile');if(mobileDensity)mobileDensity.value=state.density;
}

function toggleTheme() {
  state.theme=state.theme==='Graphite'?'Light':'Graphite';
  const durable=persist();applyAppearance();
  announce(`${state.theme==='Graphite'?'Dark':'Light'} theme enabled. ${durable?'Saved in this browser.':'Changed for this session; browser storage is unavailable.'}`);
}

function rememberFocus(){return rememberStableFocus(main);}
function restoreFocus(focus){return restoreStableFocus(main,focus);}
function prepareReadableTables(container){
 for(const wrap of container.querySelectorAll('.table-wrap')){
  const visible=wrap.getBoundingClientRect().width>0,overflow=visible&&wrap.scrollWidth>wrap.clientWidth+2;
  wrap.dataset.overflow=String(overflow);
  if(overflow){wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',`${wrap.querySelector('caption')?.textContent??'Data table'} · Scroll horizontally for all columns`);}
  else {wrap.removeAttribute('tabindex');wrap.removeAttribute('role');wrap.removeAttribute('aria-label');}
 }
}
function actionFeedback(message,kind='status'){
 let node=main.querySelector('.page-action-feedback');if(!node){node=document.createElement('p');node.className='page-action-feedback';main.querySelector('.page-heading')?.after(node);}
 node.setAttribute('role',kind==='error'?'alert':'status');node.textContent=message;
}

function trackedChanges(){return [...new Set((state.saved.length?state.saved:state.selected).filter(id=>getSeries(id)))];}
function trackedFailures(){
 const agencies=new Set(trackedChanges().map(id=>series[id].agency));
 return Object.entries(dataStatus.sources).filter(([id,source])=>agencies.has(id)&&source.status!=='ok').map(([id,source])=>({id,...source}));
}
function syncPublications({retry=false}={}){
  publicationController.sync(state,{retry});
  const context=publicationController.context(state.publicationSeries);
  publicationArchive=context.archive;publicationState={status:context.status,error:context.error};
}
function syncPublicationExplanations({retry=false}={}){
  if(!(state.page==='release'||state.page==='research'&&state.researchView==='publications')||(state.publicationSeries??'gdp')!=='gdp'||explanationState.status==='loading'||!retry&&explanationState.status!=='idle')return;
  explanationState={status:'loading',error:null};
  explanationLoader.load({retry}).then(archive=>{
    publicationExplanations=archive;explanationState={status:'ready',error:null};
    if((state.page==='release'||state.page==='research'&&state.researchView==='publications')&&(state.publicationSeries??'gdp')==='gdp')preserveHistoryView(main,()=>render());
  }).catch(error=>{
    explanationState={status:'error',error:error.message};
    if((state.page==='release'||state.page==='research'&&state.researchView==='publications')&&(state.publicationSeries??'gdp')==='gdp')preserveHistoryView(main,()=>render());
  });
}
function syncChanges({retry=false}={}){
  if(!(state.page==='research'&&state.researchView==='changes'||['overview','watchlist'].includes(state.page)&&changeCheckpoint.enabled))return;
  const ids=trackedChanges(),key=ids.join(',');
  if(key===changeKey&&(changeState.status==='loading'||!retry&&['ready','error'].includes(changeState.status)))return;
  changeKey=key;changeState={status:'loading',ids,history:null,error:null};
  Promise.all(ids.map(id=>historyLoader.load(id,{retry}))).then(histories=>{
    if(changeKey!==key)return;
    const captures=new Map();
    for(const history of histories)for(const capture of history.captures)captures.set(capture.sourceId+'|'+capture.capturedAt,capture);
    changeState={status:'ready',ids,history:{version:1,captures:[...captures.values()].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.sourceId.localeCompare(b.sourceId))},error:null};
    if(['overview','watchlist'].includes(state.page)||state.page==='research'&&state.researchView==='changes')preserveHistoryView(main,()=>render());
  }).catch(error=>{
    if(changeKey!==key)return;
    changeState={status:'error',ids,history:null,error:error.message};
    if(['overview','watchlist'].includes(state.page)||state.page==='research'&&state.researchView==='changes')preserveHistoryView(main,()=>render());
  });
}
function changesContext(){
  if(changeState.status!=='ready')return changeState;
  try{
    const since=state.changeSince||changeCheckpoint.since,ids=changeState.ids.join(',');
    if(changeRowsCache?.history!==changeState.history||changeRowsCache.ids!==ids||changeRowsCache.since!==since)changeRowsCache={history:changeState.history,ids,since,rows:captureChanges(changeState.history,{ids:changeState.ids,since})};
    return {...changeState,rows:changeRowsCache.rows};
  }
  catch(error){return {...changeState,status:'error',error:error.message};}
}
function currentPackage(){return state.page==='research'&&state.researchView==='packages'?researchLibrary.getPackage(state.packageId):null;}
function renderCurrentCharts(inspection){
 renderCurrentChartsIn(main,inspection);
}
function renderCurrentChartsIn(container,inspection){
 if(dataStatus.sourceArchive&&sourceController.context(state).status!=='ready')return;
 const pkg=currentPackage(),history=pkg?.context.currentAccountGdpHistory,breakdown=pkg?.context.currentAccountGdpBreakdown,trailing=pkg?.context.currentAccountGdpTrailing,comparison=pkg?.context.currentAccountGdpComparison,contributions=pkg?.context.currentAccountGdpContributions,balanceEffects=pkg?.context.currentAccountGdpBalanceEffects,componentEffects=pkg?.context.currentAccountGdpComponentEffects,allComponentEffects=pkg?.context.currentAccountGdpAllComponentEffects;
 const chartCatalogs=pkg?{
  ...(history?currentAccountGdpHistoryChartCatalog(history.sources,{frozen:true}):{}),
  ...(breakdown?currentAccountGdpBreakdownChartCatalog(breakdown.sources,{frozen:true}):{}),
  ...(trailing&&breakdown?currentAccountGdpTrailingChartCatalog(breakdown.sources,{frozen:true}):{}),
  ...(comparison&&breakdown?currentAccountGdpComparisonChartCatalog(breakdown.sources,{frozen:true}):{}),
  ...((contributions||balanceEffects||componentEffects||allComponentEffects)&&breakdown?currentAccountGdpContributionsChartCatalog(breakdown.sources,{frozen:true,effects:Boolean(balanceEffects),componentEffects:Boolean(componentEffects||allComponentEffects),includeContributions:Boolean(contributions)}):{}),
 }:state.page==='macroCoverage'&&state.macroFamily==='external'?{
  ...currentAccountGdpHistoryChartCatalog(dataStatus.sources),...currentAccountGdpBreakdownChartCatalog(dataStatus.sources),
  ...currentAccountGdpTrailingChartCatalog(dataStatus.sources),
  ...currentAccountGdpComparisonChartCatalog(dataStatus.sources),
  ...currentAccountGdpContributionsChartCatalog(dataStatus.sources,{effects:true,componentEffects:true}),
 }:{};
 if([1,2].includes(pkg?.context.fundingDistributions?.version))chartCatalogs.funding=fundingChartCatalog(pkg.context.moduleSources?.marketFunctioning??{},{frozen:true});
 else if(!pkg&&state.page==='market')chartCatalogs.funding=fundingChartCatalog(dataStatus.sources.marketFunctioning);
 if(pkg){
  for(const evidence of Object.values(pkg.context.economicEvidence??{}))Object.assign(chartCatalogs,economicEvidenceChartCatalog(evidence.source,{frozen:true}));
  if(pkg.context.pceBaseEffects){const value=pkg.context.pceBaseEffects;Object.assign(chartCatalogs,pceBaseEffectsChartCatalog(value.indexSeries,value.model.assumptions,{frozen:true}));}
 }else{
  if(state.page==='overview')Object.assign(chartCatalogs,pceHorizonChartCatalog());
  if(state.page==='labor'||state.page==='macroCoverage'&&state.macroFamily==='labor')Object.assign(chartCatalogs,economicEvidenceChartCatalog(dataStatus.sources.laborEvidence));
  if(state.page==='macroCoverage'&&state.macroFamily==='prices')Object.assign(chartCatalogs,economicEvidenceChartCatalog(dataStatus.sources.pcePriceContributions),pceBaseEffectsChartCatalog(getSeries(state.pceBaseIndex),pceScenarioOptions(state)));
 }
 renderCharts(container,{...(pkg?{catalog:pkg.catalog}:{}),chartCatalogs,...(inspection?{inspection}:{})});
}
function researchActions(){
 if(state.page==='sources')return '';
 const alert=changeCheckpoint.enabled&&dataStatus.generatedAt>changeCheckpoint.snapshotAt?'<p class="panel-note amber" role="status">A newer snapshot is available since your local change checkpoint. <a href="#/research?view=changes">Review captured changes and collector failures</a>. A new snapshot does not itself establish a new economic release.</p>':'';
 if(state.page==='research')return alert;
 const active=researchLibrary.getWorkspace(activeWorkspaceId),name=researchLabel||active?.name||`${pageNames[state.page]} research`,candidates=state.page==='release'?[]:freezeCandidates(state),scope=researchSaveScope(state);
 const draft=saveDrafts.get(scope,{name,selected:state.freezeSelection??candidates.slice(0,4)});
 if(state.freezeSelection)draft.selected=[...state.freezeSelection];
 return alert+renderResearchSave({scope,draft,candidates,catalog:series,active:Boolean(active),watchlist:state.page==='watchlist',pending:pinBusy,release:state.page==='release'});
}

const workspacePreviews={overview:'gdp',explore:null};
let overviewChartSettings=normalizeDashboardChartSettings();
let workspacePreviewRequest=0;
async function chooseWorkspacePreview(id){
 const request=++workspacePreviewRequest,page=state.page,route=location.hash;
 try{if(page==='overview')await ensureSourceAction(requiredSourceIds(state,{ids:[id]}));}
 catch(error){if(request===workspacePreviewRequest&&state.page===page&&location.hash===route)announce(`Chart history unavailable: ${error.message}`);return false;}
 if(request!==workspacePreviewRequest||state.page!==page||location.hash!==route)return false;
 workspacePreviews[page]=id;render({preserveFocus:true});return true;
}
document.getElementById('workspace-topics').innerHTML=workspaceNavigation();

function render({focusHeading=false,preserveFocus=false,captureDrafts=true}={}) {
  if(captureDrafts){saveDrafts.capture(main);questionDrafts.capture(document);}
  const inspection=focusHeading?null:captureChartInspection(main);
  if(state.page==='calendar'){
    const normalized=revealedCalendarState(state);
    if(normalized!==state){state=normalized;history.replaceState(null,'',routeFor(state));}
  }
  const focus=preserveFocus?rememberFocus():null;
  const externalControlsOpen=main.querySelector('#external-history-controls')?.open??false;
  researchDisclosures.capture(main);
  historyController.sync(state);
  sourceController.sync(state);
  syncChanges();
  syncPublications();
  syncPublicationExplanations();
  applyAppearance();
  root.dataset.page=state.page==='labor'||state.page==='macroCoverage'&&state.macroFamily==='labor'?'labor':state.page;
  const failures=trackedFailures();
  const publicationContexts={gdp:publicationController.context('gdp'),claims:publicationController.context('claimsAdvance'),cpi:publicationController.context('cpiMonthly')};
  main.innerHTML=renderPage(state,{
    ...historyController.context(state),sourceState:sourceController.context(state),library:researchLibrary.getState(),
    questionDrafts:questionDrafts.snapshot(),changes:changesContext(),checkpoint:changeCheckpoint,failures,publicationContexts,
    publicationArchive,publicationState,publicationExplanations,explanationState,
    workspacePreview:workspacePreviews[state.page],overviewChartSettings,
  });
  main.querySelector('.page-heading .actions')?.insertAdjacentHTML('beforeend',researchActions());
  document.getElementById('workspace-page-label').textContent=main.querySelector('h1')?.textContent??pageNames[state.page];
  if(externalControlsOpen&&main.querySelector('#external-history-controls'))main.querySelector('#external-history-controls').open=true;
  researchDisclosures.restore(main);
  document.getElementById('ticker').hidden=true;
  freshnessController.refresh();
  syncCompactNavigation(root,state);
  document.getElementById('ticker').innerHTML=['yield','unrate','cpi','payroll'].map(id=>{
    const item=getSeries(id);
    return `<a href="#/series/${id}"><span>${esc(item.code)}</span>`
      +`<strong>${esc(formatDisplayValue(item,latest(item)?.value))}</strong>`
      +`<span class="mono">${esc(formatDisplayChange(item))}</span></a>`;
  }).join('');
  document.getElementById('saved-count').textContent=state.saved.length;
  document.getElementById('mobile-saved-count').textContent=state.saved.length;
  document.getElementById('saved-list').innerHTML=state.saved.length?state.saved.map(id=>`<div class="saved-item"><a href="${esc(indicatorHref(id,{...state,page:'watchlist'}))}">${esc(getSeries(id).short)}</a><button type="button" data-save="${id}" aria-label="Remove ${esc(getSeries(id).name)} from watchlist">×</button></div>`).join(''):'<p class="rail-note">No followed indicators.<br>Open an indicator and choose Follow.</p>';
  const notices=pageSourceScope(state,main.innerHTML);
  document.getElementById('source-notice').innerHTML=state.page==='sources'?'':sourceNotice(notices.sources,
    {scoped:true,calendarSources:notices.calendarSources});
  document.getElementById('snapshot-time').textContent=humanTimestamp(dataStatus.generatedAt,{prefix:'Updated '})||'Snapshot unavailable';
  document.title=`${state.page==='indicator'?getSeries(state.seriesId).name:pageNames[state.page]} — Meridian`;
  document.title=`${main.querySelector('h1')?.textContent??pageNames[state.page]} — Meridian`;
  renderCurrentCharts(inspection);prepareReadableTables(main);positionResearchSave(main);
  if(state.researchFeedback?.packageId===state.packageId&&state.page==='research')actionFeedback(state.researchFeedback.message);
  if(focusHeading) {
    const heading=main.querySelector('h1');
    heading.tabIndex=-1;heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
    const position=workspaceMemory.recall(state);
    if(position){
      workspaceMemory.restoreFocus(main,position);
      window.scrollTo({left:position.left,top:position.top,behavior:'instant'});
    }
  } else restoreFocus(focus);
}

function navigate(patch,{replace=false,preserveFocus=true}={}) {
  const previous={...state};
  saveDrafts.capture(main);questionDrafts.capture(document);
  if(destinationChanged(state,{...state,...patch}))rememberWorkspace();
  if(['page','seriesId','macroFamily','macroMeasure','vintageSeries','eventId','selected'].some(key=>key in patch&&patch[key]!==state[key]))delete state.freezeSelection;
  state={...state,...patch};
  if(['explore','watchlist'].includes(previous.page)&&!(previous.selected?.length)&&patch.selected?.length
    &&!Object.hasOwn(patch,'window')&&!Object.hasOwn(patch,'range'))state.window=entryWindow(state,location.hash);
  const automaticOrigin=['overview','fiscal','refinancing','auctions','ownership','macro','credit','calendar'].includes(previous.page);
  if(automaticOrigin&&patch.page&&patch.page!==previous.page
    &&!Object.hasOwn(patch,'window')&&!Object.hasOwn(patch,'range'))state.window=entryWindow(state,location.hash);
  if(state.page==='labor')Object.assign(state,{macroFamily:'labor',macroMeasure:parseRoute(routeFor(state)).macroMeasure});
  if(patch.selected&&state.returnTo)state.returnTo=updateWorkspaceSelection(state.returnTo,state.selected);
  const route=routeFor(state);
  if(location.hash!==route)history[replace?'replaceState':'pushState'](null,'',route);
  render({focusHeading:destinationChanged(previous,state),preserveFocus});
}

window.addEventListener('hashchange',()=>{
  if(location.hash==='#main-content'){main.focus();return;}
  const route=parseRoute(location.hash), previous={...state};
  const focusedControl=document.activeElement,focusActiveTab=previous.page==='indicator'&&route.page==='indicator'&&previous.seriesId===route.seriesId&&previous.tab!==route.tab&&main.contains(focusedControl)&&focusedControl?.matches?.('[role="tab"][data-tab]');
  if(destinationChanged(state,{...state,...route}))rememberWorkspace();
  if(route.page!=='indicator')route.seriesId=state.seriesId;
  if(!location.hash.includes('selected='))route.selected=state.selected;
  route.window=entryWindow(route,location.hash);
  delete state.freezeSelection;
  state={...state,...route};
  render({focusHeading:destinationChanged(previous,state),preserveFocus:true});
  if(focusActiveTab)document.getElementById(`detail-tab-${state.tab}`)?.focus({preventScroll:true});
});

function save(id) {
  if(!getSeries(id))return;
  const wasSaved=state.saved.includes(id);
  state.saved=wasSaved?state.saved.filter(value=>value!==id):[...state.saved,id];delete state.freezeSelection;
  const durable=persist();
  const removedRow=wasSaved&&state.page==='watchlist'&&main.contains(document.activeElement)?document.activeElement.closest('tr'):null;
  const nextSaved=removedRow?.nextElementSibling?.querySelector('[data-save]')?.dataset.save??removedRow?.previousElementSibling?.querySelector('[data-save]')?.dataset.save;
  render({preserveFocus:true});
  if(removedRow){
    const next=nextSaved?main.querySelector(`[data-save="${nextSaved}"]`):main.querySelector('.empty-state a')??main.querySelector('h1');
    if(next){if(next.tagName==='H1')next.tabIndex=-1;next.focus();}
  }
  announce(wasSaved?`${getSeries(id).short} removed from watchlist.`:`${getSeries(id).short} saved ${durable?'in this browser':'for this session; browser storage is unavailable'}.`);
}

function exportCsv(selection=null) {
  const ids=selection??(state.page==='indicator'?[state.seriesId]:state.selected);
  if(!ids.length){announce('Select at least one series to export.');return;}
  try {
    const comparison=state.page==='explore' && state.exploreMode==='compare'?state.comparison:'native';
    const content=toCsv(ids,{transform:state.page==='indicator'?state.transform:'level',range:['indicator','explore','watchlist','macroCoverage','labor'].includes(state.page)?viewRange(state):state.range,comparison});
    downloadCsv(content,`meridian-${ids.join('-')}.csv`,'CSV downloaded with displayed observations, units, official source identifiers, retrieval times and per-series data status. Unknown publication dates remain empty.');
  } catch(error) {announce(`Export unavailable: ${error.message}`);}
}

function downloadJson(pkg){
  const url=URL.createObjectURL(new Blob([exportResearchPackage(pkg)],{type:'application/json;charset=utf-8'})),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`meridian-package-${pkg.id}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Frozen research JSON downloaded with original observations, assumptions, exports and provenance.');
}
function applyPceAssumptions(){
  if(currentPackage())throw new Error('Frozen assumptions are read-only.');
  const read=id=>document.getElementById(id).value.trim(),raw=['pce-monthly-rate','pce-horizon-months','pce-target-annual'].map(read);
  if(raw.some(value=>value===''||!Number.isFinite(Number(value))))throw new Error('Enter finite numeric assumptions; no value was substituted.');
  const pceBaseIndex=read('pce-base-index');if(!['pceIndex','pceCoreIndex'].includes(pceBaseIndex))throw new Error('Choose a retained PCE price index.');
  const [pceMonthlyRate,pceHorizonMonths,pceTargetAnnualRate]=raw.map(Number),patch={pceBaseIndex,pceMonthlyRate,pceHorizonMonths,pceTargetAnnualRate};
  const result=buildPceBaseEffects(getSeries(pceBaseIndex),pceScenarioOptions(patch));if(result.error)throw new Error(result.error);
  navigate(patch);announce('Assumptions applied. The conditional chart, table, saved view and CSV now use this path. Future values remain modeled, not forecasts.');
}
async function ensureSourceAction(sourceIds,{retry=false}={}){
  if(!dataStatus.sourceArchive||!sourceIds.length)return;
  const route=routeFor(state);
  actionFeedback('Loading complete retained source data…');
  try{await sourceController.ensure(sourceIds,{retry});}
  catch(error){
    actionFeedback(`Complete retained history unavailable: ${error.message}`,'error');
    main.querySelector('.page-action-feedback')?.insertAdjacentHTML('beforeend',
      `<button type="button" class="action" data-retry-sources="${esc(sourceIds.join(','))}">Retry source history</button>`);
    throw error;
  }
  if(routeFor(state)!==route)throw new Error('The view changed while history loaded. Choose the action again in the current view.');
}
function stored(result,label){
  if(!result.ok)throw new Error(result.reason==='duplicate-id'?'This package ID already identifies different frozen evidence.':`Research library ${result.reason??'save failed'}.`);
  announce(`${label}${result.persisted?' saved in this browser.':' retained for this session. Export settings for Saved Views and watchlists; download JSON for Frozen Results before reloading.'}`);
}
function showCalendarPreview(force=false){
  if(!force&&!window.matchMedia('(max-width:736px)').matches)return;
  const preview=document.getElementById('calendar-selected-preview');
  if(!preview)return;
  preview.focus({preventScroll:true});
  preview.scrollIntoView({block:'nearest'});
}
async function handleResearchAction(d){
  state.researchError='';
  if('exportCoverage' in d)await ensureSourceAction(requiredSourceIds(state,{purpose:'export',action:d}));
  if('editQuestion' in d||'closeQuestion' in d){
    const id=d.editQuestion??d.closeQuestion,prior=researchLibrary.getWorkspace(id);if(!prior)throw new Error('Saved view unavailable.');
    questionDrafts.capture(document);
    if('editQuestion' in d)questionDrafts.edit(id,prior.researchQuestion);else questionDrafts.close(id);
    render({preserveFocus:true,captureDrafts:false});document.getElementById(questionFieldId(id,'editQuestion' in d?'hypothesis':'edit'))?.focus({preventScroll:true});
  }else if('questionAddCondition' in d||'questionRemoveCondition' in d){
    const id=d.questionAddCondition??d.questionRemoveCondition;questionDrafts.capture(document);
    if('questionAddCondition' in d)questionDrafts.addCondition(id);else questionDrafts.removeCondition(id,Number(d.conditionIndex));
    render({preserveFocus:true,captureDrafts:false});
  }else if('saveQuestion' in d){
    const prior=researchLibrary.getWorkspace(d.saveQuestion);if(!prior)throw new Error('Saved view unavailable.');
    questionDrafts.capture(document);const entry=questionDrafts.get(prior.id,prior.researchQuestion);if(entry.status==='pending')return;
    const initiatingFocus=rememberStableFocus(main,{document});
    questionDrafts.pending(prior.id);render({preserveFocus:true,captureDrafts:false});
    const createPackage=async args=>{
      await ensureSourceAction(requiredSourceIds(args.state,{ids:args.state.selected}));
      return createResearchPackage(args);
    };
    const result=await saveResearchQuestion({
      library:researchLibrary,workspace:prior,draft:entry.draft,createPackage,catalog:series,events:releases,
    });
    if(result.ok)questionDrafts.saved(prior.id,result.question);else questionDrafts.failed(prior.id,result);
    render({preserveFocus:true,captureDrafts:false});
    if(result.focusField)document.getElementById(questionFieldId(prior.id,result.focusField))?.focus();else restoreStableFocus(main,initiatingFocus,{document});
    announce(result.message);
  }else if('saveWorkspace' in d){
    const prior=researchLibrary.getWorkspace(activeWorkspaceId),name=document.getElementById('research-name').value;
    const record=createWorkspace({name,state,...(prior?{id:prior.id,now:new Date(prior.createdAt),researchQuestion:prior.researchQuestion}:{})});
    const scope=researchSaveScope(state),draft=saveDrafts.get(scope),initiatingFocus=rememberStableFocus(main,{document});saveDrafts.update(scope,{pending:'save',feedback:null});render({preserveFocus:true});
    try{const result=await researchLibrary.saveWorkspace(record);stored(result,'Saved view');activeWorkspaceId=record.id;researchLabel=record.name;saveDrafts.update(scope,{name:record.name,feedback:{kind:result.persisted?'success':'warning',message:result.persisted?'Saved View saved in this browser.':'Saved View is session-only. Export settings for recovery before reloading.'}});}
    catch(error){saveDrafts.update(scope,{feedback:{kind:'error',message:error.message},open:true});throw error;}
    finally{draft.pending=false;render({preserveFocus:true});if(researchSaveScope(state)===scope)restoreStableFocus(main,initiatingFocus,{document});}
  }else if('clearWorkspace' in d){activeWorkspaceId=null;researchLabel='';saveDrafts.reset(researchSaveScope(state));}
  else if('openWorkspace' in d){
    const record=researchLibrary.getWorkspace(d.openWorkspace);if(!record)throw new Error('Workspace unavailable.');
    activeWorkspaceId=record.id;researchLabel=record.name;saveDrafts.reset(researchSaveScope({...state,...openWorkspace(record)}));navigate(openWorkspace(record));announce('Saved View opened against the latest snapshot. UPDATE SAVED VIEW saves configuration changes.');
  }else if('renameWorkspace' in d){
    const record=researchLibrary.getWorkspace(d.renameWorkspace);if(!record)throw new Error('Workspace unavailable.');
    stored(await researchLibrary.saveWorkspace({...record,name:document.getElementById(`workspace-label-${record.id}`).value.trim()}),'Renamed workspace');
    if(activeWorkspaceId===record.id)researchLabel=researchLibrary.getWorkspace(record.id).name;
  }else if('removeWorkspace' in d){stored(await researchLibrary.removeWorkspace(d.removeWorkspace),'Workspace removal');if(activeWorkspaceId===d.removeWorkspace){activeWorkspaceId=null;researchLabel='';}}
  else if('pinResult' in d||'pinPublication' in d||'pinGdpMatrix' in d){
    if(pinBusy)return;
    if(('pinPublication' in d||'pinGdpMatrix' in d)&&publicationState.status!=='ready')throw new Error('Load the selected official publication archive before pinning.');
    if('pinGdpMatrix' in d&&state.publicationSeries!=='gdp')throw new Error('The revision matrix requires GDP publication evidence.');
    if('pinResult' in d&&state.page!=='release'){const draft=saveDrafts.get(researchSaveScope(state),{selected:state.freezeSelection??freezeCandidates(state).slice(0,4)});state.freezeSelection=[...draft.selected];}
    const pinState={...state,...(state.freezeSelection?{freezeSelection:[...state.freezeSelection]}:{})};
    const pinChartSettings={...overviewChartSettings},pinChartPreview=workspacePreviews.overview;
    const claims=claimsPublicationIds.includes(pinState.publicationSeries),cpi=cpiPublicationIds.includes(pinState.publicationSeries);
    let args,name=document.getElementById('research-name')?.value??'';
    const initiatingScope=researchSaveScope(state),initiatingFocus=rememberStableFocus(main,{document});
    pinBusy=true;render({preserveFocus:true});
    try{
      if('pinGdpMatrix' in d){
        args=buildGdpMatrixPin(publicationArchive,pinState.publicationCutoff);
        name=`GDP revision matrix by ${args.context.gdpRevisionMatrix.cutoff}`;
      }else if('pinPublication' in d){
        const {publicationSeries:id,publicationCutoff:cutoff,publicationPeriod:period}=pinState;
        if(cpi)args=buildCpiPublicationPin(publicationArchive,id,cutoff,period);
        else if(claims)args=buildClaimsPublicationPin(publicationArchive,id,cutoff,period);
        else args=buildPublicationPin(publicationArchive,cutoff,period,{
          explanationArchive:publicationExplanations,explanationStatus:explanationState.status,
        });
        const context=args.context;
        const label=cpi?args.catalog[id].short:claims?`${id==='continuedClaimsAdvance'?'Continued':'Initial'} claims`
          :`GDP ${periodLabel({frequency:'Quarterly'},context.publicationPeriod)} published`;
        name=`${label} ${cpi||claims?context.publicationPeriod+' ':''}by ${context.publicationCutoff}`;
      }else if(pinState.page==='release'){
        args=buildReleasePin(pinState,{
          archive:publicationArchive,publicationState,explanationArchive:publicationExplanations,explanationStatus:explanationState.status,
        });
      }else{
        await ensureSourceAction(requiredSourceIds(pinState,{purpose:'freeze'}));
        args=buildPinContext(pinState,{
          ...historyController.context(pinState),changes:changesContext(),checkpoint:changeCheckpoint,failures:trackedFailures(),overviewChartSettings:pinChartSettings,overviewPreview:pinChartPreview,
          publicationContexts:{
            gdp:publicationController.context('gdp'),claims:publicationController.context('claimsAdvance'),
            cpi:publicationController.context('cpiMonthly'),
          },
        });
      }
      const pkg=await createResearchPackage({name,...args}),result=await researchLibrary.pinPackage(pkg);stored(result,'Saved snapshot');
      navigate({page:'research',researchView:'packages',packageId:pkg.id,researchFeedback:{packageId:pkg.id,message:result.persisted?
  'Snapshot saved with its original evidence.':'Snapshot is session-only. Download JSON before reloading for recovery.'}});
    }finally{pinBusy=false;if(researchSaveScope(state)===initiatingScope){render({preserveFocus:true});restoreStableFocus(main,initiatingFocus,{document});}}
  }else if('openPackage' in d)navigate({page:'research',researchView:'packages',packageId:d.openPackage});
  else if('removePackage' in d){stored(await researchLibrary.removePackage(d.removePackage),'Package removal');if(state.packageId===d.removePackage)navigate({packageId:''});}
  else if('packageJson' in d){const pkg=researchLibrary.getPackage(d.packageJson);if(!pkg)throw new Error('Package unavailable.');downloadJson(pkg);}
  else if('packageCsv' in d){const pkg=researchLibrary.getPackage(d.packageCsv);if(!pkg)throw new Error('Package unavailable.');downloadCsv(researchPackageCsv(pkg),`meridian-frozen-${pkg.id}.csv`,'Original frozen CSV downloaded; current data were not substituted.');}
  else if('exportFrozenCurrentAccountGdpContributions' in d){const pkg=researchLibrary.getPackage(d.exportFrozenCurrentAccountGdpContributions),context=pkg?.context.currentAccountGdpContributions,inputs=context&&pkg.context[context.inputContext];if(!context||!inputs)throw new Error('Frozen contribution inputs unavailable.');downloadCsv(currentAccountGdpContributionsCsv(inputs.sources,context.range),`meridian-frozen-${pkg.id}-contributions.csv`,'Contribution CSV reconstructed from recorded BEA inputs, method and window; current data were not substituted.');}
  else if('exportFrozenCurrentAccountGdpBalanceEffects' in d){const pkg=researchLibrary.getPackage(d.exportFrozenCurrentAccountGdpBalanceEffects),context=pkg?.context.currentAccountGdpBalanceEffects,inputs=context&&pkg.context[context.inputContext];if(!context||!inputs)throw new Error('Frozen balance/GDP effect inputs unavailable.');downloadCsv(currentAccountGdpBalanceEffectsCsv(inputs.sources,context.range),`meridian-frozen-${pkg.id}-balance-gdp-effects.csv`,'Balance/GDP effect CSV reconstructed from recorded BEA inputs, symmetric method and window; current data were not substituted.');}
  else if('exportFrozenCurrentAccountGdpComponentEffects' in d){const pkg=researchLibrary.getPackage(d.exportFrozenCurrentAccountGdpComponentEffects),context=pkg?.context.currentAccountGdpComponentEffects,inputs=context&&pkg.context[context.inputContext];if(!context||!inputs)throw new Error('Frozen component effect inputs unavailable.');downloadCsv(currentAccountGdpComponentEffectsCsv(inputs.sources,context.range,context.measure),`meridian-frozen-${pkg.id}-component-effects.csv`,'Selected component effect CSV reconstructed from recorded BEA inputs, component, symmetric method and window; current data were not substituted.');}
  else if('exportFrozenCurrentAccountGdpAllComponentEffects' in d){const pkg=researchLibrary.getPackage(d.exportFrozenCurrentAccountGdpAllComponentEffects),context=pkg?.context.currentAccountGdpAllComponentEffects,inputs=context&&pkg.context[context.inputContext];if(!context||!inputs)throw new Error('Frozen all-component effect inputs unavailable.');downloadCsv(currentAccountGdpBalanceEffectsCsv(inputs.sources,context.range),`meridian-frozen-${pkg.id}-all-component-effects.csv`,'All-component effect CSV reconstructed from recorded BEA inputs, symmetric method and window; current data were not substituted.');}
  else if('packageAttachment' in d){const pkg=currentPackage();if(!pkg)throw new Error('Frozen attachment unavailable.');const file=researchPackageAttachment(pkg,Number(d.packageAttachment)),generated=pkg.context.fundingDistributions?.version===2&&file.name==='market-functioning.csv'||pkg.context.auctionExports?.version===1&&['auction-results.csv','auction-peers.csv'].includes(file.name);downloadCsv(file.content,file.name,generated?'Full-retained specialist CSV generated from recorded frozen inputs and method.':'Original frozen specialist export downloaded with its captured inputs and assumptions.');}
  else if('enableChanges' in d||'disableChanges' in d||'markChanges' in d){
    changeCheckpoint={...changeCheckpoint,enabled:'enableChanges' in d?true:'disableChanges' in d?false:changeCheckpoint.enabled,...('disableChanges' in d?{}:{since:dataStatus.generatedAt,snapshotAt:dataStatus.generatedAt})};
    const durable=writeChangeCheckpoint(storage,changeCheckpoint);changeCheckpoint.storageAvailable=durable;
    navigate({changeSince:'',changePage:1},{replace:true});announce(`${changeCheckpoint.enabled?'Local change alerts enabled':'Local change alerts disabled'}. ${durable?'Checkpoint saved in this browser.':'Checkpoint lasts for this session; browser storage is unavailable.'}`);
  }else if('reviewAllChanges' in d){
    if(changeState.status!=='ready')throw new Error('Load the selected capture archives first.');
    const earliest=changeState.history.captures.map(row=>row.capturedAt).sort()[0];
    if(earliest)navigate({changeSince:new Date(Date.parse(earliest)-1).toISOString(),changePage:1});
  }else if('retryChanges' in d)syncChanges({retry:true});
  else if('changePage' in d)navigate({changePage:Math.max(1,Number(d.changePage)||1)});
  else if('exportChanges' in d){const view=changesContext();if(view.status!=='ready')throw new Error('Verified capture changes are unavailable.');downloadCsv(changesCsv(view.rows),'meridian-capture-changes.csv','Capture-change CSV downloaded. Retrieval changes do not establish publication times or revision causes.');}
  else if('exportCoverage' in d){
    if(state.page!=='explore'||state.exploreMode!=='coverage')throw new Error('Open Coverage inventory to export its filtered scope.');
    downloadCsv(coverageInventoryCsv(buildCoverageInventory(series,{...state,publicationContexts:{gdp:publicationController.context('gdp'),claims:publicationController.context('claimsAdvance'),cpi:publicationController.context('cpiMonthly')}})),'meridian-coverage-inventory.csv','Filtered retained coverage metadata downloaded; reference dates are not publication dates.');
  }
  else if('exportGdpMatrix' in d){
    if(state.publicationSeries!=='gdp'||publicationState.status!=='ready')throw new Error('Load the GDP archive before exporting a revision matrix.');
    downloadCsv(gdpRevisionMatrixCsv(publicationArchive,{cutoff:state.publicationCutoff}),'meridian-gdp-revision-matrix.csv','GDP revision matrix downloaded with cutoff, independent sample counts and original evidence.');
  }
  else if('exportPublications' in d){
    if(publicationState.status!=='ready')throw new Error('Load the selected official publication archive before exporting.');
    if(cpiPublicationIds.includes(state.publicationSeries)){
      const options={seriesId:state.publicationSeries,cutoff:state.publicationCutoff,period:state.publicationPeriod},view=selectCpiPublicationHistory(publicationArchive,options);if(!view.releases.length)throw new Error('No CPI publication is retained for this month and cutoff.');
      downloadCsv(cpiPublicationCsv(publicationArchive,{...options,period:view.period}),`meridian-${state.publicationSeries}-cpi-publications-${view.period}.csv`,'Published CPI rate facts downloaded with seasonal basis, source cells and actual retrieval receipts.');
    }else if(claimsPublicationIds.includes(state.publicationSeries)){
      const view=selectClaimsPublicationHistory(publicationArchive,state.publicationSeries,state.publicationCutoff,state.publicationPeriod);if(!view.releases.length)throw new Error('No official claims publication is available for this week and date.');
      downloadCsv(claimsPublicationCsv(publicationArchive,state.publicationSeries,state.publicationCutoff,view.period),`meridian-${state.publicationSeries}-publications-${view.period}.csv`,'Selected-measurement, selected-week official claims publications downloaded with release roles and actual retrieval receipts.');
    }else{const view=selectPublicationHistory(publicationArchive,state.publicationCutoff,state.publicationPeriod);if(!view.releases.length)throw new Error('No official publication is available for the selected quarter and date.');downloadCsv(publicationCsv(publicationArchive,state.publicationCutoff,view.period),`meridian-gdp-publications-${view.period}.csv`,'Selected-quarter official GDP publication history downloaded with original source cells and separate retrieval provenance.');}
  }
  else if('retryPublications' in d)syncPublications({retry:true});
  else if('exportPublicationExplanations' in d){
    if(state.publicationSeries!=='gdp')throw new Error('BEA explanations apply only to GDP publications.');
    if(explanationState.status!=='ready')throw new Error('Reviewed BEA explanations are unavailable.');
    const view=selectPublicationHistory(publicationArchive,state.publicationCutoff,state.publicationPeriod);if(!view.releases.length)throw new Error('No official publication is available for the selected quarter and date.');
    downloadCsv(publicationExplanationsCsv(publicationArchive,publicationExplanations,state.publicationCutoff,view.period),`meridian-gdp-revision-explanations-${view.period}.csv`,'Selected-quarter BEA explanation CSV downloaded with separate release and retrieval evidence. Missing explanations remain explicit.');
  }else if('retryPublicationExplanations' in d)syncPublicationExplanations({retry:true});
}

root.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const d=button.dataset;
  if(button.disabled)return;
  if(button.id==='theme-toggle'){toggleTheme();return;}
  if('previewClose' in d){
    const id=workspacePreviews.explore;workspacePreviews.explore=null;
    render({preserveFocus:true});
    (main.querySelector(`[data-workspace-preview="${id}"]`)??main.querySelector('#catalog-search'))?.focus();return;
  }
  if('dashboardRange' in d||'dashboardFamily' in d){
    if(state.page!=='overview')return;
    const input='dashboardFamily' in d?{...overviewChartSettings,inflationFamily:d.dashboardFamily}:
      ['growth','inflation'].includes(d.dashboardRange)?{...overviewChartSettings,[d.dashboardRange]:d.preset}:overviewChartSettings;
    overviewChartSettings=normalizeDashboardChartSettings(input);
    render({preserveFocus:true});announce('Chart display updated. Research window and comparison selection are unchanged.');return;
  }
  if('workspacePreview' in d&&getSeries(d.workspacePreview)){
    if(!await chooseWorkspacePreview(d.workspacePreview))return;
    if(state.page==='explore'&&window.matchMedia('(max-width:1000px)').matches){
      main.querySelector('#catalog-preview')?.focus();
    }
    announce(`Previewing ${getSeries(d.workspacePreview).name}. Comparison selection is unchanged.`);
    return;
  }
  if(Object.keys(d).some(key=>key.startsWith('export')&&!key.startsWith('exportFrozen')&&key!=='exportSettings')){
    try{await ensureSourceAction(requiredSourceIds(state,{purpose:'export',action:d}));}
    catch(error){announce(`Export unavailable: ${error.message}`);return;}
  }
  if('retrySources' in d){
    try{
      await ensureSourceAction(d.retrySources.split(','),{retry:true});
      preserveHistoryView(main,()=>render());announce('Complete source history loaded. The selected workspace is ready.');
    }catch(error){announce(`Source history unavailable: ${error.message}`);}
    return;
  }
  if('yieldShortcut' in d){navigate({yieldDateA:d.yieldDateA,yieldDateB:d.yieldDateB});announce(`Selected retained curves ${d.yieldDateA} and ${d.yieldDateB}.`);return;}
  if('exportEconomicEvidence' in d){
    if(!['laborEvidence','pcePriceContributions'].includes(d.exportEconomicEvidence)||currentPackage())return;
    downloadCsv(economicEvidenceCsv(dataStatus.sources[d.exportEconomicEvidence],{range:viewRange(state)}),`meridian-${d.exportEconomicEvidence}.csv`,'Exact selected official observations downloaded with native units, preliminary flags, definitions, rights and capture receipts.');return;
  }
  if('applyPceAssumptions' in d){
    try{applyPceAssumptions();}catch(error){document.getElementById('pce-input-status').textContent=error.message;announce(error.message);}return;
  }
  if('exportPceBaseEffects' in d){
    if(currentPackage())return;
    downloadCsv(pceBaseEffectsCsv(getSeries(state.pceBaseIndex),pceScenarioOptions(state)),'meridian-pce-conditional-path.csv','Conditional arithmetic and exact historical indexes downloaded with all assumptions. Future rows are modeled, not official observations.');return;
  }
  if('sourceHealth' in d){const details=document.querySelector('#data-freshness .freshness-details');if(details){details.open=true;details.querySelector('summary')?.focus();details.scrollIntoView({block:'nearest'});}return;}
  const researchKeys=['editQuestion','closeQuestion','questionAddCondition','questionRemoveCondition','saveQuestion','saveWorkspace','clearWorkspace','pinResult','pinPublication','pinGdpMatrix','exportGdpMatrix','exportCoverage','openWorkspace','renameWorkspace','removeWorkspace','openPackage','removePackage','packageJson','packageCsv','packageAttachment','exportFrozenCurrentAccountGdpContributions','exportFrozenCurrentAccountGdpBalanceEffects','exportFrozenCurrentAccountGdpComponentEffects','exportFrozenCurrentAccountGdpAllComponentEffects','enableChanges','disableChanges','markChanges','reviewAllChanges','retryChanges','changePage','exportChanges','exportPublications','retryPublications','exportPublicationExplanations','retryPublicationExplanations'];
  if(researchKeys.some(key=>key in d)){
    const before=location.hash;
    try{await handleResearchAction(d);}catch(error){state.researchError=error.message;if('saveWorkspace' in d||'pinResult' in d)saveDrafts.update(researchSaveScope(state),{feedback:{kind:'error',message:error.message},open:true});announce(`Research action unavailable: ${error.message}`);}
    if(location.hash===before)render({preserveFocus:true});return;
  }
  if('exportSettings' in d){
    const content=exportResearchSettings({preferences:state,workspaces:researchLibrary.listWorkspaces()}),url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='meridian-research-settings.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Watchlists and saved-view settings downloaded. Frozen evidence is exported separately.');return;
  }
  if('createWatchlist' in d||'renameWatchlist' in d||'deleteWatchlist' in d){
    try{
      const name=document.getElementById('watchlist-name').value;
      const preferences='deleteWatchlist' in d?removeNamedWatchlist(state,state.activeWatchlistId):saveNamedWatchlist(state,{id:'createWatchlist' in d?globalThis.crypto.randomUUID():state.activeWatchlistId,name,saved:state.saved});
      state={...state,...preferences};delete state.freezeSelection;const durable=persist();render({preserveFocus:true});announce(durable?'Named watchlist saved with its ordered membership.':'Named watchlist retained for this session; export settings for recovery.');
    }catch(error){announce(error.message);state.researchError=error.message;render({preserveFocus:true});}return;
  }
  if('watchMove' in d){state.saved=moveFollowed(state.saved,d.watchMove,Number(d.direction));const durable=persist();render({preserveFocus:true});announce(durable?'Watchlist order saved.':'Order changed for this session; browser storage is unavailable.');return;}
  if('reloadSnapshot' in d){
    const url=new URL(window.location.href);
    url.searchParams.set('_refresh',Date.now().toString(36));
    window.location.replace(url.href);
  }
  else if('save' in d)save(d.save);
  else if('retryHistory' in d){
    if(historyController.context(state).historyState.status!=='error')return;
    historyController.sync(state,{retry:true});
    preserveHistoryView(main,()=>render());
  }
  else if('series' in d && getSeries(d.series))navigate(parseRoute(indicatorHref(d.series,state)));
  else if('addCompare' in d&&getSeries(d.addCompare)){
    const selected=[...new Set([...state.selected,d.addCompare])];
    if(selected.length>4){announce('Compare up to four series. Remove a selected series first.');return;}
    const returnTo=state.page==='watchlist'?routeFor({...state,selected}):state.returnTo;
    navigate({page:'explore',exploreMode:'compare',selected,returnTo});
  }
  else if('page' in d && pageNames[d.page])navigate({page:d.page});
  else if('compare' in d)navigate({page:'explore',selected:[...new Set(d.compare.split(',').filter(id=>getSeries(id)))].slice(0,4),exploreMode:'compare',comparison:'native',returnTo:['overview','macroCoverage','labor','fiscal','refinancing','yields','auctions','ownership','macro','vintages','market','credit','calendar'].includes(state.page)?routeFor(state):state.returnTo});
  else if('laborGroup' in d&&['all','jobs','people','pay','claims'].includes(d.laborGroup))navigate({laborGroup:d.laborGroup},{replace:true});
  else if('laborSection' in d&&['labor-analysis','labor-weekly','labor-trends','labor-readings','labor-notes'].includes(d.laborSection))document.getElementById(d.laborSection)?.scrollIntoView({block:'start'});
  else if('calendarPreview' in d)showCalendarPreview(true);
  else if('event' in d){
    const selected=releases.find(release=>release.id===d.event);
    if(selected){
      navigate(state.page==='calendar'?{eventId:selected.id}:{page:'calendar',eventId:selected.id,calendarView:selected.sourceId==='treasury'?'treasury':'macro',calendarMonth:selected.date.slice(0,7),day:'all',calendarTopic:'All topics',watchOnly:false});
      showCalendarPreview();
    }
  }
  else if('range' in d)navigate({range:Number(d.range),window:'observations',startDate:'',endDate:''});
  else if('window' in d)navigate({window:d.window,startDate:'',endDate:''});
  else if('comparisonResetRange' in d){navigate({window:'all',startDate:'',endDate:''});announce('Date range reset. Your measurements, comparison mode and alignment are preserved.');}
  else if('focusField' in d){const field=document.getElementById(d.focusField);field?.focus({preventScroll:true});field?.scrollIntoView({block:'nearest'});}
  else if('comparisonMode' in d)navigate({comparison:d.comparisonMode});
  else if('tab' in d)navigate({tab:d.tab});
  else if('exploreMode' in d)navigate({exploreMode:d.exploreMode});
  else if('publicationMode' in d)navigate({publicationMode:d.publicationMode==='matrix'?'matrix':'quarter',publicationPeriod:''});
  else if('remove' in d)navigate({selected:state.selected.filter(id=>id!==d.remove)});
  else if('day' in d)navigate({day:d.day});
  else if('resetFilters' in d)navigate({query:'',topic:'All topics',frequency:'All frequencies',catalogPage:1});
  else if('resetCalendar' in d)navigate({calendarView:'macro',calendarMonth:'upcoming',day:'all',calendarTopic:'All topics',watchOnly:false,eventId:''});
  else if('export' in d)exportCsv();
  else if('exportMacroMeasure' in d)exportCsv([state.macroMeasure]);
  else if('exportCurrentAccount' in d)downloadCsv(currentAccountCsv(dataStatus.sources.beaIta),'meridian-current-account-current-prior.csv','Official current-account and component balances downloaded for the exact current and preceding quarters, with nonannualized units and BEA provenance.');
  else if('exportCurrentAccountGdp' in d)downloadCsv(currentAccountGdpCsv(dataStatus.sources),'meridian-current-account-gdp.csv','Calculated current-account-to-GDP ratios downloaded with exact quarterly inputs, GDP SAAR divided by four, percentage-point change and separate BEA retrieval evidence.');
  else if('exportCurrentAccountGdpHistory' in d)downloadCsv(currentAccountGdpHistoryCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-history.csv','Historical current-account-to-GDP ratios downloaded for the chart window, with exact quarterly inputs, missing values, calculation and separate BEA retrieval evidence.');
  else if('exportCurrentAccountGdpBreakdown' in d)downloadCsv(currentAccountGdpBreakdownCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-breakdown.csv','Historical current-account component ratios downloaded for the shared chart window, with original BEA inputs, published total, rounding reconciliation and separate retrieval evidence.');
  else if('exportCurrentAccountGdpTrailing' in d)downloadCsv(currentAccountGdpTrailingCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-trailing.csv','Trailing-four-quarter ratios downloaded for the shared window, with supporting quarterly inputs, source evidence and rounding reconciliation.');
  else if('exportCurrentAccountGdpComparison' in d)downloadCsv(currentAccountGdpComparisonCsv(dataStatus.sources,viewRange(state),state.macroMeasure),'meridian-current-account-gdp-comparison.csv','Quarterly and trailing-four-quarter ratios downloaded with the selected balance, horizon gaps and original BEA inputs.');
  else if('exportCurrentAccountGdpContributions' in d)downloadCsv(currentAccountGdpContributionsCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-contributions.csv','Calculated quarterly and trailing contribution changes downloaded with exact predecessor inputs, percentage-point reconciliation and BEA evidence.');
  else if('exportCurrentAccountGdpBalanceEffects' in d)downloadCsv(currentAccountGdpBalanceEffectsCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-balance-gdp-effects.csv','Symmetric balance and GDP-denominator effects downloaded with combined changes, exact predecessor inputs and BEA source evidence.');
  else if('exportCurrentAccountGdpComponentEffects' in d)downloadCsv(currentAccountGdpComponentEffectsCsv(dataStatus.sources,viewRange(state),state.macroMeasure),'meridian-current-account-gdp-component-effects.csv','Selected component quarterly and trailing effect histories downloaded with exact component/GDP inputs, method and source evidence.');
  else if('exportCurrentAccountGdpAllComponentEffects' in d)downloadCsv(currentAccountGdpBalanceEffectsCsv(dataStatus.sources,viewRange(state)),'meridian-current-account-gdp-all-component-effects.csv','All four component quarterly and trailing effect histories downloaded with reconciliation, exact BEA inputs, method and source evidence.');
  else if('exportFiscal' in d)exportCsv(['receipts','outlays','netInterest','budgetDeficit','primaryDeficit','receiptsTtm','outlaysTtm','netInterestTtm','primaryDeficitTtm','interestRevenueRatio','publicDebt']);
  else if('exportFiscalFinancing' in d){
    downloadCsv(fiscalFinancingCsv(dataStatus.sources.fiscal),'meridian-fiscal-financing.csv','MTS financing CSV downloaded with reported amounts and calculated residuals; release dates remain unknown.');
  }
  else if('exportRefinancing' in d||'exportRefinancingScenario' in d)downloadCsv(refinancingCsv(dataStatus.sources.refinancing,{scenario:'exportRefinancingScenario' in d,horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock}),'meridian-refinancing.csv','Refinancing CSV downloaded with observed principal, generated identifiers and explicitly modeled assumptions.');
  else if('exportYieldCurves' in d)downloadCsv(yieldCurvesCsv(dataStatus.sources.yields,state),'meridian-yield-curves.csv','Selected historical curves downloaded; input URLs and calculated compensation are labeled.');
  else if('exportYieldIndicators' in d)exportCsv(['spread2s10s','spread3m10y','realYield10','inflationComp10','nominalYield2','nominalYield3m']);
  else if('auctionHistoryPage' in d){
    navigate({auctionHistoryPage:Math.max(0,Number(d.auctionHistoryPage)||0)});document.getElementById('auction-history')?.focus({preventScroll:true});
  }
  else if('auctionSelected' in d){const result=document.getElementById('auction-selected-result');result?.focus({preventScroll:true});result?.scrollIntoView({block:'start'});}
  else if('auctionId' in d){
    navigate({auctionId:d.auctionId});const selected=dataStatus.sources.auctions?.auctions?.find(row=>row.id===d.auctionId);
    announce(selected?`Selected auction ${selected.auctionDate} · ${selected.securityType} ${selected.securityTerm}. Comparison, exports and frozen evidence use this selection.`:'Selected auction updated.');
  }
  else if('exportAuctions' in d||'exportAuctionBenchmark' in d)downloadCsv(auctionsCsv(dataStatus.sources.auctions,{securityType:state.auctionType,auctionId:state.auctionId,benchmark:'exportAuctionBenchmark' in d}),'meridian-auctions.csv','Auction CSV downloaded with matching scope, observed results, calculated allocations and source provenance.');
  else if('exportMarket' in d)downloadCsv(marketFunctioningCsv(dataStatus.sources.marketFunctioning),'meridian-market.csv','Market CSV downloaded with reporting bases, missing and suppressed values, source titles and reuse conditions.');
  else if('exportVintages' in d){
    try {
      const history = historyController.context(state).historyState;
      if(history.status!=='ready')throw new Error('Capture history is not ready.');
      downloadCsv(vintagesCsv(history.history,{cutoff:state.vintageCutoff??history.latestCaptureAt,seriesId:state.vintageSeries}),'meridian-vintages.csv','Vintage CSV downloaded at the selected UTC retrieval cutoff. First captured is distinct from first released.');
    } catch(error) {announce(`Export unavailable: ${error.message}`);}
  }
  else if('exportFiscalGdp' in d)downloadCsv(fiscalGdpCsv(dataStatus.sources),'meridian-fiscal-gdp-ratios.csv','Defined fiscal ratios downloaded with aligned nominal GDP denominator, formulas, timing and retrieval provenance.');
  else if('exportCredit' in d)downloadCsv(creditContextCsv(dataStatus.sources),'meridian-credit-context.csv','Official credit and policy context downloaded with distinct reference dates, units and reuse notices.');
  else if('exportFomc' in d)downloadCsv(fomcDocumentsCsv(dataStatus.calendar.sources.fomc),'meridian-fomc-references.csv','Dated official FOMC references downloaded; document links do not substitute for captured contents.');
  else if('exportMacro' in d)downloadCsv(macroContributionsCsv(dataStatus.sources.macroContributions),'meridian-macro.csv','Macro CSV downloaded with published GDP contributions and unavailable CPI effects labeled.');
  else if('exportOwnership' in d)downloadCsv(ownershipCsv(dataStatus.sources.ownership),'meridian-ownership.csv','Ownership CSV downloaded with separate reporting dates, valuations and reuse notices.');
  else if('copyLink' in d) {
    try {await navigator.clipboard.writeText(location.href);announce('Link copied with the current series, range, view and tab.');}
    catch {announce('Copy is unavailable. The address bar contains the shareable link.');}
  }
});

root.addEventListener('change',async event=>{
  const target=event.target;
  if(target.matches?.('[data-workspace-series]')&&getSeries(target.value)){
    await chooseWorkspacePreview(target.value);return;
  }
  if(target.dataset&&'freezeSelect' in target.dataset){
    const candidates=freezeCandidates(state),scope=researchSaveScope(state),draft=saveDrafts.get(scope,{selected:candidates.slice(0,4)}),chosen=[...(state.freezeSelection??draft.selected)],id=target.dataset.freezeSelect;
    if(target.checked&&chosen.length>=4){target.checked=false;const message=
  ('Save snapshot allows four primary histories. Uncheck a measurement before choosing '+
  'another; existing selections are preserved.');saveDrafts.update(scope,{feedback:{kind:'error',message}});render({preserveFocus:true});announce
  (message);return;}
    state.freezeSelection=target.checked?[...chosen,id]:chosen.filter(value=>value!==id);saveDrafts.update(scope,{selected:[...state.freezeSelection],feedback:null});render({preserveFocus:true});return;
  }
  if(target.matches?.('[data-question-role],[data-question-condition-field]')){questionDrafts.capture(document);render({preserveFocus:true});return;}
  if(target.id==='auction-type'){const selected=dataStatus.sources.auctions?.auctions?.find(row=>row.id===state.auctionId);navigate({auctionType:target.value,auctionHistoryPage:null,auctionId:target.value==='All'||selected?.securityType===target.value?state.auctionId:''});return;}
  if(target.id==='watchlist-sort' ||target.id==='watchlist-group'){state={...state,...(target.id==='watchlist-sort'?{watchlistSort:target.value}:{watchlistGroup:target.checked})};const durable=persist();render({preserveFocus:true});announce(durable?'Monitoring preferences saved.':'Monitoring preferences changed for this session; browser storage is unavailable.');return;}
  if(target.id==='watchlist-active'){
    try{state={...state,...selectNamedWatchlist(state,target.value)};delete state.freezeSelection;const durable=persist();render({preserveFocus:true});announce(durable?'Named watchlist restored with its ordering.':'Watchlist restored for this session; export settings for recovery.');}catch(error){announce(error.message);}return;
  }
  if(target.id==='research-settings-import'){
    const file=target.files?.[0];if(!file)return;
    try{
      if(file.size>MAX_RESEARCH_SETTINGS_BYTES)throw new Error('Settings file exceeds the 1 MiB limit.');
      const imported=importResearchSettings(await file.text()),merged=mergeResearchSettings(state,imported,researchLibrary.listWorkspaces());
      let durable=true;for(const record of merged.workspaces){const result=await researchLibrary.saveWorkspace(record);if(!result.ok)throw new Error(`Saved view import failed: ${result.reason}`);durable=durable&&result.persisted;}
      state={...state,...merged.preferences};delete state.freezeSelection;durable=persist()&&durable;applyAppearance();render({preserveFocus:true});announce(durable?'Settings imported. Existing records were preserved; conflicting identities were copied.':'Settings imported with session-only records. Export settings for recovery; existing records were preserved.');
    }catch(error){state.researchError=error.message;render({preserveFocus:true});announce(`Settings import rejected: ${error.message}`);}return;
  }
  if(target.id==='research-import'){
    const file=target.files?.[0];if(!file)return;
    try{
      if(file.size>MAX_RESEARCH_JSON_BYTES)throw new Error('Package exceeds the 12 MiB file limit.');
      const pkg=await importResearchPackage(await file.text());stored(await researchLibrary.pinPackage(pkg),'Imported read-only package');
      navigate({page:'research',researchView:'packages',packageId:pkg.id,researchError:''});
    }catch(error){state.researchError=error.message;render({preserveFocus:true});announce(`Import rejected: ${error.message}`);}return;
  }
  if(target.id==='publication-series'){navigate({publicationSeries:[...claimsPublicationIds,...cpiPublicationIds].includes(target.value)?target.value:'gdp',publicationMode:'quarter',publicationPeriod:''});return;}
  if(target.id==='publication-period'){navigate({publicationPeriod:target.value});return;}
  if(target.id==='publication-cutoff'){
    if(state.publicationSeries==='gdp'&&state.publicationMode==='matrix'){navigate({publicationCutoff:target.value,publicationPeriod:''});return;}
    const view=cpiPublicationIds.includes(state.publicationSeries)?selectCpiPublicationHistory(publicationArchive,{seriesId:state.publicationSeries,cutoff:state.publicationCutoff,period:state.publicationPeriod}):claimsPublicationIds.includes(state.publicationSeries)?selectClaimsPublicationHistory(publicationArchive,state.publicationSeries,state.publicationCutoff,state.publicationPeriod):selectPublicationHistory(publicationArchive,state.publicationCutoff,state.publicationPeriod);navigate({publicationCutoff:target.value,publicationPeriod:view.period});return;
  }
  if(target.id==='change-since'){
    try{navigate({changeSince:normalizedCutoff(target.value,changeState.history),changePage:1});}
    catch(error){state.researchError=error.message;render({preserveFocus:true});}return;
  }
  if(target.id==='density-select'||target.id==='density-select-mobile') {
    state.density=target.value;
    const durable=persist();render({preserveFocus:true});
    announce(durable?'Appearance saved in this browser.':'Appearance changed for this session; browser storage is unavailable.');
    return;
  }
  if(['yield-curve-date-a','yield-curve-date-b'].includes(target.id)){
    const date=nearestCurveDate(dataStatus.sources.yields,target.value);
    if(!date){target.value=target.defaultValue;return;}
    navigate({[target.id==='yield-curve-date-a'?'yieldDateA':'yieldDateB']:date});announce(`Selected retained curve ${date}.`);return;
  }
  const fields={'topic-filter':'topic','frequency-filter':'frequency','transform-select':'transform','comparison-select':'comparison',
    'alignment-select':'alignment','calendar-topic':'calendarTopic','auction-type':'auctionType',
    'vintage-cutoff':'vintageCutoff','vintage-series':'vintageSeries'};
  if(target.id==='macro-family'&&Object.hasOwn(coverageFamilies,target.value))navigate({macroFamily:target.value,macroMeasure:coverageFamilies[target.value].defaultMeasure});
  else if(target.id==='macro-measure'&&coverageFamilies[state.macroFamily].ids.includes(target.value))navigate({macroMeasure:target.value});
  else if(target.id==='current-account-comparison-measure'&&state.macroFamily==='external'&&CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.some(item=>item.id===target.value))navigate({macroMeasure:target.value});
  else if(target.id==='current-account-effect-component'&&state.macroFamily==='external'&&CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.some(item=>item.id===target.value))navigate({macroMeasure:target.value});
  else if(target.id==='refinancing-horizon')navigate({refinancingHorizon:Number(target.value)});
  else if(['window-start','window-end'].includes(target.id))navigate({window:'custom',startDate:document.getElementById('window-start').value,endDate:document.getElementById('window-end').value});
  else if(target.id==='refinancing-shock')navigate({refinancingShock:Number(target.value)});
  else if(target.id==='calendar-scope')navigate({calendarView:target.value,day:'all',eventId:''});
  else if(target.id==='calendar-month')navigate({calendarMonth:target.value,day:'all',eventId:''});
  else if(target.id==='calendar-day')navigate({day:target.value,eventId:''});
  else if(fields[target.id])navigate({[fields[target.id]]:target.value,
    ...(['topic-filter','frequency-filter'].includes(target.id)?{catalogPage:1}:{}),
    ...(target.id==='calendar-topic'?{eventId:''}:{})});
  else if(target.id==='calendar-watch-only')navigate({watchOnly:target.checked,eventId:''});
  else if(target.matches('[data-select]')) {
    const id=target.dataset.select;
    if(target.checked && state.selected.length>=4){target.checked=false;announce('Compare up to four series. Remove a selected series first.');return;}
    navigate({selected:target.checked?[...new Set([...state.selected,id])]:state.selected.filter(value=>value!==id)},{replace:true});
  }
});

root.addEventListener('input',event=>{
  if(event.target.id==='research-name')researchLabel=event.target.value;
  if(event.target.id==='catalog-search')navigate({query:event.target.value,catalogPage:1},{replace:true});
  if(event.target.id==='labor-query')navigate({query:event.target.value},{replace:true});
});

document.getElementById('command-form').addEventListener('submit',event=>{
  event.preventDefault();
  const input=document.getElementById('command-input'), query=input.value.trim().replace(/<go>/ig,'').trim();
  const command=query.toUpperCase();
  const pages={US:'overview',OVERVIEW:'overview',LABOR:'labor',MACRO:'macroCoverage',CAL:'calendar',CALENDAR:'calendar',FIND:'explore',EXPLORE:'explore',WATCHLIST:'watchlist',SAVED:'research',RESEARCH:'research'};
  if(pages[command])navigate({page:pages[command],returnTo:null});
  else {
    const matches=filterSeries({query});
    const exact=exactIndicatorMatch(query,Object.values(series));
    if(exact)navigate({page:'indicator',seriesId:exact.id,transform:'level',tab:'data',returnTo:routeFor({...state,page:'explore',query,topic:'All topics',frequency:'All frequencies',exploreMode:'catalog',returnTo:null})});
    else navigate({page:'explore',query,topic:'All topics',frequency:'All frequencies',exploreMode:'catalog',returnTo:null});
    announce(exact?`${exact.name} opened.`:`Search results for ${query||'all indicators'}: pages, indicators, scheduled events and saved research. ${matches.length} matching indicators.`);
  }
  input.value='';
});

document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();document.getElementById('command-input').focus();return;
  }
  const tab=event.target.closest('[role="tab"]');
  if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')], index=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
    const id=tabs[next].id;tabs[next].click();document.getElementById(id)?.focus();
  }
});

root.addEventListener('input',event=>{const target=event.target;if(target.matches?.('[data-freeze-query]')){saveDrafts.update(researchSaveScope(state),{query:target.value});filterFreezeCandidates(main,target.value);}else if(target.matches?.('[data-question-search]')){filterQuestionPicker(target);questionDrafts.capture(document);}});

let resizeFrame;
window.addEventListener('resize',()=>{
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{renderCurrentCharts();prepareReadableTables(main);positionResearchSave(main);});
});

watchDisclosureCharts(main,renderCurrentChartsIn);
render();
if(!location.hash || location.hash==='#/')history.replaceState(null,'',routeFor(state));
if(!state.storageAvailable)announce('Browser storage is unavailable; watchlists and preferences will last for this session.');
