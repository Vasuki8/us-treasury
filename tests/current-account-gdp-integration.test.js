import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountGdpCsv} from '../src/current-account-gdp-view.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {snapshot} from '../src/official-snapshot.js';
import {currentAccountGdpContext} from '../src/current-account-gdp.js';

test('external family exposes calculated GDP ratio and an accessible scoped CSV action',async()=>{
 const html=renderPage({...parseRoute('#/economy?family=external'),saved:[]});
 assert.match(html,/CURRENT ACCOUNT \/ NOMINAL GDP/i);assert.match(html,/data-export-current-account-gdp/);
 assert.doesNotMatch(renderPage({...parseRoute('#/economy?family=prices'),saved:[]}),/data-export-current-account-gdp/);
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/exportCurrentAccountGdp/);assert.match(app,/currentAccountGdpCsv\(dataStatus.sources\)/);
});

test('frozen external result retains only exact current/prior GDP, original inputs and ratio CSV',async()=>{
 const state=parseRoute('#/economy?family=external&window=all'),args=buildPinContext(state);
 const denominator=args.context.currentAccountGdpDenominator;
 assert.deepEqual(Object.keys(denominator.series),['nominalGdp']);
 const ratio=currentAccountGdpContext(snapshot.sources),dates=[ratio.previousDate,ratio.date];
 assert.deepEqual(denominator.series.nominalGdp.observations,snapshot.sources.bea.series.nominalGdp.observations.filter(row=>dates.includes(row.date)));
 assert.equal(denominator.fetchedAt,snapshot.sources.bea.fetchedAt);assert.deepEqual(denominator.provenance,snapshot.sources.bea.provenance);
 assert.equal(args.context.attachments.find(file=>file.name==='current-account-gdp.csv').content,currentAccountGdpCsv(snapshot.sources));
 const pkg=await createResearchPackage({name:'Ratio with exact GDP inputs',...args}),original=exportResearchPackage(pkg),imported=await importResearchPackage(original);
 assert.equal(exportResearchPackage(imported),original);
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[imported],workspaces:[]}});
 assert.match(html,/FROZEN CURRENT ACCOUNT \/ NOMINAL GDP/i);
 assert.ok(html.includes(Number.isFinite(ratio.current.value)?ratio.current.value.toFixed(2)+'%':'Unavailable'));
 assert.doesNotMatch(html,/data-export-current-account-gdp/);
});

test('a later GDP revision changes new context without rewriting an old package or adding a ratio to legacy pins',async()=>{
 const state=parseRoute('#/economy?family=external'),sources=structuredClone(snapshot.sources),args=buildPinContext(state,{sources});
 const originalPkg=await createResearchPackage({name:'Before GDP revision',...args}),text=exportResearchPackage(originalPkg);
 sources.bea.series.nominalGdp.observations.at(-1).value*=1.1;
 const revised=buildPinContext(state,{sources});
 assert.notEqual(revised.context.attachments.find(file=>file.name==='current-account-gdp.csv').content,args.context.attachments.find(file=>file.name==='current-account-gdp.csv').content);
 assert.equal(exportResearchPackage(originalPkg),text);
 const context=structuredClone(args.context);delete context.currentAccountGdpDenominator;
 delete context.currentAccountGdpHistory;
 context.attachments=context.attachments.filter(file=>!['current-account-gdp.csv','current-account-gdp-history.csv'].includes(file.name));
 const legacy=await createResearchPackage({name:'Legacy current-account package',...args,context});
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:legacy.id},{library:{packages:[legacy],workspaces:[]}});
 assert.doesNotMatch(html,/FROZEN CURRENT ACCOUNT \/ NOMINAL GDP/i);
});
