import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {snapshot} from '../src/official-snapshot.js';

test('the complete canonical snapshot is gzip JSON and the Node adapter contains no large data payload',async()=>{
  const bytes=await readFile(new URL('../src/official-snapshot.json.gz',import.meta.url)).catch(error=>{
    assert.fail(`The canonical gzip snapshot must exist: ${error.code}`);
  });
  const decoded=JSON.parse(gunzipSync(bytes));
  assert.deepEqual(decoded,snapshot);
  assert.equal(JSON.stringify(decoded),JSON.stringify(snapshot));
  assert.ok(bytes.length<=20*1024**2,'The tracked snapshot must fit the repository file budget');
  const reader=await readFile(new URL('../src/official-snapshot.js',import.meta.url));
  assert.ok(reader.length<2048,'The JS entry is a small Node reader, not a second copy of the data');
});
