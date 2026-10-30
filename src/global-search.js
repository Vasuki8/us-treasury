import {searchSeries,groupSearchMeasurements} from './search.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {escapeHtml as esc} from './ui.js';
import {humanDate} from './ui-time.js';

const normalize=value=>String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
const pageDefinitions=[
 ['Overview','#/overview','US daily briefing macro snapshot'],
 ['Activity & income','#/economy?family=activity','economy growth consumption spending saving GDP'],
 ['GDP contributions','#/macro','growth gross domestic product components consumption investment'],
 ['Inflation','#/economy?family=prices','economy consumer prices CPI PCE inflation momentum'],
 ['Labor market','#/economy/labor','economy jobs employment unemployment wages participation claims payroll'],
 ['Residential construction','#/economy?family=housing','housing economy starts permits completions construction'],
 ['Trade & current account','#/economy?family=external','economy trade balance external exports imports income transfers'],
 ['Credit & banking','#/credit','economy credit banking transmission loans deposits'],
 ['Policy rates','#/economy?family=policy','fed FOMC federal reserve monetary policy target funding'],
 ['Rates & curves','#/yields','fed Treasury yields nominal real inflation compensation curve'],
 ['Funding & market functioning','#/market','fed liquidity funding repo SOFR EFFR dealers'],
 ['Fiscal pressure','#/fiscal','Treasury funding debt deficit interest revenue spending budget'],
 ['Refinancing exposure','#/refinancing','Treasury funding debt maturity maturities refinancing risk scenario'],
 ['Auction demand','#/auctions','Treasury funding auction results bid cover dealers allotment'],
 ['Debt ownership','#/ownership','Treasury funding holders foreign domestic ownership'],
 ['Calendar','#/calendar','scheduled events releases catalysts economic calendar'],
 ['Explore data','#/explore','indicators series catalog compare comparison download definitions'],
 ['Watchlist','#/watchlist','my research followed saved indicators'],
 ['Saved views','#/research','my research saved workspaces configurations'],
 ['Saved snapshots','#/research?view=packages','my research pinned packages frozen values saved snapshots'],
 ['Published estimates','#/research?view=publications','data evidence official publication history GDP claims estimates'],
 ['Captured history','#/vintages','data evidence retrieval history captured cutoff vintages'],
 ['Capture changes','#/research?view=changes','data evidence collection changes revisions checkpoint'],
 ['Sources & terms','#/sources','data sources rights attribution reuse terms notices'],
];
const matches=(query,text)=>query.split(' ').every(term=>normalize(text).includes(term));
const byName=(a,b)=>a.label.localeCompare(b.label);

/** Exact identifiers resolve only when the matching identifier tier is unique. */
export function exactIndicatorMatch(query,catalog=[]) {
 const value=normalize(query);if(!value)return null;
 for(const pick of [item=>[item.id],item=>[item.code],item=>item.source?.seriesIds??[]]) {
  const matches=catalog.filter(item=>pick(item).some(candidate=>normalize(candidate)===value));
  if(matches.length)return matches.length===1?matches[0]:null;
 }
 return null;
}

/** Groups retain their own semantics; a schedule match is never a release claim. */
export function globalSearch(query,{catalog=[],events=[],library={},now=new Date()}={}) {
 const normalized=normalize(query),result={query:String(query??'').trim(),pages:[],indicators:[],events:[],research:[]};
 if(!normalized)return result;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const basisLabel=event=>({'listed-date':'Listed date','recurring-rule':'Agency rule','published-exception':'Agency exception','calendar-estimate':'Estimated'}[event.scheduleBasis]??'Basis not supplied');
 const indicatorText=ids=>ids.map(id=>{const item=catalog.find(item=>item.id===id);return item?[item.id,item.name,item.short,item.code,item.topic].join(' '):id;}).join(' ');
 result.pages=pageDefinitions.filter(([label,,terms])=>matches(normalized,`${label} ${terms}`)).map(([label,href])=>({label,href}));
 result.indicators=searchSeries(catalog,{query});
 result.events=events.filter(event=>matches(normalized,[event.name,event.agency,event.topic,event.program,event.periodLabel,event.date,indicatorText(calendarRelatedIds(event))].join(' ')))
  .sort((a,b)=>{
   const pastA=a.date<today,pastB=b.date<today;
   return Number(pastA)-Number(pastB)||(pastA?String(b.date).localeCompare(String(a.date)):String(a.date).localeCompare(String(b.date)))||String(a.time??'').localeCompare(String(b.time??''))||String(a.id).localeCompare(String(b.id));
  })
  .map(event=>({id:event.id,sourceId:event.sourceId,label:event.name,date:event.date,time:event.time??null,
   periodLabel:event.periodLabel??null,agency:event.agency??event.sourceId,basis:basisLabel(event),past:event.date<today,
   href:`#/calendar?month=${encodeURIComponent(String(event.date).slice(0,7))}&event=${encodeURIComponent(event.id)}`
    +`&scope=${['treasury','treasury-auctions'].includes(event.sourceId)?'treasury':'macro'}`}));
 result.research=[
  ...(library.workspaces??[]).filter(item=>matches(normalized,[item.name,item.state?.page,indicatorText([...new Set([item.state?.seriesId,...item.state?.selected??[]].filter(Boolean))])].join(' '))).map(item=>({id:item.id,label:item.name,kind:'workspace',description:'Saved view · opens current data'})),
  ...(library.packages??[]).filter(item=>matches(normalized,[item.name,indicatorText(item.request?.ids??[]),item.resolvedWindow?.label].join(' '))).map(item=>({id:item.id,label:item.name,kind:'package',description:'Frozen values · retained package',href:`#/research?view=packages&package=${encodeURIComponent(item.id)}`})),
 ].sort(byName);
 return result;
}

export function globalSearchPanel(result,{includeIndicators=true}={}) {
 if(!result.query)return '';
 const anchor=item=>`<a href="${esc(item.href)}">${esc(item.label)}</a>`;
 const group=(label,items,render)=>items.length?`<details class="global-search-group" aria-label="${label} search results"${label==='Indicators'?' open':''}><summary>${label} <span class="muted">${items.length}</span></summary><ul>${items.map(item=>`<li>${render(item)}</li>`).join('')}</ul></details>`:'';
 const events=group('Scheduled events',result.events,item=>`${anchor(item)}`
  +`<span class="table-code muted" data-calendar-source="${esc(item.sourceId)}">${esc(humanDate(item.date))}`
  +(item.time?` · ${esc(item.time)} ET`:'')+` · ${esc(item.agency)}${item.periodLabel?` · ${esc(item.periodLabel)}`:''}`
  +` · ${esc(item.basis)} · ${item.past?'Past event · Earlier schedule':'Upcoming event'} · Schedule only</span>`);
 const research=group('Saved research',result.research,item=>`${item.kind==='workspace'?`<button type="button" class="link-button" data-open-workspace="${esc(item.id)}">${esc(item.label)}</button>`:anchor(item)}<span class="table-code muted">${esc(item.description)}</span>`);
 const indicator=item=>`<a href="#/series/${encodeURIComponent(item.id)}">${esc(item.name)}</a><span class="table-code mono muted">${esc(item.code)} · ${esc(item.source?.name??'')}</span>`;
 const indicators=includeIndicators?group('Indicators',groupSearchMeasurements(result.indicators),entry=>indicator(entry.primary)+(entry.variants.length?`<details><summary>Separate source evidence · ${entry.variants.length}</summary><ul>${entry.variants.map(item=>`<li>${indicator(item)}</li>`).join('')}</ul></details>`:'')):'';
 return `<div class="panel-body global-search-results" role="region" aria-label="Search across the workspace">${indicators}<div class="grid g11">${group('Pages',result.pages,anchor)}${events}</div>${research}<p class="small muted">Scheduled events are source calendar entries; publication is verified separately. Saved research is local to this browser.</p></div>`;
}
