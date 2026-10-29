import {createPublicationLoader} from './publication-loader.js';
let retryNumber=0;
export function createCpiPublicationLoader({importModule}={}){
 return createPublicationLoader({exportName:'cpiPublicationArchive',maxRecords:54,importArchive:({retry})=>{
  const url = import.meta.resolve('./cpi-publication-archive.js') + (retry ? `?retry=${Date.now()}-${++retryNumber}` : '');
  if(importModule)return importModule(url);return retry?import(url):import('./cpi-publication-archive.js');
 }});
}
