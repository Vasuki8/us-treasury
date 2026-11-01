import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaults,parseRoute,routeFor} from '../src/router.js';
import {explorePage} from '../src/explore-page.js';
import {series} from '../src/data.js';
import {groupSearchMeasurements} from '../src/search.js';
import {researchNavigation,navigationFamily} from '../src/research-navigation.js';

const render=(state={})=>explorePage({...defaults,page:'explore',...state});
const rows=html=>[...html.matchAll(/<tr\b[^>]*data-catalog-series="([^"]+)"[^>]*>/g)].map(match=>match[1]);
const links=html=>[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*data-catalog-page="(\d+)"[^>]*>/g)]
  .map(match=>({href:match[1].replaceAll('&amp;','&'),page:Number(match[2])}));

test('Explore begins with no preselected measurements and preserves explicit saved requests',()=>{
  assert.deepEqual(parseRoute('#/explore').selected,[]);
  assert.deepEqual(parseRoute('#/explore?selected=unrate,cpi').selected,['unrate','cpi']);
  assert.deepEqual(parseRoute(routeFor({page:'explore',selected:[]})).selected,[]);
  assert.equal(routeFor({page:'indicator',seriesId:'unrate',selected:['unrate','cpi'],window:'1y'},
    {legacyWindow:true}),'#/series/unrate');
  assert.equal(routeFor({page:'macroCoverage',window:'1y'},{legacyWindow:true}),
    '#/economy?family=prices&measure=cpiMonthly&selected=unrate%2Ccpi');
});

test('Economy opens Activity & income and Sources & terms is a local evidence destination',()=>{
  const state=parseRoute('#/economy');
  assert.equal(state.macroFamily,'activity');
  assert.equal(state.macroMeasure,'realSpendingMonthly');
  assert.equal(parseRoute('#/economy?family=prices').macroFamily,'prices');
  assert.equal(parseRoute('#/sources').page,'sources');
  assert.equal(routeFor({page:'sources'}),'#/sources');
  assert.equal(navigationFamily({page:'sources'}),'evidence');
  const nav=researchNavigation({page:'sources'});
  assert.match(nav,/<a[^>]*href="#\/sources"[^>]*aria-current="page"[^>]*>Sources &amp; terms<\/a>/);
  assert.ok(nav.includes('Saved snapshots'));
  assert.ok(nav.includes('Retrieval history'));
  assert.ok(nav.includes('Capture changes'));
});

test('catalog pages contain at most 25 grouped rows ordered by topic and headline relevance',()=>{
  const all=[],topics=[];
  let page=1;
  for(;;){
    const html=render({catalogPage:page}),ids=rows(html);
    assert.ok(ids.length>0&&ids.length<=25,`Page ${page} has 1–25 measurements`);
    all.push(...ids);topics.push(...ids.map(id=>series[id].topic));
    const next=links(html).find(link=>link.page===page+1);
    if(!next)break;
    assert.equal(parseRoute(next.href).catalogPage,page+1);
    page++;
    assert.ok(page<100,'paging terminates');
  }
  assert.equal(new Set(all).size,all.length,'no primary measurement repeats between pages');
  assert.equal(all.length,groupSearchMeasurements(Object.values(series)).length,'all measurements remain reachable');
  const seen=new Set();let prior;
  for(const topic of topics){if(topic!==prior){assert.ok(!seen.has(topic),`${topic} remains grouped`);seen.add(topic);prior=topic;}}
  for(const [headline,secondary] of [['gdp','nominalGdp'],['cpi','cpiShelter'],['unrate','primeAgeParticipation']]){
    if(all.includes(secondary))assert.ok(all.indexOf(headline)<all.indexOf(secondary),`${headline} leads ${secondary}`);
  }
});

test('paging preserves filters, selections and research windows and clamps invalid pages',()=>{
  const state={selected:['unrate'],query:'',topic:'All topics',frequency:'Monthly',catalogPage:2,
    window:'custom',startDate:'2021-01-01',endDate:'2026-01-01'};
  assert.equal(parseRoute(routeFor({...state,page:'explore'})).catalogPage,2);
  const previous=links(render(state)).find(link=>link.page===1);
  assert.ok(previous);
  const restored=parseRoute(previous.href);
  for(const key of ['selected','query','topic','frequency','window','startDate','endDate'])assert.deepEqual(restored[key],state[key]);
  assert.equal(parseRoute('#/explore?catalogPage=-1').catalogPage,1);
  assert.equal(parseRoute('#/explore?catalogPage=bad').catalogPage,1);
  assert.ok(rows(render({catalogPage:10000})).length>0,'out of range pages retain the last results');
});

test('catalog rows keep closed source evidence while reference filters remain visible above the catalog',()=>{
  const html=render(),row=html.match(/<tr\b[^>]*data-catalog-series="gdp"[^>]*>([^]*?)<\/tr>/)?.[1]??'';
  const details=[...row.matchAll(/<details\b([^>]*)>([^]*?)<\/details>/g)];
  assert.equal(details.length,1,'ordinary notes and separate source evidence share one disclosure');
  assert.doesNotMatch(details[0][1],/\sopen(?:\s|$)/);
  assert.ok(details[0][2].includes('Notes &amp; source evidence'));
  assert.ok(details[0][2].includes('data-select="gdpTotalContribution"'));
  assert.ok(details[0][2].includes('Separate source evidence'));
  assert.doesNotMatch(row,/<span class="pill"/,'the disclosure replaces the redundant Notes badge');
  const filters=html.match(/<div\b[^>]*class="catalog-filter-bar"[^>]*data-page-disclosure="explore:catalog-filters"[^>]*>([^]*?)<\/div><\/div>/);
  assert.ok(filters,'topic and frequency controls remain visible in the reference filter bar');
  assert.ok(filters[1].includes('id="topic-filter"'));assert.ok(filters[1].includes('id="frequency-filter"'));
  assert.ok(html.indexOf('id="catalog-search"')<filters.index,'search remains visible before filters');
});

test('mobile content links precede Density and Overview uses a two-column reading grid',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const menu=html.split('<div class="navigation-menu">')[1]?.split('</details>')[0]??'';
  assert.ok(menu.indexOf('Density')>menu.lastIndexOf('<a '));
  assert.ok(menu.indexOf('Activity &amp; income')<menu.indexOf('Saved views'),'content comes before saved research');
  assert.ok(menu.includes('Sources &amp; terms'));
  assert.ok(!html.includes('Frozen results'));
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(css,/:root\s*\{[^}]*font-size:\s*14px/);
  assert.match(css,/font-family:\s*system-ui/);
  assert.match(css,/ui-monospace/);
  // Stitch uses smaller metadata and table labels; reading text and mobile targets stay legible.
  assert.match(css,/:root\s*\{[^}]*font-family:Inter[^}]*font-size:14px/);
  assert.match(css,/\.subtitle\s*\{[^}]*font-size:14px[^}]*line-height:20px/);
  assert.match(css,/\.brief-takeaways p\s*\{[^}]*font-size:13px[^}]*line-height:18px/);
  assert.match(css,/table,\.table-wrap thead th,\.labor-table thead th\s*\{[^}]*font-size:12px/);
  assert.match(css,/\.stitch-status-label,\.stitch-window-label\s*\{[^}]*font-size:10px/);
  const responsive=css.slice(css.lastIndexOf('@media(max-width:800px)'));
  assert.match(responsive,/\.action[^}]*min-height:44px/);
  const mobile=css.split('@container (max-width:530px)')[1]?.split('@media')[0]??'';
  assert.match(mobile,/\.oh-topic-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(mobile,/grid-auto-flow:\s*column/);
  const calendarOrder=css.match(/\.radar-calendar #calendar-selected-preview\s*\{\s*order:([^;}]+)/)?.[1]?.trim();
  assert.equal(calendarOrder,'0','the mobile schedule precedes its selected-event preview');
});
