import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Evaluate our workflow's plain boolean expressions with representative Actions
// contexts. Actual job execution is also verified in Actions after publication.
const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const jobs = Object.fromEntries([...workflow.slice(workflow.indexOf('\njobs:')).matchAll(/^  ([\w-]+):\r?\n([\s\S]*?)(?=^  [\w-]+:\r?$|(?![\s\S]))/gm)].map(match => [match[1], match[2]]));
function context(event = 'push', { ref = 'refs/heads/main', force = false, checkSources = false, cancelled = false, check = 'success', required = 'true', refresh = 'success', verify = 'success', target = '' } = {}) {
  return {
    github: { event_name: event, ref }, inputs: { refresh_data: force, check_sources: checkSources }, vars: { DEPLOY_TARGET: target },
    needs: { refresh_check: { result: check, outputs: { required } }, refresh: { result: refresh }, verify: { result: verify } },
    cancelled: () => cancelled,
  };
}
function eligible(job, data) {
  assert.ok(jobs[job], `Missing workflow job: ${job}`);
  const condition = jobs[job].match(/^    if:\s*(.+)$/m)?.[1];
  assert.ok(condition, `Missing explicit workflow gate: ${job}`);
  const expression = condition.replace(/^\$\{\{\s*|\s*\}\}$/g, '').trim();
  // Actions exposes only declared job dependencies in the needs context.
  const dependencies = (jobs[job].match(/^    needs:\s*(.+)$/m)?.[1] ?? '').replace(/[\[\]]/g, '').split(/[,\s]+/).filter(Boolean);
  const needs = Object.fromEntries(dependencies.map(id => [id, data.needs[id]]));
  return !!vm.runInNewContext(expression, { ...data, needs }, { timeout: 1000 });
}

test('trusted automatic main runs check for a missed refresh while PRs and redeploy-only runs do not', () => {
  for (const event of ['push', 'schedule']) assert.equal(eligible('refresh_check', context(event)), true, event);
  assert.equal(eligible('refresh_check', context('workflow_dispatch', { force: true })), true);
  assert.equal(eligible('refresh_check', context('workflow_dispatch')), false);
  assert.equal(eligible('refresh_check', context('pull_request', { ref: 'refs/pull/1/merge' })), false);
  assert.equal(eligible('refresh_check', context('push', { ref: 'refs/heads/feature' })), false);
});

test('all-source diagnostics require explicit manual selection and do not gate publication',()=>{
 for(const ref of ['refs/heads/main','refs/heads/codex/source-update-reliability']){
  assert.equal(eligible('source_health',context('workflow_dispatch',{ref,checkSources:true})),true);
  assert.equal(eligible('source_health',context('workflow_dispatch',{ref})),false);
 }
 for(const event of ['push','schedule','pull_request'])assert.equal(eligible('source_health',context(event,{checkSources:true})),false);
 for(const job of ['refresh_check','refresh','verify','deploy','deploy-cloudflare'])assert.doesNotMatch(jobs[job].match(/^    needs:\s*(.+)$/m)?.[1]??'',/source_health/);
});

test('refresh downloads run only after a successful due check', () => {
  assert.equal(eligible('refresh', context()), true);
  for (const options of [{ required: 'false' }, { check: 'failure' }, { check: 'skipped' }, { check: 'cancelled' }, { cancelled: true }]) {
    assert.equal(eligible('refresh', context('push', options)), false, JSON.stringify(options));
  }
});

test('failed refresh planning or collection blocks verification and deployment', () => {
  for (const options of [{ check: 'failure', refresh: 'skipped' }, { check: 'cancelled', refresh: 'skipped' }, { refresh: 'failure' }, { refresh: 'cancelled' }, { cancelled: true }]) {
    assert.equal(eligible('verify', context('push', options)), false, JSON.stringify(options));
  }
  assert.equal(eligible('verify', context()), true);
  assert.equal(eligible('verify', context('push', { required: 'false', refresh: 'skipped' })), true);
  assert.equal(eligible('verify', context('pull_request', { check: 'skipped', refresh: 'skipped' })), true);
  assert.equal(eligible('verify', context('workflow_dispatch', { check: 'skipped', refresh: 'skipped' })), true);
});

test('backup checks become cheap no-ops after completion and never deploy an unverified artifact', () => {
  assert.equal(eligible('verify', context('schedule', { required: 'false', refresh: 'skipped' })), false);
  assert.equal(eligible('verify', context('schedule')), true);
  for (const job of ['deploy', 'deploy-cloudflare']) {
    for (const verify of ['failure', 'skipped', 'cancelled']) assert.equal(eligible(job, context('schedule', { verify })), false);
  }
  assert.equal(eligible('deploy', context('schedule')), true);
  assert.equal(eligible('deploy-cloudflare', context('schedule', { target: 'cloudflare' })), true);
});

test('publication upkeep is manually verifiable on a branch and its failure cannot gate statistical deployment',()=>{
 assert.equal(eligible('publication_upkeep',context('workflow_dispatch',{ref:'refs/heads/codex/cpi-release-check-reliability'})),true);
 assert.equal(eligible('publication_upkeep',context('pull_request',{ref:'refs/pull/1/merge'})),false);
 assert.equal(eligible('publication_upkeep',context('push',{ref:'refs/heads/codex/cpi-release-check-reliability'})),false);
 for(const job of ['refresh_check','refresh','verify','deploy','deploy-cloudflare'])assert.doesNotMatch(jobs[job].match(/^    needs:\s*(.+)$/m)?.[1]??'',/publication_upkeep/);
 assert.match(jobs.publication_upkeep,/if: always\(\)[\s\S]*publication-upkeep\.json/);
});
