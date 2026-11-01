import {BLS_DESK_API,BLS_DESK_COVERAGE_NOTE,BLS_DESK_NOTICE,BLS_DESK_TERMS,blsDeskDefinitions,blsDeskNativeCodes} from './bls-desk-definitions.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const fail=message=>{throw new Error(`Invalid BLS desk source: ${message}`);};
const dateKey=value=>typeof value==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(value)&&value.slice(0,4)!=='0000';
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const same=(a,b)=>a===b||finite(a)&&finite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-12;
export function parseBlsDeskNumber(value){
  if(typeof value!=='string'||value.length>100)fail('numeric source observation');
  const text=value.trim().replaceAll(',','');
  if(['','-','—','(D)','(S)','(NA)','N/A','null'].includes(text))return null;
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(text)||!finite(Number(text)))fail('numeric source observation');
  return Number(text);
}
export function offsetBlsDeskMonth(date,offset){
  const parsed=new Date(`${date}T00:00:00Z`);parsed.setUTCMonth(parsed.getUTCMonth()+offset);return parsed.toISOString().slice(0,10);
}
/** Shared exact-date transformation used in collection and untrusted frozen/import admission. */
export function deriveBlsDeskObservations(definition,series){
  const inputs=definition.inputs.map(id=>series[id]);
  if(inputs.some(input=>!input?.observations))fail('missing calculation dependency');
  const maps=inputs.map(input=>new Map(input.observations.map(row=>[row.date,row])));
  return inputs[0].observations.map(row=>{
    const current=maps.map(map=>map.get(row.date)),valid=current.every(item=>finite(item?.value));
    let value=null,baseline=null;
    if(['growth','difference','averageChanges'].includes(definition.operation)){
      baseline=maps[0].get(offsetBlsDeskMonth(row.date,-definition.months));
      if(finite(row.value)&&finite(baseline?.value)){
        if(definition.operation==='difference')value=row.value-baseline.value;
        else if(definition.operation==='growth'&&baseline.value!==0){const ratio=row.value/baseline.value;if(ratio>=0)value=100*(ratio**(definition.power??1)-1);}
        else if(definition.operation==='averageChanges'&&Array.from({length:definition.months+1},(_,i)=>maps[0].get(offsetBlsDeskMonth(row.date,-i))).every(item=>finite(item?.value)))value=(row.value-baseline.value)/definition.months;
      }
    }else if(valid){
      if(definition.operation==='sum')value=current.reduce((sum,item)=>sum+item.value,0);
      else if(definition.operation==='subtract')value=current[0].value-current[1].value;
      else fail('unknown calculation operation');
    }
    return {date:row.date,value:finite(value)?value:null,sourceValue:row.sourceValue,publishedAt:null,footnotes:[...new Set(current.flatMap(item=>item?.footnotes??[]))],...(['growth','difference','averageChanges'].includes(definition.operation)?{baseDate:baseline?.date??null,baseValue:baseline?.sourceValue??null}:{})};
  });
}
export function buildBlsDeskSeries(raw,{sourceUrl=BLS_DESK_API}={}){
  const series={};
  for(const [id,definition]of Object.entries(blsDeskDefinitions)){
    const observations=definition.nativeCode?raw[definition.nativeCode]:deriveBlsDeskObservations(definition,series);
    if(!Array.isArray(observations)||!observations.length)fail(`missing observations ${id}`);
    series[id]={observations,sourceUrl,sourceIds:[...definition.sourceIds],unit:definition.unit,frequency:definition.frequency,adjustment:definition.adjustment,measure:definition.name,calculation:definition.definition,observationType:definition.observationType,dataStatus:'official',attribution:'Source: U.S. Bureau of Labor Statistics.',sourceNotice:BLS_DESK_NOTICE,licenseUrl:BLS_DESK_TERMS[0]};
  }
  return series;
}
function assertSource(source){
  if(!source||source.id!=='blsDesk'||!['ok','cached','error'].includes(source.status)||!timestamp(source.fetchedAt)||!dateKey(source.coverageStart)||typeof source.coverageEnd!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(source.coverageEnd)||!Number.isFinite(Date.parse(source.coverageEnd))||source.coverageEnd<source.coverageStart||source.coverageNote!==BLS_DESK_COVERAGE_NOTE)fail('capture metadata');
  const startYear=Number(source.coverageStart.slice(0,4)),endYear=Number(source.coverageEnd.slice(0,4));
  if(source.coverageStart!==`${startYear}-01-01`||endYear-startYear!==9)fail('ten-year coverage scope');
  if(!Array.isArray(source.provenance)||source.provenance.length!==Math.ceil(blsDeskNativeCodes.length/25))fail('capture receipts');
  const captured=new Set();let latest='';
  for(const receipt of source.provenance){
    if(receipt.url!==BLS_DESK_API||!timestamp(receipt.retrievedAt)||!/^[a-f0-9]{64}$/.test(receipt.sha256)||receipt.startYear!==startYear||receipt.endYear!==endYear||!Array.isArray(receipt.requestedSeries)||!receipt.requestedSeries.length||receipt.requestedSeries.length>25)fail('capture receipt scope');
    for(const code of receipt.requestedSeries){if(!blsDeskNativeCodes.includes(code)||captured.has(code))fail('capture requested series scope');captured.add(code);}
    if(receipt.retrievedAt>latest)latest=receipt.retrievedAt;
  }
  if(captured.size!==blsDeskNativeCodes.length||latest!==source.fetchedAt)fail('complete capture lineage');
  if(!source.series||typeof source.series!=='object'||Object.keys(source.series).length!==Object.keys(blsDeskDefinitions).length)fail('series scope');
  const raw={};
  for(const [id,definition]of Object.entries(blsDeskDefinitions)){
    const item=source.series[id];
    if(!item||item.sourceUrl!==BLS_DESK_API||JSON.stringify(item.sourceIds)!==JSON.stringify(definition.sourceIds)||item.unit!==definition.unit||item.frequency!==definition.frequency||item.adjustment!==definition.adjustment||item.observationType!==definition.observationType||item.dataStatus!=='official'||item.measure!==definition.name||item.calculation!==definition.definition||item.sourceNotice!==BLS_DESK_NOTICE||item.attribution!=='Source: U.S. Bureau of Labor Statistics.'||item.licenseUrl!==BLS_DESK_TERMS[0])fail(`unreviewed measurement ${id}`);
    if(!Array.isArray(item.observations)||!item.observations.length||item.observations.length>(definition.frequency==='Quarterly'?40:120))fail(`observation count ${id}`);
    let previous='';
    for(const row of item.observations){
      if(!row||!dateKey(row.date)||row.date<=previous||row.date<source.coverageStart||row.date>source.coverageEnd||definition.frequency==='Quarterly'&&!['01','04','07','10'].includes(row.date.slice(5,7))||row.publishedAt!==null||row.value!==null&&!finite(row.value)||!Array.isArray(row.footnotes)||row.footnotes.length>40||row.footnotes.some(note=>typeof note!=='string'||!note.trim()||note.length>4000))fail(`observation period/value ${id}`);
      previous=row.date;
      if(definition.nativeCode&&!same(parseBlsDeskNumber(row.sourceValue),row.value))fail(`source numeric lineage ${id}`);
    }
    if(definition.nativeCode){if(!item.observations.some(row=>finite(row.value)))fail(`no usable native observations ${id}`);raw[definition.nativeCode]=item.observations;}
  }
  const rebuilt=buildBlsDeskSeries(raw);
  for(const [id,definition]of Object.entries(blsDeskDefinitions))if(!definition.nativeCode){
    const actual=source.series[id].observations,expected=rebuilt[id].observations;
    if(actual.length!==expected.length||expected.some((row,index)=>!same(row.value,actual[index].value)||row.date!==actual[index].date||row.sourceValue!==actual[index].sourceValue||row.baseDate!==actual[index].baseDate||row.baseValue!==actual[index].baseValue||JSON.stringify(row.footnotes)!==JSON.stringify(actual[index].footnotes)))fail(`calculation lineage ${id}`);
  }
}
export function validateBlsDeskSource(source){try{assertSource(source);return true;}catch{return false;}}
