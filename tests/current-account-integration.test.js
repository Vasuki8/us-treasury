import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registry} from '../src/registry.js';
import {series,dataStatus} from '../src/data.js';
import {currentAccountRegistry} from '../src/current-account-registry.js';
import {parseRoute,routeFor} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {calendarRelatedIds} from '../src/macro-calendar.js';
import {relevantRefreshIds} from '../src/research-status.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountCsv} from '../src/current-account-view.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

test('Trade & current account is discoverable and all six official balances keep safe classifications',async()=>{
 const state=parseRoute('#/economy?family=external&window=all');
 assert.equal(state.macroFamily,'external');assert.equal(state.macroMeasure,'currentAccountBalance');
 assert.match(routeFor(state),/family=external/);
 for(const id of Object.keys(currentAccountRegistry)){assert.equal(registry[id].comparisonClass,'balance');assert.equal(registry[id].agency,'beaIta');}
 const html=renderPage({...state,saved:[]});
 assert.match(html,/CURRENT ACCOUNT · ACCOUNTING CHANGES/);assert.match(html,/not annualized/);assert.match(html,/NIPA/);
 assert.match(await readFile(new URL('../index.html',import.meta.url),'utf8'),/href="#\/economy\?family=external"/);
 assert.deepEqual(relevantRefreshIds(state,series),['data:beaIta','data:bea']);
});

test('ITA is not silently associated with GDP/PCE release results or substituted for NIPA trade',()=>{
 for(const program of ['gdp','personal-income-outlays'])for(const id of Object.keys(currentAccountRegistry))assert.ok(!calendarRelatedIds({sourceId:'bea',program,seriesIds:[]}).includes(id));
 assert.equal(registry.nominalTradeBalance.agency,'bea');assert.match(registry.nominalTradeBalance.unit,/SAAR/);
 assert.match(registry.currentAccountBalance.unit,/not annualized/);
});

test('frozen external context retains exact current/prior inputs, dataset release and original accounting CSV',async()=>{
 const state={...parseRoute('#/economy?family=external&window=all'),saved:[]},args=buildPinContext(state);
 assert.deepEqual(args.state.selected,['currentAccountBalance']);
 assert.ok(args.context.currentAccountInputs?.series.currentAccountBalance.observations.length===2);
 assert.equal(args.context.currentAccountInputs.tableReleaseDate,dataStatus.sources.beaIta.tableReleaseDate);
 assert.equal(args.context.attachments[0].content,currentAccountCsv(dataStatus.sources.beaIta));
 const pkg=await createResearchPackage({name:'Official current-account accounting',...args}),json=exportResearchPackage(pkg),restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[restored],workspaces:[]}});
 assert.match(html,/FROZEN CURRENT ACCOUNT/);assert.doesNotMatch(html,/data-export-current-account/);
});
