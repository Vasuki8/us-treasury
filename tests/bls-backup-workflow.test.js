import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const ci=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const diagnostic=await readFile(new URL('../.github/workflows/bls-registered-access.yml',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
const jobs=Object.fromEntries([...ci.slice(ci.indexOf('\njobs:')).matchAll(/^  ([\w-]+):\r?\n([\s\S]*?)(?=^  [\w-]+:\r?$|(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
test('BLS key is scoped to trusted main collection steps and never build or deployment',()=>{
 for(const id of ['source_health','refresh']){
  const expression=jobs[id].match(/^          BLS_API_KEY: \$\{\{ (.+) \}\}$/m)?.[1];
  assert.ok(expression,`${id} needs a step-scoped key`);
  for(const [ref,event,expected]of [['refs/heads/main','push','private-fixture-key'],['refs/heads/main','schedule','private-fixture-key'],['refs/heads/main','workflow_dispatch','private-fixture-key'],['refs/heads/feature','workflow_dispatch',''],['refs/pull/1/merge','pull_request',''],['refs/heads/main','pull_request','']]){
   assert.equal(vm.runInNewContext(expression,{github:{ref,event_name:event},secrets:{BLS_API_KEY:'private-fixture-key'}}),expected);
  }
  assert.equal((jobs[id].match(/BLS_API_KEY:/g)??[]).length,1);
 }
 for(const [id,body]of Object.entries(jobs))if(!['source_health','refresh'].includes(id))assert.doesNotMatch(body,/BLS_API_KEY/);
 assert.equal((ci.match(/secrets\.BLS_API_KEY/g)??[]).length,2);
});
test('registered-only workflow is manually selected on main with no publishing or credentials in inputs',()=>{
 assert.ok(diagnostic,'registered access workflow exists');
 assert.match(diagnostic,/workflow_dispatch:/);
 assert.match(diagnostic,/if: github\.ref == 'refs\/heads\/main'/);
 assert.match(diagnostic,/contents: read/);
 assert.match(diagnostic,/persist-credentials: false/);
 assert.match(diagnostic,/node scripts\/check-bls-registered-access\.mjs/);
 assert.match(diagnostic,/BLS_API_KEY: \$\{\{ secrets\.BLS_API_KEY \}\}/);
 assert.doesNotMatch(diagnostic,/contents: write|pages: write|id-token: write|publish-snapshot|deploy-pages|data:refresh|pull_request|schedule:/);
 assert.match(diagnostic,/if: always\(\)[\s\S]*bls-registered-access\.json/);
 assert.doesNotMatch(diagnostic,/inputs:/);
});
