import {open,readFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {publicationArchive} from '../src/publication-archive.js';
import {assertPublicationData,publicationScope,publicationId} from './publication-policy.mjs';
import {collectPublications} from './sources/publications.mjs';

const archiveTarget=fileURLToPath(new URL('../src/publication-archive.js',import.meta.url));
const header='// Immutable selected official publication facts; distinct from local capture history.\n';
const archiveSource=archive=>header+'export const publicationArchive = '+JSON.stringify(archive,null,2)+';\n';
const archiveByteLimit=4*1024*1024;

function parseArchiveModule(text){
 if(Buffer.byteLength(text)>archiveByteLimit)throw new Error('Publication archive module exceeds its byte limit.');
 const match=/^(?:\/\/ Immutable selected official publication facts; distinct from local capture history\.\r?\n)?export const publicationArchive = ([^]*);\s*$/.exec(text.replace(/^\ufeff/,''));
 if(!match)throw new Error('Invalid publication archive module; expected a data-only JSON export.');
 let archive;try{archive=JSON.parse(match[1]);}catch{throw new Error('Invalid publication archive module JSON.');}
 assertPublicationData(archive);return archive;
}

/** Append reviewed missing facts without replacing retained values or provenance. */
export async function capturePublicationArchive({previous=publicationArchive,collect=collectPublications}={}){
 assertPublicationData(previous,{complete:false});
 const retained=new Set(previous.releases.map(release=>release.id));
 const missing=publicationScope.map(publicationId).filter(id=>!retained.has(id));
 if(!missing.length)return previous;
 const batch=await collect({ids:missing});
 assertPublicationData(batch,{ids:missing});
 const byId=new Map(batch.releases.map(release=>[release.id,release]));
 const archive={version:previous.version,releases:[...previous.releases,...missing.map(id=>byId.get(id))]};
 assertPublicationData(archive,{complete:true});
 return archive;
}

/** All cooperating writers lock before reading; module imports can be stale. */
export async function capturePublicationFile({target=archiveTarget,collect=collectPublications}={}){
 const destination=path.resolve(target),lockPath=destination+'.lock',temporary=destination+'.'+globalThis.crypto.randomUUID()+'.tmp';
 let lock;
 try{lock=await open(lockPath,'wx');}catch(error){
  if(error.code==='EEXIST')throw new Error('A publication capture lock already exists; another capture may be in progress.');
  throw error;
 }
 let temporaryHandle,ownsTemporary=false;
 try{
  const previous=parseArchiveModule(await readFile(destination,'utf8'));
  const archive=await capturePublicationArchive({previous,collect});
  if(archive===previous)return {archive,captured:false};
  const contents=archiveSource(archive);
  if(Buffer.byteLength(contents)>archiveByteLimit)throw new Error('Publication archive module exceeds its byte limit.');
  temporaryHandle=await open(temporary,'wx');ownsTemporary=true;
  await temporaryHandle.writeFile(contents,'utf8');await temporaryHandle.close();temporaryHandle=null;
  await rename(temporary,destination);ownsTemporary=false;
  return {archive,captured:true};
 }finally{
  try{
   if(temporaryHandle)await temporaryHandle.close();
   // Only exact files created by this invocation are eligible for cleanup.
   if(ownsTemporary)await unlink(temporary);
  }finally{try{await lock.close();}finally{await unlink(lockPath);}}
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {archive,captured}=await capturePublicationFile();
 if(!captured)console.log('All approved publication facts already retained; original values and retrieval provenance preserved without refetching.');
 else console.log(`Retained ${archive.releases.length} official GDP publication facts, appending missing IDs while preserving earlier captures.`);
}
