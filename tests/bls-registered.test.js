import test from 'node:test';
import assert from 'node:assert/strict';
import * as bls from '../scripts/sources/bls.mjs';
import { OfficialSourceHttpError } from '../scripts/sources/http.mjs';
import { addMomentumSeries } from '../src/momentum.js';

const V1='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const V2='https://api.bls.gov/publicAPI/v2/timeseries/data/';
const KEY='test-only-registered-key-782';
const NOW=new Date('2026-10-25T12:00:00Z');
const nativeIds=[
  'LNS14000000','CES0000000001','CUUR0000SA0','LNS11300000','CES0500000003','JTS000000000000000JOL',
  'CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E','LNS13327709','LNS12300000','CES0500000002',
  'JTS000000000000000HIR','JTS000000000000000QUR','JTS000000000000000LDR','LNS12300060','LNS11300060',
  'CIS1010000000000I','PRS85006092','PRS85006112',
];
const quarterly=new Set(['CIS1010000000000I','PRS85006092','PRS85006112']);
function payload(){
  return {status:'REQUEST_SUCCEEDED',message:[],Results:{series:nativeIds.map(seriesID=>({seriesID,data:[
    {year:'2025',period:quarterly.has(seriesID)?'Q01':'M01',value:'100',footnotes:[]},
    {year:'2025',period:quarterly.has(seriesID)?'Q04':'M12',value:'110',footnotes:[]},
    {year:'2026',period:quarterly.has(seriesID)?'Q01':'M01',value:'112',footnotes:[{code:'P',text:'preliminary'}]},
  ]}))}};
}
const success=p=>new Response(JSON.stringify(p??payload()),{status:200,headers:{'last-modified':'Sun, 25 Oct 2026 10:00:00 GMT'}});
function withUrl(response,url,redirected=false){
  Object.defineProperties(response,{url:{value:url},redirected:{value:redirected}});
  return response;
}
function assertSafe(error){
  assert.equal(String(error.message).includes(KEY),false);
  assert.equal(JSON.stringify(error).includes(KEY),false);
  return true;
}

test('healthy primary stays keyless and makes one exact nonredirecting request',async()=>{
  const calls=[];
  const result=await bls.collectBls({now:NOW,apiKey:KEY,pause:async()=>assert.fail('healthy primary must not pause'),fetchImpl:async(url,options)=>{
    calls.push(url);
    assert.equal(url,V1);assert.equal(options.redirect,'manual');assert.equal(options.method,'POST');
    const body=JSON.parse(options.body);
    assert.deepEqual(body.seriesid,nativeIds);assert.equal(body.startyear,'2017');assert.equal(body.endyear,'2026');
    assert.equal(Object.hasOwn(body,'registrationkey'),false);
    assert.equal(JSON.stringify({url,options}).includes(KEY),false);
    return success();
  }});
  assert.deepEqual(calls,[V1]);assert.equal(result.provenance[0].url,V1);
  assert.equal(Object.keys(addMomentumSeries(result).series).length,31);
});

test('exact primary 503 triggers one registered request after one second with genuine v2 provenance',async()=>{
  const events=[];
  const result=await bls.collectBls({now:NOW,apiKey:KEY,pause:async milliseconds=>events.push(milliseconds),fetchImpl:async(url,options)=>{
    events.push(url);assert.equal(options.redirect,'manual');
    if(url===V1){assert.equal(JSON.stringify(options).includes(KEY),false);return new Response('unavailable',{status:503});}
    assert.equal(url,V2);assert.equal(options.method,'POST');
    assert.deepEqual(JSON.parse(options.body),{seriesid:nativeIds,startyear:'2017',endyear:'2026',registrationkey:KEY});
    assert.equal(JSON.stringify(options.headers).includes(KEY),false);
    return success();
  }});
  assert.deepEqual(events,[V1,1000,V2]);
  assert.equal(Object.keys(result.series).length,26);
  assert.equal(result.provenance.length,1);assert.equal(result.provenance[0].url,V2);
  assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);
  assert.ok(Object.values(addMomentumSeries(result).series).every(series=>series.sourceUrl===V2));
  assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/503.*registered|registered.*503/i);
  assert.equal(JSON.stringify(result).includes(KEY),false);
  assert.equal(result.series.payroll.observations.at(-1).value,2);
  assert.ok(Math.abs(result.series.cpi.observations.at(-1).value-12)<1e-9);
});

test('registered-only collection requires a key before any request and never tries primary',async()=>{
  assert.equal(typeof bls.collectRegisteredBls,'function');
  for(const apiKey of ['', '  ', null])await assert.rejects(bls.collectRegisteredBls({apiKey,fetchImpl:async()=>assert.fail('missing key must not contact BLS')}),/key|required/i);
  const calls=[];
  const result=await bls.collectRegisteredBls({apiKey:KEY,now:NOW,pause:async()=>assert.fail('direct check does not need a primary gap'),fetchImpl:async(url)=>{calls.push(url);return success();}});
  assert.deepEqual(calls,[V2]);assert.deepEqual(result.warnings,[]);
  assert.ok(Object.values(result.series).every(series=>series.sourceUrl===V2));
});

test('missing key preserves the original typed primary 503 without pause or retry',async()=>{
  let calls=0;
  await assert.rejects(bls.collectBls({apiKey:'',now:NOW,pause:async()=>assert.fail('missing key must not pause'),fetchImpl:async()=>{calls++;return new Response('unavailable',{status:503});}}),error=>{
    assert.ok(error instanceof OfficialSourceHttpError);assert.equal(error.status,503);assert.equal(error.requestedUrl,V1);assert.equal(error.url,V1);assert.equal(error.redirected,false);return true;
  });
  assert.equal(calls,1);
});

test('denials, quota responses, redirects, semantic failures and malformed primary data never trigger backup',async()=>{
  const failures=[
    ()=>new Response('denied',{status:403}),()=>new Response('quota',{status:429}),
    ()=>new Response('',{status:302,headers:{location:V2}}),
    ()=>withUrl(new Response('unavailable',{status:503}),V2,true),
    ()=>withUrl(success(),V2),
    ()=>new Response('{invalid',{status:200}),
    ()=>success({status:'REQUEST_FAILED',message:['API rejected request']}),
    ()=>success({status:'REQUEST_SUCCEEDED',message:[],Results:{series:[]}}),
  ];
  for(const response of failures){
    let calls=0;
    await assert.rejects(bls.collectBls({apiKey:KEY,now:NOW,pause:async()=>assert.fail('ineligible primary failure must not pause'),fetchImpl:async(url)=>{calls++;assert.equal(url,V1);return response();}}));
    assert.equal(calls,1);
  }
});

test('failed backup keeps original safe v1 503 identity and makes no third request',async()=>{
  for(const failure of [()=>new Response('denied',{status:403}),()=>{throw new Error(`network echoed ${KEY}`);},()=>success({status:'REQUEST_FAILED',message:[KEY]})]){
    let calls=0;
    await assert.rejects(bls.collectBls({apiKey:KEY,now:NOW,pause:async()=>{},fetchImpl:async()=>{calls++;return calls===1?new Response('unavailable',{status:503}):failure();}}),error=>{
      assertSafe(error);assert.ok(error instanceof OfficialSourceHttpError);
      assert.equal(error.status,503);assert.equal(error.requestedUrl,V1);assert.equal(error.url,V1);assert.equal(error.redirected,false);
      assert.match(error.message,/registered/i);return true;
    });
    assert.equal(calls,2);
  }
});

test('registered data fails atomically for API advisories, incomplete families, duplicates and invalid observations',async()=>{
  const failures=[
    p=>{p.status='REQUEST_FAILED';p.message=[`invalid key ${KEY}`];},
    p=>{p.message=['The registration key was invalid; processed as unregistered.'];},
    p=>{delete p.message;},p=>{p.Results.series.pop();},
    p=>{p.Results.series.push(structuredClone(p.Results.series[0]));},
    p=>{p.Results.series[0].data[0].value='not a number';},
    p=>{p.Results.series[0].data[0].period='M14';},
    p=>{p.Results.series[0].data[0].year='0000';},
    p=>{p.Results.series[0].data.forEach(row=>row.value='-');},
    p=>{p.Results.series[0].data.push({...p.Results.series[0].data[0]});},
    p=>{p.Results.series[0].data.forEach(row=>row.year='2027');},
  ];
  for(const mutate of failures){
    const p=payload();mutate(p);let calls=0;
    assert.equal(typeof bls.collectRegisteredBls,'function');
    await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>{calls++;return success(p);}}),assertSafe);
    assert.equal(calls,1);
  }
});

test('registered responses cannot echo credentials through payloads, receipt headers or redirects',async()=>{
  const failures=[
    ()=>{const p=payload();p.Results.series[0].data[0].footnotes=[{text:KEY}];return success(p);},
    ()=>{const p=payload();p.unused={registrationkey:KEY};return success(p);},
    ()=>new Response(JSON.stringify(payload()),{status:200,headers:{'last-modified':KEY}}),
    ()=>new Response(JSON.stringify(payload()),{status:200,headers:{'x-registrationkey':KEY}}),
    ()=>new Response('',{status:307,headers:{location:`https://unreviewed.example/${KEY}`}}),
    ()=>withUrl(success(),`${V2}?registrationkey=${KEY}`,true),
    ()=>{throw new Error(`remote exception ${KEY}`);},
    ()=>new Response(`remote body ${KEY}`,{status:500}),
  ];
  for(const response of failures){
    let calls=0;
    assert.equal(typeof bls.collectRegisteredBls,'function');
    await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async(url,options)=>{calls++;assert.equal(url,V2);assert.equal(options.redirect,'manual');return response();}}),assertSafe);
    assert.equal(calls,1);
  }
});

test('registered diagnostics classify known failures without exposing API text or trusting remote error codes',async()=>{
  const cases=[
    ['registration-rejected',()=>success({status:'REQUEST_FAILED',message:[`Invalid registration key ${KEY}`]})],
    ['registration-rejected',()=>success({status:'REQUEST_SUCCEEDED',message:[`Key expired; renew ${KEY}`],Results:payload().Results})],
    ['api-response-rejected',()=>success({status:'REQUEST_FAILED',message:['Unclassified API problem']})],
    ['api-response-rejected',()=>success({status:'REQUEST_FAILED',message:['Invalid series identifier']})],
    ['api-response-rejected',()=>success({status:'REQUEST_FAILED',message:['Invalid start year']})],
    ['registration-rejected',()=>success({status:'REQUEST_FAILED',message:['A registration key is required']})],
    ['registration-rejected',()=>success({status:'REQUEST_FAILED',message:['Please renew your registration']})],
    ['registration-rejected',()=>success({status:'REQUEST_FAILED',message:['This request is not registered']})],
    ['malformed-json',()=>new Response(`invalid JSON ${KEY}`,{status:200})],
    ['incomplete-family',()=>{const p=payload();p.Results.series.pop();return success(p);}],
    ['invalid-observations',()=>{const p=payload();p.Results.series[0].data[0].value='invalid';return success(p);}],
    ['credential-echo',()=>{const p=payload();p.Results.series[0].data[0].footnotes=[{text:KEY}];return success(p);}],
    ['redirect-rejected',()=>new Response('',{status:307,headers:{location:`https://unreviewed.example/${KEY}`}})],
    ['transport-failed',()=>{throw Object.assign(new Error(`remote exception ${KEY}`),{code:`remote-${KEY}`});}],
    ['transport-failed',()=>{throw Object.assign(new Error('Invalid BLS numeric observation'),{code:'registration-rejected'});}],
  ];
  for(const [code,response] of cases)await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>response()}),error=>{
    assertSafe(error);assert.equal(error.code,code);return true;
  });
});

test('registered collection accepts only exact catalog-unavailable notices for requested native series',async()=>{
  const p=payload();p.message=[
    'Unable to get Catalog Data for series JTS000000000000000JOL',
    'Unable to get Catalog Data for series JTS000000000000000HIR',
  ];
  const result=await bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success(p)});
  assert.equal(Object.keys(result.series).length,26);
  assert.ok(Object.values(result.series).every(series=>series.sourceUrl===V2));
  assert.deepEqual(result.warnings,[
    'BLS catalog metadata unavailable for JTS000000000000000JOL; complete requested observations were validated.',
    'BLS catalog metadata unavailable for JTS000000000000000HIR; complete requested observations were validated.',
  ]);
  for(const notice of [
    'Unable to get Catalog Data for series UNREVIEWED123',
    'Catalog disabled', 'Unable to get Catalog Data for series JTS000000000000000JOL; extra text',
    `Invalid registration key ${KEY}`, 'Daily request quota exceeded',
  ]){
    const rejected=structuredClone(p);rejected.message.push(notice);
    await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success(rejected)}),error=>{
      assertSafe(error);assert.ok(error.apiSummary);assert.equal(error.apiSummary.messageCount,3);return true;
    });
  }
  const incomplete=structuredClone(p);incomplete.Results.series.pop();
  await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success(incomplete)}),error=>error.code==='incomplete-family');
});

test('rejected API diagnostics expose only bounded status, notice categories and counts',async()=>{
  const messages=[
    `Registration key ${KEY} is required`, 'Daily request quota exceeded', 'Catalog details are unavailable',
    'Requested calculations were omitted', 'Requested years are out of range', 'Requested series could not be found',
    'Scheduled maintenance is in progress', `Unclassified advisory ${KEY}`,
  ];
  await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success({status:'REQUEST_SUCCEEDED',message:messages,Results:payload().Results})}),error=>{
    assertSafe(error);
    assert.deepEqual(error.apiSummary,{status:'REQUEST_SUCCEEDED',messageCount:8,categories:['registration','quota','catalog','calculations','years','series','maintenance','other'],seriesCount:20});
    assert.equal(JSON.stringify(error.apiSummary).includes(KEY),false);return true;
  });
  for(const status of ['REQUEST_FAILED','REQUEST_NOT_PROCESSED',`unknown-${KEY}`]){
    await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success({status,message:Array(101).fill(`unknown ${KEY}`),Results:{series:Array(101).fill({})}})}),error=>{
      assertSafe(error);
      assert.deepEqual(error.apiSummary,{status:status.startsWith('unknown')?'other':status,messageCount:null,categories:['other'],seriesCount:null});return true;
    });
  }
  await assert.rejects(bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>{throw Object.assign(new Error('remote failure'),{apiSummary:{status:KEY,categories:[KEY]}});}}),error=>{
    assert.equal(error.apiSummary,undefined);assertSafe(error);return true;
  });
});

test('registered collection filters future observations and preserves exact-calendar calculations',async()=>{
  assert.equal(typeof bls.collectRegisteredBls,'function');
  const p=payload();p.Results.series.forEach(series=>series.data.push({year:'2027',period:quarterly.has(series.seriesID)?'Q01':'M01',value:'999',footnotes:[]}));
  const result=await bls.collectRegisteredBls({apiKey:KEY,now:NOW,fetchImpl:async()=>success(p)});
  assert.ok(Object.values(result.series).every(series=>series.observations.every(row=>row.date<='2026-10-25')));
  assert.equal(result.series.payroll.observations.at(-1).baseDate,'2025-12-01');
  assert.equal(result.series.eciCompensationQuarterly.observations.at(-1).baseDate,'2025-10-01');
});

test('credential echo rejection inspects decoded values even when JSON escapes the key',async()=>{
  const escapedKey='test-only-"quoted-key';
  const p=payload();p.Results.series[0].data[0].footnotes=[{text:escapedKey}];
  await assert.rejects(bls.collectRegisteredBls({apiKey:escapedKey,now:NOW,fetchImpl:async()=>success(p)}),error=>{
    assert.equal(error.message.includes(escapedKey),false);return true;
  });
});

test('backup coverage rejects truncated history and regressed usable dates across all 31 outputs while retaining original primary 503',async()=>{
  const allIds=['unrate','payroll','cpi','participation','wages','openings','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','payrollLevel','underemployment','employmentPopulation','weeklyHours','hiresRate','quitsRate','layoffsRate','primeAgeEmploymentPopulation','primeAgeParticipation','eciCompensation','laborProductivity','unitLaborCosts','eciCompensationQuarterly','payrollAverage3m','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
  for(const id of allIds)for(const observations of [
    [{date:'2017-01-01',value:100},{date:'2026-01-01',value:112}],
    [{date:'2026-01-01',value:112},{date:'2026-07-01',value:113}],
  ]){
    let calls=0;
    await assert.rejects(bls.collectBls({now:NOW,apiKey:KEY,previous:{series:{[id]:{observations}}},pause:async()=>{},fetchImpl:async()=>{
      calls++;return calls===1?new Response('unavailable',{status:503}):success();
    }}),error=>{
      assertSafe(error);assert.ok(error instanceof OfficialSourceHttpError);
      assert.equal(error.status,503);assert.equal(error.requestedUrl,V1);assert.equal(error.url,V1);assert.equal(error.redirected,false);
      return true;
    });
    assert.equal(calls,2,id);
  }
});

test('backup permits annual window rollover and keeps every retained prior date including missing observations',async()=>{
  const p=payload();
  const previous={series:{unrate:{observations:[{date:'2016-01-01',value:99},{date:'2025-01-01',value:100},{date:'2025-12-01',value:null},{date:'2026-01-01',value:112}]}}};
  let calls=0;
  const result=await bls.collectBls({now:NOW,apiKey:KEY,previous,pause:async()=>{},fetchImpl:async()=>++calls===1?new Response('unavailable',{status:503}):success(p)});
  assert.equal(result.provenance[0].url,V2);assert.equal(calls,2);
  const missingMonth=structuredClone(p);
  missingMonth.Results.series[0].data=missingMonth.Results.series[0].data.filter(row=>row.period!=='M12');
  calls=0;
  await assert.rejects(bls.collectBls({now:NOW,apiKey:KEY,previous,pause:async()=>{},fetchImpl:async()=>++calls===1?new Response('unavailable',{status:503}):success(missingMonth)}),error=>error instanceof OfficialSourceHttpError&&error.status===503);
});

test('backup cannot turn the previous latest usable observation into a missing value',async()=>{
  const p=payload();p.Results.series[0].data.at(-1).value='-';
  let calls=0;
  await assert.rejects(bls.collectBls({now:NOW,apiKey:KEY,previous:{series:{unrate:{observations:[{date:'2026-01-01',value:112}]}}},pause:async()=>{},fetchImpl:async()=>++calls===1?new Response('unavailable',{status:503}):success(p)}),error=>error instanceof OfficialSourceHttpError&&error.status===503);
});

test('backup rejects a lost momentum baseline even when its raw series retains the same dates and usable latest month',async()=>{
  const p=payload();
  p.Results.series.find(series=>series.seriesID==='CUSR0000SA0').data=Array.from({length:9},(_,i)=>({year:'2026',period:`M${String(i+1).padStart(2,'0')}`,value:i===5?'-':String(100+i),footnotes:[]}));
  const previous={series:{
    cpiSaIndex:{observations:[{date:'2026-06-01',value:105},{date:'2026-09-01',value:108}]},
    cpiAnnualized3m:{observations:[{date:'2026-09-01',value:11.927}]},
  }};
  let calls=0;
  await assert.rejects(bls.collectBls({now:NOW,apiKey:KEY,previous,pause:async()=>{},fetchImpl:async()=>++calls===1?new Response('unavailable',{status:503}):success(p)}),error=>{
    assertSafe(error);assert.ok(error instanceof OfficialSourceHttpError);
    assert.equal(error.status,503);assert.equal(error.requestedUrl,V1);assert.equal(error.url,V1);return true;
  });
  assert.equal(calls,2);
});
