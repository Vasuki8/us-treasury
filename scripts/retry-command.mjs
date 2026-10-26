import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const abortCode=signal=>signal?.reason==='SIGTERM'?143:130;
const errorCode=(error,signal)=>signal?.aborted||error?.code==='ABORT_ERR'?abortCode(signal):['ENOENT','ENOTDIR'].includes(error?.code)?127:['EACCES','ENOEXEC','EINVAL'].includes(error?.code)?126:1;
const resultCode=result=>result?.signal?(result.signal==='SIGINT'?130:143):Number.isInteger(result?.code)&&result.code>=0&&result.code<=255?result.code:1;

/** No shell is used: each argument is passed unchanged to one child process. */
export function runChild(command,args,{signal,spawnImpl=spawn}={}){
 if(signal?.aborted)return Promise.resolve({code:abortCode(signal),signal:null});
 return new Promise(resolve=>{
  let child;
  try{child=spawnImpl(command,args,{stdio:'inherit',shell:false,windowsHide:true,...(signal?{signal}:{})});}
  catch(error){resolve({code:errorCode(error,signal),signal:null});return;}
  child.once('error',error=>resolve({code:errorCode(error,signal),signal:null}));
  child.once('close',(code,childSignal)=>resolve({code,signal:childSignal}));
 });
}

/** At most three total executions; callers retain their outer job timeout. */
export async function runWithRetries({command,args=[],execute=runChild,sleep=(ms,{signal})=>wait(ms,undefined,{signal}),signal,onRetry=()=>{}}){
 if(typeof command!=='string'||!command||command.includes('\0')||!Array.isArray(args)||args.some(arg=>typeof arg!=='string'||arg.includes('\0')))return 126;
 const executable=command==='node'?process.execPath:command;
 const delays=[5000,30000];
 for(let attempt=0;attempt<=delays.length;attempt++){
  if(signal?.aborted)return abortCode(signal);
  let result;
  try{result=await execute(executable,args,{signal});}
  catch(error){result={code:errorCode(error,signal)};}
  if(signal?.aborted)return abortCode(signal);
  const code=resultCode(result);
  if(code===0||result?.signal||[126,127,130,143].includes(code)||attempt===delays.length)return code;
  onRetry({attempt:attempt+1,nextAttempt:attempt+2,totalAttempts:3,delayMs:delays[attempt],code});
  try{await sleep(delays[attempt],{signal});}catch{return signal?.aborted?abortCode(signal):code;}
 }
}

async function main(){
 if(process.argv[2]!=='--'||!process.argv[3])throw new Error('Expected a command after the argument separator.');
 const controller=new AbortController(),interrupt=()=>controller.abort('SIGINT'),terminate=()=>controller.abort('SIGTERM');
 process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);
 try{
  process.exitCode=await runWithRetries({command:process.argv[3],args:process.argv.slice(4),signal:controller.signal,sleep:(ms,{signal})=>wait(ms,undefined,{signal}),onRetry:({attempt,nextAttempt,delayMs,code})=>console.log(`Command attempt ${attempt} failed (exit ${code}); retry ${nextAttempt} of 3 in ${delayMs/1000} seconds.`)});
 }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',terminate);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Retry command could not run. Check its fixed command and arguments.');process.exitCode=126;});
