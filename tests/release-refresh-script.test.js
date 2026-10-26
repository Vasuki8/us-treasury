import test from 'node:test';
import assert from 'node:assert/strict';
import {getFreshness} from '../src/freshness.js';
const api=await import('../scripts/check-release-refresh.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
function complete(){
 const snapshot={sources:{},calendar:{sources:{}},releases:[{id:'claims',sourceId:'dol',program:'weekly-claims',date:'2026-10-29',scheduledAt:'2026-10-29T12:30:00Z'}]};
 for(const entry of getFreshness().entries){const [kind,id]=entry.id.split(':');(kind==='data'?snapshot.sources:snapshot.calendar.sources)[id]={status:'ok',fetchedAt:'2026-10-29T00:00:00Z'};}
 return snapshot;
}
test('workflow planning preserves the complete daily refresh and chooses only due release collectors after daily completion',()=>{
 assert.equal(typeof api.getWorkflowRefreshPlan,'function');
 const at={now:new Date('2026-10-29T12:47:00Z')};
 const targeted=api.getWorkflowRefreshPlan(complete(),at);assert.equal(targeted.kind,'release');assert.equal(targeted.required,true);assert.deepEqual(targeted.sources,['dolAdvance']);
 const forced=api.getWorkflowRefreshPlan(complete(),{...at,force:true});assert.equal(forced.kind,'daily');assert.deepEqual(forced.sources,[]);
 const missing=complete();delete missing.sources.treasury;assert.equal(api.getWorkflowRefreshPlan(missing,at).kind,'daily');
 const quiet=api.getWorkflowRefreshPlan(complete(),{now:new Date('2026-10-29T12:00:00Z')});assert.equal(quiet.required,false);assert.equal(quiet.kind,'none');
});

test('an explicit forced source scope refreshes only admitted selections and never changes automatic planning',()=>{
 const args={now:new Date('2026-10-29T12:47:00Z'),force:true,forceSources:['bls','treasury','fiscal']};
 const result=api.getWorkflowRefreshPlan(complete(),args);
 assert.equal(result.required,true);assert.equal(result.kind,'manual');
 assert.deepEqual(result.sources,['bls','treasury','fiscal']);
 assert.throws(()=>api.getWorkflowRefreshPlan(complete(),{...args,force:false}),/force|manual/i);
 for(const forceSources of [[],['bls','bls'],['vendor'],['bls;echo']])assert.throws(()=>api.getWorkflowRefreshPlan(complete(),{...args,forceSources}),/source|selection/i);
 assert.deepEqual(api.getWorkflowRefreshPlan(complete(),{now:args.now,force:true}).sources,[]);
});
