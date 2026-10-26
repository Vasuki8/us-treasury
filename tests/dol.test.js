import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

let adapter;
try {
  adapter = await import('../scripts/sources/dol.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('dol.mjs')) throw error;
}
function dol() {
  assert.ok(adapter, 'The DOL source adapter must exist');
  return adapter;
}

const endpoint = 'https://oui.doleta.gov/unemploy/wkclaims/report.asp';
// Exact 127-byte HTTP 200 HTML response captured from the official export on
// October 26, 2026. An identical query also returned valid national XML.
const databaseUnavailable = 'Unable to connect!<br/>SQLSTATE=HY000, SQLDriverConnect: -25546 [Informix][Informix ODBC Driver][Informix]Invalid ASF assoc_id.';
function week(date, value = '198,000', continued = '1,699,000') {
  return `<week><weekEnded>${date}</weekEnded><InitialClaims><NSA>164,717</NSA><SF>83.0</SF>${value === null ? '' : `<SA>${value}</SA>`}<SA4WK>202,500</SA4WK></InitialClaims><ContinuedClaims><NSA>1,497,243</NSA><SF>88.1</SF>${continued === null ? '' : `<SA>${continued}</SA>`}<SA4WK>1,723,250</SA4WK></ContinuedClaims><IUR><NSA>1.0</NSA><SA>1.1</SA></IUR><CoveredEmployment>153,732,307</CoveredEmployment></week>`;
}
function xml(rows, reportDate = '10/21/2026') {
  return `<r539cyNational rundate="${reportDate}">\n${rows.join('\n')}\n</r539cyNational>`;
}
// Exact empty seasonal-factor row in the official XML captured 2026-10-24;
// it is between the actual Saturday observations for March 28 and April 4.
const seasonalFactorRow = `<week><weekEnded>04/03/2026</weekEnded><InitialClaims><NSA>&#160;</NSA><SF>92.3</SF><SA>&#160;</SA><SA4WK>&#160;</SA4WK></InitialClaims><ContinuedClaims><NSA>&#160;</NSA><SF>104.6</SF><SA>&#160;</SA><SA4WK>&#160;</SA4WK></ContinuedClaims><IUR><NSA>&#160;</NSA><SA>&#160;</SA></IUR><CoveredEmployment>&#160;</CoveredEmployment></week>`;
function fixtureFetch(text) {
  return async (url, options) => {
    const body = new URLSearchParams(options.body);
    assert.equal(url, endpoint);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(body.get('level'), 'us');
    assert.equal(body.get('strtdate'), '1967');
    assert.equal(body.get('enddate'), '2026');
    assert.equal(body.get('filetype'), 'xml');
    assert.equal(body.get('submit'), 'Submit');
    return new Response(text, { headers: { 'content-type': 'text/xml; charset=UTF-8' } });
  };
}

test('read-only DOL export POST explicitly retries transient failures with the identical query',async()=>{
 const calls=[],waits=[];let attempts=0;
 const source=await dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),maxAttempts:3,pause:async ms=>waits.push(ms),fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method,body:options.body});attempts++;
  return attempts<3?new Response('temporarily unavailable',{status:503}):fixtureFetch(xml([week('10/17/2026')]))(url,options);
 }});
 assert.equal(attempts,3);assert.deepEqual(waits,[5000,30000]);assert.ok(calls.every(call=>JSON.stringify(call)===JSON.stringify(calls[0])));assert.equal(source.series.claims.observations.at(-1).value,198);
});

test('DOL retry exhaustion stays failed and an unrecognized successful response remains terminal',async()=>{
 let attempts=0;
 await assert.rejects(dol().collectDol({maxAttempts:3,pause:async()=>{},fetchImpl:async()=>{attempts++;return new Response('unavailable',{status:503});}}),/HTTP.*503/);assert.equal(attempts,3);
 attempts=0;await assert.rejects(dol().collectDol({maxAttempts:3,pause:async()=>assert.fail('schema errors cannot retry'),fetchImpl:async()=>{attempts++;return new Response('<html>Invalid export</html>');}}),/schema/);assert.equal(attempts,1);
});

test('DOL shares one retry budget across its exact HTTP200 database outage and transient HTTP failures',async()=>{
 const calls=[],waits=[],accepted=xml([week('10/17/2026')]);
 const source=await dol().collectDol({now:new Date('2026-10-26T12:00:00Z'),maxAttempts:3,pause:async ms=>waits.push(ms),fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method,body:options.body});
  if(calls.length===1)return new Response(databaseUnavailable,{headers:{'content-type':'text/html;charset=UTF-8'}});
  if(calls.length===2)return new Response('temporarily unavailable',{status:503});
  return fixtureFetch(accepted)(url,options);
 }});
 assert.equal(calls.length,3);assert.deepEqual(waits,[5000,30000]);
 assert.ok(calls.every(call=>JSON.stringify(call)===JSON.stringify(calls[0])));
 assert.equal(source.series.claims.observations.at(-1).value,198);
 assert.equal(source.series.continuedClaims.observations.at(-1).value,1699);
 assert.equal(source.provenance.length,1);
 assert.equal(source.provenance[0].sha256,createHash('sha256').update(accepted).digest('hex'));
 assert.equal(source.fetchedAt,source.provenance[0].retrievedAt);
 assert.doesNotMatch(JSON.stringify(source),/SQLSTATE|Informix|Unable to connect/);
});

test('the exact DOL database outage exhausts bounded retries without masquerading as an HTTP503',async()=>{
 let calls=0;const waits=[];
 await assert.rejects(dol().collectDol({maxAttempts:3,pause:async ms=>waits.push(ms),fetchImpl:async()=>{
  calls++;return new Response(databaseUnavailable,{headers:{'content-type':'text/html; charset=UTF-8'}});
 }}),error=>{
  assert.match(error.message,/temporarily unavailable/i);assert.equal(error.status,200);
  assert.equal(error.url,endpoint);assert.equal(error.redirected,false);
  assert.doesNotMatch(JSON.stringify(error),/SQLSTATE|Informix|assoc_id/);return true;
 });
 assert.equal(calls,3);assert.deepEqual(waits,[5000,30000]);
});

test('DOL outage recognition rejects lookalikes, changed scope, redirects and unknown content',async()=>{
 for(const [body,type,properties] of [
  [databaseUnavailable+'<other/>','text/html',{}],
  [databaseUnavailable.replace('-25546','-25547'),'text/html',{}],
  [databaseUnavailable,'text/xml',{}],
  [databaseUnavailable,'text/html',{redirected:true,url:endpoint}],
  [databaseUnavailable,'text/html',{url:'https://other.test/report.asp'}],
  ['<html>Access denied</html>','text/html',{}],
 ]){
  let calls=0;
  await assert.rejects(dol().collectDol({maxAttempts:3,pause:async()=>assert.fail('unrecognized successful content cannot retry'),fetchImpl:async()=>{
   calls++;const response=new Response(body,{headers:{'content-type':type}});
   Object.defineProperties(response,Object.fromEntries(Object.entries(properties).map(([key,value])=>[key,{value}])));return response;
  }}),/schema/i);
  assert.equal(calls,1);
 }
});

test('DOL preserves week-ending periods and raw counts while converting SA initial claims to thousands', () => {
  const result = dol().parseDol(xml([week('09/19/2026'), week('09/05/2026', '0'), week('09/12/2026', '1,234')]));
  assert.deepEqual(result.observations, [
    { date: '2026-09-05', value: 0, publishedAt: null, sourceValue: '0' },
    { date: '2026-09-12', value: 1.234, publishedAt: null, sourceValue: '1,234' },
    { date: '2026-09-19', value: 198, publishedAt: null, sourceValue: '198,000' },
  ]);
  assert.equal(result.reportDate, '2026-10-21');
});

test('DOL omits missing SA counts, including XML nonbreaking spaces, without fabricating zeros', () => {
  const result = dol().parseDol(xml([
    week('08/15/2026', ''), week('08/22/2026', '&#160;'), week('08/29/2026', '&#xA0;'),
    week('09/05/2026', '\u00a0'), week('09/12/2026', null), week('09/19/2026', '0'),
  ]));
  assert.deepEqual(result.observations, [{ date: '2026-09-19', value: 0, publishedAt: null, sourceValue: '0' }]);
});

test('DOL retains an internal missing week so changes and charts cannot bridge an unobserved count', () => {
  const result = dol().parseDol(xml([
    week('08/29/2026', '&#160;'), week('09/05/2026', '197,000'), week('09/12/2026', '&#160;'),
    week('09/19/2026', '198,000'), week('09/26/2026', '&#160;'),
  ]));
  assert.deepEqual(result.observations, [
    { date: '2026-09-05', value: 197, publishedAt: null, sourceValue: '197,000' },
    { date: '2026-09-12', value: null, publishedAt: null, sourceValue: '' },
    { date: '2026-09-19', value: 198, publishedAt: null, sourceValue: '198,000' },
  ]);
});

test('DOL rejects duplicate weekly periods even when one duplicate lacks a count', () => {
  assert.throws(() => dol().parseDol(xml([week('09/19/2026'), week('09/19/2026', '199,000')])), /duplicate/i);
  assert.throws(() => dol().parseDol(xml([week('09/19/2026'), week('09/19/2026', '&#160;')])), /duplicate/i);
});

test('DOL rejects invalid calendar dates and observation dates that are not week-ending Saturdays', () => {
  for (const date of ['02/30/2026', '09/21/2026', '2026-09-19', '00/19/2026']) {
    assert.throws(() => dol().parseDol(xml([week(date)])), /date|Saturday|week/i);
  }
  assert.throws(() => dol().parseDol(xml([week('09/19/2026')], '02/30/2026')), /date/i);
});

test('DOL excludes the empty non-Saturday seasonal-factor row with a warning and keeps actual weeks exact', async () => {
  const input = xml([week('03/28/2026', '203,000', '1,787,000'), seasonalFactorRow, week('04/04/2026', '218,000', '1,809,000')]);
  const parsed = dol().parseDol(input);
  assert.deepEqual(parsed.observations.map(row => [row.date, row.value]), [['2026-03-28', 203], ['2026-04-04', 218]]);
  assert.deepEqual(parsed.continuedObservations.map(row => [row.date, row.value]), [['2026-03-28', 1787], ['2026-04-04', 1809]]);
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /2026-04-03.*seasonal.factor.*no.*(?:claims|observations)/i);
  const source = await dol().collectDol({ now: new Date('2026-04-10T12:00:00Z'), fetchImpl: fixtureFetch(input) });
  assert.deepEqual(source.warnings, parsed.warnings);
  assert.ok(Object.values(source.series).every(item => item.observations.every(row => row.date !== '2026-04-03')));
});

test('non-Saturday rows with any real count, insured-unemployment rate or employment still fail', () => {
  for (const [section, names] of [['InitialClaims', ['NSA', 'SA', 'SA4WK']], ['ContinuedClaims', ['NSA', 'SA', 'SA4WK']], ['IUR', ['NSA', 'SA']]]) {
    for (const name of names) {
      const row = seasonalFactorRow.replace(new RegExp(`<${section}>(.*?)</${section}>`), (_all, fields) => `<${section}>${fields.replace(`<${name}>&#160;</${name}>`, `<${name}>0</${name}>`)}</${section}>`);
      assert.throws(() => dol().parseDol(xml([week('04/04/2026'), row])), /Saturday/i, `${section}/${name}`);
    }
  }
  assert.throws(() => dol().parseDol(xml([week('04/04/2026'), seasonalFactorRow.replace('<CoveredEmployment>&#160;</CoveredEmployment>', '<CoveredEmployment>153,547,535</CoveredEmployment>')])), /Saturday/i);
});

test('seasonal-factor exclusions retain strict calendar, XML, factor and duplicate validation', () => {
  for (const oldFactor of ['92.3', '104.6']) {
    for (const factor of ['junk', '1e2', 'Infinity', '-1', '0', '9'.repeat(400)]) {
      assert.throws(() => dol().parseDol(xml([week('04/04/2026'), seasonalFactorRow.replace(`<SF>${oldFactor}</SF>`, `<SF>${factor}</SF>`)])), /factor/i, factor);
    }
  }
  for (const row of [
    seasonalFactorRow.replace('04/03/2026', '02/30/2026'),
    seasonalFactorRow.replace('<SA>&#160;</SA>', '<SA>&unknown;</SA>'),
    seasonalFactorRow.replace('</InitialClaims>', '<Other>1</Other></InitialClaims>'),
    seasonalFactorRow.replace('<SF>92.3</SF>', '<SF>92.3</SF><SF>92.3</SF>'),
    '<week><weekEnded>04/03/2026</weekEnded></week>',
  ]) assert.throws(() => dol().parseDol(xml([week('04/04/2026'), row])), /DOL|XML|schema|date|entity|Saturday/i);
  assert.throws(() => dol().parseDol(xml([week('04/04/2026'), seasonalFactorRow, seasonalFactorRow])), /duplicate/i);
  assert.throws(() => dol().parseDol(xml([seasonalFactorRow])), /usable|numeric|observations/i);
});

test('excluded seasonal-factor dates count toward the source row limit', () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const rows = Array.from({length: 10001}, (_, index) => {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    return `<week><weekEnded>${date.slice(5, 7)}/${date.slice(8)}/${date.slice(0, 4)}</weekEnded><InitialClaims><SF>92.3</SF></InitialClaims></week>`;
  });
  assert.throws(() => dol().parseDol(xml(rows)), /observation limit/i);
});

test('DOL rejects malformed or negative claims rather than normalizing them into plausible data', () => {
  for (const value of ['-1', '1.5', '1,23', '1e3', 'NaN', 'Infinity', '9007199254740992', '&unknown;']) {
    assert.throws(() => dol().parseDol(xml([week('09/19/2026', value)])), /numeric|count|entity|XML/i);
  }
});

test('DOL accepts only the known national XML schema and never evaluates declarations or entities', () => {
  const valid = xml([week('09/19/2026')]);
  const invalid = [
    '<html>Access denied</html>', valid.replaceAll('r539cyNational', 'r539cyState'),
    valid.replace('<weekEnded>', '<date>').replace('</weekEnded>', '</date>'),
    valid.replace('</InitialClaims>', ''), valid.replace('<SA>198,000</SA>', '<SA>198,000</SA><SA>199,000</SA>'),
    '<!DOCTYPE claims [<!ENTITY external SYSTEM "https://example.com/data">]>' + valid,
    valid.replace('198,000', '&external;'), valid + '<other/>', null,
  ];
  for (const text of invalid) assert.throws(() => dol().parseDol(text), /DOL|XML|schema|date|entity/i);
  assert.equal(dol().parseDol('<?xml version="1.0" encoding="UTF-8"?>\n' + valid).observations[0].value, 198);
  assert.throws(() => dol().parseDol(' '.repeat(2 * 1024 * 1024) + valid), /limit|large|size/i);
});

test('DOL fails unusable exports instead of treating an empty or future-only placeholder year as data', () => {
  for (const text of [xml([]), xml([week('09/19/2026', '&#160;')])]) {
    assert.throws(() => dol().parseDol(text), /numeric|usable|observations/i);
  }
});

test('a revised DOL export replaces its reported count without inventing publication history', () => {
  const prior = dol().parseDol(xml([week('09/19/2026', '198,000')], '10/20/2026'));
  const revised = dol().parseDol(xml([week('09/19/2026', '199,000')]));
  assert.equal(prior.observations[0].value, 198);
  assert.equal(revised.observations[0].value, 199);
  assert.equal(revised.observations[0].publishedAt, null);
  assert.equal(revised.observations[0].sourceValue, '199,000');
  assert.equal(revised.revisions, undefined);
});

test('DOL collector fetches national XML, retains every returned past week, and records source provenance', async () => {
  const start = Date.parse('2025-06-21T00:00:00Z');
  const rows = Array.from({ length: 71 }, (_, index) => {
    const date = new Date(start + index * 7 * 86400000).toISOString().slice(0, 10);
    return week(`${date.slice(5, 7)}/${date.slice(8)}/${date.slice(0, 4)}`, String(200000 + index * 1000));
  });
  const result = await dol().collectDol({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch(xml(rows)) });
  const claims = result.series.claims;
  assert.equal(result.id, 'dol');
  assert.equal(claims.observations.length, 70);
  assert.equal(claims.observations[0].date, '2025-06-21');
  assert.equal(claims.observations.at(-1).date, '2026-10-17');
  assert.equal(claims.observations.at(-1).value, 269);
  assert.equal(claims.sourceUrl, endpoint);
  assert.deepEqual(claims.sourceIds, ['InitialClaims/SA']);
  assert.equal(claims.dataStatus, 'official');
  assert.match(claims.calculation, /1,?000|1000/);
  assert.equal(result.reportDate, '2026-10-21');
  assert.equal(result.latestObservationDate, '2026-10-17');
  assert.equal(claims.latestObservationDate, '2026-10-17');
  assert.match(result.coverageNote, /2026-10-17/);
  assert.match(claims.coverageNote, /lag.*advance|advance.*lag/i);
  assert.equal(result.provenance.length, 1);
  assert.equal(result.provenance[0].url, endpoint);
  assert.match(result.provenance[0].sha256, /^[a-f\d]{64}$/);
  assert.ok(!('text' in result.provenance[0]));
  assert.equal(result.fetchedAt, result.provenance[0].retrievedAt);
  assert.equal(result.warnings.length, 0);
});

test('DOL source warns when its actual latest observation trails the as-of date by more than 14 days', async () => {
  const stale = await dol().collectDol({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch(xml([week('09/19/2026'), week('10/24/2026')])) });
  assert.equal(stale.latestObservationDate, '2026-09-19');
  assert.match(stale.warnings.join(' '), /lag|advance|old/i);
  assert.match(stale.warnings.join(' '), /2026-09-19/);
  const boundary = await dol().collectDol({ now: new Date('2026-10-17T12:00:00Z'), fetchImpl: fixtureFetch(xml([week('10/03/2026')])) });
  assert.equal(boundary.warnings.length, 0);
});

test('DOL collector rejects unavailable HTTP responses and exports without usable observations before the cutoff', async () => {
  await assert.rejects(dol().collectDol({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /HTTP.*503/i);
  await assert.rejects(dol().collectDol({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch(xml([week('10/24/2026')])) }), /usable|numeric|observations/i);
});

test('continued claims preserve their own source values and Saturday reference dates in thousands',()=>{
  const result=dol().parseDol(xml([week('09/19/2026','198,000','1,720,000'),week('09/05/2026','0','0'),week('09/12/2026','1,234','1,700,123')]));
  assert.deepEqual(result.continuedObservations,[
    {date:'2026-09-05',value:0,publishedAt:null,sourceValue:'0'},
    {date:'2026-09-12',value:1700.123,publishedAt:null,sourceValue:'1,700,123'},
    {date:'2026-09-19',value:1720,publishedAt:null,sourceValue:'1,720,000'},
  ]);
  assert.equal(result.observations.at(-1).value,198,'initial-claims values remain independent');
});

test('continued claims trim only their empty edges and retain internal missing weeks without copying initial counts',()=>{
  const result=dol().parseDol(xml([
    week('08/29/2026','197,000',null),week('09/05/2026','198,000','1,700,000'),
    week('09/12/2026','199,000','&#160;'),week('09/19/2026','200,000','0'),week('09/26/2026','201,000',''),
  ]));
  assert.deepEqual(result.continuedObservations,[
    {date:'2026-09-05',value:1700,publishedAt:null,sourceValue:'1,700,000'},
    {date:'2026-09-12',value:null,publishedAt:null,sourceValue:''},
    {date:'2026-09-19',value:0,publishedAt:null,sourceValue:'0'},
  ]);
  assert.equal(result.observations.length,5);
  const newerContinued=dol().parseDol(xml([week('09/12/2026','198,000','1,700,000'),week('09/19/2026',null,'1,701,000')]));
  assert.equal(newerContinued.observations.at(-1).date,'2026-09-12');
  assert.equal(newerContinued.continuedObservations.at(-1).date,'2026-09-19');
});

test('continued-claims malformed numeric values and a wholly missing required measure fail closed',()=>{
  for(const value of ['-1','1.5','1,23','1e3','NaN','Infinity','9007199254740992']){
    assert.throws(()=>dol().parseDol(xml([week('09/19/2026','198,000',value)])),/numeric|count/i,value);
  }
  assert.throws(()=>dol().parseDol(xml([week('09/19/2026','198,000',null)])),/continued|usable|numeric/i);
});

test('collector retains each measure\'s own full past history with the same one-request source provenance',async()=>{
  const start=Date.parse('2025-06-21T00:00:00Z');
  const rows=Array.from({length:71},(_,i)=>{
    const date=new Date(start+i*7*86400000).toISOString().slice(0,10);
    return week(`${date.slice(5,7)}/${date.slice(8)}/${date.slice(0,4)}`,String(200000+i*1000),i===69?null:String(1700000+i*1000));
  });
  let requests=0;
  const fetch=fixtureFetch(xml(rows));
  const result=await dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async(...args)=>{requests++;return fetch(...args);}});
  const initial=result.series.claims,continued=result.series.continuedClaims;
  assert.ok(continued,'collector publishes the continued-claims family member');
  assert.equal(requests,1);
  assert.equal(initial.observations.at(-1).date,'2026-10-17');
  assert.equal(continued.observations.length,69);
  assert.equal(continued.observations[0].date,'2025-06-21');
  assert.equal(continued.observations.at(-1).date,'2026-10-10');
  assert.equal(continued.observations.at(-1).value,1768);
  assert.equal(continued.latestObservationDate,'2026-10-10');
  assert.equal(continued.sourceUrl,endpoint);
  assert.deepEqual(continued.sourceIds,['ContinuedClaims/SA']);
  assert.equal(continued.observationType,'official');
  assert.match(continued.measure,/insured unemployment|continued/i);
  assert.match(continued.calculation,/1000|1,000/);
  assert.match(continued.coverageNote,/2026-10-10/);
  assert.doesNotMatch(continued.coverageNote,/2026-10-17/);
  assert.ok(continued.observations.every(o=>o.publishedAt===null));
});

test('continued-claims freshness warnings use their own latest observation even when initial claims are current',async()=>{
  const result=await dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:fixtureFetch(xml([
    week('10/03/2026','198,000','1,700,000'),week('10/10/2026','199,000',null),week('10/17/2026','200,000',null),
  ]))});
  assert.equal(result.latestObservationDate,'2026-10-17');
  assert.equal(result.series.continuedClaims?.latestObservationDate,'2026-10-03');
  assert.equal(result.warnings.length,1);
  assert.match(result.warnings[0],/continued.*2026-10-03.*18 days/i);
});

test('collector does not use a future continued-claims observation as a current value',async()=>{
  await assert.rejects(dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:fixtureFetch(xml([
    week('10/17/2026','198,000',null),week('10/24/2026','199,000','1,700,000'),
  ]))}),/usable|numeric|continued|observations/i);
});

test('full 1967-onward histories preserve early values, internal missing weeks and independent coverage with reuse metadata',async()=>{
 const start=Date.parse('1967-01-07T00:00:00Z'),end=Date.parse('2026-10-24T00:00:00Z'),count=Math.floor((end-start)/(7*86400000))+1;
 const rows=Array.from({length:count},(_,i)=>{
  const date=new Date(start+i*7*86400000).toISOString().slice(0,10);
  return week(`${date.slice(5,7)}/${date.slice(8)}/${date.slice(0,4)}`,i===100?'&#160;':String(200000+i),i===0||i===count-2?null:i===200?'&#160;':String(1700000+i));
 });
 // A source outside the requested start must not extend the reviewed scope.
 const result=await dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:fixtureFetch(xml([week('12/31/1966'),...rows]))});
 const initial=result.series.claims,continued=result.series.continuedClaims;
 assert.equal(initial.observations.length,count-1);assert.equal(initial.observations[0].date,'1967-01-07');assert.equal(initial.observations[0].sourceValue,'200000');assert.equal(initial.observations[0].value,200);
 assert.equal(continued.observations.length,count-3);assert.equal(continued.observations[0].date,'1967-01-14');assert.equal(continued.observations.at(-1).date,'2026-10-10');
 assert.equal(initial.observations[100].value,null);assert.equal(continued.observations[199].value,null);
 for(const measure of [initial,continued]){
  assert.match(measure.coverageNote,new RegExp(measure.observations[0].date));assert.match(measure.coverageNote,new RegExp(measure.observations.at(-1).date));
  assert.match(measure.coverageNote,/first captured.*retrieval|retriev.*not.*release|not.*historical.*vintage/i);
  assert.match(measure.coverageNote,/regular.*UI|regular.*unemployment insurance/i);
  assert.equal(measure.licenseUrl,'https://www.dol.gov/general/aboutdol/copyright');assert.match(measure.attribution,/Department of Labor.*Employment and Training Administration/);
  assert.ok(measure.observations.every(row=>row.publishedAt===null));
 }
});

test('full-history requests advance their end year at the UTC new year without discarding the start',async()=>{
 let body;
 await dol().collectDol({now:new Date('2027-01-01T00:00:00Z'),fetchImpl:async(_url,options)=>{body=new URLSearchParams(options.body);return new Response(xml([week('12/26/2026')],'01/01/2027'));}});
 assert.equal(body.get('strtdate'),'1967');assert.equal(body.get('enddate'),'2027');
});

test('full-history collection bounds the downloaded XML before parsing',async()=>{
 await assert.rejects(dol().collectDol({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response(' '.repeat(2*1024*1024+1))}),/byte|size|limit/i);
});
