import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeObservations, decodeObservations, encodeSnapshot, decodeSnapshot } from '../src/source-codec.js';

test('columnar observations retain sparse fields, nulls, negative zero, URL variants and property order', () => {
  const rows = [
    { date:'2025-01-01', value:-0, publishedAt:null, sourceUrl:'https://example.test/2025', sourceUrls:['https://example.test/2025'] },
    { date:'2025-01-02', value:null, sourceUrl:'https://example.test/2025', publishedAt:null, inputValues:{ previous:-0 } },
    { date:'2026-01-01', value:2, publishedAt:null, sourceUrl:'https://example.test/2026', footnotes:[] },
    { date:'2026-01-02', value:3, publishedAt:null, sourceUrl:'https://example.test/2026', footnotes:null },
  ];
  const encoded = encodeObservations(rows), restored = decodeObservations(encoded);
  assert.deepEqual(restored, rows);
  assert.equal(JSON.stringify(restored), JSON.stringify(rows));
  assert.deepEqual(encoded.dates, rows.map(row => row.date));
  assert.deepEqual(encoded.values, rows.map(row => row.value));
  assert.deepEqual(encoded.columns.sourceUrl.dictionary, ['https://example.test/2025', 'https://example.test/2026']);
  assert.deepEqual(encoded.columns.publishedAt, { constant:null });
  assert.equal(Object.hasOwn(restored[0], 'footnotes'), false);
  assert.equal(restored[3].footnotes, null);
  assert.ok(Object.is(restored[0].value, -0));
  assert.ok(Object.is(restored[1].inputValues.previous, -0));
});

test('empty observation arrays and every source/series metadata field round-trip', () => {
  const source = { id:'alpha', provenance:[{ url:'https://example.test', sha256:'a'.repeat(64) }], series:{ x:{ unit:'Original', observations:[] } } };
  const snapshot = { sources:{ alpha:source }, calendar:{ status:'ok' }, generatedAt:'2026-10-29T00:00:00Z' };
  assert.deepEqual(decodeSnapshot(encodeSnapshot(snapshot)), snapshot);
  assert.deepEqual(decodeObservations(encodeObservations([])), []);
});

test('decoder rejects malformed dictionary indexes, sparse positions and row property orders', () => {
  const rows = [{ date:'2026-01-01', value:1, optional:null }, { date:'2026-01-02', value:2 }];
  const encoded = encodeObservations(rows);
  for (const mutate of [
    value => { value.values.pop(); },
    value => { value.order = { dictionary:[['date', 'value']], indexes:[0, 2] }; },
    value => { value.columns.optional.positions = [1, 0]; },
    value => { value.order = { constant:['date', 'date', 'value'] }; },
    value => { value.order = { constant:['date', 'value', 'absent'] }; },
  ]) {
    const invalid = structuredClone(encoded); mutate(invalid);
    assert.throws(() => decodeObservations(invalid), /Invalid|absent/);
  }
});
