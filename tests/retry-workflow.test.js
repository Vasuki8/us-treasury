import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const ci=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const bls=await readFile(new URL('../.github/workflows/bls-registered-access.yml',import.meta.url),'utf8');
const jobs=Object.fromEntries([...ci.slice(ci.indexOf('\njobs:')).matchAll(/^  ([\w-]+):\r?\n([\s\S]*?)(?=^  [\w-]+:\r?$|(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));

test('source retry configuration stays in collection steps and no whole collector or publisher is replayed',()=>{
 for(const id of ['source_health','refresh','publication_upkeep'])assert.match(jobs[id],/env:\s*\n(?:[^\n]*\n)*?\s+SOURCE_RETRY_ATTEMPTS: '3'/);
 for(const id of ['verify','refresh_check','deploy','deploy-cloudflare'])assert.doesNotMatch(jobs[id],/SOURCE_RETRY_ATTEMPTS/);
 assert.match(bls,/SOURCE_RETRY_ATTEMPTS: '3'/);
 assert.match(jobs.refresh,/UPDATE_RETRY_ATTEMPTS: '3'/);
 assert.doesNotMatch(ci,/retry-command\.mjs -- (?:npm run data:refresh|node scripts\/(?:refresh-data|publish-snapshot|report-publication-upkeep))/);
 assert.match(jobs.verify,/timeout-minutes: 25/);
});

test('deterministic checks run once while the remote deployment check retains retries',()=>{
 for(const id of ['refresh','verify']){
  const commands=[...jobs[id].matchAll(/^        run: ([^\r\n]+)/gm)].map(match=>match[1]);
  for(const command of ['npm test','npm run build','node scripts/check-build.mjs']){
   assert.equal(commands.filter(value=>value===command).length,1,`${id}: ${command} must run directly once`);
  }
  assert.doesNotMatch(jobs[id],/retry-command\.mjs/);
 }
 assert.doesNotMatch(jobs.refresh_check,/retry-command\.mjs/,'refresh planning is local and must not be replayed');
 const retried=[...ci.matchAll(/run: node scripts\/retry-command\.mjs -- ([^\r\n]+)/g)].map(match=>match[1]);
 assert.ok(retried.length>0,'remote deployment verification retains its bounded retry');
 for(const command of retried)assert.match(command,/^node scripts\/check-live\.mjs /);
});

test('deployment retries use the same pinned action/artifact and only the last attempt can fail the job',()=>{
 for(const id of ['deploy','deploy-cloudflare']){
  const body=jobs[id],steps=[...body.matchAll(/      - name: Deploy verified static (?:artifact|assets) \(attempt ([123])\)\r?\n([\s\S]*?)(?=      - name: |$)/g)];
  assert.equal(steps.length,3,id);
  assert.match(steps[0][2],/continue-on-error: true/);assert.match(steps[1][2],/continue-on-error: true/);assert.doesNotMatch(steps[2][2],/continue-on-error/);
  const uses=steps.map(step=>step[2].match(/uses: (.+)/)[1]);assert.equal(new Set(uses).size,1,'all attempts use the same pinned action');
  assert.match(body,/sleep 5/);assert.match(body,/sleep 30/);
  for(const [index,previous]of [[1,'deploy_first'],[2,'deploy_second']]){
   const raw=steps[index][2].match(/if: (.+)/)[1],expression=raw.startsWith('"')?JSON.parse(raw):raw;
   assert.equal(vm.runInNewContext(expression,{cancelled:()=>false,steps:{[previous]:{outcome:'failure'}}}),true);
   for(const outcome of ['success','skipped'])assert.equal(vm.runInNewContext(expression,{cancelled:()=>false,steps:{[previous]:{outcome}}}),false);
   assert.equal(vm.runInNewContext(expression,{cancelled:()=>true,steps:{[previous]:{outcome:'failure'}}}),false);
  }
 }
 assert.equal((jobs.deploy.match(/timeout: '600000'/g)??[]).length,3,'each Pages attempt preserves the prior ten-minute allowance');
 for(const id of ['deploy','deploy-cloudflare'])assert.match(jobs[id],/timeout-minutes: 35/,'three full attempts fit the job timeout');
 for(const id of ['deploy','deploy-cloudflare'])assert.match(jobs[id],/url: \$\{\{ steps\.deploy_first\.outcome == 'success' &&/,'public URL must come from an actually successful attempt');
 assert.doesNotMatch(ci,/actions: write|rerun-failed-jobs|force-with-lease|--force-push/);
});
