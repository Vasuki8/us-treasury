import {stableLinkIdentity,findStableLink} from './stable-focus.js';
import {parseRoute,routeFor,safeReturnTo,returnPages} from './router.js';

/** One range descriptor feeds chart, table and CSV. Numeric deep links stay explicit. */
export function viewRange(state={}) {
  const window=state.window??(Object.hasOwn(state,'range')?'observations':'1y');
  const range=window==='observations'?state.range??12:{preset:window,startDate:state.startDate??'',endDate:state.endDate??''};
  return state.alignment==='quarter'?{...(typeof range==='number'?{preset:'observations',count:range}:range),alignment:'quarter'}:range;
}
export function pceScenarioOptions(state={}){
 return {monthlyRate:state.pceMonthlyRate??0.2,horizonMonths:state.pceHorizonMonths??12,targetAnnualRate:state.pceTargetAnnualRate??2};
}

export function indicatorHref(seriesId,state={}) {
  const origin=safeReturnTo(state.returnTo);
  const terminalOrigin=state.page==='explore'&&origin?.split('?')[0]!=='#/explore'?origin:null;
  const returnTo=['release','research','vintages'].includes(state.page)?routeFor(state):returnPages.includes(state.page)?routeFor({...state,returnTo:terminalOrigin}):origin;
  return routeFor({...state,page:'indicator',seriesId,tab:'data',transform:'level',returnTo});
}

export function workspaceReturn(state={}) {
  const href=safeReturnTo(state.returnTo);if(!href)return null;
  const route=parseRoute(href);
  const labels={indicator:'INDICATOR',release:'RELEASE EVIDENCE',research:route.researchView==='publications'?'PUBLICATION HISTORY':route.researchView==='changes'?'CAPTURE CHANGES':route.researchView==='packages'?'FROZEN RESULTS':'SAVED VIEWS',overview:'OVERVIEW',watchlist:'WATCHLIST',labor:'LABOR',macroCoverage:route.macroFamily==='prices'?'INFLATION':'ECONOMY',fiscal:'FISCAL',refinancing:'REFINANCING',yields:'RATES & CURVES',auctions:'AUCTIONS',ownership:'OWNERSHIP',macro:'GDP CONTRIBUTIONS',vintages:'RETRIEVAL HISTORY',market:'MARKET FUNCTIONING',credit:'CREDIT & BANKING',calendar:'CALENDAR'};
  return {href,label:'BACK TO '+(labels[route.page]??(route.exploreMode==='coverage'?'COVERAGE INVENTORY':route.exploreMode==='compare'?'COMPARISON':route.query?'RESULTS':'CATALOG'))};
}

/** Update the selection throughout the bounded return journey. */
export function updateWorkspaceSelection(href,selected){
  const safe=safeReturnTo(href);if(!safe)return null;
  const origin=parseRoute(safe);
  const returnTo=origin.returnTo?updateWorkspaceSelection(origin.returnTo,selected):null;
  return routeFor({...origin,selected,returnTo});
}

/** Session-only workspace positions; observations and preferences stay elsewhere. */
export function createWorkspaceMemory() {
  const positions=new Map(),key=state=>routeFor({...state,selected:[],returnTo:null});
  return {
    remember(state,position){
      if(![...returnPages,'indicator','release','research'].includes(state.page))return;
      const focusIdentity=stableLinkIdentity(position.focusElement);
      positions.set(key(state),{left:Math.max(0,position.left||0),top:Math.max(0,position.top||0),focusHref:position.focusHref??focusIdentity?.href??null,...(focusIdentity?{focusIdentity}:{})});
      if(positions.size>30)positions.delete(positions.keys().next().value);
    },
    recall(state){return [...returnPages,'indicator','release','research'].includes(state.page)?positions.get(key(state))??null:null;},
    restoreFocus(container,position){
      const link=findStableLink(container,position?.focusIdentity??{href:position?.focusHref});
      link?.focus({preventScroll:true});return link;
    },
  };
}

/** Preserve the immediate origin when moving through evidence and detail destinations. */
export function contextualHref(patch,state={}){
 return routeFor({...state,...patch,returnTo:safeReturnTo(routeFor(state))});
}
