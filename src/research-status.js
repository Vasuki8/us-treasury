import {publicationFamily} from './publication-controller.js';
import {stitchPageSources} from './stitch-desk-contracts.js';
/** Relevant collection warnings are shown beside this view; all remain disclosed. */
export function relevantRefreshIds(state,catalog) {
 if(state.page==='calendar')return ['bls','bea','census','dol','treasury','fomc'].map(id=>`calendar:${id}`);
 const moduleSources={overview:['bea','bls','dolAdvance','policyRates','treasury','yields','fiscal'],labor:['bls','dol','dolAdvance','laborEvidence'],fiscal:['fiscal','treasury','bea'],refinancing:['refinancing'],yields:['yields','treasury','policyRates'],auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning'],credit:['bankCredit','lendingSurvey','fedBalance','onRrp','householdDebt','loanDelinquency']};
 let ids=moduleSources[state.page]??[];
 if(state.page==='indicator')ids=[catalog[state.seriesId]?.agency];
 if(state.page==='watchlist')ids=(state.saved??[]).map(id=>catalog[id]?.agency);
 if(state.page==='macroCoverage')ids=state.macroFamily==='external'?['beaIta','bea']:state.macroFamily==='prices'?['bls','bea','pcePriceContributions']:state.macroFamily==='labor'?moduleSources.labor:[catalog[state.macroMeasure]?.agency];
 if(state.page==='explore')ids=(state.selected??[]).map(id=>catalog[id]?.agency);
 if(state.page==='release'){const family=publicationFamily(state.publicationSeries??'gdp'),agency=family==='gdp'?'bea':family==='cpi'?'bls':family==='claims'?'dol':null;return agency?[`calendar:${agency}`,`data:${family==='claims'?'dolAdvance':agency}`]:[];}
 return [...new Set([...ids,...stitchPageSources(state)].filter(Boolean))].map(id=>`data:${id}`);
}
