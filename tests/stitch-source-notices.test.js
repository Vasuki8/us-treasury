import test from 'node:test';
import assert from 'node:assert/strict';
import {pageSourceScope} from '../src/page-source-scope.js';
import {sourceNotice} from '../src/ui.js';

const input=(attribution,licenseUrl)=>({status:'ok',fetchedAt:'2026-11-01T00:00:00Z',series:{component:{observations:[{date:'2026-09-01',value:1}],attribution,licenseUrl}}});

test('specialist credits include supporting datasets even when their tables do not expose a chart-series attribute',()=>{
 const sources={inflationCleveland:input('Cleveland measures · CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'),inflationBea:input('Source: BEA','https://www.bea.gov/about/policies-and-information')};
 const scope=pageSourceScope({page:'wedge'},'<table></table>',{sources,catalog:{}});
 assert.ok(scope.sources.inflationCleveland.series.component);
 const html=sourceNotice(scope.sources,{scoped:true});
 assert.match(html,/Cleveland measures · CC BY-SA 4.0/);assert.match(html,/https:\/\/creativecommons.org\/licenses\/by-sa\/4.0\//);
 assert.match(html,/Federal Reserve Bank of Cleveland/);assert.match(html,/Bureau of Economic Analysis/);
});

test('FX source footer credits both official jurisdictions',()=>{
 const scope=pageSourceScope({page:'fxBasis'},'',{sources:{fedFx:input('H.10','https://www.federalreserve.gov/disclaimer.htm'),ecbFx:input('ECB fixes','https://www.ecb.europa.eu/services/disclaimer/html/index.en.html'),ecbPolicy:input('ECB policy','https://www.ecb.europa.eu/services/disclaimer/html/index.en.html')},catalog:{}});
 const html=sourceNotice(scope.sources,{scoped:true});
 assert.match(html,/Board of Governors/);assert.match(html,/European Central Bank/);assert.match(html,/ECB fixes/);assert.match(html,/ECB policy/);
});

test('new BLS indicator support retains its agency notice without crediting unrelated sources',()=>{
 const scope=pageSourceScope({page:'indicator',seriesId:'payroll'},'',{sources:{blsDesk:input('BLS desk','https://www.bls.gov/developers/termsOfService.htm'),ecbFx:input('ECB unrelated','https://www.ecb.europa.eu/')},catalog:{}});
 const html=sourceNotice(scope.sources,{scoped:true});
 assert.match(html,/Bureau of Labor Statistics/);assert.match(html,/BLS data terms/);assert.match(html,/BLS desk/);assert.doesNotMatch(html,/ECB unrelated/);
});
