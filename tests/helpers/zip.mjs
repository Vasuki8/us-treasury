import { crc32, deflateRawSync } from 'node:zlib';

/** Small ZIP fixture writer; no production parser is used to create fixtures. */
export function zipFixture(entries) {
  let offset=0;
  const local=[],central=[];
  for(const {name,text='',bytes=Buffer.from(text),method=8,flags=0} of entries) {
    const filename=Buffer.from(name),compressed=method===8?deflateRawSync(bytes):bytes;
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(flags,6);header.writeUInt16LE(method,8);
    header.writeUInt32LE(crc32(bytes),14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(flags,8);directory.writeUInt16LE(method,10);
    directory.writeUInt32LE(crc32(bytes),16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,filename,compressed);central.push(directory,filename);offset+=header.length+filename.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
