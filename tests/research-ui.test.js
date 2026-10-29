import test from 'node:test';import assert from 'node:assert/strict';
import {renderPage} from '../src/pages.js';import {series} from '../src/data.js';
import {parseRoute,routeFor} from '../src/router.js';
import {toCsv} from '../src/model.js';import {parseCsv} from '../scripts/sources/http.mjs';

test('growth and changes calculated from official levels are labeled calculated in details and CSV',()=>{
 for(const id of ['payroll','cpi','pce','wages','retail']){
  assert.equal(series[id].observationType,'calculated',id);
  assert.match(renderPage(parseRoute(`#/series/${id}`)),/Calculated metric/,id);
  const [headers,row]=parseCsv(toCsv([id],{range:1}));
  assert.equal(row[headers.indexOf('observation_type')],'calculated',id);
 }
 assert.match(renderPage(parseRoute('#/series/gdp')),/Official observation/,'published GDP growth stays official');
});

test('indicator exposes all retained SOFR history and exact dates shared by chart and table',()=>{
 const state=parseRoute('#/series/sofr?window=all'),html=renderPage(state),count=series.sofr.observations.length;
 assert.match(html,/data-window="all"[^>]*aria-pressed="true"/);assert.match(html,/id="window-start"[^>]*type="date"/);assert.match(html,/id="window-end"[^>]*type="date"/);
 assert.ok(html.includes(`Retained: ${count} observations`));assert.ok(html.includes(series.sofr.observations[0].date));
 assert.equal((html.match(/<time datetime=/g)??[]).length,count);assert.match(html,/data-range="\{&quot;preset&quot;:&quot;all&quot;/);
 const custom=renderPage(parseRoute('#/series/sofr?window=custom&start=2026-09-01&end=2026-09-30'));
 assert.ok(!custom.includes('<time datetime="2026-08-31"'));assert.ok(custom.includes('2026-09-01'));assert.match(custom,/Displayed: \d+ observations/);
});

test('catalog related context and return links preserve search settings',()=>{
 const origin=routeFor({...parseRoute('#/explore'),query:'Treasury',window:'all'});
 const detail=renderPage(parseRoute('#/series/publicDebt?return='+encodeURIComponent(origin)));
 assert.match(detail,/BACK TO RESULTS/);assert.match(detail,/Treasury|Fiscal/);assert.doesNotMatch(detail,/href="#\/series\/payroll"/);
 const comparison=renderPage({...parseRoute('#/explore'),exploreMode:'compare',window:'all',selected:['sofr','effr']});
 assert.match(comparison,/href="#\/series\/sofr\?[^\"]*window=all[^\"]*return=/,'comparison builder keeps its date and return context');
});

test('negative GDP contributions cannot be ratio indexed but baseline differences stay available',()=>{
 const state={...parseRoute('#/explore'),selected:['gdpImportsContribution','gdpExportsContribution'],exploreMode:'compare',comparison:'indexed',window:'all'};
 const html=renderPage(state);assert.match(html,/Indexed comparison is unsupported/);assert.match(html,/cannot be ratio-indexed/);assert.match(html,/class="comparison-error" role="alert"/);assert.match(html,/data-export[^>]*disabled/);assert.match(html,/native|baseline/i);assert.match(html,/value="difference"/);assert.match(html,/data-comparison-mode="difference"/);
 const differences=renderPage({...state,comparison:'difference'});assert.doesNotMatch(differences,/class="comparison-error"/);assert.match(differences,/Change from baseline/);assert.match(differences,/data-panel-id=/);
});

test('invalid custom bounds block charts and visibly disable export instead of silently widening',()=>{
 const html=renderPage(parseRoute('#/series/sofr?window=custom&start=2026-10-01&end=2026-09-01'));
 assert.match(html,/role="alert"/);assert.match(html,/data-export[^>]*disabled/);assert.doesNotMatch(html,/<time datetime=/);
});
