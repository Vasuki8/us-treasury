import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountGdpHistoryCsv} from '../src/current-account-gdp-view.js';
import {currentAccountGdpHistoryChartCatalog} from '../src/current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownChartCatalog} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingChartCatalog} from '../src/current-account-gdp-trailing-view.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {MAX_RESEARCH_JSON_BYTES} from '../src/research-workspaces.js';

test('external history reuses one date-control set and binds a scoped calculated chart and CSV action',async()=>{
 const html=renderPage({...parseRoute('#/economy?family=external&window=all'),saved:[]});
 assert.match(html,/HISTORICAL CURRENT ACCOUNT \/ GDP/);assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.match(html,/data-chart-catalog="current-account-gdp-history"/);assert.match(html,/data-export-current-account-gdp-history/);
 assert.doesNotMatch(renderPage({...parseRoute('#/economy?family=prices'),saved:[]}),/data-chart-catalog="current-account-gdp-history"/);
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/exportCurrentAccountGdpHistory/);assert.match(app,/currentAccountGdpHistoryCsv\(dataStatus.sources,viewRange\(state\)\)/);
});

test('history pins retain only the two relevant full input histories, selected window and exact CSV',async()=>{
 const state=parseRoute('#/economy?family=external&window=all'),args=buildPinContext(state),history=args.context.currentAccountGdpHistory;
 assert.equal(history.version,1);assert.equal(history.range.preset,'all');assert.deepEqual(Object.keys(history.sources).sort(),['bea','beaIta']);
 assert.deepEqual(Object.keys(history.sources.bea.series),['nominalGdp']);assert.deepEqual(Object.keys(history.sources.beaIta.series),['currentAccountBalance']);
 assert.equal(history.sources.beaIta.series.currentAccountBalance.observations.length,snapshot.sources.beaIta.series.currentAccountBalance.observations.length);
 assert.equal(history.sources.bea.series.nominalGdp.observations.length,snapshot.sources.bea.series.nominalGdp.observations.length);
 assert.equal(args.context.attachments.find(file=>file.name==='current-account-gdp-history.csv').content,currentAccountGdpHistoryCsv(snapshot.sources,history.range));
 const pkg=await createResearchPackage({name:'Historical ratio acceptance',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.ok(Buffer.byteLength(text)<MAX_RESEARCH_JSON_BYTES);
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[restored],workspaces:[]}});
 assert.match(html,/FROZEN HISTORICAL CURRENT ACCOUNT \/ GDP/);assert.doesNotMatch(html,/data-export-current-account-gdp-history/);
 const frozen=currentAccountGdpHistoryChartCatalog(history.sources,{frozen:true});
 assert.equal(frozen['current-account-gdp-history'].catalog.currentAccountToGdp.observations.length,history.sources.beaIta.series.currentAccountBalance.observations.length);
 assert.match(frozen['current-account-gdp-history'].evidenceLabel,/Frozen calculated/);
});

test('live and frozen app chart bindings never borrow current ratio data for a legacy package',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts()'),end=source.indexOf('function researchActions()',start);
 assert.ok(start>=0&&end>start);
 const calls=[],state=parseRoute('#/economy?family=external'),main={};let pkg=null;
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog);
 run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-history'].catalog.currentAccountToGdp.observations.length,snapshot.sources.beaIta.series.currentAccountBalance.observations.length);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();
 assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-history'].evidenceLabel,/Frozen/);
});
