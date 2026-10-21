import { crc32, inflateRawSync } from 'node:zlib';

/** Read one ZIP member in memory. ZIP64, encryption and multipart archives are unsupported. */
export function extractZipEntry(input,name,{maxOutputBytes=8*1024*1024}={}) {
  const bytes=Buffer.from(input);
  const fail=message=>{throw new Error(`Invalid ZIP archive: ${message}`);};
  const bounds=(offset,size,end=bytes.length)=>{
    if(!Number.isSafeInteger(offset)||offset<0||size<0||offset+size>end)fail('truncated entry or bounds');
  };
  let end=-1;
  for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--) {
    if(bytes.readUInt32LE(offset)===0x06054b50 && offset+22+bytes.readUInt16LE(offset+20)===bytes.length){end=offset;break;}
  }
  if(end<0)fail('missing end of central directory');
  const count=bytes.readUInt16LE(end+10),directorySize=bytes.readUInt32LE(end+12),directoryOffset=bytes.readUInt32LE(end+16);
  if(bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0||bytes.readUInt16LE(end+8)!==count)fail('multipart archive');
  if(count===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff||count>100)fail('unsupported directory size');
  bounds(directoryOffset,directorySize,end);
  if(directoryOffset+directorySize!==end)fail('central directory bounds');
  let cursor=directoryOffset,target=null;
  for(let index=0;index<count;index++) {
    bounds(cursor,46,end);
    if(bytes.readUInt32LE(cursor)!==0x02014b50)fail('central directory header');
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressedSize=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24);
    const nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32),localOffset=bytes.readUInt32LE(cursor+42);
    const recordLength=46+nameLength+extraLength+commentLength;bounds(cursor,recordLength,end);
    if(flags&0x41)fail('encrypted entry');
    if(bytes.readUInt16LE(cursor+34)!==0||[compressedSize,size,localOffset].includes(0xffffffff))fail('ZIP64 or multipart entry');
    const filename=bytes.subarray(cursor+46,cursor+46+nameLength);
    if(filename.toString('utf8')===name) {
      if(target)fail('duplicate target entry');
      target={flags,method,compressedSize,size,localOffset,filename,checksum:bytes.readUInt32LE(cursor+16)};
    }
    cursor+=recordLength;
  }
  if(cursor!==end)fail('central directory record count');
  if(!target)fail(`missing entry ${name}`);
  const {flags,method,compressedSize,size,localOffset,filename,checksum}=target;
  if(![0,8].includes(method))fail('unsupported compression method');
  if(size>maxOutputBytes)fail('entry exceeds output byte limit');
  bounds(localOffset,30,directoryOffset);
  if(bytes.readUInt32LE(localOffset)!==0x04034b50||bytes.readUInt16LE(localOffset+6)!==flags||bytes.readUInt16LE(localOffset+8)!==method)fail('local header disagrees with directory');
  const localNameLength=bytes.readUInt16LE(localOffset+26),localExtraLength=bytes.readUInt16LE(localOffset+28);
  const dataOffset=localOffset+30+localNameLength+localExtraLength;
  bounds(localOffset+30,localNameLength+localExtraLength,directoryOffset);
  if(!bytes.subarray(localOffset+30,localOffset+30+localNameLength).equals(filename))fail('local filename disagrees with directory');
  if(!(flags&8)&&(bytes.readUInt32LE(localOffset+14)!==checksum||bytes.readUInt32LE(localOffset+18)!==compressedSize||bytes.readUInt32LE(localOffset+22)!==size))fail('local size or checksum disagrees with directory');
  bounds(dataOffset,compressedSize,directoryOffset);
  const compressed=bytes.subarray(dataOffset,dataOffset+compressedSize);
  let output;
  if(method===0)output=Buffer.from(compressed);
  else {
    const inflated=inflateRawSync(compressed,{maxOutputLength:maxOutputBytes,info:true});
    if(inflated.engine.bytesWritten!==compressedSize)fail('compressed stream length');
    output=inflated.buffer;
  }
  if(output.length!==size||output.length>maxOutputBytes)fail('uncompressed length or output limit');
  if(crc32(output)!==checksum)fail('CRC checksum mismatch');
  return output;
}
