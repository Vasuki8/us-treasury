import {series} from './data.js';
import {coverageFamilies} from './macro-registry.js';
import {searchSeries} from './search.js';
import {freezeCandidates} from './research-context.js';
import {defaultWindowPreset} from './date-window.js';

const pageSources={
 credit:['bankCredit','lendingSurvey','fedBalance','onRrp','householdDebt','loanDelinquency'],
 fiscal:['fiscal','treasury','bea'],refinancing:['refinancing'],yields:['yields','treasury'],
 auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning'],
};
const overviewSources=['bea','bls','policyRates','marketFunctioning','treasury','yields','fiscal','activity','dolAdvance'];
const agencies=(ids,catalog)=>ids.map(id=>catalog[id]?.agency).filter(Boolean);
const questionIds=question=>[
 ...(question?.supportingSeriesIds??[]),...(question?.contradictingSeriesIds??[]),
 ...(question?.conditions??[]).map(row=>row.seriesId),
];

/** Complete source inputs are requested only by an explicit historical workspace or action. */
export function requiredSourceIds(state,{purpose='render',catalog=series,library={},ids,action}={}){
 if(ids)return [...new Set(agencies(ids,catalog))];
 if(action){
  const key=Object.keys(action).find(value=>value.startsWith('export'))??'';
  if(key==='exportEconomicEvidence')return [action[key]];
  if(key==='exportPceBaseEffects')return agencies([state.pceBaseIndex??'pceIndex'],catalog);
  if(key.startsWith('exportCurrentAccount'))return key==='exportCurrentAccount'?['beaIta']:['beaIta','bea'];
  const direct={
   exportFiscal:['fiscal'],exportFiscalFinancing:['fiscal'],exportFiscalGdp:['fiscal','treasury','bea'],
   exportRefinancing:['refinancing'],exportRefinancingScenario:['refinancing'],exportYieldCurves:['yields'],
   exportYieldIndicators:['yields'],exportAuctions:['auctions'],exportAuctionBenchmark:['auctions'],
   exportMarket:['marketFunctioning'],exportOwnership:['ownership'],exportMacro:['macroContributions'],
   exportCredit:pageSources.credit,
  };
  if(direct[key])return direct[key];
  if(key==='export')return [...new Set(agencies(state.page==='indicator'?[state.seriesId]:state.selected??[],catalog))];
  if(key==='exportMacroMeasure')return agencies([state.macroMeasure],catalog);
  if(key!=='exportCoverage')return [];
 }
 const result=[...(pageSources[state.page]??[])];
 if(state.page==='indicator'){
  const window=state.window??(Object.hasOwn(state,'range')?'observations':defaultWindowPreset([catalog[state.seriesId]]));
  const count=state.range??12;
  const needsFull=purpose!=='render'||state.tab==='revisions'||(window==='observations'
   ?(catalog[state.seriesId]?.observations.length??0)<count:window!=='1y');
  if(needsFull)result.push(...agencies([state.seriesId],catalog));
 }
 if(state.page==='watchlist')result.push(...agencies(state.saved??[],catalog));
 if(['macroCoverage','labor'].includes(state.page)){
  const family=state.page==='labor'?'labor':state.macroFamily;
  result.push(...agencies(coverageFamilies[family]?.ids??[],catalog));
  if(family==='labor')result.push('laborEvidence');
  if(family==='prices')result.push('pcePriceContributions');
 }
 if(state.page==='explore'){
  if(state.exploreMode==='coverage')result.push(...agencies(searchSeries(Object.values(catalog),state).map(row=>row.id),catalog));
  else if(state.exploreMode==='compare'||purpose!=='render')result.push(...agencies(state.selected??[],catalog));
 }
 if(state.page==='research'&&state.researchView==='workspaces'){
  result.push(...agencies((library.workspaces??[]).flatMap(row=>questionIds(row.researchQuestion)),catalog));
 }
 if(purpose==='freeze'){
  result.push(...agencies(state.freezeSelection??freezeCandidates(state,{catalog}).slice(0,4),catalog));
  if(state.page==='overview')result.push(...overviewSources);
  if(state.page==='yields')result.push('policyRates','marketFunctioning');
 }
 return [...new Set(result)];
}

/** Source completion updates the live route only when it still uses the completed input. */
export function createSourceController(loader,{getRoute,getLibrary=()=>({}),hydrate,onChange}){
 const pending=new Map(),hydrated=new Set();
 const required=route=>requiredSourceIds(route,{library:getLibrary()});
 function stateOf(sourceId){
  const state=loader.getState(sourceId);
  return pending.has(sourceId)&&state.status!=='error'?{...state,status:'loading'}:state;
 }
 function load(sourceId,{retry=false}={}){
  if(pending.has(sourceId))return pending.get(sourceId);
  const state=loader.getState(sourceId);
  if(state.status==='error'&&!retry)return Promise.reject(state.error);
  if(state.status==='ready'){
   if(state.source&&!hydrated.has(sourceId)){hydrate(sourceId,state.source);hydrated.add(sourceId);}
   return Promise.resolve(state.source);
  }
  const request=loader.load(sourceId,{retry}).then(source=>{
   hydrate(sourceId,source);hydrated.add(sourceId);return source;
  });
  const complete=()=>{
   pending.delete(sourceId);
   if(required(getRoute()).includes(sourceId))onChange();
  };
  const settled=request.then(source=>{complete();return source;},error=>{complete();throw error;});
  pending.set(sourceId,settled);return settled;
 }
 return {
  ensure(sourceIds,options){return Promise.all([...new Set(sourceIds)].map(id=>load(id,options)));},
  sync(route,options){
   for(const id of required(route))load(id,options).catch(()=>{});
  },
  context(route){
   const sourceIds=required(route),states=sourceIds.map(stateOf),failed=states.find(row=>row.status==='error');
   return {sourceIds,status:failed?'error':states.every(row=>row.status==='ready')?'ready':'loading',error:failed?.error??null};
  },
 };
}
