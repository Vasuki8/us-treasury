import {open,readFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {publicationArchive} from '../src/publication-archive.js';
import {assertPublicationData} from './publication-policy.mjs';
import {collectPublications} from './sources/publications.mjs';

const archiveTarget=fileURLToPath(new URL('../src/publication-archive.js',import.meta.url));
const header='// Immutable selected official publication facts; distinct from local capture history.\n';
const archiveSource=archive=>header+'export const publicationArchive = '+JSON.stringify(archive,null,2)+';\n';

function parseArchiveModule(text){
 if(Buffer.byteLength(text)>256*1024)throw new Error('Publication archive module exceeds its byte limit.');
 const match=/^(?:\/\/ Immutable selected official publication facts; distinct from local capture history\.\r?\n)?export const publicationArchive = ([^]*);\s*$/.exec(text.replace(/^\ufeff/,''));
 if(!match)throw new Error('Invalid publication archive module; expected a data-only JSON export.');
 let archive;try{archive=JSON.parse(match[1]);}catch{throw new Error('Invalid publication archive module JSON.');}
 assertPublicationData(archive);return archive;
}

/** This deliberately selected historical sample is immutable after first capture. */
export async function capturePublicationArchive({previous=publicationArchive,collect=collectPublications}={}){
 assertPublicationData(previous);
 if(previous.releases.length)return previous;
 const result=await collect();assertPublicationData(result);
 if(result.releases.length!==3)throw new Error('A complete official publication sample is required.');
 return result;
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
  temporaryHandle=await open(temporary,'wx');ownsTemporary=true;
  await temporaryHandle.writeFile(archiveSource(archive),'utf8');await temporaryHandle.close();temporaryHandle=null;
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
 if(!captured)console.log('Publication archive already captured; original facts and retrieval provenance retained without refetching.');
 else console.log(`Captured ${archive.releases.length} official GDP publication estimates with original source cells, dates and provenance.`);
}
