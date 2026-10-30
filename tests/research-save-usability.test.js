import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/research-save.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const catalog=Object.fromEntries(Array.from({length:145},(_,index)=>['m'+index,{id:'m'+index,name:'Measurement '+index,unit:'Percent',source:{name:'Official source'}}]));

test('full-inventory Save View and Freeze actions precede bounded searchable candidates',()=>{
 assert.equal(typeof api.renderResearchSave,'function');
 const html=api.renderResearchSave({scope:'coverage',draft:{name:'My view',selected:['m0','m1','m2','m3'],query:''},catalog,candidates:Object.keys(catalog)});
 assert.ok(html.indexOf('data-save-workspace')<html.indexOf('data-freeze-select'));assert.ok(html.indexOf('data-pin-result')<html.indexOf('data-freeze-select'));
 assert.equal((html.match(/data-freeze-select=/g)||[]).length,145);assert.match(html,/data-freeze-query/);assert.match(html,/4 of 4 selected/);assert.match(html,/research-save-options/);
 const labels=new Map([...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)]
  .map(([,attributes,label])=>[attributes.match(/id="([^"]+)"/)?.[1],label]));
 assert.equal(labels.get('research-save-view'),'Save view');assert.equal(labels.get('research-freeze-result'),'Save snapshot');
 assert.ok(html.includes('keeps a reusable configuration'));assert.ok(html.includes('preserves observations and supporting evidence'));
});

test('search hides candidate rows without changing checked membership or draft fields',()=>{
 assert.equal(typeof api.createResearchSaveDrafts,'function');
 const store=api.createResearchSaveDrafts(),draft=store.get('coverage',{name:'Unsaved name',selected:['m0','m1']});store.update('coverage',{query:'Measurement 144'});
 const html=api.renderResearchSave({scope:'coverage',draft:store.get('coverage'),catalog,candidates:Object.keys(catalog)});
 assert.deepEqual(store.get('coverage').selected,['m0','m1']);assert.equal(store.get('coverage').name,'Unsaved name');assert.match(html,/data-freeze-candidate="m0" hidden/);assert.match(html,/data-freeze-select="m0" checked/);assert.match(html,/1 of 145 shown/);
 const controls={'#research-name':{value:'Edited before rerender'},'[data-freeze-query]':{value:'Percent'},'.freeze-preview':{}};
 const panel={dataset:{saveScope:'coverage'},open:true,querySelector:selector=>controls[selector],querySelectorAll:()=>[{dataset:{freezeSelect:'m1'}}]};
 store.capture({querySelector:()=>panel});assert.equal(store.get('coverage').name,'Edited before rerender');assert.equal(store.get('coverage').query,'Percent');assert.deepEqual(store.get('coverage').selected,['m1']);assert.equal(store.get('coverage').open,true);
});

test('the Save panel position fits a narrow and zoom-sized viewport',()=>{
 assert.equal(typeof api.researchSavePosition,'function');
 for(const viewport of [{width:375,height:812},{width:320,height:400},{width:1280,height:720}]){
  const value=api.researchSavePosition({anchor:{left:280,right:360,top:220,bottom:250},viewport,width:460});
  assert.ok(value.left>=12);assert.ok(value.top>=12);assert.ok(value.width<=viewport.width-24);assert.ok(value.top+value.maxHeight<=viewport.height-12);
  if(viewport.width<=600)assert.equal(value.top,12,'Phone Save uses available height so candidates remain reachable alongside the actions.');
 }
});

test('Escape dismisses Save and restores its trigger; outside dismissal preserves the clicked control',()=>{
 assert.equal(typeof api.installResearchSaveDismissal,'function');
 const handlers={},trigger={focused:0,focus(){this.focused++;}},inside={},outside={},panel={open:true,contains:target=>target===inside,querySelector:()=>trigger};
 const root={querySelector:()=>panel},document={addEventListener:(event,callback)=>{handlers[event]=callback;}};let captures=0;
 api.installResearchSaveDismissal(root,document,{capture:()=>captures++});
 handlers.keydown({key:'Escape',preventDefault(){}});assert.equal(panel.open,false);assert.equal(trigger.focused,1);assert.equal(captures,1);
 panel.open=true;handlers.pointerdown({target:inside});assert.equal(panel.open,true);handlers.pointerdown({target:outside});assert.equal(panel.open,false);assert.equal(trigger.focused,1);assert.equal(captures,2);
});


test('a changed view keeps out-of-scope draft selections visible and blocks Freeze until explicitly resolved',()=>{
 const html=api.renderResearchSave({scope:'compare',draft:{name:'My comparison',selected:['m1'],query:''},catalog,candidates:['m2']});
 assert.match(html,/data-freeze-candidate="m1"/);assert.match(html,/data-freeze-select="m1" checked/);assert.match(html,/outside the current view/);assert.match(html,/data-pin-result disabled/);
});

test('empty candidate-based selection blocks Freeze while Save View remains available',()=>{
 const html=api.renderResearchSave({scope:'compare',draft:{name:'Empty setup',selected:[],query:''},catalog,candidates:['m2']});
 assert.match(html,/data-pin-result disabled/);assert.doesNotMatch(html,/data-save-workspace disabled/);
});
