import {open,readFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';
import {cpiPublicationScope,assertCpiPublicationData} from './cpi-publication-policy.mjs';
import {collectCpiPublications} from './sources/cpi-publications.mjs';

const archiveTarget=fileURLToPath(new URL('../src/cpi-publication-archive.js',import.meta.url));
const header='// Immutable selected official CPI publication facts; separate from revised and capture history.\n';
const serialize=archive=>header+'export const cpiPublicationArchive = '+JSON.stringify(archive,null,2)+';\n';
const byteLimit=4*1024*1024;
function parseModule(text){
 if(Buffer.byteLength(text)>byteLimit)throw new Error('CPI publication archive exceeds its byte limit.');
 const match=/^(?:\/\/ Immutable selected official CPI publication facts; separate from revised and capture history\.\r?\n)?export const cpiPublicationArchive = ([^]*);\s*$/.exec(text.replace(/^\ufeff/,''));
 if(!match)throw new Error('CPI publication archive must be a data-only JSON export.');
 let archive;try{archive=JSON.parse(match[1]);}catch{throw new Error('Invalid CPI publication archive JSON.');}
 assertCpiPublicationData(archive);return archive;
}
/** Never replace retained facts or their original retrieval evidence. */
export async function captureCpiPublicationArchive({previous=cpiPublicationArchive,collect=collectCpiPublications}={}){
 assertCpiPublicationData(previous);
 const retained=new Set(previous.releases.map(row=>row.id)),missing=cpiPublicationScope.map(row=>row.id).filter(id=>!retained.has(id));
 if(!missing.length)return previous;
 const batch=await collect({ids:missing});assertCpiPublicationData(batch,{ids:missing});
 const byId=new Map(batch.releases.map(row=>[row.id,row]));
 const archive={version:1,releases:[...previous.releases,...missing.map(id=>byId.get(id))]};assertCpiPublicationData(archive,{complete:true});return archive;
}
/** Lock before a fresh read, then atomically replace only after complete admission. */
export async function captureCpiPublicationFile({target=archiveTarget,collect=collectCpiPublications}={}){
 const destination=path.resolve(target),lockPath=destination+'.lock',temporary=destination+'.'+globalThis.crypto.randomUUID()+'.tmp';
 let lock;
 try{lock=await open(lockPath,'wx');}catch(error){if(error.code==='EEXIST')throw new Error('CPI publication capture lock exists; another capture may be in progress.');throw error;}
 let handle,ownsTemporary=false;
 try{
  const previous=parseModule(await readFile(destination,'utf8')),archive=await captureCpiPublicationArchive({previous,collect});
  if(archive===previous)return {archive,captured:false};
  const text=serialize(archive);if(Buffer.byteLength(text)>byteLimit)throw new Error('CPI publication archive exceeds its byte limit.');
  handle=await open(temporary,'wx');ownsTemporary=true;await handle.writeFile(text,'utf8');await handle.close();handle=null;
  await rename(temporary,destination);ownsTemporary=false;return {archive,captured:true};
 }finally{
  try{if(handle)await handle.close();if(ownsTemporary)await unlink(temporary);}
  finally{try{await lock.close();}finally{await unlink(lockPath);}}
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {archive,captured}=await captureCpiPublicationFile();
 console.log(captured?`Retained ${archive.releases.length} official CPI publication facts; existing facts and provenance preserved.`:'All approved CPI publication facts already retained; no refetch or immutable-history change.');
}
