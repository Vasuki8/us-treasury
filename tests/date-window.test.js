import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';

const observations = (dates) => dates.map((date, index) => ({ date, value: index === 1 ? null : index + 1 }));
const sample = (dates) => ({ observations: observations(dates) });

test('calendar presets share the latest retained UTC date across selected source calendars', () => {
  assert.equal(typeof model.resolveDateWindow, 'function');
  const sources = [sample(['2023-10-20', '2025-10-20', '2026-10-20']), sample(['2023-01-01', '2026-07-01'])];
  for (const [preset, startDate] of [['1y', '2025-10-20'], ['3y', '2023-10-20'], ['5y', '2021-10-20']]) {
    const resolved = model.resolveDateWindow({ preset }, sources);
    assert.equal(resolved.error, null);
    assert.equal(resolved.startDate, startDate);
    assert.equal(resolved.endDate, '2026-10-20');
    assert.equal(resolved.fullStartDate, '2023-01-01');
    assert.equal(resolved.fullEndDate, '2026-10-20');
    assert.equal(resolved.label, preset.toUpperCase());
    assert.equal(resolved.mode, 'calendar');
  }
});

test('calendar years clamp leap-day anniversaries to a real UTC date', () => {
  assert.equal(typeof model.resolveDateWindow, 'function');
  const resolved = model.resolveDateWindow({ preset: '1y' }, [sample(['2024-02-29'])]);
  assert.equal(resolved.startDate, '2023-02-28');
  assert.equal(resolved.endDate, '2024-02-29');
});

test('exact custom dates are inclusive, retain missing observations, and do not fill gaps', () => {
  assert.equal(typeof model.windowObservations, 'function');
  const input = observations(['2024-02-28', '2024-02-29', '2024-03-02', '2024-03-03']);
  const resolved = model.resolveDateWindow({ preset: 'custom', startDate: '2024-02-29', endDate: '2024-03-02' }, [{ observations: input }]);
  assert.equal(resolved.error, null);
  assert.deepEqual(model.windowObservations(input, resolved), input.slice(1, 3));
  assert.match(resolved.label, /2024-02-29.*2024-03-02/);
});

test('custom windows reject impossible, incomplete, non-ISO, and reversed dates explicitly', () => {
  assert.equal(typeof model.resolveDateWindow, 'function');
  const sources = [sample(['2026-01-01'])];
  for (const [startDate, endDate] of [
    ['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'],
    ['', '2026-01-01'], ['2026-01-01', ''],
    ['2026-1-01', '2026-02-01'], ['2026-01-01T00:00:00Z', '2026-02-01'],
    ['2026-03-01', '2026-02-01'],
  ]) {
    const resolved = model.resolveDateWindow({ preset: 'custom', startDate, endDate }, sources);
    assert.match(resolved.error, /date|start|end/i, `${startDate} / ${endDate}`);
    assert.deepEqual(model.windowObservations(sources[0].observations, resolved), []);
  }
  assert.match(model.resolveDateWindow({ preset: 'unknown' }, sources).error, /unknown/i);
});

test('All covers every retained observation and legacy counts remain explicit OBS windows', () => {
  assert.equal(typeof model.resolveDateWindow, 'function');
  const input = observations(['2024-02-28', '2024-02-29', '2024-03-02']);
  const all = model.resolveDateWindow({ preset: 'all' }, [{ observations: input }]);
  assert.equal(all.startDate, '2024-02-28');
  assert.equal(all.endDate, '2024-03-02');
  assert.equal(all.label, 'All');
  assert.deepEqual(model.windowObservations(input, all), input);
  const legacy = model.resolveDateWindow(2, [{ observations: input }]);
  assert.equal(legacy.mode, 'observations');
  assert.equal(legacy.label, '2 OBS');
  assert.deepEqual(model.windowObservations(input, legacy), input.slice(-2));
  assert.deepEqual(model.windowObservations(input, model.resolveDateWindow(0, [])), []);
});

test('window resolution neither substitutes the current date nor clamps exact requested bounds', () => {
  assert.equal(typeof model.resolveDateWindow, 'function');
  const source = sample(['2020-01-01', '2020-12-31']);
  assert.equal(model.resolveDateWindow({ preset: '1y' }, [source]).endDate, '2020-12-31');
  const outside = model.resolveDateWindow({ preset: 'custom', startDate: '2010-01-01', endDate: '2011-01-01' }, [source]);
  assert.equal(outside.error, null);
  assert.equal(outside.startDate, '2010-01-01');
  assert.deepEqual(model.windowObservations(source.observations, outside), []);
});
