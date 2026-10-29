import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,destinationChanged} from '../src/router.js';
import {rememberStableFocus,restoreStableFocus} from '../src/stable-focus.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const start=source.indexOf("window.addEventListener('hashchange',()=>{"),end=source.indexOf('\nfunction save(id)',start);
assert.ok(start>=0&&end>start,'Extract the actual browser-history handler.');

function fixture(hash='#/series/cpi?window=3y'){
 const document={body:{tagName:'BODY'},documentElement:{tagName:'HTML'},activeElement:null};
 const heading={tagName:'H1',focus(){document.activeElement=this;}};
 const specs=[{dataset:{window:'1y'}},{dataset:{window:'3y'}},{id:'detail-tab-data',dataset:{tab:'data'}},{id:'detail-tab-methodology',dataset:{tab:'methodology'}},{id:'window-start',tagName:'INPUT',dataset:{}}];
 const makeControls=()=>specs.map(spec=>({tagName:spec.tagName??'BUTTON',id:spec.id??'',dataset:{...spec.dataset},matches(selector){return selector==='[role="tab"][data-tab]'&&'tab' in this.dataset;},focus(){document.activeElement=this;}}));
 let controls=makeControls();
 const main={ownerDocument:document,contains:node=>node===heading||controls.includes(node),querySelectorAll:selector=>controls.filter(node=>node.tagName===selector),focus(){document.activeElement=main;}};
 document.getElementById=id=>controls.find(node=>node.id===id);
 const calls=[],remembered=[],location={hash};let handler,api;
 const render=options=>{
  calls.push(options);
  const snapshot=options.preserveFocus?rememberStableFocus(main,{document}):null;
  if(main.contains(document.activeElement))document.activeElement=document.body;
  controls=makeControls();
  if(options.focusHeading)heading.focus();else restoreStableFocus(main,snapshot,{document});
 };
 const env={document,state:{...parseRoute(hash),saved:[]},location,parseRoute,destinationChanged,main,render,window:{addEventListener(name,callback){assert.equal(name,'hashchange');handler=callback;}},rememberWorkspace(){remembered.push({...api.state()});}};
 api=new Function('env',`let {state,location,parseRoute,destinationChanged,main,render,window,rememberWorkspace,document}=env;${source.slice(start,end)};return{state:()=>state};`)(env);
 return{document,heading,main,calls,remembered,state:api.state,control:identity=>controls.find(node=>node.id===identity||node.dataset.window===identity),go:hash=>{location.hash=hash;handler();}};
}

test('actual Back and Forward within an indicator preserve the current range-control identity',()=>{
 const f=fixture();f.control('3y').focus();
 f.go('#/series/cpi?window=1y');
 assert.equal(f.state().window,'1y');assert.equal(f.document.activeElement,f.control('3y'));
 assert.equal(f.calls.at(-1).focusHeading,false);assert.equal(f.remembered.length,0);
 f.go('#/series/cpi?window=3y');
 assert.equal(f.state().window,'3y');assert.equal(f.document.activeElement,f.control('3y'));
});

test('actual in-place detail-tab history focuses the newly active tab and preserves exact custom dates',()=>{
 const range='window=custom&start=2025-01-01&end=2026-09-01';
 const f=fixture('#/series/cpi?tab=methodology&'+range);f.control('detail-tab-methodology').focus();
 f.go('#/series/cpi?tab=data&'+range);
 assert.equal(f.state().tab,'data');assert.equal(f.state().startDate,'2025-01-01');assert.equal(f.state().endDate,'2026-09-01');
 assert.equal(f.document.activeElement,f.control('detail-tab-data'));assert.equal(f.remembered.length,0);
 f.go('#/series/cpi?tab=methodology&'+range);
 assert.equal(f.state().tab,'methodology');assert.equal(f.document.activeElement,f.control('detail-tab-methodology'));
 assert.equal(f.state().startDate,'2025-01-01');assert.equal(f.state().endDate,'2026-09-01');
});

test('actual cross-destination history still remembers the departing view and focuses its destination',()=>{
 const origin='#/series/cpi?tab=methodology&window=custom&start=2025-01-01&end=2026-09-01',f=fixture(origin);
 f.control('detail-tab-methodology').focus();
 f.go('#/release?publicationSeries=cpi&period=2026-09-01&return='+encodeURIComponent(origin));
 assert.equal(f.remembered.length,1);assert.equal(f.remembered[0].page,'indicator');assert.equal(f.remembered[0].tab,'methodology');
 assert.equal(f.state().page,'release');assert.equal(f.state().returnTo,origin);assert.equal(f.calls.at(-1).focusHeading,true);assert.equal(f.document.activeElement,f.heading);
});

test('actual in-place history never takes focus from a control outside the replaced content',()=>{
 const f=fixture(),outside={tagName:'SELECT',id:'density-select-mobile'};f.document.activeElement=outside;
 f.go('#/series/cpi?window=1y');
 assert.equal(f.document.activeElement,outside);assert.equal(f.remembered.length,0);
});

test('actual skip-link hash retains its direct main-focus behavior without a redraw',()=>{
 const f=fixture();f.go('#main-content');
 assert.equal(f.document.activeElement,f.main);assert.equal(f.calls.length,0);assert.equal(f.remembered.length,0);
});


test('tab history preserves a focused date input instead of moving it to the active tab',()=>{
 const f=fixture('#/series/cpi?tab=methodology');f.control('window-start').focus();
 f.go('#/series/cpi?tab=data');
 assert.equal(f.state().tab,'data');assert.equal(f.document.activeElement,f.control('window-start'));
});

test('tab history does not move focus from a control outside the indicator',()=>{
 const f=fixture('#/series/cpi?tab=methodology'),outside={tagName:'SELECT',id:'density-select-mobile'};f.document.activeElement=outside;
 f.go('#/series/cpi?tab=data');
 assert.equal(f.state().tab,'data');assert.equal(f.document.activeElement,outside);
});

test('moving to a different indicator keeps destination-heading focus despite the previously focused tab',()=>{
 const f=fixture('#/series/cpi?tab=methodology');f.control('detail-tab-methodology').focus();
 f.go('#/series/gdp?tab=data');
 assert.equal(f.state().seriesId,'gdp');assert.equal(f.document.activeElement,f.heading);assert.equal(f.remembered.length,1);
});
