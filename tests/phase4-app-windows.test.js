import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as router from '../src/router.js';
import {getSeries} from '../src/model.js';
import {updateWorkspaceSelection} from '../src/workspace-context.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
function app(hash,initial={}){
 const start=source.indexOf('function navigate('),end=source.indexOf("window.addEventListener('hashchange'",start);
 const click=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(source);
 const change=/window\.addEventListener\('hashchange',\(\)=>\{([^]*?)\n\}\);/.exec(source);
 assert.ok(start>=0&&end>start&&click&&change);
 const location={hash},env={...router,getSeries,updateWorkspaceSelection,location,state:{...router.parseRoute(hash),...initial},
  saveDrafts:{capture(){}},questionDrafts:{capture(){}},main:{contains:()=>false},document:{activeElement:null},
  history:{pushState:(_state,_title,route)=>{location.hash=route;},replaceState:(_state,_title,route)=>{location.hash=route;}},
  render(){},rememberWorkspace(){},announce(){}};
 const code=`let {${Object.keys(env).join(',')}}=env;${source.slice(start,end)};`
  +`return {navigate,state:()=>state,click:async event=>{${click[1]}},hashchange:()=>{${change[1]}}};`;
 const handlers=new Function('env',code)(env);
 return {...handlers,location,compare:ids=>handlers.click({target:{closest:()=>({disabled:false,dataset:{compare:ids}})}})};
}

test('actual comparison buttons and generic navigation use destination frequency from automatic module origins',async()=>{
 for(const [ids,window] of [['pceMonthly,pceCoreMonthly','5y'],['payroll,unrate','5y'],['yield,sofr','1y']]){
  const view=app('#/overview');await view.compare(ids);assert.equal(view.state().window,window);
  assert.equal(router.parseRoute(view.location.hash).window,window);
 }
 const view=app('#/overview');view.navigate({page:'indicator',seriesId:'gdp'});assert.equal(view.state().window,'5y');
 for(const page of ['fiscal','refinancing','auctions','ownership','macro','credit','calendar']){
  const origin=app('#/'+page);await origin.compare('receiptsTtm,outlaysTtm');assert.equal(origin.state().window,'5y',page);
 }
});

test('actual bare hash navigation resolves the window after retaining the real selection',()=>{
 for(const [selected,window] of [[['yield'],'1y'],[['gdp'],'5y'],[['yield','gdp'],'1y'],[['gdp','yield'],'5y']]){
  const view=app('#/series/yield',{selected});view.location.hash='#/explore';view.hashchange();
  assert.deepEqual(view.state().selected,selected);assert.equal(view.state().window,window);
 }
});

test('actual app transitions preserve explicit origin, saved-view and controlled module windows',async()=>{
 const requests=['window=1y','window=custom&start=2024-01-01&end=2025-01-01','range=6'];
 for(const request of requests){
  const view=app('#/overview?'+request),expected=router.parseRoute(view.location.hash);
  await view.compare('pceMonthly,pceCoreMonthly');
  for(const key of ['window','range','startDate','endDate'])assert.equal(view.state()[key],expected[key]);
  view.location.hash='#/explore?'+request;view.hashchange();assert.equal(view.state().window,expected.window);
 }
 const saved=app('#/overview');saved.navigate({page:'indicator',seriesId:'gdp',window:'1y'});
 assert.equal(saved.state().window,'1y');
 for(const hash of ['#/economy/labor?window=1y','#/market?window=custom&start=2024-01-01&end=2025-01-01']){
  const view=app(hash),expected=router.parseRoute(hash);await view.compare('gdp,unrate');
  for(const key of ['window','startDate','endDate'])assert.equal(view.state()[key],expected[key]);
 }
});
