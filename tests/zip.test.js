import test from 'node:test';
import assert from 'node:assert/strict';
import { zipFixture } from './helpers/zip.mjs';
import { extractZipEntry as extract } from '../scripts/sources/zip.mjs';

test('ZIP extracts exactly the requested stored or deflated entry in memory', () => {
  for(const method of [0,8]) {
    const archive=zipFixture([{name:'/README',text:'ignore'},{name:'MARTS-mf.csv',text:'official,retail\r\n1,2',method}]);
    assert.equal(extract(archive,'MARTS-mf.csv').toString(),'official,retail\r\n1,2');
    assert.throws(()=>extract(archive,'absent'),/missing|not found/i);
  }
});

test('ZIP rejects duplicate targets, encrypted files, unsupported compression and truncated archives', () => {
  assert.throws(()=>extract(zipFixture([{name:'data',text:'one'},{name:'data',text:'two'}]),'data'),/duplicate/i);
  assert.throws(()=>extract(zipFixture([{name:'data',text:'one',flags:1}]),'data'),/encrypt/i);
  assert.throws(()=>extract(zipFixture([{name:'data',text:'one',flags:64}]),'data'),/encrypt/i);
  assert.throws(()=>extract(zipFixture([{name:'data',text:'one',method:99}]),'data'),/compression|method/i);
  const archive=zipFixture([{name:'data',text:'one'}]);
  for(const input of [Buffer.from('<html>blocked</html>'),archive.subarray(0,-2)])assert.throws(()=>extract(input,'data'),/ZIP|archive|truncat/i);
});

test('ZIP validates CRC, directory and local header bounds, and local filename', () => {
  const archive=zipFixture([{name:'data',text:'official',method:0}]);
  const badCrc=Buffer.from(archive);badCrc[34]^=1;
  assert.throws(()=>extract(badCrc,'data'),/CRC|checksum/i);
  const badOffset=Buffer.from(archive);badOffset.writeUInt32LE(0xfffffff0,badOffset.length-6);
  assert.throws(()=>extract(badOffset,'data'),/ZIP|bounds|directory/i);
  const badLocal=Buffer.from(archive);badLocal[30]=0x78;
  assert.throws(()=>extract(badLocal,'data'),/local|name|header/i);
});

test('ZIP limits both declared and inflated output size', () => {
  const archive=zipFixture([{name:'data',text:'a'.repeat(1024)}]);
  assert.throws(()=>extract(archive,'data',{maxOutputBytes:16}),/limit|exceeds/i);
  const lying=Buffer.from(archive),directory=lying.readUInt32LE(lying.length-6);
  lying.writeUInt32LE(1,22);lying.writeUInt32LE(1,directory+24);
  assert.throws(()=>extract(lying,'data',{maxOutputBytes:16}),/limit|length|size|buffer/i);
});
