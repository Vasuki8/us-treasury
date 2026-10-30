import {creditContextPage} from './credit-context-page.js';
import {overviewPage} from './overview-page.js';
import {indicatorPage} from './indicator-page.js';
import {calendarPage} from './calendar-page.js';
import {explorePage} from './explore-page.js';
import {releasePage} from './release-page.js';
import {fiscalPage} from './fiscal-page.js';
import {refinancingPage} from './refinancing-page.js';
import {yieldsPage} from './yields-page.js';
import {auctionsPage} from './auctions-page.js';
import {ownershipPage} from './ownership-page.js';
import {macroPage} from './macro-page.js';
import {vintagesPage} from './vintages-page.js';
import {marketFunctioningPage} from './market-functioning-page.js';
import {watchlistPage} from './watchlist-page.js';
import {macroCoveragePage} from './macro-coverage-page.js';
import {laborPage} from './labor-page.js';
import {researchPage} from './research-page.js';
import {sourcesPage} from './sources-page.js';
import {defaults as routeDefaults,defaultRouteWindow} from './router.js';
import {getSeries} from './model.js';
import {researchNavigation} from './research-navigation.js';
import {indicatorHref,workspaceReturn} from './workspace-context.js';
import {escapeHtml as esc,heading,button,emptyState} from './ui.js';
import {rangeControls} from './research-controls.js';
import {series,releases,dataStatus} from './data.js';
import {releaseCoverage,releaseCoveragePanel} from './release-coverage.js';
const defaults={...routeDefaults,saved:[],density:'compact'};
const seriesIds=values=>[...new Set(values)].filter(id=>getSeries(id));
const labor=state=>laborPage(state);
const refinancing=state=>refinancingPage(state);

function sourceLoadingPage(state,sourceState){
  const labels={
    indicator:getSeries(state.seriesId)?.name,explore:'Explore Data',watchlist:'Watchlist',macroCoverage:'Economy',labor:'Labor Market',
    fiscal:'Fiscal pressure',refinancing:'Refinancing risk',yields:'Rates & curves',auctions:'Auction demand',ownership:'Debt ownership',
    macro:'GDP contributions',market:'Market functioning',credit:'Credit & banking',research:'Saved research',
  };
  const origin=workspaceReturn(state);
  const back=origin?`<nav class="return-context"><a href="${esc(origin.href)}">${esc(origin.label)}</a></nav>`:'';
  const ids=state.page==='indicator'?[state.seriesId]:state.page==='watchlist'?state.saved:state.selected;
  const controls=['indicator','explore','watchlist','macroCoverage','labor','market','yields'].includes(state.page)
    ?rangeControls(state,ids??[]):'';
  const failed=sourceState.status==='error';
  const message=failed?'Complete retained history unavailable.':'Loading complete retained history.';
  const detail=failed?sourceState.error?.message??String(sourceState.error??'Source request failed.')
    :'The selected measurements, date window and assumptions are preserved. Full history is required before analysis or export.';
  const retry=failed?button('RETRY SOURCE HISTORY',`data-retry-sources="${esc(sourceState.sourceIds.join(','))}"`):'';
  return researchNavigation(state)+back+heading(labels[state.page]??'Research workspace','Selected source history')+controls
    +`<section role="${failed?'alert':'status'}" aria-live="polite">${emptyState(message,detail,retry)}</section>`;
}

export function renderPage(input = {}, historyContext = {}) {
  const state = { ...defaults, ...input };
  state.selected = seriesIds(Array.isArray(state.selected) ? state.selected : []).slice(0, 4);
  state.saved = seriesIds(Array.isArray(state.saved) ? state.saved : []);
  if(!Object.hasOwn(input,'window'))state.window=Object.hasOwn(input,'range')?'observations':defaultRouteWindow(state);
  if(historyContext.sourceState&&historyContext.sourceState.status!=='ready')return sourceLoadingPage(state,historyContext.sourceState);
  if(state.page==='sources')return researchNavigation(state)+`<div class="page-hierarchy">${sourcesPage()}</div>`;
  const content=({ research:()=>researchPage(state,historyContext),overview:()=>overviewPage(state,historyContext), labor, release:()=>releasePage(state,{archive:historyContext.publicationArchive,publicationState:historyContext.publicationState,explanations:historyContext.publicationExplanations,explanationState:historyContext.explanationState}), macroCoverage:()=>state.macroFamily==='labor'?labor(state):macroCoveragePage(state), credit:()=>creditContextPage(), indicator:()=>indicatorPage(state, historyContext), calendar:()=>calendarPage(state), explore:()=>explorePage(state,historyContext),watchlist:()=>`<div class="watchlist-workspace">${watchlistPage(state,historyContext)}</div>`, fiscal:()=>fiscalPage(),refinancing,yields:()=>yieldsPage(state),auctions:()=>auctionsPage(state),ownership:()=>ownershipPage(),macro:()=>macroPage(),vintages:()=>vintagesPage(state, historyContext.historyState?.history, historyContext.historyState),market:()=>marketFunctioningPage(undefined,state) }[state.page] ?? (()=>overviewPage(state,historyContext)))(state);
  const styled=['overview','labor','indicator','calendar','explore'].includes(state.page)||(state.page==='macroCoverage'&&state.macroFamily==='labor');
  const specialist=['fiscal','refinancing','yields','auctions','ownership','macro','vintages','market','credit'].includes(state.page);
  const linked=specialist?content.replace(/href="#\/series\/([A-Za-z0-9]+)"/g,(_all,id)=>`href="${esc(indicatorHref(id,state))}"`):content;
  const ids=state.page==='indicator'?[state.seriesId]:state.page==='labor'?['payroll','claimsAdvance','continuedClaimsAdvance']:state.page==='macroCoverage'?[state.macroMeasure]:[];
  const freshness=releaseCoveragePanel(releaseCoverage(series,dataStatus,{seriesIds:ids,events:releases,publicationContexts:historyContext.publicationContexts}),{hrefFor:id=>indicatorHref(id,state)});
  const body=(styled?linked:`<div class="koyfin-page">${linked}</div>`)+freshness;
  return researchNavigation(state)+(state.page==='overview'?body:`<div class="page-hierarchy" data-hierarchy-page="${esc(state.page)}">${body}</div>`);
}
