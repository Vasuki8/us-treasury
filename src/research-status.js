/** Relevant collection warnings are shown beside this view; all remain disclosed. */
export function relevantRefreshIds(state,catalog) {
 if(state.page==='calendar')return ['bls','bea','census','dol','treasury','fomc'].map(id=>`calendar:${id}`);
 const moduleSources={overview:['bea','bls','dolAdvance','policyRates','treasury','yields','fiscal'],labor:['bls','dol','dolAdvance','laborEvidence'],fiscal:['fiscal','treasury','bea'],refinancing:['refinancing'],yields:['yields','treasury','policyRates'],auctions:['auctions'],ownership:['ownership'],macro:['macroContributions'],market:['marketFunctioning'],credit:['bankCredit','lendingSurvey','fedBalance','onRrp','householdDebt','loanDelinquency']};
 let ids=moduleSources[state.page]??[];
 if(state.page==='indicator')ids=[catalog[state.seriesId]?.agency];
 if(state.page==='watchlist')ids=(state.saved??[]).map(id=>catalog[id]?.agency);
 if(state.page==='macroCoverage')ids=state.macroFamily==='external'?['beaIta','bea']:state.macroFamily==='prices'?['bls','bea','pcePriceContributions']:state.macroFamily==='labor'?moduleSources.labor:[catalog[state.macroMeasure]?.agency];
 if(state.page==='explore')ids=(state.selected??[]).map(id=>catalog[id]?.agency);
 if(state.page==='release')return [`calendar:${state.publicationSeries==='gdp'?'bea':'dol'}`,`data:${state.publicationSeries==='gdp'?'bea':'dolAdvance'}`];
 return [...new Set(ids.filter(Boolean))].map(id=>`data:${id}`);
}
