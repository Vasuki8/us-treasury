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
import {defaults as routeDefaults} from './router.js';
import {getSeries} from './model.js';
import {researchNavigation} from './research-navigation.js';
const defaults={...routeDefaults,saved:[],density:'compact'};
const seriesIds=values=>[...new Set(values)].filter(id=>getSeries(id));
const labor=state=>laborPage(state);
const refinancing=state=>refinancingPage(state);

export function renderPage(input = {}, historyContext = {}) {
  const state = { ...defaults, ...input };
  if(Object.hasOwn(input,'range')&&!Object.hasOwn(input,'window'))state.window='observations';
  state.selected = seriesIds(Array.isArray(state.selected) ? state.selected : []).slice(0, 4);
  state.saved = seriesIds(Array.isArray(state.saved) ? state.saved : []);
  const content=({ research:()=>researchPage(state,historyContext),overview:()=>overviewPage(state,historyContext), labor, release:()=>releasePage(state,{archive:historyContext.publicationArchive,publicationState:historyContext.publicationState,explanations:historyContext.publicationExplanations,explanationState:historyContext.explanationState}), macroCoverage:()=>state.macroFamily==='labor'?labor(state):macroCoveragePage(state), credit:()=>creditContextPage(), indicator:()=>indicatorPage(state, historyContext), calendar:()=>calendarPage(state), explore:()=>explorePage(state),watchlist:()=>`<div class="watchlist-workspace">${watchlistPage(state,historyContext)}</div>`, fiscal:()=>fiscalPage(),refinancing,yields:()=>yieldsPage(state),auctions:()=>auctionsPage(state),ownership:()=>ownershipPage(),macro:()=>macroPage(),vintages:()=>vintagesPage(state, historyContext.historyState?.history, historyContext.historyState),market:()=>marketFunctioningPage() }[state.page] ?? (()=>overviewPage(state,historyContext)))(state);
  const styled=['overview','labor','indicator','calendar','explore'].includes(state.page)||(state.page==='macroCoverage'&&state.macroFamily==='labor');
  return researchNavigation(state.page)+(styled?content:`<div class="koyfin-page">${content}</div>`);
}
