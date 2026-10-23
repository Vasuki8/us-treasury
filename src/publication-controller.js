const kind=id=>['claimsAdvance','continuedClaimsAdvance'].includes(id)?'claims':'gdp';
const active=route=>route.page==='release'||route.page==='research'&&route.researchView==='publications';
/** Cache each family independently; late completion cannot replace another view. */
export function createPublicationController({gdpLoader,claimsLoader,getRoute,onChange}){
 const states={gdp:{status:'idle',archive:null,error:null},claims:{status:'idle',archive:null,error:null}};
 return {
  context(seriesId='gdp'){return {...states[kind(seriesId)]};},
  sync(route,{retry=false}={}){
   if(!active(route))return;
   const key=kind(route.publicationSeries),entry=states[key];
   if(entry.status==='loading'||!retry&&entry.status!=='idle')return;
   entry.status='loading';entry.error=null;
   const complete=()=>{const current=getRoute();if(active(current)&&kind(current.publicationSeries)===key)onChange();};
   let pending;try{pending=(key==='gdp'?gdpLoader:claimsLoader).load({retry});}catch(error){pending=Promise.reject(error);}
   Promise.resolve(pending).then(archive=>{
    entry.archive=archive;entry.status='ready';complete();
   }).catch(error=>{entry.status='error';entry.error=error?.message??String(error);complete();});
  },
 };
}
