import test from 'node:test';
import assert from 'node:assert/strict';
import * as charts from '../src/charts.js';
import {series} from '../src/data.js';
class Element{
 constructor(tag,document){this.tag=tag;this.ownerDocument=document;this.attributes={};this.children=[];this.listeners={};this.dataset={};}
 setAttribute(name,value){this.attributes[name]=String(value);}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){if(this.children.some(child=>nodes(child).includes(this.ownerDocument.activeElement)))this.ownerDocument.activeElement=this.ownerDocument.body;this.children=children;}
 addEventListener(name,listener){this.listeners[name]=listener;}
 focus(){this.ownerDocument.activeElement=this;}
 set textContent(value){this.children=[String(value)];}
 get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
}
const nodes=node=>typeof node==='string'?[]:[node,...node.children.flatMap(nodes)];
function fixture(run){
 const original=globalThis.document,document={body:{},activeElement:null};
 document.createElement=tag=>new Element(tag,document);document.createElementNS=(_ns,tag)=>new Element(tag,document);globalThis.document=document;
 const make=()=>{const container=new Element('div',document);container.clientWidth=375;container.dataset={series:'cpi',range:'{"preset":"all"}'};return container;};
 let containers=[make()];const root={querySelectorAll:()=>containers};
 const catalog={cpi:{...series.cpi,observations:[{date:'2026-01-01',value:1},{date:'2026-02-01',value:2},{date:'2026-03-01',value:3}]}};
 const options={catalog},svg=()=>nodes(containers[0]).find(node=>node.tag==='svg'),readout=()=>nodes(containers[0]).find(node=>node.className?.startsWith('chart-readout')).textContent;
 const key=value=>svg().listeners.keydown({key:value,preventDefault(){}});
 try{charts.renderCharts(root,options);run({root,document,catalog,options,svg,readout,key,replace:()=>{containers=[make()];},resize:()=>{containers[0].clientWidth=768;charts.renderCharts(root,options);}});}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

test('resize retains focused chart and inspected date when observations are inserted before it',()=>fixture(({document,catalog,svg,readout,key,resize})=>{
 svg().focus();key('Home');key('ArrowRight');assert.match(readout(),/^Feb 2026/);
 catalog.cpi.observations.unshift({date:'2025-12-01',value:0});resize();
 assert.equal(document.activeElement,svg());assert.match(readout(),/^Feb 2026/);
 key('ArrowLeft');assert.match(readout(),/^Jan 2026/);key('Home');assert.match(readout(),/^Dec 2025/);key('End');assert.match(readout(),/^Mar 2026/);
}));

test('replaced DOM restores chart identity and date while an unavailable date falls back to latest visible',()=>fixture(({root,document,catalog,options,svg,readout,key,replace})=>{
 assert.equal(typeof charts.captureChartInspection,'function');
 svg().focus();key('Home');key('ArrowRight');const inspection=charts.captureChartInspection(root);replace();document.activeElement=document.body;
 charts.renderCharts(root,{...options,inspection});assert.equal(document.activeElement,svg());assert.match(readout(),/^Feb 2026/);
 catalog.cpi.observations=catalog.cpi.observations.filter(row=>row.date!=='2026-02-01');charts.renderCharts(root,options);assert.match(readout(),/^Mar 2026/);
}));

test('background redraw never takes focus from another control',()=>fixture(({document,svg,key,resize})=>{
 svg().focus();key('Home');const outside={tag:'input'};document.activeElement=outside;resize();assert.equal(document.activeElement,outside);
}));
