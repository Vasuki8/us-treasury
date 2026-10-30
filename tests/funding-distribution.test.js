import test from 'node:test';
import assert from 'node:assert/strict';
import {NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_TERMS_URL} from '../src/market-functioning.js';
import {createHash} from 'node:crypto';
import {renderCharts} from '../src/charts.js';
import {marketFunctioningPage,marketFunctioningCsv} from '../src/market-functioning-page.js';
let funding,view;
try {funding=await import('../src/funding-distribution.js');view=await import('../src/funding-distribution-view.js');} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const api=()=>{assert.ok(funding,'Funding distribution model must exist');assert.ok(view,'Funding distribution view must exist');return funding;};
const row=(date,value,percentile1,percentile25,percentile75,percentile99,extra={})=>({date,value,percentile1,percentile25,percentile75,percentile99,...extra});
const source=()=>({status:'ok',fetchedAt:'2026-10-23T00:00:00Z',series:{
 sofr:{observations:[row('2026-01-01',3,-10,2,4,20,{volumeInBillions:2000,revisionIndicator:'Y',sourceValue:'3.00'}),row('2026-02-01',4,1,null,5,8),row('2026-03-01',5,null,3,6,9),row('2026-04-01',null,2,4,6,10)]},
 effr:{observations:[row('2026-02-01',0,0,0,0,0,{volumeInBillions:0,revisionIndicator:''}),row('2026-03-01',1,.5,.8,1.2,1.5)]},
 sofrEffrSpread:{observations:[{date:'2026-02-01',value:400},{date:'2026-03-01',value:400}]},dealerRepo:{observations:[{date:'2026-01-01',value:999}]}
}});
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.listeners={};}
 setAttribute(key,value){this.attributes[key]=String(value);}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(key,handler){this.listeners[key]=handler;}
 set textContent(value){this.children=[String(value)];}
 get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
}
const nodes=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(nodes)];
function rendered(input,range,run,{frozen=false,id='sofr',binding=true,kind='funding-distribution',yDomain}={}){
 const prior=globalThis.document;globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
 try {const container=new Element('div');container.clientWidth=232;container.dataset={series:id,kind,chartCatalog:'funding',range:JSON.stringify(range),...(yDomain?{yDomain:JSON.stringify(yDomain)}:{})};
 renderCharts({querySelectorAll:()=>[container]},{chartCatalogs:binding?{funding:api().fundingChartCatalog(input,{frozen})}:{}});
 run({container,all:nodes(container),key:key=>nodes(container).find(node=>node.tag==='svg').listeners.keydown({key,preventDefault(){}})});
 }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
}
test('funding populations retain exact published endpoints, original flags and their own dates',()=>{
 const input=source(),binding=api().fundingChartCatalog(input),result=funding.fundingDistributionHistory(input,{preset:'all'});
 assert.deepEqual(Object.keys(binding.catalog),['sofr','effr','sofrEffrSpread']);
 assert.deepEqual(result.panels.map(panel=>panel.observations.map(o=>o.date)),[['2026-01-01','2026-02-01','2026-03-01','2026-04-01'],['2026-02-01','2026-03-01']]);
 assert.deepEqual(result.panels[0].observations[0],row('2026-01-01',3,-10,2,4,20,{volumeInBillions:2000,revisionIndicator:'Y',sourceValue:'3.00'}));
 assert.equal(result.panels[1].observations[0].value,0);assert.equal(result.panels[1].observations[0].percentile99,0);
 binding.catalog.sofr.observations[0].value=99;assert.equal(input.series.sofr.observations[0].value,3);
 assert.deepEqual(funding.fundingChartCatalog({series:{}}).catalog.sofr.observations,[]);
});
test('funding shared windows use inclusive exact boundaries and fail closed on invalid dates',()=>{
 api();const input=source(),result=funding.fundingDistributionHistory(input,{preset:'custom',startDate:'2026-02-01',endDate:'2026-03-01'});
 assert.deepEqual(result.panels.map(p=>p.observations.map(o=>o.date)),[['2026-02-01','2026-03-01'],['2026-02-01','2026-03-01']]);
 assert.equal(result.panels[0].window.startDate,'2026-02-01');
 assert.equal(funding.fundingDistributionHistory(input,{preset:'custom',startDate:'bad',endDate:'2026-03-01'}).panels[0].observations.length,0);
});
test('native funding charts scale every endpoint and gap each band independently while keeping the median',()=>{
 rendered(source(),{preset:'all'},({container,all,key})=>{
  const bands=all.filter(node=>node.attributes.class?.includes('funding-band'));
  assert.equal(bands.length,2);const outer=bands.find(node=>node.attributes.class.includes('outer')),inner=bands.find(node=>node.attributes.class.includes('inner'));
  assert.equal((outer.attributes.d.match(/M/g)??[]).length,2);assert.equal((inner.attributes.d.match(/M/g)??[]).length,2);
  assert.equal((all.find(node=>node.attributes.class==='series-line').attributes.d.match(/M/g)??[]).length,1);
  const hit=all.find(node=>node.tag==='rect'&&node.attributes.fill==='transparent'),top=Number(hit.attributes.y),bottom=top+Number(hit.attributes.height);
  for(const band of bands)for(const match of band.attributes.d.matchAll(/[ML][\d.]+ ([\d.]+)/g))assert.ok(Number(match[1])>=top&&Number(match[1])<=bottom,'Every band endpoint fits the chart scale');
  const readout=all.find(node=>node.className==='chart-readout');assert.match(readout.textContent,/Median —/);assert.match(readout.textContent,/p1 2\.00%.*p25 4\.00%.*p75 6\.00%.*p99 10\.00%/);
  key('Home');assert.match(readout.textContent,/1 Jan 2026.*Median 3\.00%.*p1 -10\.00%.*p25 2\.00%.*p75 4\.00%.*p99 20\.00%.*Volume \$2,000B.*Revision flag Y/);
  key('ArrowRight');assert.match(readout.textContent,/1 Feb 2026.*Median 4\.00%.*p25 —/);
  key('End');assert.match(readout.textContent,/1 Apr 2026.*Median —/);
 });
});
test('equal zero bands and volume survive readout and frozen labels stay bound through keyboard interaction',()=>{
 rendered(source(),{preset:'all'},({all,key})=>{key('Home');assert.match(all.find(node=>node.className==='chart-readout').textContent,/Median 0\.00%.*p1 0\.00%.*p25 0\.00%.*p75 0\.00%.*p99 0\.00%.*Volume \$0B/);assert.match(all.find(node=>node.tag==='svg').attributes['aria-label'],/Frozen/);},{id:'effr',frozen:true});
 rendered(source(),{preset:'all'},({container,all})=>{assert.match(container.textContent,/not bound/);assert.equal(all.some(node=>node.tag==='svg'),false);},{binding:false});
 rendered({series:{}},{preset:'all'},({container,all})=>{assert.match(container.textContent,/No observations/);assert.equal(all.some(node=>node.tag==='svg'),false);});
});
test('funding chart calendar axis keeps requested empty extent before retained observations',()=>{
 rendered(source(),{preset:'custom',startDate:'2025-01-01',endDate:'2026-04-01'},({all,key})=>{const labels=all.filter(n=>n.tag==='text').map(n=>n.textContent);assert.ok(labels.includes('1 Jan 2025'));assert.ok(labels.includes('1 Apr 2026'));key('Home');assert.match(all.find(n=>n.className==='chart-readout').textContent,/1 Jan 2026/);});
});
test('live market page shares explicit controls and chart windows while frozen panels have no active controls',()=>{
 api();const input=source(),state={window:'custom',startDate:'2026-02-01',endDate:'2026-03-01'},html=marketFunctioningPage(input,state);
 assert.match(html,/data-window="all"/);assert.equal((html.match(/data-chart-catalog="funding"/g)??[]).length,3);
 assert.equal((html.match(/data-kind="funding-distribution"/g)??[]).length,2);
 assert.match(html,/CSV INDICATORS · FULL RETAINED/i);assert.match(html,/Retained: 4 observations.*2026-01-01.*2026-04-01/);assert.match(html,
  /Displayed: 2 observations.*2026-02-01.*2026-03-01/);
 assert.match(html,/transaction-rate distributions/);assert.match(html,/not confidence intervals/);
 assert.equal((html.match(/data-range="\{&quot;preset&quot;:&quot;custom&quot;,&quot;startDate&quot;:&quot;2026-02-01&quot;,&quot;endDate&quot;:&quot;2026-03-01&quot;\}"/g)??[]).length,3);
 const frozen=view.fundingDistributionPanels(input,{preset:'all'},{frozen:true});assert.match(frozen,/Frozen/);for(const notice of [NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_TERMS_URL])assert.ok(frozen.includes(notice));assert.doesNotMatch(frozen,/data-window|data-range="12"|data-export|<input|<button/);

});

test('specialist full-retained CSV keeps its pre-feature byte contract including zeros, bands, notices and flags',()=>{
 const observation=row('2026-02-01',0,0,0,0,0,{volumeInBillions:0,revisionIndicator:'Y'});
 const input={status:'ok',fetchedAt:'2026-10-23T00:00:00Z',series:{sofr:{observations:[observation]},effr:{observations:[observation]},sofrEffrSpread:{observations:[{date:'2026-02-01',value:0}]}}};
 assert.equal(createHash('sha256').update(marketFunctioningCsv(input)).digest('hex'),'eedee0802af4bf9d13147bdcdfad90effd025620e9819fe8932191be3caf8ab0');
});

test('spread and both funding populations keep the same shared calendar bounds even with earlier final spread data',()=>{
 rendered(source(),{preset:'all'},({all})=>{
  const labels=all.filter(node=>node.tag==='text').map(node=>node.textContent);
  assert.ok(labels.includes('1 Jan 2026'));assert.ok(labels.includes('1 Apr 2026'));
 },{id:'sofrEffrSpread',kind:'line'});
});
test('endpoint clipping by an explicit domain is rejected and bands survive without any finite median',()=>{
 rendered(source(),{preset:'all'},({container,all})=>{assert.match(container.textContent,/must cover every displayed value/);assert.equal(all.some(node=>node.tag==='svg'),false);},{yDomain:[2,6]});
 const input={series:{sofr:{observations:[row('2026-01-01',null,1,2,3,4),row('2026-02-01',null,2,3,4,5)]}}};
 rendered(input,{preset:'all'},({all})=>{assert.equal(all.filter(node=>node.attributes.class?.includes('funding-band')&&node.attributes.d).length,2);assert.match(all.find(node=>node.className==='chart-readout').textContent,/Median —.*p1 2.00%/);});
});

test('historical funding readouts retain raw revision flags and source footnote meanings',()=>{
 const input={series:{effr:{observations:[row('2020-03-02',1.59,1.5,1.58,1.6,1.65,{revisionIndicator:'r',footnoteId:1,footnotes:['Reduced reported volume.']})]}}};
 rendered(input,{preset:'all'},({all,key})=>{key('Home');const readout=all.find(node=>node.className==='chart-readout');assert.match(readout.textContent,/Revision flag r.*Footnote 1.*Reduced reported volume/);},{id:'effr'});
});
