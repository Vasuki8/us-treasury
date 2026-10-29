import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute} from '../src/router.js';
import {createWorkspaceMemory} from '../src/workspace-context.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const captureStart=source.indexOf('function rememberWorkspace(){'),captureEnd=source.indexOf('function downloadCsv(',captureStart);
const returnStart=source.indexOf('    const position=workspaceMemory.recall(state);'),returnEnd=source.indexOf('  } else restoreFocus(focus);',returnStart);
assert.ok(captureStart>=0&&captureEnd>captureStart&&returnStart>=0&&returnEnd>returnStart,'Extract the actual workspace capture and return restoration.');
const capture=new Function('document','main','window','workspaceMemory','state',source.slice(captureStart,captureEnd)+';rememberWorkspace();');
const restore=new Function('main','window','workspaceMemory','state',source.slice(returnStart,returnEnd));
const href='#/series/cpiMonthly?return=%23%2Feconomy%3Ffamily%3Dprices';
function fixture(specs,selected=1){
 const state=parseRoute('#/economy?family=prices'),memory=createWorkspaceMemory(),heading={tagName:'H1'},document={activeElement:null};
 const make=spec=>({tagName:'A',id:spec.id??'',textContent:spec.text,dataset:{},getAttribute:()=>spec.href??href,closest:()=>spec.disclosure?{dataset:{pageDisclosure:spec.disclosure}}:null,focus(){document.activeElement=this;}});
 let links=specs.map(make);document.activeElement=links[selected];
 const main={contains:node=>links.includes(node),querySelectorAll:()=>links};
 const window={scrollX:0,scrollY:895.33,scrollTo(position){this.restored=position;}};
 return{state,memory,document,heading,window,capture:()=>capture(document,main,window,memory,state),returnTo:next=>{links=next.map(make);document.activeElement=heading;restore(main,window,memory,state);return links;}};
}

test('actual contextual return restores the lower reading among four same-href links after reordering',()=>{
 const f=fixture([{text:'DETAILS & DATA TABLE'},{text:'0.6%'},{text:'DETAILS & DATA TABLE'},{text:'4.3%'}]);
 f.capture();const links=f.returnTo([{text:'DETAILS & DATA TABLE'},{text:'4.3%'},{text:'DETAILS & DATA TABLE'},{text:'0.6%'}]);
 assert.equal(f.document.activeElement,links[3]);assert.equal(f.document.activeElement.textContent,'0.6%');
 assert.deepEqual(f.window.restored,{left:0,top:895.33,behavior:'instant'});
 const position=f.memory.recall(f.state);assert.equal(position.focusHref,href);assert.ok(position.focusIdentity);assert.equal(Object.hasOwn(position.focusIdentity,'node'),false);
});

test('actual contextual return distinguishes same-text links using their disclosure context',()=>{
 const f=fixture([{text:'0.6%'},{text:'0.6%',disclosure:'inflation:secondary'},{text:'0.6%',disclosure:'inflation:primary'}],2);
 f.capture();const links=f.returnTo([{text:'0.6%'},{text:'0.6%',disclosure:'inflation:primary'},{text:'0.6%',disclosure:'inflation:secondary'}]);
 assert.equal(f.document.activeElement,links[1]);
});

test('actual contextual return prefers the unique stable ID when readable link text changes',()=>{
 const f=fixture([{text:'Details'},{text:'0.6%',id:'focused-reading'}]);f.capture();
 const links=f.returnTo([{text:'Updated details'},{text:'0.7%',id:'focused-reading'}]);
 assert.equal(f.document.activeElement,links[1]);
});

test('ambiguous or missing remembered link identity retains destination-heading focus and scroll',()=>{
 const f=fixture([{text:'Details'},{text:'0.6%'}]);f.capture();
 f.returnTo([{text:'0.6%'},{text:'0.6%'}]);assert.equal(f.document.activeElement,f.heading);
 f.returnTo([{text:'Details'},{text:'Different reading'}]);assert.equal(f.document.activeElement,f.heading);
 assert.equal(f.window.restored.top,895.33);
});

test('legacy unique focusHref positions remain usable without a new identity field',()=>{
 const f=fixture([{text:'Details'},{text:'0.6%'}]);
 f.memory.remember(f.state,{left:0,top:895.33,focusHref:href});
 const links=f.returnTo([{text:'0.6%'},{text:'Other destination',href:'#/overview'}]);
 assert.equal(f.document.activeElement,links[0]);
});

test('legacy duplicate href positions use heading fallback rather than the first unrelated opener',()=>{
 const f=fixture([{text:'Details'},{text:'0.6%'}]);
 f.memory.remember(f.state,{left:0,top:895.33,focusHref:href});
 f.returnTo([{text:'Details'},{text:'0.6%'}]);assert.equal(f.document.activeElement,f.heading);
});
