const kind=id=>['claimsAdvance','continuedClaimsAdvance'].includes(id)?'claims':'gdp';
function visibleFamilies(route){
 if(route.page==='overview')return ['gdp','claims'];
 if(route.page==='release'||route.page==='research'&&route.researchView==='publications')return [kind(route.publicationSeries)];
 if(route.page==='labor'||route.page==='macroCoverage'&&route.macroFamily==='labor')return ['claims'];
 const id=route.page==='indicator'?route.seriesId:route.page==='macroCoverage'?route.macroMeasure:null;
 return ['gdp','claimsAdvance','continuedClaimsAdvance'].includes(id)?[kind(id)]:[];
}
/** Cache each family independently; late completion cannot replace another view. */
export function createPublicationController({gdpLoader,claimsLoader,getRoute,onChange}){
 const states={gdp:{status:'idle',archive:null,error:null},claims:{status:'idle',archive:null,error:null}};
 return {
  context(seriesId='gdp'){return {...states[kind(seriesId)]};},
  sync(route,{retry=false}={}){
   const keys=visibleFamilies(route);
   for(const key of keys){
   const entry=states[key];
   if(entry.status==='loading'||!retry&&entry.status!=='idle')continue;
   entry.status='loading';entry.error=null;
   const complete=()=>{if(visibleFamilies(getRoute()).includes(key))onChange();};
   let pending;try{pending=(key==='gdp'?gdpLoader:claimsLoader).load({retry});}catch(error){pending=Promise.reject(error);}
   Promise.resolve(pending).then(archive=>{
    entry.archive=archive;entry.status='ready';complete();
   }).catch(error=>{entry.status='error';entry.error=error?.message??String(error);complete();});
   }
  },
 };
}
