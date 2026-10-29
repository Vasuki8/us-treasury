import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor} from '../src/router.js';
import {requiredSourceIds} from '../src/source-controller.js';
import {dataStatus} from '../src/data.js';
import {toCsv} from '../src/model.js';
import {viewRange} from '../src/workspace-context.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
function helper(env){
 const from=source.indexOf('async function ensureSourceAction('),to=source.indexOf('\nfunction stored(',from);
 assert.ok(from>=0&&to>from,'Source actions need a common readiness gate');
 return new Function('env',`let {${Object.keys(env).join(',')}}=env;${source.slice(from,to)};return ensureSourceAction;`)(env);
}

test('an export waits for all selected full inputs and aborts if navigation changes meanwhile',async()=>{
 let finish,calls=[];const state=parseRoute('#/explore?mode=compare&selected=unrate,gdp&window=all');
 const env={state,routeFor,dataStatus:{sourceArchive:{sources:{bls:{},bea:{}}}},
  sourceController:{ensure:ids=>{calls.push(ids);return new Promise(resolve=>{finish=resolve;});}},
  actionFeedback(){},main:{querySelector:()=>null},esc:value=>value};
 const ensure=helper(env),pending=ensure(requiredSourceIds(state,{purpose:'export',action:{export:''}}));
 assert.deepEqual(calls,[['bls','bea']]);Object.assign(state,parseRoute('#/overview'));finish();
 await assert.rejects(pending,/view changed/i);
});

test('failed source actions provide an explicit retry and never proceed with compact data',async()=>{
 const messages=[],buttons=[],env={state:parseRoute('#/explore'),routeFor,dataStatus:{sourceArchive:{sources:{bls:{}}}},
  sourceController:{ensure:async()=>{throw Error('HTTP 503');}},actionFeedback:(...args)=>messages.push(args),
  main:{querySelector:()=>({insertAdjacentHTML:(_position,html)=>buttons.push(html)})},esc:value=>value};
 await assert.rejects(helper(env)(['bls']),/HTTP 503/);
 assert.equal(messages.at(-1)[1],'error');assert.match(buttons[0],/data-retry-sources="bls"/);
});

test('actual delegated comparison CSV waits for complete sources before downloading exact existing bytes',async()=>{
 let finish;const downloads=[],state=parseRoute('#/explore?mode=compare&selected=unrate,gdp&window=all');
 const env={state,routeFor,dataStatus:{...dataStatus,sourceArchive:{sources:{bls:{},bea:{}}}},
  sourceController:{ensure:()=>new Promise(resolve=>{finish=resolve;})},
  actionFeedback(){},main:{querySelector:()=>null},esc:value=>value,announce(){},
  requiredSourceIds,toCsv,viewRange,downloadCsv:content=>downloads.push(content)};
 env.ensureSourceAction=helper(env);
 const from=source.indexOf('function exportCsv('),to=source.indexOf('function downloadJson(',from);
 const delegated=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(source);
 assert.ok(delegated);
 const run=new Function('env',`let {${Object.keys(env).join(',')}}=env;${source.slice(from,to)};
  return async event=>{${delegated[1]}};`)(env);
 const pending=run({target:{closest:()=>({disabled:false,dataset:{export:''}})}});
 await Promise.resolve();assert.equal(downloads.length,0);finish();await pending;
 assert.equal(downloads.length,1);
 assert.equal(downloads[0],toCsv(state.selected,{range:viewRange(state),comparison:state.comparison}));
});
