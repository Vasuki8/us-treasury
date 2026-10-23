import {parseRoute,routeFor,safeReturnTo} from './router.js';

/** One range descriptor feeds chart, table and CSV. Numeric deep links stay explicit. */
export function viewRange(state={}) {
  const window=state.window??(Object.hasOwn(state,'range')?'observations':'1y');
  return window==='observations'?state.range??12:{preset:window,startDate:state.startDate??'',endDate:state.endDate??''};
}

export function indicatorHref(seriesId,state={}) {
  const origin=safeReturnTo(state.returnTo);
  const terminalOrigin=state.page==='explore'&&/^#\/(?:watchlist|economy)(?:\?|$)/.test(origin??'')?origin:null;
  const returnTo=['explore','watchlist','macroCoverage'].includes(state.page)?routeFor({...state,returnTo:terminalOrigin}):origin;
  return routeFor({...state,page:'indicator',seriesId,tab:'data',transform:'level',returnTo});
}

export function workspaceReturn(state={}) {
  const href=safeReturnTo(state.returnTo);if(!href)return null;
  const route=parseRoute(href);
  return {href,label:route.page==='watchlist'?'BACK TO WATCHLIST':route.page==='macroCoverage'?'BACK TO ECONOMY':route.exploreMode==='compare'?'BACK TO COMPARISON':route.query?'BACK TO RESULTS':'BACK TO CATALOG'};
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
      if(!['explore','watchlist','macroCoverage'].includes(state.page))return;
      positions.set(key(state),{left:Math.max(0,position.left||0),top:Math.max(0,position.top||0),focusHref:position.focusHref??null});
      if(positions.size>30)positions.delete(positions.keys().next().value);
    },
    recall(state){return ['explore','watchlist','macroCoverage'].includes(state.page)?positions.get(key(state))??null:null;},
  };
}
