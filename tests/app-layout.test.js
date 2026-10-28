import test from 'node:test';
import assert from 'node:assert/strict';
import * as hierarchy from '../src/page-hierarchy.js';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {getSeries} from '../src/model.js';
import {escapeHtml} from '../src/ui.js';

test('reading groups identify native content and escape labels without replacing working actions',()=>{
 assert.equal(typeof hierarchy.readingGroup,'function');
 const html=hierarchy.readingGroup('Latest <readings>','<button data-export-test>CSV</button>','Own dates & units');
 assert.match(html,/aria-label="Latest &lt;readings&gt;"/);
 assert.match(html,/<h2>Latest &lt;readings&gt;<\/h2>/);
 assert.match(html,/<button data-export-test>CSV<\/button>/);
 assert.match(html,/Own dates &amp; units/);
 assert.doesNotMatch(html,/<details/);
});

test('Overview distinguishes calculated readings and preserves native units without repeating routine official labels',()=>{
 const html=overviewPage({saved:[]});
 const fiscal=html.match(/<a class="oh-reading" data-overview-reading="interestRevenueRatio"[\s\S]*?<\/a>/)?.[0];
 assert.ok(fiscal);
 assert.match(fiscal,/class="reading-basis">Calculated measure/);
 const gdp=html.match(/<a class="oh-reading" data-overview-reading="gdp"[\s\S]*?<\/a>/)?.[0];
 assert.ok(gdp);
 assert.doesNotMatch(gdp,/Calculated measure/);
 assert.match(gdp,/reading-unit/);
 assert.match(gdp,/q\/q SAAR/);
 assert.ok(html.indexOf('ECONOMIC CONDITIONS')<html.indexOf('MOMENTUM'));
});

test('Labor headlines retain explicit native units and adjustments beside each measurement',()=>{
 const html=laborPage({saved:[],selected:[]});
 const headlines=html.slice(html.indexOf('class="labor-headlines"'),html.indexOf('class="labor-desk"'));
 for(const id of ['payroll','unrate','participation','wages']){
  const s=getSeries(id);
  assert.ok(headlines.includes(escapeHtml(s.unit)+' · '+escapeHtml(s.adjustment)),id+' basis remains readable');
 }
 assert.equal((headlines.match(/class="labor-reading-basis"/g)||[]).length,4);
 assert.match(html,/data-labor-section="labor-readings"/);
 assert.match(html,/id="labor-readings"/);
});
