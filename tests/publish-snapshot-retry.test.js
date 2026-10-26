import test from 'node:test';
import assert from 'node:assert/strict';
import {pushVerifiedCommit,readPublicationRemote} from '../scripts/publish-snapshot.mjs';

const expectedHead='a'.repeat(40),commitSha='b'.repeat(40),otherHead='c'.repeat(40);
const remote=sha=>`${sha}\trefs/heads/main\n`;
const network=()=>Object.assign(new Error('private canary: connection reset by peer'),{code:128,stderr:'fatal: unable to access remote: Connection reset by peer'});
function fixture({head=expectedHead,pushes=[],reads=[]}={}){
 const calls=[],waits=[];let index=0,readIndex=0;
 const git=async(...args)=>{
  calls.push(args);
  if(args[0]==='ls-remote'){
   const next=reads[readIndex++];if(next instanceof Error)throw next;
   return remote(next??head);
  }
  assert.deepEqual(args,['push','origin',`${commitSha}:refs/heads/main`]);
  const next=pushes[index++];if(next instanceof Error)throw next;
  if(typeof next==='function')return next();return '';
 };
 return {git,calls,waits,sleepImpl:async duration=>{waits.push(duration);}};
}
const push=f=>pushVerifiedCommit({...f,expectedHead,commitSha,maxAttempts:3});

test('transient publication failure retries the same verified commit with guarded non-force pushes',async()=>{
 const f=fixture({pushes:[network(),network(),undefined]});
 const result=await push(f);
 assert.equal(result.alreadyPublished,false);assert.equal(result.attempts,3);
 assert.deepEqual(f.waits,[5000,30000]);
 assert.equal(f.calls.filter(args=>args[0]==='push').length,3);
 assert.ok(f.calls.every(args=>['push','ls-remote'].includes(args[0])),'no new commit, index, ref or rebase operation');
});

test('a lost acknowledgement recognizes the exact commit already on main without another push',async()=>{
 const f=fixture({pushes:[network()],reads:[expectedHead,commitSha]});
 const result=await push(f);
 assert.equal(result.alreadyPublished,true);assert.equal(f.calls.filter(args=>args[0]==='push').length,1);assert.deepEqual(f.waits,[]);
});

test('remote main advancing before or between attempts refuses stale publication',async()=>{
 for(const reads of [[otherHead],[expectedHead,otherHead],[expectedHead,expectedHead,otherHead]]){
  const f=fixture({pushes:[network()],reads});
  await assert.rejects(push(f),/Remote main.*changed|stale/i);
  assert.ok(f.calls.filter(args=>args[0]==='push').length<=1);
 }
});

test('authentication, hook denial and cancellation do not retry or expose private error text',async()=>{
 for(const failure of [Object.assign(new Error('private canary'),{stderr:'fatal: Authentication failed'}),Object.assign(new Error('private canary'),{stderr:'remote: pre-receive hook declined'}),Object.assign(network(),{signal:'SIGTERM'})]){
  const f=fixture({pushes:[failure]});
  await assert.rejects(push(f),error=>/Verified snapshot push failed/.test(error.message)&&!error.message.includes('private canary'));
  assert.equal(f.calls.filter(args=>args[0]==='push').length,1);assert.deepEqual(f.waits,[]);
 }
});

test('exhaustion stays bounded and keeps the original verified commit',async()=>{
 const f=fixture({pushes:[network(),network(),network()]});
 await assert.rejects(push(f),error=>/Verified snapshot push failed/.test(error.message)&&!error.message.includes('private canary'));
 assert.equal(f.calls.filter(args=>args[0]==='push').length,3);assert.deepEqual(f.waits,[5000,30000]);
 const single=fixture({pushes:[network()]});
 await assert.rejects(pushVerifiedCommit({...single,expectedHead,commitSha}),/Verified snapshot push failed/);
 assert.equal(single.calls.filter(args=>args[0]==='push').length,1);assert.deepEqual(single.waits,[]);
});

test('transient remote-read failures consume the bounded budget without blind pushes',async()=>{
 const f=fixture({reads:[network(),network(),expectedHead]});
 await push(f);assert.deepEqual(f.waits,[5000,30000]);assert.equal(f.calls.filter(args=>args[0]==='push').length,1);
 const exhausted=fixture({reads:[network(),network(),network()]});
 await assert.rejects(push(exhausted),/Verified snapshot push failed/);assert.equal(exhausted.calls.filter(args=>args[0]==='push').length,0);
});

test('malformed helper inputs cannot become Git arguments or unbounded retry budgets',async()=>{
 for(const invalid of [{maxAttempts:0},{maxAttempts:4},{expectedHead:'main'},{commitSha:'--force'}]){
  const f=fixture();await assert.rejects(pushVerifiedCommit({...f,expectedHead,commitSha,...invalid}),/Invalid verified publication retry/);assert.equal(f.calls.length,0);
 }
});

test('the initial publication remote check retries a transport timeout without touching the local tree',async()=>{
 const timeout=Object.assign(new Error('private remote detail'),{code:'ETIMEDOUT'});
 const f=fixture({reads:[timeout,expectedHead]});
 assert.equal(await readPublicationRemote({...f,maxAttempts:3}),remote(expectedHead).trim());
 assert.deepEqual(f.waits,[5000]);assert.ok(f.calls.every(args=>args[0]==='ls-remote'));
 const denied=fixture({reads:[Object.assign(new Error('private remote detail'),{stderr:'Authentication failed'})]});
 await assert.rejects(readPublicationRemote({...denied,maxAttempts:3}),error=>/Publication remote check failed/.test(error.message)&&!error.message.includes('private remote detail'));
 assert.equal(denied.calls.length,1);assert.deepEqual(denied.waits,[]);
});
