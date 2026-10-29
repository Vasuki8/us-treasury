import test from 'node:test';
import assert from 'node:assert/strict';
const focus=await import('../src/stable-focus.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
import * as router from '../src/router.js';
const destinationChanged=(previous,next)=>{assert.equal(typeof router.destinationChanged,'function');return router.destinationChanged(previous,next);};
function fixture(active, replacements){
 const document={activeElement:active,getElementById:id=>replacements.find(node=>node.id===id),body:{}};
 const root={ownerDocument:document,contains:node=>node===active||replacements.includes(node),querySelectorAll:tag=>replacements.filter(node=>node.tagName===tag)};
 for(const node of replacements)node.focus=()=>{document.activeElement=node;};
 return {root,document};
}
const link=(href,data={})=>({id:'',tagName:'A',dataset:data,getAttribute:name=>name==='href'?href:null});
test('ordinary links restore by href and never by an empty dataset',()=>{
 assert.equal(typeof focus.rememberStableFocus,'function');
 const old=link('#/series/cpi'),unrelated=link('#/overview'),same=link('#/series/cpi');
 const {root,document}=fixture(old,[unrelated,same]);
 const snapshot=focus.rememberStableFocus(root);document.activeElement=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),same);assert.equal(document.activeElement,same);
 const missing=fixture(old,[unrelated]);const gone=focus.rememberStableFocus(missing.root);missing.document.activeElement=missing.document.body;
 assert.equal(focus.restoreStableFocus(missing.root,gone),null);assert.equal(missing.document.activeElement,missing.document.body);
});
test('meaningful data identity and IDs restore controls without stealing another active control',()=>{
 assert.equal(typeof focus.rememberStableFocus,'function');
 const old={id:'',tagName:'BUTTON',dataset:{save:'cpi'}},same={id:'',tagName:'BUTTON',dataset:{save:'cpi'}},other={id:'',tagName:'BUTTON',dataset:{save:'gdp'}};
 const {root,document}=fixture(old,[other,same]);const snapshot=focus.rememberStableFocus(root);document.activeElement=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),same);
 const outside={tagName:'INPUT'};document.activeElement=outside;
 assert.equal(focus.restoreStableFocus(root,snapshot),null);assert.equal(document.activeElement,outside);
 const empty=fixture({id:'',tagName:'BUTTON',dataset:{export:''}},[{id:'',tagName:'BUTTON',dataset:{export:''}}]);
 const emptySnapshot=focus.rememberStableFocus(empty.root);empty.document.activeElement=empty.document.body;
 assert.equal(focus.restoreStableFocus(empty.root,emptySnapshot),null);
});
test('topic and research destinations differ while filtering and indicator tabs stay in place',()=>{
 assert.equal(destinationChanged({page:'macroCoverage',macroFamily:'prices'},{page:'macroCoverage',macroFamily:'housing'}),true);
 assert.equal(destinationChanged({page:'research',researchView:'publications'},{page:'research',researchView:'changes'}),true);
 assert.equal(destinationChanged({page:'research',researchView:'packages',packageId:'one'},{page:'research',researchView:'packages',packageId:'two'}),true);
 assert.equal(destinationChanged({page:'indicator',seriesId:'cpi',tab:'data'},{page:'indicator',seriesId:'cpi',tab:'methodology'}),false);
 assert.equal(destinationChanged({page:'explore',query:'CPI',selected:['cpi']},{page:'explore',query:'CPI inflation',selected:['cpi','gdp']}),false);
});


test('a focused native disclosure summary restores through its remembered disclosure identity',()=>{
 const old={id:'',tagName:'SUMMARY',dataset:{},parentElement:{dataset:{pageDisclosure:'calendar:filters'}}};
 let active=old;const next={focus(){active=next;}};
 const document={get activeElement(){return active;},body:{},getElementById:()=>null};
 const root={ownerDocument:document,contains:node=>node===old,querySelectorAll:selector=>selector.startsWith('details')?[{dataset:{pageDisclosure:'calendar:filters'},querySelector:()=>next}]:[]};
 const snapshot=focus.rememberStableFocus(root);active=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),next);assert.equal(active,next);
});

test('a control inside an interactive disclosure restores within that disclosure when another control has the same action',()=>{
 const disclosure={dataset:{pageDisclosure:'calendar:event:cpi:related'}};
 const old={id:'',tagName:'BUTTON',dataset:{save:'cpi'},closest:()=>disclosure};let active=old;
 const next={id:'',tagName:'BUTTON',dataset:{save:'cpi'},focus(){active=next;}},other={id:'',tagName:'BUTTON',dataset:{save:'cpi'},focus(){active=other;}};
 const detail={dataset:disclosure.dataset,querySelectorAll:()=>[next]};
 const document={get activeElement(){return active;},body:{},getElementById:()=>null};
 const root={ownerDocument:document,contains:node=>node===old,querySelectorAll:selector=>selector.startsWith('details')?[detail]:[other,next]};
 const snapshot=focus.rememberStableFocus(root);active=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),next);assert.equal(active,next);
});

const readingLink=(href,text,disclosure='')=>Object.assign(link(href),{textContent:text,closest:()=>disclosure?{dataset:{pageDisclosure:disclosure}}:null});

test('actual density redraw preserves the reading opener among repeated href links',async()=>{
 const {readFile}=await import('node:fs/promises'),app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const start=app.indexOf("if(target.id==='density-select'||target.id==='density-select-mobile')"),end=app.indexOf('  const fields=',start);assert.ok(start>=0&&end>start);
 const href='#/series/cpiMonthly',old=readingLink(href,'0.6%'),reading=readingLink(href,'0.6%'),first=readingLink(href,'DETAILS & DATA TABLE');
 const {root,document}=fixture(old,[first,readingLink(href,'DETAILS & DATA TABLE'),readingLink(href,'4.3%'),reading]),state={density:'compact'};
 const render=options=>{assert.equal(options.preserveFocus,true);const snapshot=focus.rememberStableFocus(root);document.activeElement=document.body;focus.restoreStableFocus(root,snapshot);};
 new Function('target','state','persist','render','announce',app.slice(start,end))({id:'density-select',value:'comfortable'},state,()=>true,render,()=>{});
 assert.equal(state.density,'comfortable');assert.equal(document.activeElement,reading);
});

test('async archive redraw restores repeated-href reading identity and exact scroll',async()=>{
 const {preserveHistoryView}=await import('../src/history-controller.js');
 const href='#/series/cpiMonthly',old=readingLink(href,'  0.6% \n '),reading=readingLink(href,'0.6%');
 const {root,document}=fixture(old,[readingLink(href,'DETAILS & DATA TABLE'),reading,readingLink(href,'DETAILS & DATA TABLE'),readingLink(href,'4.3%')]);
 const window={scrollX:0,scrollY:895.33,scrollTo(value){this.restored=value;}};
 preserveHistoryView(root,()=>{document.activeElement=document.body;},{window,document});
 assert.equal(document.activeElement,reading);assert.deepEqual(window.restored,{left:0,top:895.33,behavior:'instant'});
});

test('same-text repeated links use disclosure identity and never steal newly chosen focus',()=>{
 const href='#/series/cpiMonthly',old=readingLink(href,'0.6%','inflation:primary'),other=readingLink(href,'0.6%','inflation:secondary'),same=readingLink(href,'0.6%','inflation:primary');
 const {root,document}=fixture(old,[other,same]);const snapshot=focus.rememberStableFocus(root);document.activeElement=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),same);
 const outside={tagName:'SELECT'};document.activeElement=outside;assert.equal(focus.restoreStableFocus(root,snapshot),null);assert.equal(document.activeElement,outside);
});

test('ambiguous repeated link text remains unfocused while legacy unique href snapshots remain usable',()=>{
 const href='#/series/cpiMonthly',old=readingLink(href,'0.6%');
 const ambiguous=fixture(old,[readingLink(href,'0.6%'),readingLink(href,'0.6%')]);const snapshot=focus.rememberStableFocus(ambiguous.root);ambiguous.document.activeElement=ambiguous.document.body;
 assert.equal(focus.restoreStableFocus(ambiguous.root,snapshot),null);
 const same=readingLink(href,'Current value'),unique=fixture(old,[same]);unique.document.activeElement=unique.document.body;
 assert.equal(focus.restoreStableFocus(unique.root,{node:old,tag:'A',href,data:{}}),same);
});

test('anchor ID remains preferred when readable text and destination parameters update',()=>{
 const old=Object.assign(readingLink('#/series/cpiMonthly?window=1y','0.6%'),{id:'stable-reading'}),same=Object.assign(readingLink('#/series/cpiMonthly?window=3y','0.7%'),{id:'stable-reading'});
 const {root,document}=fixture(old,[same]);const snapshot=focus.rememberStableFocus(root);document.activeElement=document.body;
 assert.equal(focus.restoreStableFocus(root,snapshot),same);
});
