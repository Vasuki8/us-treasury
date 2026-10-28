const aliases = {
  u6:{ids:['underemployment'],phrases:['labor underutilization']},
  'fed policy':{ids:['policyTargetLower','policyTargetUpper','iorb'],phrases:['federal funds target','reserve balances']},
  jobs: { ids: ['payroll', 'unrate'], phrases: ['employment', 'jobs'] },
  employment: { ids: ['payroll', 'unrate'], phrases: ['employment', 'jobs'] },
  'jobs data': { ids: ['payroll', 'unrate'], phrases: ['employment', 'jobs'] },
  unemployment: { ids: ['unrate','underemployment'], phrases: ['unemployment'] },
  'unemployment rate': { ids: ['unrate'], phrases: ['unemployment rate'] },
  inflation: { ids: ['cpi', 'pce'], phrases: ['inflation'] },
  'consumer prices': { ids: ['cpi'], phrases: ['consumer price', 'cpi'] },
  gdp: { ids: ['gdp'], phrases: ['gdp', 'gross domestic product'] },
  'economic growth': { ids: ['gdp'], phrases: ['gdp', 'gross domestic product', 'economic growth'] },
  treasury: { ids: ['yield', 'debt'], phrases: ['treasury'] },
  'interest rates': { ids: ['yield'], phrases: ['yield', 'funding rate', 'federal funds rate', 'financing rate'] },
  'bond yields': { ids: ['yield'], phrases: ['treasury par yield', 'treasury real par yield'] },
  debt: { ids: ['debt'], phrases: ['debt'] },
  'national debt': { ids: ['debt'], phrases: ['federal debt', 'treasury debt'] },
  'jobless claims': { ids: ['claims'], phrases: ['unemployment insurance claims'] },
  'job openings': { ids: ['openings'], phrases: ['job openings'] },
};

const normalize = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
/** Same headline, separate admitted retrieval/source evidence. No broad ID deduplication. */
export function groupSearchMeasurements(items){
 const canonical={gdpTotalContribution:'gdp'},groups=new Map();
 for(const item of items){const key=canonical[item.id]??item.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
 return [...groups].map(([id,rows])=>{const primary=rows.find(row=>row.id===id)??rows[0];return {primary,variants:rows.filter(row=>row!==primary)};});
}
const metadataText = value => {
  if (Array.isArray(value)) return value.map(metadataText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(metadataText).join(' ');
  return String(value ?? '');
};

/** Full-catalog search: aliases add matches; they never replace the catalog. */
export function searchSeries(seriesList, { query = '', topic = 'All topics', frequency = 'All frequencies', watchlist = null } = {}) {
  const normalized = normalize(query);
  const terms = normalized.split(' ').filter(Boolean);
  const alias = Object.hasOwn(aliases, normalized) ? aliases[normalized] : null;
  const saved = watchlist === null ? null : new Set(watchlist);
  const matches = [];
  for (const [order, current] of seriesList.entries()) {
    if (topic !== 'All topics' && current.topic !== topic) continue;
    if (frequency !== 'All frequencies' && current.frequency !== frequency) continue;
    if (saved && !saved.has(current.id)) continue;
    if (!normalized) { matches.push({ current, rank: 0, order }); continue; }

    const id = normalize(current.id), code = normalize(current.code);
    const name = normalize(current.name), short = normalize(current.short);
    const sourceIds = (current.source?.seriesIds ?? []).map(normalize);
    const haystack = normalize(metadataText([
      current.id, current.code, current.name, current.short, current.topic,
      current.frequency, current.unit, current.agency, current.source?.name,
      current.source?.seriesIds, current.sourceTitle, current.definition,
      current.calculation, current.measure, current.observationType, current.adjustment,
    ]));
    const directMatch = terms.every(term => haystack.includes(term));
    const aliasMatch = alias && (alias.ids.includes(current.id) || alias.phrases.some(phrase => haystack.includes(phrase)));
    if (!directMatch && !aliasMatch) continue;

    // Categories keep exact IDs/codes/titles ahead of any number of loose hits.
    const category = id === normalized ? 8 : code === normalized || sourceIds.includes(normalized) ? 7
      : name === normalized ? 6 : short === normalized ? 5
        : name.startsWith(normalized) ? 4 : name.includes(normalized) ? 3
          : code.includes(normalized) || sourceIds.some(value => value.includes(normalized)) ? 2 : 1;
    const detail = terms.reduce((score, term) => score + (id.includes(term) ? 40 : 0)
      + (code.includes(term) ? 32 : 0) + (name.includes(term) ? 24 : 0)
      + (short.includes(term) ? 16 : 0), 0);
    matches.push({ current, rank: category * 10000 + detail + (alias?.ids.includes(current.id) ? 50 : 0), order });
  }
  return matches.sort((a, b) => b.rank - a.rank || a.order - b.order).map(({ current }) => current);
}
