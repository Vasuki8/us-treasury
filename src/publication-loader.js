/** Load the reviewed historical publication table only when its view needs it. */
let retryNumber=0;
const nativeArchive=({retry})=>retry?import(new URL('./publication-archive.js',import.meta.url).href+`?retry=${Date.now()}-${++retryNumber}`):import('./publication-archive.js');
export function createPublicationLoader({importArchive=nativeArchive,exportName='publicationArchive',maxRecords=2000}={}){
 let pending=null,failed=false;
 return {load({retry=false}={}){
  if(pending&&(!failed||!retry))return pending;
  failed=false;
  try{pending=Promise.resolve(importArchive({retry}));}catch(error){pending=Promise.reject(error);}
  pending=pending.then(module=>{
   const archive=module?.[exportName];
   if(archive?.version!==1||!Array.isArray(archive.releases)||archive.releases.length>maxRecords)throw new Error('Official publication archive has an unsupported structure.');
   return archive;
  }).catch(error=>{failed=true;throw error;});
  return pending;
 }};
}
