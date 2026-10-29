import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const jobs=Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/gm)]
  .map(([,name,body])=>[name,body]));

test('CI runs the whole suite once on two CPUs with the heap cap inherited by children',()=>{
  const job=jobs.test_constrained;
  assert.ok(job,'The constrained test job must exist');
  assert.match(job,/NODE_OPTIONS: ['"]--max-old-space-size=2048['"]/);
  assert.match(job,/node-version: ['"]24['"]/);
  assert.match(job,/sched_getaffinity/);
  assert.match(job,/taskset --cpu-list/);
  assert.match(job,/availableParallelism\(\), 2/);
  assert.match(job,/execFileSync/,'The probe verifies a child, not only the parent');
  assert.match(job,/timeout --kill-after=15s 600s/);
  assert.match(job,/npm test/);
  assert.doesNotMatch(job,/retry-command|continue-on-error|data:refresh|deploy-pages|wrangler/);
});

test('both deployment targets require constrained test success',()=>{
  for(const name of ['deploy','deploy-cloudflare']){
    assert.match(jobs[name],/needs: \[verify, test_constrained\]/);
    assert.match(jobs[name],/needs\.test_constrained\.result == 'success'/);
  }
});
