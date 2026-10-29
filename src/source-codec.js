const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Include property order and negative zero: some CSV cells contain original JSON.
function fingerprint(value) {
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).map(key => `${JSON.stringify(key)}:${fingerprint(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function column(values) {
  const dictionary = [], indexes = [], seen = new Map();
  for (const value of values) {
    const key = fingerprint(value);
    if (!seen.has(key)) { seen.set(key, dictionary.length); dictionary.push(value); }
    indexes.push(seen.get(key));
  }
  if (dictionary.length === 1) return { constant:dictionary[0] };
  return dictionary.length < values.length ? { dictionary, indexes } : { values };
}

function expandColumn(encoded, count) {
  if (!object(encoded)) throw new Error('Invalid observation column');
  if (own(encoded, 'constant')) return Array(count).fill(encoded.constant);
  if (Array.isArray(encoded.values) && encoded.values.length === count) return encoded.values;
  if (Array.isArray(encoded.dictionary) && Array.isArray(encoded.indexes) && encoded.indexes.length === count) {
    return encoded.indexes.map(index => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= encoded.dictionary.length) throw new Error('Invalid observation dictionary index');
      return encoded.dictionary[index];
    });
  }
  throw new Error('Invalid observation column length');
}

/** Preserve every own observation field, including absent fields and original key order. */
export function encodeObservations(observations) {
  if (!Array.isArray(observations)) throw new Error('Observations must be an array');
  for (const row of observations) {
    if (!object(row) || !own(row, 'date') || !own(row, 'value')) throw new Error('Observation date and value are required');
  }
  const orders = observations.map(Object.keys), fields = [...new Set(orders.flat())].filter(key => key !== 'date' && key !== 'value');
  const columns = Object.fromEntries(fields.map(key => {
    const positions = [], values = [];
    observations.forEach((row, index) => { if (own(row, key)) { positions.push(index); values.push(row[key]); } });
    return [key, { ...column(values), ...(positions.length === observations.length ? {} : { positions }) }];
  }));
  return {
    version:1, dates:observations.map(row => row.date), values:observations.map(row => row.value),
    columns, order:column(orders),
  };
}

export function decodeObservations(encoded) {
  if (!object(encoded) || encoded.version !== 1 || !Array.isArray(encoded.dates) || !Array.isArray(encoded.values)
    || encoded.dates.length !== encoded.values.length || !object(encoded.columns)) throw new Error('Invalid columnar observations');
  const count = encoded.dates.length, orders = expandColumn(encoded.order, count), columns = new Map();
  for (const [key, value] of Object.entries(encoded.columns)) {
    if (key === 'date' || key === 'value') throw new Error('Duplicate observation column');
    const positions = value.positions;
    if (positions !== undefined && (!Array.isArray(positions) || positions.some((index, i) =>
      !Number.isSafeInteger(index) || index < 0 || index >= count || i > 0 && index <= positions[i - 1]))) {
      throw new Error('Invalid sparse observation positions');
    }
    const values = expandColumn(value, positions?.length ?? count);
    columns.set(key, new Map(values.map((item, i) => [positions?.[i] ?? i, item])));
  }
  return encoded.dates.map((date, index) => {
    const keys = orders[index];
    if (!Array.isArray(keys) || keys.some(key => typeof key !== 'string') || new Set(keys).size !== keys.length
      || !keys.includes('date') || !keys.includes('value')) throw new Error('Invalid observation property order');
    return Object.fromEntries(keys.map(key => {
      if (key === 'date') return [key, date];
      if (key === 'value') return [key, encoded.values[index]];
      const values = columns.get(key);
      if (!values?.has(index)) throw new Error('Observation field is absent from its column');
      return [key, values.get(index)];
    }));
  });
}

function mapSnapshot(snapshot, mapper) {
  return { ...snapshot, sources:Object.fromEntries(Object.entries(snapshot.sources ?? {}).map(([sourceId, source]) => [sourceId, {
    ...source, series:Object.fromEntries(Object.entries(source.series ?? {}).map(([id, item]) => [id, mapper(item)])),
  }])) };
}

export function encodeSnapshot(snapshot) {
  return mapSnapshot(snapshot, item => {
    const { observations = [], ...metadata } = item;
    return { ...metadata, observationColumns:encodeObservations(observations) };
  });
}

export function decodeSnapshot(snapshot) {
  return mapSnapshot(snapshot, item => {
    const { observationColumns, ...metadata } = item;
    return observationColumns ? { ...metadata, observations:decodeObservations(observationColumns) } : item;
  });
}
