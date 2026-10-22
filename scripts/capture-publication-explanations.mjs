import {open,readFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicationExplanations} from '../src/publication-explanations.js';
import {publicationExplanationScope,assertPublicationExplanations} from './publication-explanation-policy.mjs';
import {collectPublicationExplanations} from './sources/publication-explanations.mjs';

const archiveTarget=fileURLToPath(new URL('../src/publication-explanations.js',import.meta.url));
const header='// Immutable reviewed source explanations; separate from numerical publication facts.\n';
const archiveSource=archive=>header+'export const publicationExplanations = '+JSON.stringify(archive,null,2)+';\n';
const byteLimit=512*1024;
function parseArchiveModule(text){
 if(Buffer.byteLength(text)>byteLimit)throw new Error('Publication explanation module exceeds its byte limit.');
 const match=/^(?:\/\/ Immutable reviewed source explanations; separate from numerical publication facts\.\r?\n)?export const publicationExplanations = ([^]*);\s*$/.exec(text.replace(/^\ufeff/,''));
 if(!match)throw new Error('Invalid publication explanation module; expected a data-only JSON export.');
 let archive;try{archive=JSON.parse(match[1]);}catch{throw new Error('Invalid publication explanation module JSON.');}
 assertPublicationExplanations(archive);return archive;
}
/** Preserve all retained explanations and their actual retrieval provenance. */
export async function capturePublicationExplanationArchive({previous=publicationExplanations,collect=collectPublicationExplanations}={}){
 assertPublicationExplanations(previous);
 const retained=new Set(previous.explanations.map(row=>row.publicationId));
 const missing=publicationExplanationScope.map(row=>row.publicationId).filter(id=>!retained.has(id));
 if(!missing.length)return previous;
 const batch=await collect({ids:missing});assertPublicationExplanations(batch,{ids:missing});
 const byId=new Map(batch.explanations.map(row=>[row.publicationId,row]));
 const archive={version:1,explanations:[...previous.explanations,...missing.map(id=>byId.get(id))]};
 assertPublicationExplanations(archive,{complete:true});return archive;
}
/** Lock before a fresh data-only read; replace atomically only after full admission. */
export async function capturePublicationExplanationFile({target=archiveTarget,collect=collectPublicationExplanations}={}){
 const destination=path.resolve(target),lockPath=destination+'.lock',temporary=destination+'.'+globalThis.crypto.randomUUID()+'.tmp';
 let lock;
 try{lock=await open(lockPath,'wx');}catch(error){
  if(error.code==='EEXIST')throw new Error('A publication explanation capture lock already exists; another capture may be in progress.');
  throw error;
 }
 let temporaryHandle,ownsTemporary=false;
 try{
  const previous=parseArchiveModule(await readFile(destination,'utf8'));
  const archive=await capturePublicationExplanationArchive({previous,collect});
  if(archive===previous)return {archive,captured:false};
  const contents=archiveSource(archive);if(Buffer.byteLength(contents)>byteLimit)throw new Error('Publication explanation module exceeds its byte limit.');
  temporaryHandle=await open(temporary,'wx');ownsTemporary=true;
  await temporaryHandle.writeFile(contents,'utf8');await temporaryHandle.close();temporaryHandle=null;
  await rename(temporary,destination);ownsTemporary=false;
  return {archive,captured:true};
 }finally{
  try{if(temporaryHandle)await temporaryHandle.close();if(ownsTemporary)await unlink(temporary);}
  finally{try{await lock.close();}finally{await unlink(lockPath);}}
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {archive,captured}=await capturePublicationExplanationFile();
 console.log(captured?`Retained ${archive.explanations.length} reviewed BEA GDP explanations without changing numerical publication facts.`:'All reviewed BEA GDP explanations already retained; original evidence and retrieval provenance preserved without refetching.');
}
