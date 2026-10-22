/** Load the reviewed historical publication table only when its view needs it. */
export function createPublicationLoader({importArchive=()=>import('./publication-archive.js')}={}){
 let pending=null,failed=false;
 return {load({retry=false}={}){
  if(pending&&(!failed||!retry))return pending;
  failed=false;
  try{pending=Promise.resolve(importArchive());}catch(error){pending=Promise.reject(error);}
  pending=pending.then(module=>{
   const archive=module?.publicationArchive;
   if(archive?.version!==1||!Array.isArray(archive.releases)||archive.releases.length>2000)throw new Error('Official publication archive has an unsupported structure.');
   return archive;
  }).catch(error=>{failed=true;throw error;});
  return pending;
 }};
}
