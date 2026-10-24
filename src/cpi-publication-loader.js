import {createPublicationLoader} from './publication-loader.js';
let retryNumber=0;
export function createCpiPublicationLoader({importModule}={}){
 return createPublicationLoader({exportName:'cpiPublicationArchive',maxRecords:54,importArchive:({retry})=>{
  const url=new URL('./cpi-publication-archive.js',import.meta.url).href+(retry?`?retry=${Date.now()}-${++retryNumber}`:'');
  if(importModule)return importModule(url);return retry?import(url):import('./cpi-publication-archive.js');
 }});
}
