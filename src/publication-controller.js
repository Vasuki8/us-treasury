export const publicationFamily=id=>id==='gdp'?'gdp':['claimsAdvance','continuedClaimsAdvance'].includes(id)?'claims':['cpiMonthly','cpiCoreMonthly','cpi','cpiCore'].includes(id)?'cpi':null;
const kind=publicationFamily;
function visibleFamilies(route){
 if(route.page==='overview')return ['gdp','claims','cpi'];
 if(route.page==='release'||route.page==='research'&&route.researchView==='publications')return [kind(route.publicationSeries??'gdp')].filter(Boolean);
 if(route.page==='labor'||route.page==='macroCoverage'&&route.macroFamily==='labor')return ['claims'];
 const id=route.page==='indicator'?route.seriesId:route.page==='macroCoverage'?route.macroMeasure:null;
 if(kind(id))return [kind(id)];
 return route.page==='macroCoverage'&&route.macroFamily==='prices'?['cpi']:[];
}
/** Cache each family independently; late completion cannot replace another view. */
export function createPublicationController({gdpLoader,claimsLoader,cpiLoader,getRoute,onChange}){
 const states={gdp:{status:'idle',archive:null,error:null},claims:{status:'idle',archive:null,error:null},cpi:{status:'idle',archive:null,error:null}};
 const loaders={gdp:gdpLoader,claims:claimsLoader,cpi:cpiLoader};
 return {
  context(seriesId='gdp'){return {...states[kind(seriesId)]};},
  sync(route,{retry=false}={}){
   const keys=visibleFamilies(route);
   for(const key of keys){
   const entry=states[key];
   if(entry.status==='loading'||!retry&&entry.status!=='idle')continue;
   entry.status='loading';entry.error=null;
   const complete=()=>{if(visibleFamilies(getRoute()).includes(key))onChange();};
   let pending;try{if(!loaders[key])throw Error('Publication loader unavailable for '+key);pending=loaders[key].load({retry});}catch(error){pending=Promise.reject(error);}
   Promise.resolve(pending).then(archive=>{
    entry.archive=archive;entry.status='ready';complete();
   }).catch(error=>{entry.status='error';entry.error=error?.message??String(error);complete();});
   }
  },
 };
}
