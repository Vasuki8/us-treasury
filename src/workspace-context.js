import {parseRoute,routeFor,safeReturnTo,returnPages} from './router.js';

/** One range descriptor feeds chart, table and CSV. Numeric deep links stay explicit. */
export function viewRange(state={}) {
  const window=state.window??(Object.hasOwn(state,'range')?'observations':'1y');
  return window==='observations'?state.range??12:{preset:window,startDate:state.startDate??'',endDate:state.endDate??''};
}

export function indicatorHref(seriesId,state={}) {
  const origin=safeReturnTo(state.returnTo);
  const terminalOrigin=state.page==='explore'&&origin?.split('?')[0]!=='#/explore'?origin:null;
  const returnTo=returnPages.includes(state.page)?routeFor({...state,returnTo:terminalOrigin}):origin;
  return routeFor({...state,page:'indicator',seriesId,tab:'data',transform:'level',returnTo});
}

export function workspaceReturn(state={}) {
  const href=safeReturnTo(state.returnTo);if(!href)return null;
  const route=parseRoute(href);
  const labels={watchlist:'WATCHLIST',labor:'LABOR',macroCoverage:'ECONOMY',fiscal:'FISCAL',refinancing:'REFINANCING',yields:'RATES & CURVES',auctions:'AUCTIONS',ownership:'OWNERSHIP',macro:'GDP CONTRIBUTIONS',vintages:'RETRIEVAL HISTORY',market:'MARKET FUNCTIONING',credit:'CREDIT & BANKING',calendar:'CALENDAR'};
  return {href,label:'BACK TO '+(labels[route.page]??(route.exploreMode==='compare'?'COMPARISON':route.query?'RESULTS':'CATALOG'))};
}

/** Update the selection in the immediate return and its bounded watchlist origin. */
export function updateWorkspaceSelection(href,selected){
  const safe=safeReturnTo(href);if(!safe)return null;
  const origin=parseRoute(safe);
  const returnTo=origin.page==='explore'&&origin.returnTo?routeFor({...parseRoute(origin.returnTo),selected,returnTo:null}):null;
  return routeFor({...origin,selected,returnTo});
}

/** Session-only workspace positions; observations and preferences stay elsewhere. */
export function createWorkspaceMemory() {
  const positions=new Map(),key=state=>routeFor({...state,selected:[],returnTo:null});
  return {
    remember(state,position){
      if(!returnPages.includes(state.page))return;
      positions.set(key(state),{left:Math.max(0,position.left||0),top:Math.max(0,position.top||0),focusHref:position.focusHref??null});
      if(positions.size>30)positions.delete(positions.keys().next().value);
    },
    recall(state){return returnPages.includes(state.page)?positions.get(key(state))??null:null;},
  };
}
