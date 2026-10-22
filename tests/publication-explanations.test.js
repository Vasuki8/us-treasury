import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanationScope,explanationMetadataFor,assertPublicationExplanations} from '../scripts/publication-explanation-policy.mjs';
import {parsePublicationExplanationPage,collectPublicationExplanations} from '../scripts/sources/publication-explanations.mjs';

const ids=()=>publicationExplanationScope.map(row=>row.publicationId);
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function page(url){
 const scopes=publicationExplanationScope.filter(row=>row.sourceUrl===url),first=scopes[0];
 const sections=new Map();
 for(const scope of scopes){if(scope.sectionHeading===null)continue;const texts=sections.get(scope.sectionHeading)||[];sections.set(scope.sectionHeading,[...texts,...scope.sectionPassages]);}
 const paragraphs=[...new Set(scopes.flatMap(row=>[...row.sourcePassages,...(row.sectionHeading===null?row.sectionPassages:[])]))];
 return '<!doctype html><html><body><article about="'+new URL(url).pathname+'"><h1>News Release</h1><div class="field field--name-field-release-date field--item">'+escape(first.releaseDateText)+'</div><h1>'+escape(first.sourceTitle)+'</h1>'+paragraphs.map(text=>'<p>'+escape(text)+'</p>').join('')+[...sections].map(([heading,texts])=>'<h2>'+escape(heading)+'</h2>'+[...new Set(texts)].map(text=>'<p>'+escape(text)+'</p>').join('')).join('')+'</article></body></html>';
}
function provenance(url,html=page(url)){
 return {url,sha256:createHash('sha256').update(html).digest('hex'),retrievedAt:'2026-10-22T19:00:00.000Z',lastModified:null};
}
const fixture=selected=>({version:1,explanations:publicationExplanationScope.filter(row=>selected===undefined||selected.includes(row.publicationId)).map(scope=>({...explanationMetadataFor(scope),provenance:[provenance(scope.sourceUrl)]}))});

test('thirty exact explanations join retained GDP identities and source-reported prior estimates',()=>{
 assert.equal(publicationExplanationScope.length,30);assert.equal(new Set(ids()).size,30);
 const byId=new Map(publicationArchive.releases.map(row=>[row.id,row]));
 for(const scope of publicationExplanationScope){
  const release=byId.get(scope.publicationId);assert.ok(release);
  for(const key of ['period','estimate','publicationDate','sourceValue'])assert.equal(scope[key],release[key]);
  const earlier=publicationArchive.releases.filter(row=>row.period===scope.period&&row.publicationDate<scope.publicationDate).sort((a,b)=>b.publicationDate.localeCompare(a.publicationDate))[0];
  assert.equal(scope.previousValue,earlier?.sourceValue??null);
  assert.equal(scope.kind,scope.previousValue===null?'first-publication':scope.estimate==='Revised'?'annual-update':'revision');
 }
 const rounded=publicationExplanationScope.find(row=>row.publicationId==='bea-gdp-2026q2-second-2026-08-26');
 assert.equal(rounded.sourceValue,rounded.previousValue);assert.equal(rounded.kind,'revision');assert.match(rounded.summary,/less than 0\.1/);
 assert.equal(publicationExplanationScope.filter(row=>row.annualUpdate).length,2);
 assert.ok(publicationExplanationScope.filter(row=>row.annualUpdate).every(row=>row.sourceUrl.endsWith('personal-income-2nd')));
 assertPublicationExplanations(fixture(),{complete:true});
});

test('admission requires exact reviewed prose, identity, source, rights and bounded provenance',()=>{
 const original=fixture(),before=JSON.stringify(original);assert.equal(assertPublicationExplanations({version:1,explanations:[]}),true);
 for(const mutate of [
  data=>{data.extra=true;},data=>{data.explanations[0].extra=true;},
  data=>{data.explanations[0].summary+=' invented cause';},data=>{data.explanations[0].details.push('invented detail');},
  data=>{data.explanations[0].period='2025-01-01';},data=>{data.explanations[0].kind='no-revision';},
  data=>{data.explanations[0].sourceValue='99';},data=>{data.explanations[0].previousValue='99';},
  data=>{data.explanations[0].sourceUrl+='?unreviewed=1';},data=>{data.explanations[0].licenseUrl='https://example.com';},
  data=>{data.explanations[0].attribution='';},data=>{data.explanations[0].textType='verbatim';},
  data=>{data.explanations[0].publishedAt='2026-04-30T12:30:00.000Z';},
  data=>{data.explanations[0].provenance[0].url='https://example.com';},
  data=>{data.explanations[0].provenance[0].sha256='not-a-hash';},
  data=>{data.explanations[0].provenance[0].retrievedAt='2026-01-01T00:00:00.000Z';},
  data=>{data.explanations[0].provenance[0].retrievedAt='2026-10-22';},
  data=>{data.explanations[0].provenance[0].extra='unreviewed';},
  data=>{data.explanations[0].provenance[0].lastModified='x'.repeat(201);},
  data=>{data.explanations.push(data.explanations[0]);},
  data=>{data.explanations.find(row=>row.annualUpdate).annualUpdate.startPeriod='2002-01-01';}
 ]){const altered=structuredClone(original);mutate(altered);assert.throws(()=>assertPublicationExplanations(altered),/publication explanation/i);}
 assert.equal(JSON.stringify(original),before);
 assert.throws(()=>assertPublicationExplanations(fixture(ids().slice(1)),{complete:true}),/complete|batch/i);
 assert.throws(()=>assertPublicationExplanations(fixture(),{ids:ids().slice(1)}),/requested|batch/i);
 assert.throws(()=>assertPublicationExplanations({version:1,explanations:[]},{ids:['unreviewed']}),/requested|scope/i);
});

test('page parser validates exact title, release date, source passages and quarter-specific section',()=>{
 for(const url of new Set(publicationExplanationScope.map(row=>row.sourceUrl))){
  const html=page(url),result=parsePublicationExplanationPage(html,{provenance:provenance(url,html)});
  assert.equal(result.explanations.length,publicationExplanationScope.filter(row=>row.sourceUrl===url).length);
  assertPublicationExplanations(result,{ids:result.explanations.map(row=>row.publicationId)});
  assert.ok(result.explanations.every(row=>row.textType==='paraphrase'&&row.publishedAt===null));
 }
 const scope=publicationExplanationScope.find(row=>row.estimate==='Second'&&row.period==='2026-01-01'),url=scope.sourceUrl,html=page(url);
 for(const altered of [html.replace(escape(scope.sourceTitle),'Wrong release'),html.replace(escape(scope.releaseDateText),'May 29, 2026'),html.replace(escape(scope.sectionPassages[0]),'unreviewed text'),html.replace('<article about="','<article about="/wrong'),html.replace('</article>','</article><article></article>'),html.replace('<h1>News Release</h1>','<h1>'+escape(scope.sourceTitle)+'</h1>')]){
  assert.throws(()=>parsePublicationExplanationPage(altered,{provenance:provenance(url,altered)}),/publication explanation/i);
 }
 const hidden=html.replace(escape(scope.sectionPassages[0]),'<!-- '+escape(scope.sectionPassages[0])+' -->');
 assert.throws(()=>parsePublicationExplanationPage(hidden,{provenance:provenance(url,hidden)}),/passage/i);
 const scripted=html.replace(escape(scope.sectionPassages[0]),'<script>'+escape(scope.sectionPassages[0])+'</script>');
 assert.throws(()=>parsePublicationExplanationPage(scripted,{provenance:provenance(url,scripted)}),/passage/i);
 const inactive=html+'<script type="text/javascript">//<![CDATA[\nvar config = {};\n//]]></script>';
 assertPublicationExplanations(parsePublicationExplanationPage(inactive,{provenance:provenance(url,inactive)}));
 assert.throws(()=>parsePublicationExplanationPage(html+'<!-- malformed',{provenance:provenance(url)}),/comment/i);
 assert.throws(()=>parsePublicationExplanationPage(' '.repeat(2*1024*1024+1),{provenance:provenance(url)}),/byte limit/i);
 assert.throws(()=>parsePublicationExplanationPage(html,{provenance:provenance(url+'?scope=wrong',html)}),/source|scope/i);
});

test('one requested explanation still validates every reviewed passage on its source page',()=>{
 const annual=publicationExplanationScope.find(row=>row.kind==='annual-update'),third=publicationExplanationScope.find(row=>row.period==='2026-04-01'&&row.estimate==='Third');
 const html=page(annual.sourceUrl),requested=[third.publicationId];
 const result=parsePublicationExplanationPage(html,{provenance:provenance(annual.sourceUrl,html),ids:requested});
 assert.deepEqual(result.explanations.map(row=>row.publicationId),requested);
 const changed=html.replace(escape(annual.sectionPassages[0]),'wrong-quarter text');
 assert.throws(()=>parsePublicationExplanationPage(changed,{provenance:provenance(annual.sourceUrl,changed),ids:requested}),/passage/i);
 assert.throws(()=>parsePublicationExplanationPage(html,{provenance:provenance(annual.sourceUrl,html),ids:[ids()[0]]}),/source|scope/i);
});

test('collector fetches only exact reviewed pages, preserves requested order and rejects redirects or gaps',async()=>{
 const fetched=[];
 const fetchImpl=async(url,options)=>{fetched.push(url);assert.equal(options.method,'GET');return new Response(page(url),{status:200,headers:{'last-modified':'Thu, 22 Oct 2026 18:00:00 GMT'}});};
 const all=await collectPublicationExplanations({fetchImpl});assert.equal(fetched.length,29);assert.deepEqual(all.explanations.map(row=>row.publicationId),ids());
 const selected=[ids().at(-1),ids()[0]];fetched.length=0;
 const subset=await collectPublicationExplanations({fetchImpl,ids:selected});assert.deepEqual(subset.explanations.map(row=>row.publicationId),selected);assert.equal(fetched.length,2);
 assert.equal(subset.explanations[0].provenance[0].sha256,createHash('sha256').update(page(fetched[0])).digest('hex'));
 assert.equal((await collectPublicationExplanations({fetchImpl,ids:[]})).explanations.length,0);
 for(const invalid of [['unknown'],[ids()[0],ids()[0]],null])await assert.rejects(collectPublicationExplanations({fetchImpl,ids:invalid}),/scope|requested/i);
 await assert.rejects(collectPublicationExplanations({ids:[ids()[0]],fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect|source/i);
 await assert.rejects(collectPublicationExplanations({ids:[ids()[0]],fetchImpl:async()=>new Response('unavailable',{status:503})}),/503/);
});

test('larger source reviews fetch at most four official pages concurrently',async()=>{
 let active=0,maximum=0,calls=0;
 const result=await collectPublicationExplanations({fetchImpl:async url=>{
  calls++;active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;
  return new Response(page(url),{status:200});
 }});
 assert.equal(calls,29);assert.equal(result.explanations.length,30);assert.ok(maximum>1);assert.ok(maximum<=4,`Observed ${maximum} concurrent requests`);
});
