import {createPublicationLoader} from './publication-loader.js';
let retryNumber=0;
/** The dated claims archive is independent of the GDP and current-source feeds. */
export function createClaimsPublicationLoader({importModule}={}){
 return createPublicationLoader({exportName:'claimsPublicationArchive',maxRecords:768,importArchive:({retry})=>{
  const url = import.meta.resolve('./claims-publication-archive.js') + (retry ? `?retry=${Date.now()}-${++retryNumber}` : '');
  if(importModule)return importModule(url);
  return retry?import(url):import('./claims-publication-archive.js');
 }});
}
