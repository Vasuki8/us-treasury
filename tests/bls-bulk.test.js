import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BLS_BULK_FILES,collectBlsBulk} from '../scripts/sources/bls-bulk.mjs';
import {parseBls,parseBlsEconomicDepth} from '../scripts/sources/bls.mjs';

const base='https://download.bls.gov/pub/time.series/';
const expected=[
 ['ce/ce.data.00a.TotalNonfarm.Employment',['CES0000000001'],1024*1024],
 ['ce/ce.data.05b.TotalPrivate.AllEmployeeHoursAndEarnings',['CES0500000002','CES0500000003'],2*1024*1024],
 ['cu/cu.data.1.AllItems',['CUUR0000SA0','CUSR0000SA0'],8*1024*1024],
 ['cu/cu.data.20.USCommoditiesServicesSpecial',['CUUR0000SA0L1E','CUSR0000SA0L1E'],8*1024*1024],
 ['jt/jt.data.1.AllItems',['JTS000000000000000JOL','JTS000000000000000HIR','JTS000000000000000QUR','JTS000000000000000LDR'],64*1024*1024],
 ['ci/ci.data.1.AllData',['CIS1010000000000I'],16*1024*1024],
 ['pr/pr.data.1.AllData',['PRS85006092','PRS85006112'],8*1024*1024],
 ['ln/ln.data.1.AllData',['LNS14000000','LNS11300000','LNS13327709','LNS12300000','LNS12300060','LNS11300060'],512*1024*1024],
];
const now=new Date('2026-10-24T12:00:00Z');
const quarterly=id=>/^(?:CI|PR)/.test(id);
const header='series_id        \tyear\tperiod\t       value\tfootnote_codes\r\n';
const noteMaps={ce:'P\tpreliminary',cu:'R\tRevised\r\nX\tData unavailable due to the 2025 lapse in appropriations',jt:'P\tpreliminary\r\n9\tData unavailable due to the 2025 lapse in appropriations',ci:'B\tIncludes wages, salaries, and employer costs for employee benefits.',pr:'R\trevised',ln:'9\tData unavailable due to the 2025 lapse in appropriations\r\n12\tJanuary 2026 estimates were revised to incorporate updated population controls.'};

function feeds(){
 const result=new Map();
 for(const[path,ids]of expected){
  const family=path.split('/')[0];
  result.set(`${base}${family}/${family}.footnote`,`footnote_code\tfootnote_text\r\n${noteMaps[family]}\r\n`);
  let text=header;
  for(const id of ids){
   const q=quarterly(id),period=q?'Q02':'M09',flag=family==='ce'||family==='jt'?'P':family==='pr'?'R':'';
   const values=id==='CES0000000001'?['145628','158900','159044']:id==='CIS1010000000000I'?['128.9','174.2','177.178']:['1.00','2.00','3.00'];
   const rows=[['2016',q?'Q04':'M12','999',''],['2017',q?'Q01':'M01',values[0],''],['2025',q?'Q04':'M09',values[1],''],['2026',q?'Q02':'M07',values[1],''],['2026',period,values[2],flag],['2027',q?'Q01':'M01','999','']];
   if(q)rows.splice(3,1); // Q1 is deliberately absent: exact-quarter growth must remain null.
   else if(family==='ln'||family==='cu')rows.splice(3,0,['2025','M10','-',family==='ln'?'9':'X']);
   rows.push(['2025',q?'Q05':'M13','888','']);
   text+=rows.map(row=>`${id.padEnd(30)}\t${row.join('\t')}\r\n`).join('');
  }
  text+='IGNORED_OTHER_SERIES\t2026\tM01\t123\t\r\n';
  result.set(`${base}${path}`,text);
 }
 return result;
}

function streamingResponse(url,text,{chunkSize=17,status=200,cancel=()=>{}}={}){
 const bytes=Buffer.from(text);let offset=0;
 const body=new ReadableStream({pull(controller){if(offset===bytes.length){controller.close();return;}const end=Math.min(bytes.length,offset+chunkSize);controller.enqueue(bytes.subarray(offset,end));offset=end;},cancel});
 const response=new Response(body,{status,headers:{'content-type':'text/plain','last-modified':'Sat, 24 Oct 2026 12:00:00 GMT'}});
 Object.defineProperty(response,'url',{value:url});
 return response;
}
function runner({contents=feeds(),response,fetchError}={}){
 const calls=[],pauses=[];
 return {calls,pauses,collect:(options={})=>collectBlsBulk({now,pause:async ms=>{pauses.push(ms);},fetchImpl:async(url,options)=>{calls.push({url,options});if(fetchError)throw fetchError;return response?response(url,contents.get(url),calls.length):streamingResponse(url,contents.get(url));},...options})};
}
const firstData=`${base}${expected[0][0]}`;
function changedFirst(change){const contents=feeds();contents.set(firstData,change(contents.get(firstData)));return contents;}

test('bulk manifest covers exactly twenty native IDs in eight documented files with explicit decoded byte bounds',()=>{
 assert.deepEqual(BLS_BULK_FILES,expected.map(([path,seriesIds,maxBytes])=>({url:`${base}${path}`,seriesIds,maxBytes,footnoteUrl:`${base}${path.split('/')[0]}/${path.split('/')[0]}.footnote`})));
 assert.equal(new Set(BLS_BULK_FILES.flatMap(file=>file.seriesIds)).size,20);
 assert.ok(Object.isFrozen(BLS_BULK_FILES));
});

test('streaming delivery preserves all twenty IDs, native values, missing values, periods, authentic footnotes and ten calendar years',async()=>{
 const state=runner(),result=await state.collect();
 assert.deepEqual(result.payload.status,'REQUEST_SUCCEEDED');assert.deepEqual(result.payload.message,[]);
 assert.equal(result.payload.Results.series.length,20);
 assert.equal(Object.keys(result.seriesUrls).length,20);
 for(const file of BLS_BULK_FILES)for(const id of file.seriesIds){
  assert.equal(result.seriesUrls[id],file.url);
  const data=result.payload.Results.series.find(row=>row.seriesID===id).data;
  assert.ok(data.length>0);assert.ok(data.every(row=>Number(row.year)>=2017&&Number(row.year)<=2026));
  assert.ok(data.some(row=>row.period===(quarterly(id)?'Q05':'M13')));
  if(id.startsWith('LNS')||id.startsWith('CU'))assert.ok(data.some(row=>row.value==='-'));
 }
 const payroll=result.payload.Results.series.find(row=>row.seriesID==='CES0000000001');
 assert.deepEqual(payroll.data.find(row=>row.year==='2026'&&row.period==='M09').footnotes,[{code:'P',text:'preliminary'}]);
 assert.equal(payroll.data.find(row=>row.year==='2026'&&row.period==='M09').value,'159044');
 const parsed={...parseBls(result.payload),...parseBlsEconomicDepth(result.payload)};
 assert.equal(parsed.payroll.observations.at(-1).value,null,'missing August is never replaced by July');
 assert.equal(parsed.cpiMonthly.observations.at(-1).value,null,'monthly CPI keeps the exact missing-month baseline');
 assert.equal(parsed.eciCompensationQuarterly.observations.at(-1).value,null,'Q4 cannot replace a missing Q1 baseline');
 assert.equal(parsed.eciCompensation.observations.at(-1).date,'2026-04-01');
 assert.deepEqual(result.warnings,[]);
});

test('hashes and byte receipts cover every complete decoded response across chunk boundaries, including unselected rows',async()=>{
 const contents=feeds(),state=runner({contents}),result=await state.collect();
 assert.equal(result.provenance.length,14);
 for(const receipt of result.provenance){const text=contents.get(receipt.url);assert.equal(receipt.sha256,createHash('sha256').update(text).digest('hex'));assert.equal(receipt.bytes,Buffer.byteLength(text));assert.equal(receipt.lastModified,'Sat, 24 Oct 2026 12:00:00 GMT');assert.ok(Number.isFinite(Date.parse(receipt.retrievedAt)));}
 assert.equal(result.fetchedAt,result.provenance.at(-1).retrievedAt);
 assert.equal(state.calls.length,14);assert.equal(state.pauses.length,13);assert.ok(state.pauses.every(ms=>ms>=1000));
 assert.deepEqual(state.calls.slice(0,6).map(call=>call.url),['ce','cu','jt','ci','pr','ln'].map(family=>`${base}${family}/${family}.footnote`));
 for(const {options}of state.calls){assert.equal(options.headers['User-Agent'],'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);}
});

test('multiple official footnote codes retain their source meanings',async()=>{
 const contents=feeds(),url=`${base}ln/ln.data.1.AllData`;
 contents.set(url,contents.get(url).replace(/LNS14000000[^\n]*2026\tM09\t[^\r\n]*/,line=>line.replace(/\t\s*$/,'\t9,12')));
 const result=await runner({contents}).collect();
 const row=result.payload.Results.series.find(item=>item.seriesID==='LNS14000000').data.find(row=>row.year==='2026'&&row.period==='M09');
 assert.deepEqual(row.footnotes.map(note=>note.code),['9','12']);
 assert.match(row.footnotes[0].text,/2025 lapse/);assert.match(row.footnotes[1].text,/population controls/);
});

for(const[name,change,pattern]of[
 ['duplicate target observation',text=>text+text.split('\r\n').find(line=>line.startsWith('CES0000000001')&&line.includes('2026\tM09'))+'\r\n',/duplicate/i],
 ['missing required target',text=>text.split('\r\n').filter(line=>!line.startsWith('CES0000000001')).join('\r\n'),/missing.*CES0000000001/i],
 ['empty response',()=>'',/empty|header|schema/i],
 ['incorrect header',text=>text.replace('series_id','series_wrong'),/schema|header/i],
 ['truncated selected record',text=>text.replace(/CES0000000001[^\n]*2026\tM09[^\n]*/, 'CES0000000001\t2026\tM09'),/schema|field|record/i],
 ['invalid monthly period',text=>text.replace('2026\tM09','2026\tQ03'),/period/i],
 ['invalid selected year',text=>text.replace('2026\tM09','nope\tM09'),/year/i],
 ['invalid native number',text=>text.replace('159044','not-a-number'),/numeric|number|value/i],
 ['nonfinite native number',text=>text.replace('159044','9'.repeat(400)),/numeric|finite|number|value/i],
 ['unknown footnote code',text=>text.replace('159044\tP','159044\tUNKNOWN'),/unknown.*footnote|footnote.*unknown/i],
])test(`bulk fails closed for ${name}`,async()=>{await assert.rejects(runner({contents:changedFirst(change)}).collect(),pattern);});

test('quarterly source periods cannot be misread as monthly observations',async()=>{
 const contents=feeds(),url=`${base}pr/pr.data.1.AllData`;contents.set(url,contents.get(url).replace('2026\tQ02','2026\tM06'));
 await assert.rejects(runner({contents}).collect(),/period/i);
});

test('footnote feeds fail closed on empty, wrong schema, duplicate code and empty meaning',async()=>{
 for(const text of ['', 'wrong\tcolumns\r\nP\tpreliminary\r\n','footnote_code\tfootnote_text\r\nP\tpreliminary\r\nP\tother\r\n','footnote_code\tfootnote_text\r\nP\t\r\n']){
  const contents=feeds();contents.set(`${base}ce/ce.footnote`,text);await assert.rejects(runner({contents}).collect(),/footnote|header|schema|empty|duplicate/i);
 }
});

test('access denials and service errors stop immediately without retry or subsequent requests',async()=>{
 for(const status of [401,403,429,503]){let cancellations=0;const state=runner({response:url=>streamingResponse(url,'denied',{status,cancel:()=>{cancellations++;}})});await assert.rejects(state.collect(),new RegExp(String(status)));assert.equal(state.calls.length,1);assert.equal(state.pauses.length,0);assert.equal(cancellations,1);}
 const state=runner({fetchError:new Error('network unavailable')});await assert.rejects(state.collect(),/network unavailable/);assert.equal(state.calls.length,1);
});

test('wrong source URLs and redirects reject and cancel the response',async()=>{
 for(const redirected of [false,true]){let cancellations=0;const state=runner({response:url=>{const result=streamingResponse(redirected?url:'https://example.com/other','footnote_code\tfootnote_text\r\nP\tpreliminary\r\n',{cancel:()=>{cancellations++;}});if(redirected)Object.defineProperty(result,'redirected',{value:true});return result;}});await assert.rejects(state.collect(),/source|redirect|URL/i);assert.equal(state.calls.length,1);assert.equal(cancellations,1);}
});

test('byte limits apply to decoded body bytes while streaming and cancel oversized responses',async()=>{
 let cancellations=0;const contents=feeds();contents.set(firstData,header+'IGNORED\t2026\tM01\t0\t\r\n'.repeat(60000));
 const state=runner({contents,response:(url,text)=>streamingResponse(url,text,{chunkSize:8192,cancel:()=>{cancellations++;}})});
 await assert.rejects(state.collect(),/byte limit|exceed/i);assert.equal(cancellations,1);assert.equal(state.calls.length,7);
});

test('line buffers are bounded before an unlimited unterminated row is retained',async()=>{
 let cancellations=0;const contents=changedFirst(()=>header+'X'.repeat(70000));
 await assert.rejects(runner({contents,response:(url,text)=>streamingResponse(url,text,{chunkSize:4096,cancel:()=>{cancellations++;}})}).collect(),/line|buffer/i);assert.equal(cancellations,1);
});

test('request deadline covers a hanging fetch and aborts without retries',async()=>{
 let capturedSignal,calls=0;const started=Date.now();
 await assert.rejects(collectBlsBulk({now,pause:async()=>{},timeoutMs:15,fetchImpl:async(url,{signal})=>{calls++;capturedSignal=signal;return new Promise(()=>{});}}),/timeout|deadline/i);
 assert.ok(Date.now()-started<1000);assert.ok(capturedSignal.aborted);assert.equal(calls,1);
});

test('request deadline also covers a stalled body and cancels its reader',async()=>{
 let signal,cancellations=0;const started=Date.now();
 await assert.rejects(collectBlsBulk({now,pause:async()=>{},timeoutMs:15,fetchImpl:async(url,options)=>{signal=options.signal;const response=new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancellations++;}}));Object.defineProperty(response,'url',{value:url});return response;}}),/timeout|deadline/i);
 assert.ok(Date.now()-started<1000);assert.ok(signal.aborted);assert.equal(cancellations,1);
});
