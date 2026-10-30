import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDateWindow} from '../src/date-window.js';
import {transformSeries} from '../src/model.js';
import {coverageSummary} from '../src/research-controls.js';

const source={
  id:'sample',observations:[{date:'2025-01-01',value:2},{date:'2026-01-01',value:3}],
  retainedCoverage:{startDate:'1990-01-01',endDate:'2026-01-01',count:400},
};

test('compact previews retain the full source bounds rather than claiming a shorter archive',()=>{
  const range=resolveDateWindow({preset:'1y'},[source]);
  assert.equal(range.startDate,'2025-01-01');
  assert.equal(range.fullStartDate,'1990-01-01');
  assert.equal(range.fullEndDate,'2026-01-01');
  const panel=transformSeries(source,'level',{preset:'1y'});
  assert.equal(panel.coverage.fullCount,400);
  assert.equal(panel.coverage.count,2);
  assert.equal(panel.coverage.fullStartDate,'1990-01-01');
  const html=coverageSummary(panel);
  assert.ok(html.includes('Retained: 400 observations'));
  assert.ok(html.includes('1 Jan 1990 to 1 Jan 2026'));
  assert.ok(html.includes('1 Jan 2025 to 1 Jan 2026'));
  assert.ok(html.includes('Displayed: 2 observations'));
});

test('ordinary full sources keep their original coverage without preview metadata',()=>{
  const full={id:'sample',observations:source.observations};
  const panel=transformSeries(full,'level',1);
  assert.equal(panel.coverage.fullCount,2);
  assert.equal(panel.coverage.fullStartDate,'2025-01-01');
  assert.equal(panel.coverage.count,1);
});
