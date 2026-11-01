import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parseInflationBea,parseClevelandInflation,inflationDeskCollectors} from '../scripts/sources/inflation-desks.mjs';
import {inflationDeskDefinitions,inflationDeskRegistry,BEA_MONTHLY_URL,BEA_SERIES_URL,BEA_TABLES_URL,CLEVELAND_MEDIAN_URL,CLEVELAND_TRIMMED_URL,CLEVELAND_LICENSE} from '../src/inflation-desk-definitions.js';
import {buildInflationDeskSeries,validateInflationDeskSource} from '../src/inflation-desk-schema.js';
import {assertInflationDeskSources,matchesInflationDeskFeed} from '../scripts/inflation-desks-policy.mjs';
const now=new Date('2026-11-01T18:00:00.000Z');
const receipt=url=>({url,sha256:'a'.repeat(64),retrievedAt:now.toISOString(),lastModified:null});
function source(id,inputs){const d=inflationDeskDefinitions[id];return {id,status:'ok',definitionVersion:1,fetchedAt:now.toISOString(),coverageNote:d.coverageNote,warnings:d.warnings,inputs,series:buildInflationDeskSeries(id,inputs,{cutoff:now.toISOString().slice(0,10)}),provenance:d.feeds.map(receipt)};}
function beaFixture(){
 const series=['%SeriesCode,SeriesLabel,MetricName,CalculationType,DefaultScale,TableId:LineNo,SeriesCodeParents'],tables=['%TableId,TableTitle'],rows=['%SeriesCode,Period,Value'];
 const selected=new Map();for(const d of Object.values(inflationDeskDefinitions).filter(d=>d.id!=='inflationCleveland'))for(const [code,m]of Object.entries(d.native))selected.set(code,m);
 for(const [code,m]of selected){series.push([code,JSON.stringify(m.label),JSON.stringify(m.metric),JSON.stringify(m.calculation),m.scale,m.table+':'+m.line,'NONE'].join(','));if(!tables.some(t=>t.startsWith(m.table+',')))tables.push(m.table+','+JSON.stringify(m.title));
  if(m.metric==='Fisher Price Index'&&m.calculation==='Level')for(let n=1;n<=12;n++)rows.push([code,'2017M'+String(n).padStart(2,'0'),100].join(','));
  for(let n=0;n<14;n++){const date=new Date(Date.UTC(2025,n,1)),period=date.getUTCFullYear()+'M'+String(date.getUTCMonth()+1).padStart(2,'0');let value=m.metric==='Current Dollars'?(code==='DPCERC'?1000:code==='DGDSRC'?300:code==='DSERRC'?700:100):m.metric==='Fisher Price Index'&&m.calculation==='Level'?100+n:m.table==='U90100'?(code==='QPCERV'?0.5:code==='SRSA0V'?0.6:code==='W913RV'?-0.1:0):0.2;rows.push([code,period,value].join(','));}
 }
 return {monthly:rows.join('\n'),series:series.join('\n'),tables:tables.join('\n')};
}
const cleveland=prefix=> 'date ,'+prefix+'_monthly_chg,'+prefix+'_ann_monthly_chg\n'+Array.from({length:14},(_,n)=>{const d=new Date(Date.UTC(2025,n,1));return (d.getUTCMonth()+1)+'/1/'+d.getUTCFullYear()+',0.01,12.7';}).join('\n');
test('BEA exact metadata, published monthly rates, index growth, expenditure shares and wedge signs',()=>{
 const f=beaFixture(),parsed=parseInflationBea(f.monthly,f.series,f.tables,{now});
 const p=source('inflationBea',parsed),w=source('inflationBea',parsed);
 assert.equal(p.series.pceGoodsMonthly.observations.at(-1).value,0.2);
 assert.equal(p.series.pceGoodsWeight.observations.at(-1).value,30);
 assert.ok(Math.abs(p.series.pceGoodsAnnual.observations.at(-1).value-(113/101-1)*100)<1e-10);
 assert.equal(w.series.cpiPceWeightEffect.observations.at(-1).value,-0.1);
 assert.equal(w.series.cpiPcePublishedCpi.observations.at(-1).value,0.6);
 assert.equal(validateInflationDeskSource(p),p);assert.equal(validateInflationDeskSource(w),w);
 assert.throws(()=>parseInflationBea(f.monthly,f.series.replace('Fisher Price Index','Current Dollars'),f.tables,{now}),/metadata/);
 assert.throws(()=>parseInflationBea(f.monthly.replace('DGDSRG,2017M01,100','DGDSRG,2017M01,120'),f.series,f.tables,{now}),/reference year/);
 assert.throws(()=>parseInflationBea(f.monthly+'\nDGDSRG,2026M02,113',f.series,f.tables,{now}),/Duplicate/);
 assert.throws(()=>parseInflationBea(f.monthly.replace('SRSA0V,2026M02,0.6','SRSA0V,2026M02,9'),f.series,f.tables,{now}),/reconciliation/);
});
test('Cleveland monthly fractions, published annualization and compounded annual rates remain distinct',()=>{
 const inputs=parseClevelandInflation(cleveland('mcpi'),cleveland('trim'),{now}),s=source('inflationCleveland',inputs);
 assert.equal(s.series.clevelandMedianCpiMonthly.observations.at(-1).value,1);
 assert.equal(s.series.clevelandMedianCpiAnnualized.observations.at(-1).value,12.7);
 assert.ok(Math.abs(s.series.clevelandMedianCpiAnnual.observations.at(-1).value-(1.01**12-1)*100)<1e-10);
 for(const id of ['clevelandMedianCpiMonthly','clevelandTrimmedCpiMonthly'])for(const date of ['2025-10-01','2025-11-01'])assert.equal(s.series[id].observations.find(r=>r.date===date).imputed,true);
 assert.equal(s.series.clevelandMedianCpiAnnual.observations.at(-1).imputationAffected,true);
 assert.equal(s.series.clevelandMedianCpiMonthly.licenseUrl,CLEVELAND_LICENSE);
 assert.match(s.series.clevelandMedianCpiAnnual.sourceNotice,/Changes:/);
 assert.equal(validateInflationDeskSource(s),s);
 const scientific=parseClevelandInflation(cleveland('mcpi').replaceAll(',0.01,',',1e-2,'),cleveland('trim'),{now});
 assert.equal(source('inflationCleveland',scientific).series.clevelandMedianCpiMonthly.observations.at(-1).value,1);
 assert.throws(()=>parseClevelandInflation(cleveland('mcpi').replace('1/1/2025','2/1/2025'),cleveland('trim'),{now}),/duplicate/i);
 assert.throws(()=>parseClevelandInflation(cleveland('mcpi').replace('mcpi_monthly_chg','haver_cpi'),cleveland('trim'),{now}),/headers/);
});
test('missing exact months remain unavailable and replay rejects changed arithmetic, imputation or rights',()=>{
 const f=beaFixture(),parsed=parseInflationBea(f.monthly,f.series,f.tables,{now}),p=source('inflationBea',parsed);
 const gap=structuredClone(parsed);gap.DGDSRG=gap.DGDSRG.filter(r=>r.date!=='2025-02-01');
 assert.equal(source('inflationBea',gap).series.pceGoodsAnnual.observations.at(-1).value,null);
 for(const mutate of [s=>s.series.pceGoodsWeight.observations.at(-1).value=31,s=>s.series.pceGoodsPriceIndex.unit='Percent',s=>s.series.pceGoodsPriceIndex.source.name='Other',s=>s.series.pceGoodsPriceIndex.sourceIds.push('other'),s=>s.provenance[0].url='https://example.com/feed',s=>s.inputs.DGDSRG.push(s.inputs.DGDSRG.at(-1)),s=>s.unreviewed={}]){
  const bad=structuredClone(p);mutate(bad);assert.throws(()=>validateInflationDeskSource(bad),/Inflation desk/);
 }
 const c=source('inflationCleveland',parseClevelandInflation(cleveland('mcpi'),cleveland('trim'),{now}));c.series.clevelandMedianCpiMonthly.observations.find(r=>r.date==='2025-10-01').imputed=false;
 assert.throws(()=>validateInflationDeskSource(c),/Inflation desk/);
});
test('result mutations cannot modify registry authority; incoherent native rates and shares fail',()=>{
 const f=beaFixture(),parsed=parseInflationBea(f.monthly,f.series,f.tables,{now}),p=source('inflationBea',parsed);
 p.series.pceGoodsPriceIndex.sourceIds.push('other');p.series.pceGoodsPriceIndex.source.name='Other';
 assert.equal(inflationDeskDefinitions.inflationBea.series.pceGoodsPriceIndex.codes.length,1);
 assert.equal(inflationDeskRegistry.pceGoodsPriceIndex.source.name,'U.S. Bureau of Economic Analysis');
 const bad=cleveland('mcpi').replace(',0.01,12.7',',0.01,1.2');
 assert.throws(()=>parseClevelandInflation(bad,cleveland('trim'),{now}),/annualized/);
 const gap=parseClevelandInflation(cleveland('mcpi'),cleveland('trim'),{now});gap.mcpi_monthly_chg=gap.mcpi_monthly_chg.filter(r=>r.date!=='2025-05-01');
 assert.equal(source('inflationCleveland',gap).series.clevelandMedianCpiAnnual.observations.at(-1).value,null);
 assert.throws(()=>buildInflationDeskSeries('inflationBea',parsed,{cutoff:'2026-02-31'}),/cutoff/);
});
test('policy allows only reviewed exact feeds and collectors emit complete replayable sources',async()=>{
 const f=beaFixture(),texts=new Map([[BEA_MONTHLY_URL,f.monthly],[BEA_SERIES_URL,f.series],[BEA_TABLES_URL,f.tables],[CLEVELAND_MEDIAN_URL,cleveland('mcpi')],[CLEVELAND_TRIMMED_URL,cleveland('trim')]]);
 const fetchImpl=async url=>{assert.ok(texts.has(url));const r=new Response(texts.get(url));Object.defineProperty(r,'url',{value:url});return r;};
 const sources={};for(const [id,collector]of Object.entries(inflationDeskCollectors))sources[id]=await collector({fetchImpl,now});
 assert.equal(assertInflationDeskSources(sources),sources);assert.equal(assertInflationDeskSources({old:{},inflationBea:sources.inflationBea},{complete:false}).inflationBea.id,'inflationBea');
 assert.ok(Object.keys(inflationDeskRegistry).length>=30);
 assert.ok(matchesInflationDeskFeed(BEA_MONTHLY_URL,'inflationBea'));assert.ok(!matchesInflationDeskFeed(BEA_MONTHLY_URL+'?x=1','inflationBea'));
 assert.ok(!matchesInflationDeskFeed('https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/mediancpi_chartdata.csv?sc_lang=en','inflationCleveland'));
 const redirected=async url=>{const r=await fetchImpl(url);Object.defineProperty(r,'redirected',{value:true});return r;};
 await assert.rejects(()=>inflationDeskCollectors.inflationCleveland({fetchImpl:redirected,now}),/redirect/);
});
test('saved real source captures replay, retaining exact source lineage',async t=>{
 const path='output/stitch-page-audit-2026-11-01/inflation/candidates.json';let data;try{data=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT'){t.skip('local candidate captures are not checked in');return;}throw e;}
 for(const source of Object.values(data))validateInflationDeskSource(source);
 assertInflationDeskSources(data);
});
test('retained official September 2026 subsets verify actual code mappings and imputation',async()=>{
 const fixture=async name=>readFile(new URL('./fixtures/inflation-desks/'+name,import.meta.url),'utf8');
 const [monthly,series,tables,median,trimmed]=await Promise.all(['bea-monthly.csv','bea-series.csv','bea-tables.csv','cleveland-median.csv','cleveland-trimmed.csv'].map(fixture));
 const bea=source('inflationBea',parseInflationBea(monthly,series,tables,{now}));
 assert.equal(bea.series.pceServicesExEnergyHousingPriceIndex.observations.at(-1).value,135.274);
 assert.equal(bea.series.pceMarketCoreMonthly.observations.at(-1).value,0.3);
 assert.equal(bea.series.cpiPcePublishedCpi.observations.at(-1).value,0.6);
 assert.equal(bea.series.cpiPceFormulaEffect.observations.at(-1).value,-0.03);
 assert.equal(bea.series.cpiPceOtherEffect.observations.at(-1).value,0.01);
 const clevelandSource=source('inflationCleveland',parseClevelandInflation(median,trimmed,{now}));
 assert.equal(clevelandSource.series.clevelandMedianCpiMonthly.observations.at(-1).value,0.231054164373612);
 assert.equal(clevelandSource.series.clevelandMedianCpiAnnual.observations.at(-1).imputationAffected,true);
 assert.equal(clevelandSource.series.clevelandTrimmedCpiMonthly.observations.find(r=>r.date==='2025-11-01').imputed,true);
 validateInflationDeskSource(bea);validateInflationDeskSource(clevelandSource);
 const definitions=(await readFile(new URL('../src/inflation-desk-definitions.js',import.meta.url),'utf8')).replace(/^export /gm,'');
 const schema=(await readFile(new URL('../src/inflation-desk-schema.js',import.meta.url),'utf8')).replace(/^import [^\n]+\n/,'').replace(/^export /gm,'');
 const browserReplay=runInNewContext(definitions+'\n'+schema+`\nconst capture=JSON.parse(captureJson);for(const source of Object.values(capture))validateInflationDeskSource(source);capture.cleveland.series.clevelandMedianCpiAnnual.observations.at(-1).imputationAffected=false;let rejected=false;try{validateInflationDeskSource(capture.cleveland);}catch{rejected=true;}({rejected,nodeGlobals:typeof Buffer+','+typeof process});`,{captureJson:JSON.stringify({bea,cleveland:clevelandSource})},{timeout:2000});
 assert.equal(browserReplay.rejected,true);assert.equal(browserReplay.nodeGlobals,'undefined,undefined');
});
