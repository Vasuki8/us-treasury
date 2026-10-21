import test from 'node:test';
import assert from 'node:assert/strict';
import { chartDateLabel } from '../src/charts.js';
import { getSeries } from '../src/model.js';

test('mixed-frequency chart dates keep the exact date regardless of series order', () => {
  const panels = ['gdp','cpi'].map(id=>({series:getSeries(id)}));
  assert.equal(chartDateLabel(panels,'2026-09-01'),'1 Sep 2026');
  assert.equal(chartDateLabel([...panels].reverse(),'2026-09-01'),'1 Sep 2026');
  assert.equal(chartDateLabel([panels[0]],'2026-04-01'),'Q2 2026');
});

test('weekly chart readouts identify the week-ending date', () => {
  assert.equal(chartDateLabel([{series:getSeries('claims')}], '2026-09-19'), 'Week ending 19 Sep 2026');
});
