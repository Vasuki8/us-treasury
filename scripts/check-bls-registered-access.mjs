import {appendFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectRegisteredBls} from './sources/bls.mjs';
import {BLS_API_V2} from './bls-api-policy.mjs';
import {assertCommercialData} from './data-policy.mjs';
import {snapshot} from '../src/official-snapshot.js';
import {registry} from '../src/registry.js';
import {addMomentumSeries} from '../src/momentum.js';
import {isIsoDate} from '../src/date-window.js';
import {OfficialSourceHttpError} from './sources/http.mjs';

/** Explicit registered-only read check. No source snapshots or histories are written. */
export async function checkRegisteredBlsAccess({apiKey=process.env.BLS_API_KEY,now=new Date(),previous=snapshot.sources.bls,collect=collectRegisteredBls}={}){
 const base={checkedAt:now.toISOString(),endpoint:BLS_API_V2,passed:false};
 const key=typeof apiKey==='string'?apiKey.trim():'';
 if(!key)return {...base,status:'not-configured',error:'Configure the repository Actions secret BLS_API_KEY before this manual check.'};
 try{
  const source=addMomentumSeries(await collect({apiKey:key,now}));
  const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=now.getTime()+45000;
  if(source.id!=='bls'||!validTime(source.fetchedAt)||source.provenance?.length!==1)throw new Error('Invalid registered capture');
  const receipt=source.provenance[0];
  if(receipt.url!==BLS_API_V2||receipt.retrievedAt!==source.fetchedAt||!/^[a-f0-9]{64}$/.test(receipt.sha256))throw new Error('Invalid registered receipt');
  const required=Object.entries(registry).filter(([,metadata])=>metadata.agency==='bls').map(([id])=>id);
  if(Object.keys(source.series).length!==required.length||required.some(id=>!source.series[id]))throw new Error('Incomplete registered family');
  const cutoff=new Date(Math.min(Date.parse(source.fetchedAt),now.getTime()+45000)).toISOString().slice(0,10);
  const start=`${now.getUTCFullYear()-9}-01-01`;
  const series=required.map(id=>{
   const value=source.series[id],rows=value.observations;
   if(value.sourceUrl!==BLS_API_V2||!Array.isArray(rows)||!rows.length||!rows.some(row=>Number.isFinite(row.value)))throw new Error('Invalid registered observations');
   let priorDate='';
   for(const row of rows){
    if(!isIsoDate(row.date)||row.date<=priorDate||row.date>cutoff||row.value!==null&&!Number.isFinite(row.value))throw new Error('Invalid registered observation');
    priorDate=row.date;
   }
   const dates=new Set(rows.map(row=>row.date)),prior=previous?.series?.[id]?.observations??[];
   if(prior.some(row=>row.date>=start&&row.date<=cutoff&&!dates.has(row.date)))throw new Error('Registered coverage regressed');
   const usable=rows.findLast(row=>Number.isFinite(row.value))?.date,priorUsable=prior.findLast(row=>Number.isFinite(row.value))?.date;
   if(priorUsable&&(!usable||usable<priorUsable))throw new Error('Registered usable coverage regressed');
   return {id,observationCount:rows.length,firstReferencePeriod:rows[0].date,latestReferencePeriod:rows.at(-1).date,latestUsableReferencePeriod:usable};
  });
  assertCommercialData({sources:{bls:source}});
  const report={...base,passed:true,status:'ok',fetchedAt:source.fetchedAt,outputCount:required.length,provenance:source.provenance,series};
  if(JSON.stringify(source).includes(key)||JSON.stringify(report).includes(key))throw new Error('Secret echo rejected');
  return report;
 }catch(error){
  const httpStatus=error instanceof OfficialSourceHttpError&&error.requestedUrl===BLS_API_V2&&Number.isInteger(error.status)&&error.status>=100&&error.status<=599?error.status:null;
  return {...base,status:'error',httpStatus,error:'Registered BLS request or validation failed. Check key validity, access and coverage; published data were not changed.'};
 }
}

async function main(){
 if(process.argv.length>2)throw new Error('This check accepts no arguments; use the private BLS_API_KEY environment variable.');
 const report=await checkRegisteredBlsAccess();
 await writeFile('bls-registered-access.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Registered BLS read-only access\n\n${report.passed?'Passed':'Not verified'}: ${report.status}. ${report.passed?`${report.outputCount} outputs validated with non-regressing reference coverage.`:report.error}\n\nNo snapshot, immutable capture or published website was changed. The key remains private; this is a second BLS endpoint, not an independent upstream.\n`);
 if(!report.passed)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Registered BLS access check could not complete; no snapshot was changed.');process.exitCode=1;});
