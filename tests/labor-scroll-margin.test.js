import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const desktop=css.slice(0,css.lastIndexOf('@media(max-width:800px)'));
const value=(selector,property)=>[...desktop.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
 .filter(match=>match[1].trim().split(',').some(part=>part.trim()===selector))
 .flatMap(match=>match[2].split(';'))
 .map(declaration=>declaration.split(':').map(part=>part.trim()))
 .filter(([name])=>name===property).at(-1)?.[1];

test('Labor jump destinations clear the fixed desktop toolbar',()=>{
 assert.equal(value('.brandbar','position'),'fixed');
 const toolbarHeight=parseFloat(value('.brandbar','height'));
 assert.ok(Number.isFinite(toolbarHeight),'the toolbar has a declared fixed height');
 for(const section of ['analysis','weekly','trends','readings','notes']){
  const margin=parseFloat(value(`#labor-${section}`,'scroll-margin-top'));
  assert.ok(margin>=toolbarHeight+8,`labor-${section} leaves space below the ${toolbarHeight}px toolbar`);
 }
});
