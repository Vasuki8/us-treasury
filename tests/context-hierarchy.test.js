import test from 'node:test';
import assert from 'node:assert/strict';
import {macroPage} from '../src/macro-page.js';
import {creditContextPage} from '../src/credit-context-page.js';
import {vintagesPage} from '../src/vintages-page.js';
import {releasePage} from '../src/release-page.js';
import {watchlistPage} from '../src/watchlist-page.js';
import {researchPage} from '../src/research-page.js';
import {recordVintages} from '../src/vintages.js';
import {createResearchPackage} from '../src/research-packages.js';
import {publicationArchive} from '../src/publication-archive.js';
import {buildPinContext} from '../src/research-context.js';
import {parseRoute} from '../src/router.js';
import {currentAccountGdpBreakdownFixture} from './helpers/current-account-gdp-breakdown-fixture.js';
import {creditContextGroups} from '../src/credit-context-registry.js';

// Model native closed disclosures without depending on a browser or CSS.
function disclosureContent(html, key) {
  const marker=`data-page-disclosure="${key}"`;
  const at=html.indexOf(marker);assert.ok(at>=0,`Missing persistent disclosure ${key}`);
  const start=html.lastIndexOf('<details',at),tokens=html.slice(start).matchAll(/<\/?details\b[^>]*>/g);
  let depth=0;
  for(const token of tokens){depth+=token[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,start+token.index+token[0].length);}
  assert.fail(`Unclosed disclosure ${key}`);
}
function visible(html){
  let hidden=0,result='';
  for(const token of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
    if(token[0].startsWith('<details')){if(hidden||! /\sopen(?:\s|>)/.test(token[0]))hidden++;}
    else if(token[0].startsWith('</details')){if(hidden)hidden--;}
    else if(!hidden)result+=token[0];
  }
  return result;
}
function ordered(html,labels){let prior=-1;for(const label of labels){const next=html.indexOf(label);assert.ok(next>prior,`${label} should follow the primary working view`);prior=next;}}
const stamp='2026-10-20T12:00:00.123Z';
const captured=(fetchedAt,value)=>({id:'bea',fetchedAt,series:{gdp:{unit:'Percent',definition:'Captured growth',observations:[{date:'2026-04-01',value}]}}});
const history=recordVintages(null,{bea:captured(stamp,2.2)},{bea:captured('2026-10-21T12:00:00.456Z',2.4)},{checkedAt:'2026-10-21T13:00:00.000Z'});

test('GDP accounting results lead supporting subdetail and methods while critical bases stay visible',()=>{
 const source={status:'ok',fetchedAt:stamp,quarterly:[{date:'2026-04-01',total:2,consumption:1,investment:.5,government:.2,exports:.4,imports:-.1,reconciliationResidual:0,complete:true}],cpiCategoryEffects:{reason:'Exact CPI effects unavailable; no approximation.'}};
 const html=macroPage(source),lead=visible(html);
 ordered(html,['GDP: WHAT CHANGED','HISTORICAL REAL GDP','data-page-disclosure="macro:demand-detail"','data-page-disclosure="macro:methods"']);
 for(const text of ['Sum of published contributions','Headline minus contribution sum','percent q/q annualized','percentage points','Imports'])assert.ok(lead.includes(text),text);
 assert.match(lead,/accounting contributions do not establish economic causation/i);
 assert.match(disclosureContent(html,'macro:demand-detail'),/alternatives to parent totals/);
 assert.match(disclosureContent(html,'macro:methods'),/not establish economic causation/);
 assert.match(html,/data-export-macro/);
});

test('credit source metrics and errors remain open with one persistent source-evidence disclosure per group',()=>{
 const group=creditContextGroups[0],html=creditContextPage({[group.id]:{status:'error',fetchedAt:stamp,error:'Source failure',series:{[group.ids[0]]:{observations:[{date:'2026-10-07',value:null}]}}}},{documents:[]});
 const lead=visible(html);assert.match(lead,/Source failure/);assert.match(lead,/Unavailable/);assert.match(lead,/data-chart/);assert.match(lead,/latest three years/);
 for(const item of creditContextGroups)assert.match(disclosureContent(html,`credit:${item.id}:evidence`),/Definitions|definition|Source/i);
 assert.equal((html.match(/latest three years per source group/g)??[]).length,1);
});

test('capture controls and both evidence tables precede supporting provenance with UTC scope visible',()=>{
 const html=vintagesPage({vintageSeries:'gdp'},history),lead=visible(html);
 ordered(html,['id="vintage-cutoff"','REAL GROSS DOMESTIC PRODUCT GROWTH · RETAINED VALUES','OBSERVED VALUE CHANGES','data-page-disclosure="vintages:provenance"']);
 for(const text of ['step="0.001"','Captures at the exact cutoff are included','First captured','Latest captured','2.4%','2.2%','not first reported'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(html,'vintages:methods'),/Supplemental module data and calendars are not reconstructed/);
 assert.match(disclosureContent(html,'vintages:source-terms'),/Captured growth/);
 assert.match(visible(vintagesPage({},undefined,{status:'error',error:{message:'Failed archive'}})),/data-retry-history/);
});

test('release results, roles and essential clocks remain open before collection and source internals',()=>{
 const row=publicationArchive.releases.find(row=>row.seriesId==='gdp'),html=releasePage({publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate},{archive:publicationArchive,publicationState:{status:'ready'}}),lead=visible(html);
 for(const text of ['Verified official result','Earlier estimate of this quarter','Expected schedule','Verified publication','Evidence retrieved','day precision','RETURN TO CALENDAR','PUBLICATION HISTORY / CSV / FREEZE'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(html,'release:collection'),/Schedule-to-retrieval delay/);
 assert.match(disclosureContent(html,'release:source-reuse'),/Reuse terms/);
 ordered(html,['VERIFIED OFFICIAL RESULT','SCHEDULE, PUBLICATION AND COLLECTION','AGENCY EXPLANATION','data-page-disclosure="release:source-reuse"']);
});

test('watchlist keeps comparison and recovery open while deliberate editing and source details persist',()=>{
 const html=watchlistPage({saved:['gdp','unrate'],selected:['gdp'],storageAvailable:false}),lead=visible(html);
 for(const text of ['id="watchlist-sort"','id="watchlist-group"','session only','data-add-compare="unrate"'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(html,'watchlist:gdp:source'),/Source/);
 assert.match(disclosureContent(html,'watchlist:gdp:edit'),/data-watch-move="gdp"[\s\S]*data-save="gdp"/);
 assert.doesNotMatch(lead,/data-watch-move="gdp"|data-save="gdp"/,'Editing controls stay behind the explicit edit disclosure');
 assert.match(visible(watchlistPage({saved:[]})),/FIND SERIES/);
});

test('frozen result and original exports lead advanced evidence; import follows the working list',async()=>{
 const pkg=await createResearchPackage({name:'Hierarchy fixture',state:{selected:['gdp'],range:1},context:{attachments:[{name:'Original analysis.csv',type:'text/csv',content:'value\n2'}]}});
 const html=researchPage({researchView:'packages',packageId:pkg.id},{library:{packages:[pkg]}}),lead=visible(html);
 for(const text of ['READ-ONLY','data-chart','data-package-csv','data-package-json','data-package-attachment="0"','does not authenticate','Imported source claims remain unverified'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(html,`research:package:${pkg.id}:checksum`),/SHA-256/);
 assert.match(disclosureContent(html,`research:package:${pkg.id}:series:gdp`),/Source IDs/);
 assert.match(disclosureContent(html,`research:package:${pkg.id}:evidence`),/research-json/);
 ordered(html,['FROZEN RESULT LIBRARY','READ-ONLY','data-page-disclosure="research:import"']);
});

test('publication controls, selected estimate and confirmation limits remain open before fuller methods',()=>{
 const html=researchPage({researchView:'publications',publicationSeries:'gdp',publicationPeriod:'2026-01-01',publicationCutoff:'2026-06-25'},{publicationArchive}),lead=visible(html);
 for(const text of ['id="publication-series"','id="publication-period"','id="publication-cutoff"','2.1%','data-export-publications','data-pin-publication','Final does not mean permanently unrevisable','confirmations'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(html,'research:publications:gdp:methods'),/retrieval hashes/);
});


test('capture measurement changes remain explicit beside both value tables after supporting metadata closes',()=>{
 const first=captured(stamp,2000),next=captured('2026-10-21T12:00:00.456Z',2);
 first.series.gdp.unit='USD millions';next.series.gdp.unit='USD billions';
 const changed=recordVintages(null,{bea:first},{bea:next},{checkedAt:'2026-10-21T13:00:00.000Z'}),lead=visible(vintagesPage({vintageSeries:'gdp'},changed));
 assert.match(lead,/USD millions/);assert.match(lead,/USD billions/);
 assert.ok((lead.match(/Not directly comparable/g)??[]).length>=2);
});

test('release loading and failure retain the calendar recovery route beside the essential schedule clocks',()=>{
 for(const status of ['loading','error']){
  const html=releasePage({publicationSeries:'gdp',calendarMonth:'2026-03'},{publicationState:{status,error:'Failed publication archive'}}),lead=visible(html);
  assert.match(lead,/RETURN TO CALENDAR/);assert.match(lead,/month=2026-03/);
  assert.match(lead,/Expected schedule/);assert.doesNotMatch(lead,/Verified official result/);
  if(status==='error')assert.match(lead,/data-retry-publications/);
 }
});

test('Research checkpoint failures and immutable-package recovery remain visible in their working view',()=>{
 const changes=visible(researchPage({researchView:'changes'},{changes:{status:'error',error:'Archive failed'},checkpoint:{enabled:true,since:stamp},failures:[{id:'bea',error:'Cached source',fetchedAt:stamp}]}));
 for(const text of ['id="change-since"','data-disable-changes','data-retry-changes','Cached source','Archive failed'])assert.ok(changes.includes(text),text);
 const missing=researchPage({researchView:'packages',packageId:'missing',researchError:'Import rejected'},{library:{sessionOnly:true}}),lead=visible(missing);
 for(const text of ['session-only','Import rejected','Frozen result unavailable','Current observations are never substituted'])assert.ok(lead.includes(text),text);
 assert.match(disclosureContent(missing,'research:import'),/id="research-import"/);
});

test('dated agency summaries and independent explanation recovery remain open beside the numerical result',()=>{
 const row=publicationArchive.releases.find(row=>row.seriesId==='gdp'),state={publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate};
 const explanation={publicationId:row.id,seriesId:row.seriesId,period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,summary:'Scoped agency summary remains primary.',details:['Full dated source explanation.'],sourceUrl:row.releaseEvidenceUrl,sourceTitle:'Dated BEA release',attribution:'Source: BEA',licenseUrl:row.licenseUrl,provenance:[]};
 const html=releasePage(state,{archive:publicationArchive,explanations:{explanations:[explanation]},explanationState:{status:'ready'}});
 assert.match(visible(html),/Scoped agency summary remains primary/);
 assert.match(disclosureContent(html,'release:agency-details'),/Full dated source explanation/);
 const failed=visible(releasePage(state,{archive:publicationArchive,explanationState:{status:'error',error:'Failed explanation'}}));
 assert.match(failed,/Verified official result/);assert.match(failed,/data-retry-publication-explanations/);assert.match(failed,/Failed explanation/);
});


test('frozen external Trends and Decomposition retain their specialist analysis visibly open',async()=>{
 for(const section of ['trends','decomposition']){
  const state=parseRoute(`#/economy?family=external&measure=itaGoodsBalance&window=custom&start=2026-01-01&end=2026-04-01&section=${section}`);
  const args=buildPinContext(state,{sources:currentAccountGdpBreakdownFixture()}),pkg=await createResearchPackage({name:`Frozen ${section}`,...args});
  const html=researchPage({researchView:'packages',packageId:pkg.id},{library:{packages:[pkg]}}),lead=visible(html);
  assert.match(lead,/data-chart-catalog="current-account-gdp-/);
  assert.match(lead,/QUARTERLY VS TRAILING FOUR QUARTERS/);
  assert.match(lead,/COMPONENT CONTRIBUTIONS TO RATIO CHANGES/);
  assert.ok(lead.includes(`data-export-frozen-current-account-gdp-contributions="${pkg.id}"`));
  assert.ok(lead.includes(`data-export-frozen-current-account-gdp-component-effects="${pkg.id}"`));
  assert.doesNotMatch(lead,/research-json/);
  assert.match(disclosureContent(html,`research:package:${pkg.id}:evidence`),/research-json/);
 }
});


test('the package library leads without a selection and discloses its index beside an active frozen result',async()=>{
 const first=await createResearchPackage({name:'First retained result',state:{selected:['gdp'],range:1}});
 const second=await createResearchPackage({name:'Second retained result',state:{selected:['unrate'],range:1}});
 const library={packages:[first,second]};
 const index=researchPage({researchView:'packages'},{library}),indexLead=visible(index);
 assert.match(indexLead,/FROZEN RESULT LIBRARY/);
 for(const pkg of [first,second]){
  for(const attribute of ['data-open-package','data-remove-package','data-package-json'])assert.ok(indexLead.includes(`${attribute}="${pkg.id}"`));
 }
 assert.doesNotMatch(index,/data-page-disclosure="research:package-library"/);
 assert.doesNotMatch(indexLead,/READ-ONLY/);
 const selected=researchPage({researchView:'packages',packageId:second.id},{library}),selectedLead=visible(selected);
 assert.ok(selectedLead.includes('READ-ONLY / Second retained result'));
 assert.match(selectedLead,/data-chart/);
 assert.ok(selectedLead.includes(`data-package-csv="${second.id}"`));
 assert.ok(selectedLead.includes(`data-package-json="${second.id}"`));
 assert.doesNotMatch(selectedLead,/FROZEN RESULT LIBRARY|First retained result|data-open-package|data-remove-package/);
 const disclosed=disclosureContent(selected,'research:package-library');
 assert.match(disclosed,/<summary>[\s\S]*Frozen result library/);
 for(const pkg of [first,second])for(const attribute of ['data-open-package','data-remove-package','data-package-json'])assert.ok(disclosed.includes(`${attribute}="${pkg.id}"`));
 ordered(selected,['data-page-disclosure="research:package-library"','READ-ONLY','data-page-disclosure="research:import"']);
});
