import { series, releases } from './data.js';
import {coverageFamilies} from './macro-registry.js';
import {defaultWindowPreset} from './date-window.js';

const validIds = ids => [...new Set(ids.filter(id => Object.hasOwn(series, id)))].slice(0, 4);
const topics = ['All topics', ...new Set(Object.values(series).map(s => s.topic))];
const frequencies = ['All frequencies', 'Daily', 'Weekly', 'Monthly', 'Quarterly'];
export const defaults = {
  page: 'overview', seriesId: 'unrate', range: 12, transform: 'level', tab: 'data',
  query: '', topic: 'All topics', frequency: 'All frequencies', selected: ['unrate', 'cpi'],
  exploreMode: 'catalog', comparison: 'native', alignment:'exact',calendarMonth: 'upcoming', day: 'all', calendarTopic: 'All topics',
  watchOnly: false, eventId: '',calendarView:'macro',externalView:'summary',
  refinancingHorizon:12,refinancingShock:100,
  yieldDateA:'',yieldDateB:'',
  pceBaseIndex:'pceIndex',pceMonthlyRate:0.2,pceHorizonMonths:12,pceTargetAnnualRate:2,
  auctionType:'All',auctionId:'',auctionHistoryPage:null,
  vintageCutoff:null,vintageSeries:'gdp',
  window:'1y',startDate:'',endDate:'',returnTo:null,
  macroFamily:'prices',macroMeasure:'cpiMonthly',laborGroup:'all',
  researchView:'workspaces',packageId:'',changeSince:'',changePage:1,publicationCutoff:'',publicationPeriod:'',publicationSeries:'gdp',publicationMode:'quarter',
};

export const returnPages=['overview','explore','watchlist','macroCoverage','labor','fiscal','refinancing','yields','auctions','ownership','macro','vintages','market','credit','calendar'];
const returnPath=/^#\/(?:overview|explore|watchlist|economy(?:\/labor)?|fiscal|refinancing|yields|auctions|ownership|macro|vintages|market|credit|calendar|release|research|series\/[A-Za-z0-9]+)(?:\?|$)/;
/** Local return journeys retain at most three origins, without recursive route growth. */
export function safeReturnTo(value,depth=0,seen=[]){
 if(typeof value!=='string'||value.length>4000||/[\u0000-\u001f\u007f]/.test(value)||!returnPath.test(value)||depth>=3)return null;
 const [path,query='']=value.split('?');
 if(seen.includes(path)||path.startsWith('#/series/')&&!Object.hasOwn(series,path.slice(9)))return null;
 const params=new URLSearchParams(query),origin=params.get('return');params.delete('return');
 // Established list/module destinations are terminal; detail destinations and comparisons may retain an origin.
 if(['#/explore','#/release','#/research','#/vintages'].includes(path)||path.startsWith('#/series/')){
  const terminal=safeReturnTo(origin,depth+1,[...seen,path]);if(terminal)params.set('return',terminal);
 }
 return path+(params.size?'?'+params.toString():'');
}
/** Hash routes work on ordinary static hosts and preserve browser history. */
export function parseRoute(hash = '') {
  const state = { ...defaults, selected: [...defaults.selected] };
  try {
    const [encodedPath, query = ''] = hash.replace(/^#/, '').split('?');
    const path = decodeURIComponent(encodedPath).replace(/\/$/, '');
    const p = new URLSearchParams(query);
    if (path === '/economy/labor') state.page = 'labor';
    else if(path==='/economy')state.page='macroCoverage';
    else if (path.startsWith('/series/')) {
      state.page = 'indicator';
      const id = path.slice('/series/'.length);
      state.seriesId = Object.hasOwn(series, id) ? id : defaults.seriesId;
    } else if (path === '/release') state.page = 'release';
    else if (path === '/credit') state.page = 'credit';
    else if (path === '/calendar') state.page = 'calendar';
    else if (path === '/explore') state.page = 'explore';
    else if (path === '/fiscal') state.page = 'fiscal';
    else if (path === '/refinancing') state.page = 'refinancing';
    else if (path === '/yields') state.page = 'yields';
    else if (path === '/auctions') state.page = 'auctions';
    else if (path === '/ownership') state.page = 'ownership';
    else if (path === '/macro') state.page = 'macro';
    else if (path === '/vintages') state.page = 'vintages';
    else if (path === '/market') state.page = 'market';
    else if (path === '/watchlist') state.page = 'watchlist';
    else if (path === '/research') state.page = 'research';
    state.researchView=['packages','changes','publications'].includes(p.get('view'))?p.get('view'):'workspaces';
    state.packageId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(p.get('package')??'')?p.get('package'):'';
    state.changeSince=(p.get('since')??'').slice(0,64);state.changePage=Math.max(1,Math.min(10000,Number.parseInt(p.get('changePage'),10)||1));
    state.publicationCutoff=(p.get('publishedBy')??'').slice(0,32);
    state.publicationPeriod=(p.get('period')??'').slice(0,16);
    state.publicationSeries=['claimsAdvance','continuedClaimsAdvance','cpi','cpiCore','cpiMonthly','cpiCoreMonthly'].includes(p.get('publicationSeries'))?p.get('publicationSeries'):'gdp';
    state.publicationMode=state.publicationSeries==='gdp'&&p.get('publicationMode')==='matrix'?'matrix':'quarter';
    state.vintageCutoff=p.has('cutoff')?p.get('cutoff').slice(0,64):null;
    state.macroFamily=state.page==='labor'?'labor':Object.hasOwn(coverageFamilies,p.get('family'))?p.get('family'):'prices';
    state.macroMeasure=coverageFamilies[state.macroFamily].ids.includes(p.get('measure'))?p.get('measure'):coverageFamilies[state.macroFamily].defaultMeasure;
    state.laborGroup=['jobs','people','pay','claims'].includes(p.get('group'))?p.get('group'):'all';
    state.externalView=['trends','decomposition','methods'].includes(p.get('section'))?p.get('section'):'summary';
    state.vintageSeries=Object.hasOwn(series,p.get('series'))?p.get('series'):'gdp';
    state.auctionType=['All','Bill','Note','Bond','FRN','TIPS'].includes(p.get('type'))?p.get('type'):'All';
    state.auctionId=(p.get('auction')??'').slice(0,200);
    state.auctionHistoryPage=/^\d{1,5}$/.test(p.get('historyPage')??'')?Math.min(10000,Number(p.get('historyPage'))):null;
    const validCurveDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
    state.yieldDateA=validCurveDate(p.get('curveA'))?p.get('curveA'):'';
    state.yieldDateB=validCurveDate(p.get('curveB'))?p.get('curveB'):'';
    state.pceBaseIndex=p.get('baseIndex')==='pceCoreIndex'?'pceCoreIndex':'pceIndex';
    for(const [field,param]of [['pceMonthlyRate','assumedMonthly'],['pceHorizonMonths','horizonMonths'],['pceTargetAnnualRate','targetAnnual']])if(p.has(param))state[field]=p.get(param).trim()!==''?Number(p.get(param)):Number.NaN;
    state.refinancingHorizon=[3,12,24].includes(Number(p.get('horizon')))?Number(p.get('horizon')):12;
    state.refinancingShock=[25,50,100,200].includes(Number(p.get('shock')))?Number(p.get('shock')):100;
    state.range = p.get('range') === '6' ? 6 : 12;
    state.startDate=(p.get('start')??'').slice(0,64);state.endDate=(p.get('end')??'').slice(0,64);
    state.returnTo=safeReturnTo(p.get('return'));
    state.transform = p.get('transform') === 'change' ? 'change' : 'level';
    state.tab = ['methodology', 'revisions'].includes(p.get('tab')) ? p.get('tab') : 'data';
    state.query = (p.get('q') || '').slice(0, 200);
    state.topic = topics.includes(p.get('topic')) ? p.get('topic') : 'All topics';
    state.frequency = frequencies.includes(p.get('frequency')) ? p.get('frequency') : 'All frequencies';
    if (p.has('selected')) state.selected = validIds(p.get('selected').split(','));
    state.window=['1y','3y','5y','all','custom'].includes(p.get('window'))?p.get('window'):
      !p.has('window')&&['6','12'].includes(p.get('range'))?'observations':defaultRouteWindow(state);
    state.exploreMode = ['compare','coverage'].includes(p.get('mode')) ? p.get('mode') : 'catalog';
    state.comparison = ['indexed','difference'].includes(p.get('comparison')) ? p.get('comparison') : 'native';
    state.alignment=p.get('alignment')==='quarter'?'quarter':'exact';
    state.day = releases.some(event=>event.date===p.get('day')) ? p.get('day') : 'all';
    state.calendarMonth = releases.some(event => event.date.startsWith(p.get('month') + '-')) ? p.get('month') : !p.has('month') && state.day !== 'all' ? state.day.slice(0, 7) : 'upcoming';
    if (state.calendarMonth !== 'upcoming' && state.day !== 'all' && !state.day.startsWith(state.calendarMonth + '-')) state.day = 'all';
    state.calendarTopic = topics.includes(p.get('calendarTopic')) ? p.get('calendarTopic') : 'All topics';
    state.watchOnly = p.get('watch') === '1';
    state.calendarView=['treasury','all'].includes(p.get('scope'))?p.get('scope'):'macro';
    state.eventId = state.page==='release'?(p.get('event')??'').slice(0,200):releases.some(event => event.id === p.get('event')) ? p.get('event') : defaults.eventId;
  } catch {
    // A malformed externally supplied URL should leave the workspace usable.
  }
  return state;
}

export function routeFor(input,{legacyWindow=false}={}) {
  const state = { ...defaults, ...input };
  if(!Object.hasOwn(input,'window'))state.window=Object.hasOwn(input,'range')?'observations':defaultRouteWindow(state);
  const path = {release:'/release',credit:'/credit',research:"/research",macroCoverage:'/economy',overview:'/overview',labor:'/economy/labor',indicator:`/series/${encodeURIComponent(state.seriesId)}`,calendar:'/calendar',explore:'/explore',watchlist:'/watchlist',fiscal:'/fiscal',refinancing:'/refinancing',yields:'/yields',auctions:'/auctions',ownership:'/ownership',macro:'/macro',vintages:'/vintages',market:'/market'}[state.page] || '/overview';
  const p = new URLSearchParams();
  if(state.alignment==='quarter')p.set('alignment','quarter');
  if(['research','release'].includes(state.page)){
    p.set('view',state.researchView);if(state.packageId)p.set('package',state.packageId);
    if(state.changeSince)p.set('since',state.changeSince);if(state.changePage>1)p.set('changePage',String(state.changePage));
    if(state.publicationCutoff)p.set('publishedBy',state.publicationCutoff);
    if(state.publicationPeriod)p.set('period',state.publicationPeriod);
    if(['claimsAdvance','continuedClaimsAdvance','cpi','cpiCore','cpiMonthly','cpiCoreMonthly'].includes(state.publicationSeries))p.set('publicationSeries',state.publicationSeries);
    if(state.publicationSeries==='gdp'&&state.publicationMode==='matrix')p.set('publicationMode','matrix');
  }
  if(state.page==='macroCoverage'){
    p.set('family',state.macroFamily);p.set('measure',state.macroMeasure);
    if(state.macroFamily==='prices'){
      if(state.pceBaseIndex==='pceCoreIndex')p.set('baseIndex',state.pceBaseIndex);
      for(const [field,param]of [['pceMonthlyRate','assumedMonthly'],['pceHorizonMonths','horizonMonths'],['pceTargetAnnualRate','targetAnnual']])if(state[field]!==defaults[field])p.set(param,String(state[field]));
    }
    if(state.macroFamily==='external'&&['trends','decomposition','methods'].includes(state.externalView))p.set('section',state.externalView);
  }
  if(state.page==='labor')p.set('measure',coverageFamilies.labor.ids.includes(state.macroMeasure)?state.macroMeasure:coverageFamilies.labor.defaultMeasure);
  if(state.page==='labor'||state.page==='macroCoverage'&&state.macroFamily==='labor'){
    if(['jobs','people','pay','claims'].includes(state.laborGroup))p.set('group',state.laborGroup);
    if(state.query)p.set('q',state.query);
  }
  if(state.page==='vintages'){
    if(state.vintageCutoff!==null)p.set('cutoff',state.vintageCutoff);
    if(state.vintageSeries!=='gdp')p.set('series',state.vintageSeries);
  }
  if(state.page==='auctions'){
    if(state.auctionType!=='All')p.set('type',state.auctionType);
    if(state.auctionId)p.set('auction',state.auctionId);
    if(Number.isInteger(state.auctionHistoryPage)&&state.auctionHistoryPage>=0)p.set('historyPage',String(Math.min(10000,state.auctionHistoryPage)));
  }
  if(state.page==='yields'){
    if(state.yieldDateA)p.set('curveA',state.yieldDateA);
    if(state.yieldDateB)p.set('curveB',state.yieldDateB);
  }
  if(state.page==='refinancing'){
    if(state.refinancingHorizon!==12)p.set('horizon',String(state.refinancingHorizon));
    if(state.refinancingShock!==100)p.set('shock',String(state.refinancingShock));
  }
  if (state.page === 'indicator'||['release','research'].includes(state.page)&&safeReturnTo(state.returnTo)) {
    if(safeReturnTo(state.returnTo)||validIds(state.selected||[]).join(',')!==defaults.selected.join(','))p.set('selected',validIds(state.selected||[]).join(','));
    if(['indexed','difference'].includes(state.comparison))p.set('comparison',state.comparison);
    if (state.transform === 'change') p.set('transform', 'change');
    if (state.tab !== 'data') p.set('tab', state.tab);
  }
  if (state.page === 'explore') {
    p.set('selected', validIds(state.selected || []).join(','));
    if (state.query) p.set('q', state.query);
    if (state.topic !== 'All topics') p.set('topic', state.topic);
    if (state.frequency !== 'All frequencies') p.set('frequency', state.frequency);
    if (['compare','coverage'].includes(state.exploreMode)) p.set('mode', state.exploreMode);
    if (['indexed','difference'].includes(state.comparison)) p.set('comparison', state.comparison);
  }
  if(['watchlist','macroCoverage','labor'].includes(state.page)){
    p.set('selected',validIds(state.selected||[]).join(','));
    if(['indexed','difference'].includes(state.comparison))p.set('comparison',state.comparison);
  }
  if(state.page==='indicator'||returnPages.includes(state.page)||['release','research'].includes(state.page)){
    if(state.window==='observations')p.set('range',String(state.range===6?6:12));
    else if(state.window!=='1y'||!legacyWindow&&defaultRouteWindow(state)!=='1y')p.set('window',state.window);
    if(state.window==='custom'){p.set('start',state.startDate);p.set('end',state.endDate);}
    const returnTo=safeReturnTo(state.returnTo);if(returnTo&&state.page!=='watchlist')p.set('return',returnTo);
  }
  if (state.page === 'calendar'||state.page==='release') {
    if(['treasury','all'].includes(state.calendarView))p.set('scope',state.calendarView);
    if (state.calendarMonth !== 'upcoming') p.set('month', state.calendarMonth);
    if (state.day !== 'all') p.set('day', state.day);
    if (state.calendarTopic !== 'All topics') p.set('calendarTopic', state.calendarTopic);
    if (state.watchOnly) p.set('watch', '1');
    if (state.eventId) p.set('event', state.eventId);
  }
  return `#${path}${p.size ? `?${p}` : ''}`;
}

/** Destination identity excludes in-place choices such as filters, ranges and tabs. */
export function navigationDestination(state={}){
 const page=state.page??defaults.page;
 const detail=page==='macroCoverage'?state.macroFamily??defaults.macroFamily:page==='indicator'?state.seriesId??defaults.seriesId:page==='research'?`${state.researchView??defaults.researchView}:${state.researchView==='packages'?state.packageId??'':''}`:page==='release'?`${state.eventId??''}:${state.publicationSeries??'gdp'}:${state.publicationPeriod??''}:${state.publicationCutoff??''}`:page==='explore'?state.exploreMode??defaults.exploreMode:'';
 return `${page}:${detail}`;
}
export const destinationChanged=(previous,next)=>navigationDestination(previous)!==navigationDestination(next);

export function defaultRouteWindow(state={}){
 const id=state.page==='indicator'?state.seriesId:['macroCoverage','labor'].includes(state.page)?state.macroMeasure:
  ['explore','watchlist'].includes(state.page)?state.selected?.[0]:null;
 return defaultWindowPreset([series[id]]);
}

/** Re-evaluate an automatic entry after the destination's actual selection is known. */
export function entryWindow(state,hash=''){
 const params=new URLSearchParams(hash.split('?')[1]??'');
 return params.has('window')||params.has('range')?state.window:defaultRouteWindow(state);
}
