/** Separate loading keeps numerical publication history usable if narrative evidence fails. */
export function createPublicationExplanationLoader({importArchive=(attempt=0)=>attempt?import(`./publication-explanations.js?retry=${attempt}`):import('./publication-explanations.js')}={}){
 let pending=null,failed=false,attempt=0;
 return {load({retry=false}={}){
  if(pending&&(!failed||!retry))return pending;
  // A failed native module fetch is cached by the browser for this URL.
  if(failed&&retry)attempt++;
  failed=false;
  try{pending=Promise.resolve(importArchive(attempt));}catch(error){pending=Promise.reject(error);}
  pending=pending.then(module=>{
   const archive=module?.publicationExplanations;
   if(archive?.version!==1||!Array.isArray(archive.explanations)||archive.explanations.length>2000)throw new Error('Official explanation archive has an unsupported structure.');
   return archive;
  }).catch(error=>{failed=true;throw error;});
  return pending;
 }};
}
