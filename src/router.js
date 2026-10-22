import { series, releases } from './data.js';

const validIds = ids => [...new Set(ids.filter(id => Object.hasOwn(series, id)))].slice(0, 4);
const topics = ['All topics', ...new Set(Object.values(series).map(s => s.topic))];
const frequencies = ['All frequencies', 'Daily', 'Weekly', 'Monthly', 'Quarterly'];
export const defaults = {
  page: 'overview', seriesId: 'unrate', range: 12, transform: 'level', tab: 'data',
  query: '', topic: 'All topics', frequency: 'All frequencies', selected: ['unrate', 'cpi'],
  exploreMode: 'catalog', comparison: 'native', calendarMonth: 'upcoming', day: 'all', calendarTopic: 'All topics',
  watchOnly: false, eventId: '',
  refinancingHorizon:12,refinancingShock:100,
  yieldDateA:'',yieldDateB:'',
  auctionType:'All',auctionId:'',
};

/** Hash routes work on ordinary static hosts and preserve browser history. */
export function parseRoute(hash = '') {
  const state = { ...defaults, selected: [...defaults.selected] };
  try {
    const [encodedPath, query = ''] = hash.replace(/^#/, '').split('?');
    const path = decodeURIComponent(encodedPath).replace(/\/$/, '');
    const p = new URLSearchParams(query);
    if (path === '/economy/labor') state.page = 'labor';
    else if (path.startsWith('/series/')) {
      state.page = 'indicator';
      const id = path.slice('/series/'.length);
      state.seriesId = Object.hasOwn(series, id) ? id : defaults.seriesId;
    } else if (path === '/calendar') state.page = 'calendar';
    else if (path === '/explore') state.page = 'explore';
    else if (path === '/fiscal') state.page = 'fiscal';
    else if (path === '/refinancing') state.page = 'refinancing';
    else if (path === '/yields') state.page = 'yields';
    else if (path === '/auctions') state.page = 'auctions';
    else if (path === '/ownership') state.page = 'ownership';
    else if (path === '/macro') state.page = 'macro';
    state.auctionType=['All','Bill','Note','Bond','FRN','TIPS'].includes(p.get('type'))?p.get('type'):'All';
    state.auctionId=(p.get('auction')??'').slice(0,200);
    const validCurveDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
    state.yieldDateA=validCurveDate(p.get('curveA'))?p.get('curveA'):'';
    state.yieldDateB=validCurveDate(p.get('curveB'))?p.get('curveB'):'';
    state.refinancingHorizon=[3,12,24].includes(Number(p.get('horizon')))?Number(p.get('horizon')):12;
    state.refinancingShock=[25,50,100,200].includes(Number(p.get('shock')))?Number(p.get('shock')):100;
    state.range = p.get('range') === '6' ? 6 : 12;
    state.transform = p.get('transform') === 'change' ? 'change' : 'level';
    state.tab = ['methodology', 'revisions'].includes(p.get('tab')) ? p.get('tab') : 'data';
    state.query = (p.get('q') || '').slice(0, 200);
    state.topic = topics.includes(p.get('topic')) ? p.get('topic') : 'All topics';
    state.frequency = frequencies.includes(p.get('frequency')) ? p.get('frequency') : 'All frequencies';
    if (p.has('selected')) state.selected = validIds(p.get('selected').split(','));
    state.exploreMode = p.get('mode') === 'compare' ? 'compare' : 'catalog';
    state.comparison = p.get('comparison') === 'indexed' ? 'indexed' : 'native';
    state.day = releases.some(event=>event.date===p.get('day')) ? p.get('day') : 'all';
    state.calendarMonth = releases.some(event => event.date.startsWith(p.get('month') + '-')) ? p.get('month') : !p.has('month') && state.day !== 'all' ? state.day.slice(0, 7) : 'upcoming';
    if (state.calendarMonth !== 'upcoming' && state.day !== 'all' && !state.day.startsWith(state.calendarMonth + '-')) state.day = 'all';
    state.calendarTopic = topics.includes(p.get('calendarTopic')) ? p.get('calendarTopic') : 'All topics';
    state.watchOnly = p.get('watch') === '1';
    state.eventId = releases.some(event => event.id === p.get('event')) ? p.get('event') : defaults.eventId;
  } catch {
    // A malformed externally supplied URL should leave the workspace usable.
  }
  return state;
}

export function routeFor(input) {
  const state = { ...defaults, ...input };
  const path = {overview:'/overview',labor:'/economy/labor',indicator:`/series/${encodeURIComponent(state.seriesId)}`,calendar:'/calendar',explore:'/explore',fiscal:'/fiscal',refinancing:'/refinancing',yields:'/yields',auctions:'/auctions',ownership:'/ownership',macro:'/macro'}[state.page] || '/overview';
  const p = new URLSearchParams();
  if(state.page==='auctions'){
    if(state.auctionType!=='All')p.set('type',state.auctionType);
    if(state.auctionId)p.set('auction',state.auctionId);
  }
  if(state.page==='yields'){
    if(state.yieldDateA)p.set('curveA',state.yieldDateA);
    if(state.yieldDateB)p.set('curveB',state.yieldDateB);
  }
  if(state.page==='refinancing'){
    if(state.refinancingHorizon!==12)p.set('horizon',String(state.refinancingHorizon));
    if(state.refinancingShock!==100)p.set('shock',String(state.refinancingShock));
  }
  if (state.page === 'indicator') {
    if (state.range === 6) p.set('range', '6');
    if (state.transform === 'change') p.set('transform', 'change');
    if (state.tab !== 'data') p.set('tab', state.tab);
  }
  if (state.page === 'explore') {
    p.set('selected', validIds(state.selected || []).join(','));
    if (state.query) p.set('q', state.query);
    if (state.topic !== 'All topics') p.set('topic', state.topic);
    if (state.frequency !== 'All frequencies') p.set('frequency', state.frequency);
    if (state.exploreMode === 'compare') p.set('mode', 'compare');
    if (state.comparison === 'indexed') p.set('comparison', 'indexed');
    if (state.range === 6) p.set('range', '6');
  }
  if (state.page === 'calendar') {
    if (state.calendarMonth !== 'upcoming') p.set('month', state.calendarMonth);
    if (state.day !== 'all') p.set('day', state.day);
    if (state.calendarTopic !== 'All topics') p.set('calendarTopic', state.calendarTopic);
    if (state.watchOnly) p.set('watch', '1');
    if (state.eventId) p.set('event', state.eventId);
  }
  return `#${path}${p.size ? `?${p}` : ''}`;
}
