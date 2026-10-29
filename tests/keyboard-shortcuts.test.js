import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const start=source.indexOf("document.addEventListener('keydown',event=>{");
const end=source.indexOf('\n});',start);
assert.ok(start>=0&&end>start,'The app keydown listener must be registered.');

function keyboard(){
  let handler,focusCount=0;
  const navigations=[];
  const document={
    addEventListener:(type,listener)=>{assert.equal(type,'keydown');handler=listener;},
    getElementById:id=>{assert.equal(id,'command-input');return {focus:()=>focusCount++};},
  };
  new Function('document','navigate',source.slice(start,end+4))(document,route=>navigations.push(route));
  return {
    navigations,focusCount:()=>focusCount,
    press(key,values={}){
      const event={
        key,ctrlKey:false,metaKey:false,defaultPrevented:false,
        target:{matches:()=>false,closest:()=>null},
        preventDefault(){this.defaultPrevented=true;},...values,
      };
      handler(event);
      return event;
    },
  };
}

test('F1 through F5 retain browser defaults and never navigate from ordinary or editable targets',()=>{
  const app=keyboard();
  for(const editable of [false,true]){
    for(const key of ['F1','F2','F3','F4','F5']){
      const event=app.press(key,{target:{matches:()=>editable,closest:()=>null}});
      assert.equal(event.defaultPrevented,false,`${key} must retain its browser default.`);
      assert.deepEqual(app.navigations,[]);
    }
  }
});

test('Ctrl K and Command K still focus command search without navigating',()=>{
  const app=keyboard();
  for(const modifier of ['ctrlKey','metaKey']){
    for(const key of ['k','K']){
      assert.equal(app.press(key,{[modifier]:true}).defaultPrevented,true);
    }
  }
  assert.equal(app.focusCount(),4);
  assert.deepEqual(app.navigations,[]);
  assert.equal(app.press('k').defaultPrevented,false);
  assert.equal(app.focusCount(),4);
});

test('navigation links do not advertise reserved browser function keys',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const links=[...html.matchAll(/<a\b([^>]*)>/g)];
  assert.ok(links.length>0);
  for(const [,attributes] of links){
    const shortcut=/\baria-keyshortcuts="([^"]*)"/.exec(attributes)?.[1]??'';
    assert.equal(shortcut.split(/\s+/).some(key=>/^F[1-5]$/.test(key)),false);
  }
});
