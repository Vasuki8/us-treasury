const calendar={status:'unavailable',message:'Release schedules have not been ingested. Follow the official agency calendars for verified publication dates and changes.',links:[{name:'BLS release calendar',url:'https://www.bls.gov/schedule/'},{name:'BEA release schedule',url:'https://www.bea.gov/news/schedule'}]};
function validate(result,cutoff) {
  if(!result || !result.series || !Object.keys(result.series).length)throw new Error('Official source returned no series');
  for(const [id,series] of Object.entries(result.series)) {
    if(!Array.isArray(series.observations)||!series.observations.length)throw new Error(`No official observations for ${id}`);
    let previous='';
    for(const {date,value} of series.observations) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=previous||date>cutoff || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error(`Invalid or duplicate official date for ${id}`);
      if(value!==null && (typeof value!=='number'||!Number.isFinite(value)))throw new Error(`Invalid official value for ${id}`);
      previous=date;
    }
    if(!series.observations.some(o=>typeof o.value==='number'&&Number.isFinite(o.value)))throw new Error(`No numeric official observations for ${id}`);
  }
}

export async function refreshSnapshot({previous={},collectors={},now=new Date()}={}) {
  const checkedAt=now.toISOString(),sources={...previous.sources};
  await Promise.all(Object.entries(collectors).map(async([id,collect])=>{
    try {
      const result=await collect({now});validate(result,checkedAt.slice(0,10));
      sources[id]={...result,status:'ok',lastAttemptAt:checkedAt,error:null};
    } catch(error) {
      const prior=sources[id];
      sources[id]={...(prior||{id,series:{},fetchedAt:null,provenance:[],warnings:[]}),status:prior?.fetchedAt?'error':'unavailable',lastAttemptAt:checkedAt,error:String(error.message||error)};
    }
  }));
  const generatedAt=new Date(Math.max(Date.now(),Date.parse(checkedAt),...Object.values(sources).map(source=>Date.parse(source.fetchedAt)||0))).toISOString();
  return {schemaVersion:1,generatedAt,checkedAt,sources,releases:[],calendar};
}
