import test from 'node:test';
import assert from 'node:assert/strict';
import {runWithRetries,runChild} from '../scripts/retry-command.mjs';

test('a transient failure retries the same literal command and succeeds',async()=>{
 const calls=[],waits=[];
 const result=await runWithRetries({command:'node',args:['example.mjs','$(literal)','a b'],execute:async(...args)=>{calls.push(args);return {code:calls.length===1?7:0};},sleep:async delay=>{waits.push(delay);}});
 assert.equal(result,0);assert.equal(calls.length,2);assert.equal(calls[0][0],process.execPath);
 assert.deepEqual(calls[0][1],['example.mjs','$(literal)','a b']);assert.deepEqual(calls[1][1],calls[0][1]);assert.deepEqual(waits,[5000]);
});

test('three failed attempts preserve the final nonzero code and bounded waits',async()=>{
 const waits=[];let attempts=0;
 const result=await runWithRetries({command:'test-command',execute:async()=>({code:[1,2,9][attempts++]}),sleep:async delay=>{waits.push(delay);}});
 assert.equal(result,9);assert.equal(attempts,3);assert.deepEqual(waits,[5000,30000]);
});

test('signals, cancellation and missing commands stop without further attempts',async()=>{
 for(const outcome of [{code:null,signal:'SIGINT'},{code:null,signal:'SIGTERM'},{code:130},{code:143},{code:126},{code:127}]){
  let calls=0,waits=0;
  const result=await runWithRetries({command:'test-command',execute:async()=>{calls++;return outcome;},sleep:async()=>{waits++;}});
  assert.equal(result,outcome.signal==='SIGINT'?130:outcome.signal==='SIGTERM'?143:outcome.code);assert.equal(calls,1);assert.equal(waits,0);
 }
 const controller=new AbortController();controller.abort();let called=false;
 assert.equal(await runWithRetries({command:'test-command',signal:controller.signal,execute:async()=>{called=true;return {code:1};}}),130);assert.equal(called,false);
});

test('cancellation during execution or waiting cannot launch another child',async()=>{
 for(const cancelAt of ['execute','wait']){
  const controller=new AbortController();let calls=0;
  const result=await runWithRetries({command:'test-command',signal:controller.signal,execute:async()=>{calls++;if(cancelAt==='execute')controller.abort();return {code:1};},sleep:async()=>{controller.abort();}});
  assert.equal(result,130);assert.equal(calls,1);
 }
});

test('child spawning uses literal arguments with no shell or argument interpolation',async()=>{
 let options;
 const spawnImpl=(command,args,config)=>{
  options={command,args,config};const handlers={};
  queueMicrotask(()=>handlers.close?.(0,null));
  return {once(event,handler){handlers[event]=handler;return this;}};
 };
 const args=['--flag','hello world','$(literal)',';echo private'];
 assert.deepEqual(await runChild(process.execPath,args,{spawnImpl}),{code:0,signal:null});
 assert.equal(options.command,process.execPath);assert.deepEqual(options.args,args);
 assert.equal(options.config.shell,false);assert.equal(options.config.stdio,'inherit');assert.equal(options.config.windowsHide,true);
});

test('spawn failures return fixed execution codes without surfacing raw error text',async()=>{
 for(const [errorCode,expected]of [['ENOENT',127],['ENOTDIR',127],['EACCES',126],['ENOEXEC',126],['EINVAL',126],['OTHER',1]]){
  const spawnImpl=()=>{const handlers={};queueMicrotask(()=>handlers.error?.({code:errorCode,message:'private error text'}));return {once(event,handler){handlers[event]=handler;return this;}};};
  assert.deepEqual(await runChild('test-command',[],{spawnImpl}),{code:expected,signal:null});
 }
});

test('the real child receives shell punctuation as literal arguments',async()=>{
 const argument='$(literal); never-run-this';
 const result=await runChild(process.execPath,['-e',`process.exit(process.argv[1]===${JSON.stringify(argument)}?0:9)`,argument]);
 assert.deepEqual(result,{code:0,signal:null});
});
