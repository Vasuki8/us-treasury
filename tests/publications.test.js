import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {zipFixture} from './helpers/zip.mjs';
let api,policy;
try {api=await import('../scripts/sources/publications.mjs');} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
try {policy=await import('../scripts/publication-policy.mjs');} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const use=()=>{assert.ok(api,'Publication collector must exist');return api;};
const usePolicy=()=>{assert.ok(policy,'Publication admission must exist');return policy;};
const url='https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx';
const provenance={url,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T15:00:00.000Z',lastModified:null};
const title='Vintage History of Quarterly Gross Domestic Product (GDP) and Gross Domestic Income (GDI) Estimates';
const xmlText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

// Independent, minimal OOXML fixture with the exact reviewed BEA sheet layout.
function workbook({mutate=()=>{},numericDates=false}={}) {
  const cells={A1:title,A2:'Last Updated June 25, 2026',A4:'Estimates by publication (or vintage) date; historical quarters to the first quarter of 2002.',A6:'2026Q1',E7:'Percent Change',B8:'Vintage',C8:'Billions of Current Dollars',E8:'from Preceding Period',C9:'GDP',D9:'GDI',E9:'Real GDP',F9:'Real GDI',G9:'Release Date',B10:'Third',C10:'31,865.7',D10:'31,574.2',E10:'2.1',F10:'1.2',G10:'Jun 25, 2026',B11:'Second',E11:'1.6',G11:'May 28, 2026',B12:'Advance',E12:'2.0',G12:'Apr 30, 2026 GDI not published',A14:'2025Q4',B18:'Revised',E18:'0.5',G18:'May 28, 2026 GDP not open for revision'};
  mutate(cells);
  const strings=[],rows=new Map();
  for(const [ref,value]of Object.entries(cells)) {
    const row=Number(ref.match(/\d+$/)[0]);if(!rows.has(row))rows.set(row,[]);
    const serial=numericDates&&ref.startsWith('G')&&[10,11,12].includes(row);
    const n=serial?({G10:46198,G11:46170,G12:46142}[ref]):strings.push(value)-1;
    rows.get(row).push(`<c r="${ref}"${serial?'':' t="s"'}><v>${n}</v></c>`);
  }
  const parts={
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="ReadMe" sheetId="1" r:id="rId1"/><sheet name="Vintage History" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/sharedStrings.xml':`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(s=>`<si><t>${xmlText(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet2.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[...rows].map(([r,c])=>`<row r="${r}">${c.join('')}</row>`).join('')}</sheetData></worksheet>`,
  };
  return {parts,zip:()=>zipFixture(Object.entries(parts).map(([name,text])=>({name,text})))};
}
const parse=fixture=>use().parseGdpPublicationWorkbook(fixture.zip(),{provenance});
const legacyIds=()=>usePolicy().legacyPublicationScope.map(usePolicy().publicationId);
const septemberUrl='https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx';
const septemberProvenance={...provenance,url:septemberUrl};
function septemberWorkbook({mutate=()=>{},richDates=true}={}){
  const cells={A1:title,A2:'Last Updated September 30, 2026',A4:'Historical quarters descend to the first quarter of 2002.'};
  for(const scope of usePolicy().septemberWorkbookScope){
    const p=scope.periodRow,r=scope.row;
    Object.assign(cells,{['A'+p]:scope.period.slice(0,4)+'Q'+(Number(scope.period.slice(5,7))+2)/3,['E'+(p+1)]:'Percent Change',['B'+(p+2)]:'Vintage',['C'+(p+2)]:'Billions of Current Dollars',['E'+(p+2)]:'from Preceding Period',['C'+(p+3)]:'GDP',['D'+(p+3)]:'GDI',['E'+(p+3)]:'Real GDP',['F'+(p+3)]:'Real GDI',['G'+(p+3)]:'Release Date',['B'+r]:scope.estimate,['E'+r]:scope.sourceValue,['G'+r]:scope.sourcePublicationDate});
  }
  mutate(cells);
  const strings=[],rows=new Map();
  for(const [ref,value]of Object.entries(cells)){
    const row=Number(ref.match(/\d+$/)[0]);if(!rows.has(row))rows.set(row,[]);
    let string=`<si><t xml:space="preserve">${xmlText(value)}</t></si>`;
    if(richDates&&ref.startsWith('G')&&/^[A-Z][a-z]{2} /.test(value)){
      const split=value.match(/^([A-Z][a-z]{2} +\d{1,2}, +\d{4})(.*)$/);
      string=`<si><r><t>${xmlText(split[1])}</t></r><r><rPr><color rgb="FFFF0000"/></rPr><t xml:space="preserve">${xmlText(split[2])}</t></r></si>`;
    }
    rows.get(row).push(`<c r="${ref}" t="s"><v>${strings.length}</v></c>`);strings.push(string);
  }
  const fixture=workbook();
  fixture.parts['xl/sharedStrings.xml']=`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.join('')}</sst>`;
  fixture.parts['xl/worksheets/sheet2.xml']=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[...rows].sort((a,b)=>a[0]-b[0]).map(([r,c])=>`<row r="${r}">${c.join('')}</row>`).join('')}</sheetData></worksheet>`;
  return fixture;
}
const parseSeptember=(fixture,ids)=>use().parseGdpPublicationWorkbook(fixture.zip(),{provenance:septemberProvenance,...(ids===undefined?{}:{ids})});

test('selected BEA publication history retains native values, exact dates and original cells',()=>{
  const result=parse(workbook());
  assert.equal(result.version,1);
  assert.deepEqual(result.releases.map(r=>[r.estimate,r.publicationDate,r.value,r.sourceValue]),[['Advance','2026-04-30',2,'2.0'],['Second','2026-05-28',1.6,'1.6'],['Third','2026-06-25',2.1,'2.1']]);
  for(const release of result.releases){assert.equal(release.period,'2026-01-01');assert.equal(release.seriesId,'gdp');assert.deepEqual(release.sourceIds,['A191RL']);assert.equal(release.publishedAt,null);assert.equal(release.publicationDatePrecision,'day');assert.deepEqual(release.provenance,[provenance]);}
  assert.deepEqual(result.releases[0].sourceCells,{period:'A6',estimate:'B12',value:'E12',publicationDate:'G12'});
  assert.equal(result.releases[0].sourcePublicationDate,'Apr 30, 2026 GDI not published');
  assert.match(result.releases[0].unit,/preceding quarter.*annualized/);
});

test('numeric Excel dates produce exact day-only dates without inventing a time',()=>{
  assert.deepEqual(parse(workbook({numericDates:true})).releases.map(r=>r.publicationDate),['2026-04-30','2026-05-28','2026-06-25']);
  for(const raw of ['60','46198.5','100001','2026-06-25','Jun 31, 2026'])assert.throws(()=>usePolicy().publicationDateFromSource(raw),/publication date/i);
});

test('explicit measure, unit, quarter and estimate headers cannot drift silently',()=>{
  for(const [cell,value]of [['A1','Other table'],['A2','Last Updated June 26, 2026'],['A6','2025Q1'],['E7','Index'],['E8','from year ago'],['E9','Current-dollar GDP'],['G9','Observation Date'],['B10','Final'],['B11','Third']])assert.throws(()=>parse(workbook({mutate:c=>c[cell]=value})),/publication|header|quarter|estimate|updated/i);
});

test('missing, duplicate, malformed and unreviewed selected values or release dates fail closed',()=>{
  for(const [cell,value]of [['E10','NaN'],['E11',''],['E12','.....'],['G10','Jun 31, 2026'],['G11','May 27, 2026'],['G12','Apr 30, 2026 anything else']])assert.throws(()=>parse(workbook({mutate:c=>c[cell]=value})),/publication|date|numeric|missing/i);
  for(const mutate of [c=>delete c.B12,c=>c.B13='Advance',c=>c.A13='2026Q1'])assert.throws(()=>parse(workbook({mutate})),/publication|duplicate|estimate/i);
});

test('formulas, duplicated cells, inconsistent rows, invalid string indexes and wrong sheet relationships fail',()=>{
  const mutations=[
    f=>f.parts['xl/worksheets/sheet2.xml']=f.parts['xl/worksheets/sheet2.xml'].replace('<c r="E10"','<c r="E10"><f>1+1</f></c><c r="E10"'),
    f=>f.parts['xl/worksheets/sheet2.xml']=f.parts['xl/worksheets/sheet2.xml'].replace('r="E10"','r="E11"'),
    f=>f.parts['xl/worksheets/sheet2.xml']=f.parts['xl/worksheets/sheet2.xml'].replace('</row><row r="11">','<c r="E10"><v>99</v></c></row><row r="11">'),
    f=>f.parts['xl/worksheets/sheet2.xml']=f.parts['xl/worksheets/sheet2.xml'].replace(/(<c r="E10"[^>]*><v>)[^<]+/,'$19999'),
    f=>f.parts['xl/_rels/workbook.xml.rels']=f.parts['xl/_rels/workbook.xml.rels'].replace('Target="worksheets/sheet2.xml"','Target="https://example.com/data.xml" TargetMode="External"'),
    f=>f.parts['xl/workbook.xml']=f.parts['xl/workbook.xml'].replace('<workbookPr/>','<workbookPr date1904="1"/>'),
  ];
  for(const mutate of mutations){const f=workbook();mutate(f);assert.throws(()=>parse(f),/publication|XML|cell|row|string|relationship|date/i);}
});

test('XML comments are excluded and malformed XML, declarations, entities and workbook bytes are rejected',()=>{
  const good=workbook();good.parts['xl/worksheets/sheet2.xml']=good.parts['xl/worksheets/sheet2.xml'].replace('<sheetData>','<sheetData><!-- <row r="10"><c r="E10"><v>99</v></c></row> -->');assert.equal(parse(good).releases.at(-1).value,2.1);
  for(const injected of ['<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]>','<!-- unclosed','<?other processing?>','<![CDATA[bad]]>']){const f=workbook();f.parts['xl/sharedStrings.xml']=injected+f.parts['xl/sharedStrings.xml'];assert.throws(()=>parse(f),/publication|XML/i);}
  const f=workbook();f.parts['xl/sharedStrings.xml']=f.parts['xl/sharedStrings.xml'].replace('Real GDP','Real &unknown; GDP');assert.throws(()=>parse(f),/publication|XML/i);
  assert.throws(()=>use().parseGdpPublicationWorkbook(Buffer.from('not xlsx'),{provenance}),/ZIP|publication/i);
});

test('collector makes one exact public workbook request and hashes actual bytes and retrieval time',async()=>{
  const bytes=workbook().zip(),requests=[];
  const result=await use().collectPublications({ids:legacyIds(),fetchImpl:async(u,options)=>{requests.push([u,options]);return new Response(bytes,{headers:{'last-modified':'Thu, 25 Jun 2026 13:00:00 GMT'}});}});
  assert.equal(requests.length,1);assert.equal(requests[0][0],url);
  assert.equal(result.releases[0].provenance[0].sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.releases[0].provenance[0].lastModified,'Thu, 25 Jun 2026 13:00:00 GMT');
  assert.ok(Date.now()-Date.parse(result.releases[0].provenance[0].retrievedAt)<10000);
  assert.equal(usePolicy().assertPublicationData(result),true);
});

test('collector rejects redirects, failed requests and incomplete workbook instead of publishing a partial archive',async()=>{
  await assert.rejects(()=>use().collectPublications({fetchImpl:async()=>new Response('bad',{status:503})}),/503/);
  await assert.rejects(()=>use().collectPublications({fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com/wrong'})}),/redirect|URL/i);
  const bytes=workbook({mutate:c=>delete c.E11}).zip();await assert.rejects(()=>use().collectPublications({ids:legacyIds(),fetchImpl:async()=>new Response(bytes)}),/publication|numeric|missing/i);
});

test('publication admission accepts an empty initial archive and only the three scoped official records',()=>{
  const {assertPublicationData}=usePolicy();assert.equal(assertPublicationData({version:1,releases:[]}),true);assert.equal(assertPublicationData(parse(workbook())),true);
  const changes=[r=>r.sourceIds=['wrong'],r=>r.sourceUrl='https://www.bea.gov/other.xlsx',r=>r.licenseUrl='https://example.com/license',r=>r.attribution='',r=>r.period='2025-01-01',r=>r.publicationDate='2026-04-29',r=>r.value=Infinity,r=>r.unit='Percent year over year',r=>r.publishedAt='2026-04-30T12:30:00Z',r=>r.provenance[0].sha256='',r=>r.sourceCells.value='D12',r=>r.extra='unreviewed'];
  for(const change of changes){const archive=structuredClone(parse(workbook()));change(archive.releases[0]);assert.throws(()=>assertPublicationData(archive),/publication|scope|source|metadata|provenance|date|value|field/i);}
  const duplicate=parse(workbook());duplicate.releases.push(duplicate.releases[0]);assert.throws(()=>assertPublicationData(duplicate),/duplicate|publication/i);
});

test('publication scope expands to the complete reviewed 2002Q1–2026Q2 official GDP history while preserving the legacy three identities',()=>{
  const {publicationScope,publicationId}=usePolicy();
  assert.equal(publicationScope.length,1076);
  assert.equal(new Set(publicationScope.map(publicationId)).size,1076);
  assert.equal(new Set(publicationScope.map(scope=>scope.period)).size,98);
  assert.equal(publicationScope.filter(scope=>scope.sourceUrl===url).length,3);
  assert.ok(publicationScope.some(scope=>scope.period==='2002-01-01'&&scope.estimate==='Final'));
  assert.ok(publicationScope.some(scope=>scope.period==='2025-07-01'&&scope.estimate==='Updated'));
});

test('September full-table parser preserves all stages, exact rich-text annotations and independent legacy source identities',()=>{
 const archive=parseSeptember(septemberWorkbook());assert.equal(archive.releases.length,1073);
 assert.ok(archive.releases.every(r=>r.sourceUrl===septemberUrl&&!legacyIds().includes(r.id)));
 assert.equal(new Set(archive.releases.map(r=>r.period)).size,98);
 assert.equal(archive.releases.filter(r=>/GDP not open for revision|GDP not revised/.test(r.sourcePublicationDate)).length,141);
 assert.equal(archive.releases.find(r=>r.period==='2002-01-01'&&r.estimate==='Final').value,6.1);
 assert.equal(archive.releases.find(r=>r.period==='2002-01-01'&&r.estimate==='Advance').sourceCells.value,'E1570');
 assert.deepEqual(archive.releases.filter(r=>r.period==='2025-07-01'&&r.estimate!=='Revised').map(r=>r.estimate),['Updated','Initial']);
 const complete={version:1,releases:[...parse(workbook()).releases,...archive.releases]};assert.equal(usePolicy().assertPublicationData(complete,{complete:true}),true);
 assert.ok(archive.releases.every(r=>r.publishedAt===null&&r.publicationDatePrecision==='day'));
});

test('requested batches are exact and the entire September workbook is checked before filtering output',()=>{
 const all=usePolicy().septemberWorkbookScope,selected=all.find(s=>s.period==='2002-01-01'&&s.estimate==='Advance').id;
 const result=parseSeptember(septemberWorkbook(),[selected]);assert.deepEqual(result.releases.map(r=>r.id),[selected]);
 assert.equal(usePolicy().assertPublicationData(result,{ids:[selected]}),true);
 assert.throws(()=>usePolicy().assertPublicationData(result,{complete:true}),/incomplete|batch/i);
 assert.throws(()=>usePolicy().assertPublicationData(result,{ids:[]}),/unrequested|batch/i);
 for(const mutate of [c=>delete c.E10,c=>c.G10='Sep 30, 2026 GDP not open for revision',c=>c.B10='Final',c=>c.E9='Real GDI',c=>c.A1553='2001Q4',c=>{c.B1572='Revised';c.E1572='1.0';c.G1572='Sep 30, 2026';},c=>c.E19='99.0',c=>c.E27='99.0'])assert.throws(()=>parseSeptember(septemberWorkbook({mutate}),[selected]),/publication|scope|header|row|overlap|value/i);
 assert.throws(()=>parseSeptember(septemberWorkbook(),[legacyIds()[0]]),/source|workbook|scope|request/i);
});

test('exact reviewed publication tokens reject jointly altered values and source values',()=>{
 const archive=parse(workbook());archive.releases[0].value=9;archive.releases[0].sourceValue='9.0';
 assert.throws(()=>usePolicy().assertPublicationData(archive),/source value|reviewed.*value/i);
 const changed=workbook({mutate:c=>c.E10='2.10'});assert.throws(()=>parse(changed),/source value|reviewed.*value/i);
});

test('collector defaults to only new September facts, uses exact requested feeds and rejects unreviewed requests before fetching',async()=>{
 const september=septemberWorkbook().zip(),june=workbook().zip(),requests=[];
 const fetchImpl=async u=>{requests.push(u);return new Response(u===septemberUrl?september:june);};
 const result=await use().collectPublications({fetchImpl});assert.equal(result.releases.length,1073);assert.deepEqual(requests,[septemberUrl]);
 const newer=result.releases[0].id,older=legacyIds()[0];requests.length=0;
 const mixed=await use().collectPublications({ids:[newer,older],fetchImpl});assert.deepEqual(mixed.releases.map(r=>r.id),[newer,older]);assert.deepEqual(new Set(requests),new Set([septemberUrl,url]));
 assert.equal(mixed.releases[1].sourceCells.value,'E12');assert.equal(mixed.releases[1].sourceUrl,url);
 for(const ids of [['unknown-id'],[newer,newer],null])await assert.rejects(()=>use().collectPublications({ids,fetchImpl:()=>{throw new Error('must not fetch');}}),/requested|duplicate|unknown/i);
 assert.deepEqual(await use().collectPublications({ids:[],fetchImpl:()=>{throw new Error('must not fetch');}}),{version:1,releases:[]});
});
