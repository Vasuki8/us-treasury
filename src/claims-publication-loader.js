import {createPublicationLoader} from './publication-loader.js';
let retryNumber=0;
/** The dated claims archive is independent of the GDP and current-source feeds. */
export function createClaimsPublicationLoader({importModule}={}){
 return createPublicationLoader({exportName:'claimsPublicationArchive',maxRecords:560,importArchive:({retry})=>{
  const url=new URL('./claims-publication-archive.js',import.meta.url).href+(retry?`?retry=${Date.now()}-${++retryNumber}`:'');
  if(importModule)return importModule(url);
  return retry?import(url):import('./claims-publication-archive.js');
 }});
}
