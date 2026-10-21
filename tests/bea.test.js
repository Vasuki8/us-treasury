import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try {
  adapter = await import('../scripts/sources/bea.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('bea.mjs')) throw error;
}

function bea() {
  assert.ok(adapter, 'The official BEA source adapter must exist');
  return adapter;
}

const header = '%SeriesCode,Period,Value\r\n';

test('BEA GDP parser preserves published annualized quarterly growth and sorts period starts', () => {
  const text = '\uFEFF' + header
    + 'A191RL,2026Q2,"2.2"\r\n'
    + 'A191RL,2026Q1,"2.5"\r\n'
    + 'A191RL,2025,"2.1"\r\n'
    + 'DPCERG,2026Q2,"131.006"\r\n';
  assert.deepEqual(bea().parseBea(text, 'A191RL', 'quarterly'), [
    { date: '2026-01-01', value: 2.5, publishedAt: null, sourceValue: '2.5' },
    { date: '2026-04-01', value: 2.2, publishedAt: null, sourceValue: '2.2' },
  ]);
});

test('BEA parser selects the exact PCE index series and preserves zero, missing data and quoted commas', () => {
  const text = header + 'DPCERGM,2026M08,"0.3"\n'
    + 'DPCERG,2026M08,"1,131.579"\n'
    + 'DPCERG,2026M07,"0"\n'
    + 'DPCERG,2026M06,"(NA)"\n'
    + 'DPCERG,2026Q2,"131.006"\n';
  assert.deepEqual(bea().parseBea(text, 'DPCERG', 'M'), [
    { date: '2026-06-01', value: null, publishedAt: null, sourceValue: '(NA)' },
    { date: '2026-07-01', value: 0, publishedAt: null, sourceValue: '0' },
    { date: '2026-08-01', value: 1131.579, publishedAt: null, sourceValue: '1,131.579' },
  ]);
});

test('BEA parser rejects HTML200, unknown headers and a missing target series', () => {
  const { parseBea } = bea();
  for (const text of ['<html>File not found</html>', 'Series,Date,Rate\nA191RL,2026Q2,2.2', header + 'DPCERG,2026M08,131.579']) {
    assert.throws(() => parseBea(text, 'A191RL', 'Q'), /BEA|header|missing|series/i);
  }
});

test('BEA parser rejects duplicate periods, invalid periods and malformed numbers', () => {
  const { parseBea } = bea();
  for (const text of [
    header + 'A191RL,2026Q2,2.2\nA191RL,2026Q2,2.2',
    header + 'A191RL,2026Q5,2.2',
    header + 'A191RL,2026Q2,2.2garbage',
    header + 'A191RL,2026Q2,"1,2.2"',
  ]) {
    assert.throws(() => parseBea(text, 'A191RL', 'Q'), /duplicate|period|numeric|invalid/i);
  }
  assert.throws(() => parseBea(header + 'DPCERG,2026M13,1', 'DPCERG', 'M'), /period|invalid/i);
});

function fixtureFetch({ quarterly = header + 'A191RL,2026Q2,"2.2"\nA191RL,2027Q1,"9.9"', monthly } = {}) {
  return async url => {
    if (url === 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt') {
      return new Response(quarterly, { headers: { 'content-type': 'text/plain', 'last-modified': 'Wed, 30 Sep 2026 12:30:00 GMT' } });
    }
    if (url === 'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt') {
      return new Response(monthly, { headers: { 'content-type': 'text/plain' } });
    }
    throw new Error(`Unexpected official BEA URL ${url}`);
  };
}

test('BEA collector calculates exact year-ago PCE inflation and retains both source indexes', async () => {
  const monthly = header + 'DPCERG,2025M08,"127.229"\nDPCERG,2026M08,"131.579"';
  const result = await bea().collectBea({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  const last = result.series.pce.observations.at(-1);
  assert.ok(Math.abs(last.value - 3.419031824505425) < 1e-10);
  assert.equal(last.sourceValue, '131.579');
  assert.equal(last.yearAgoSourceValue, '127.229');
  assert.equal(last.publishedAt, null);
  assert.equal(result.series.pce.observations[0].value, null);
  assert.equal(result.series.gdp.observations.at(-1).value, 2.2);
  assert.equal(result.id, 'bea');
  assert.equal(result.fetchedAt, result.provenance.map(source=>source.retrievedAt).sort().at(-1));
  assert.equal(result.series.pce.dataStatus, 'official');
  assert.deepEqual(result.series.gdp.sourceIds, ['A191RL']);
  assert.deepEqual(result.series.pce.sourceIds, ['DPCERG']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.provenance.length, 2);
  assert.ok(result.provenance.every(row => !('text' in row) && /^[a-f\d]{64}$/.test(row.sha256)));
});

test('PCE annual inflation stays missing when the exact calendar comparison is unavailable or zero', async () => {
  const monthly = header + 'DPCERG,2025M07,"127"\nDPCERG,2025M09,"0"\n'
    + 'DPCERG,2025M10,"(NA)"\nDPCERG,2026M08,"131.579"\n'
    + 'DPCERG,2026M09,"132"\nDPCERG,2026M10,"133"';
  const result = await bea().collectBea({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  assert.deepEqual(result.series.pce.observations.slice(-3).map(row => row.value), [null, null, null]);
  assert.deepEqual(result.series.pce.observations.slice(-3).map(row => row.date), ['2026-08-01', '2026-09-01', '2026-10-01']);
});

test('collector filters future periods and truncates only after calculating annual inflation', async () => {
  const monthly = header + Array.from({ length: 60 }, (_, index) => {
    const year = 2022 + Math.floor(index / 12);
    const month = String(index % 12 + 1).padStart(2, '0');
    return `DPCERG,${year}M${month},"${100 + index}"`;
  }).join('\n');
  const result = await bea().collectBea({ now: new Date('2026-08-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  assert.equal(result.series.pce.observations.length, 36);
  assert.equal(result.series.pce.observations[0].date, '2023-09-01');
  assert.ok(Math.abs(result.series.pce.observations[0].value - 11.111111111111116) < 1e-10);
  assert.equal(result.series.pce.observations.at(-1).date, '2026-08-01');
  assert.equal(result.series.pce.observations.at(-1).sourceValue, '155');
  assert.equal(result.series.pce.observations.at(-1).yearAgoSourceValue, '143');
  assert.deepEqual(result.series.gdp.observations.map(row => row.date), ['2026-04-01']);
});

test('BEA collector propagates upstream failure rather than supplying sample values', async () => {
  await assert.rejects(bea().collectBea({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /503|HTTP|request/i);
});
