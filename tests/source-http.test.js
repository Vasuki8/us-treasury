import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, requestText } from '../scripts/sources/http.mjs';
import * as http from '../scripts/sources/http.mjs';
import { createHash } from 'node:crypto';

test('official CSV handles quoted delimiters, escaped quotes, CRLF and embedded lines', () => {
  assert.deepEqual(parseCsv('\ufeffCode,Value,Note\r\na,0,"quoted, value"\r\nb,,"two\nlines and ""quotes"""\r\n'),[
    ['Code','Value','Note'],['a','0','quoted, value'],['b','','two\nlines and "quotes"'],
  ]);
  assert.throws(()=>parseCsv('a,"broken'),/unterminated/i);
});

test('binary source fetch preserves raw bytes and their hash without UTF-8 conversion', async () => {
  assert.equal(typeof http.requestBytes,'function');
  const bytes=Buffer.from([0x50,0x4b,0xff,0x00,0x80]);
  const result=await http.requestBytes('https://example.test/archive',{fetchImpl:async()=>new Response(bytes)});
  assert.deepEqual(result.bytes,bytes);
  assert.equal(result.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.url,'https://example.test/archive');
});

test('source byte limit rejects a response even when content length is absent', async () => {
  assert.equal(typeof http.requestBytes,'function');
  await assert.rejects(http.requestBytes('https://example.test/archive',{maxBytes:3,fetchImpl:async()=>new Response('1234')}),/limit|exceeds/i);
});

test('source fetch rejects unsuccessful HTTP and records a hash without the body', async () => {
  await assert.rejects(requestText('https://example.test/data',{fetchImpl:async()=>new Response('blocked',{status:403})}),/403/);
  const result=await requestText('https://example.test/data',{fetchImpl:async()=>new Response('official',{headers:{'last-modified':'Wed, 21 Oct 2026 12:00:00 GMT'}})});
  assert.equal(result.text,'official');
  assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.match(result.retrievedAt,/^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.url,'https://example.test/data');
});

test('official HTTP errors preserve status and default request identity', () => {
  assert.equal(typeof http.OfficialSourceHttpError,'function');
  const error=new http.OfficialSourceHttpError(403,'https://www.bls.gov/schedule/2026/home.htm');
  assert.ok(error instanceof Error);
  assert.equal(error.message,'Official source HTTP 403 (www.bls.gov)');
  assert.equal(error.status,403);
  assert.equal(error.requestedUrl,'https://www.bls.gov/schedule/2026/home.htm');
  assert.equal(error.url,error.requestedUrl);
  assert.equal(error.redirected,false);
});

test('unsuccessful fetch exposes the final response identity without changing its public message', async () => {
  const requestedUrl='https://www.bls.gov/schedule/2026/home.htm';
  const finalUrl='https://www.bls.gov/access-denied';
  const response=new Response('Access Denied',{status:403});
  Object.defineProperties(response,{url:{value:finalUrl},redirected:{value:true}});
  await assert.rejects(requestText(requestedUrl,{fetchImpl:async()=>response}),error=>{
    assert.equal(typeof http.OfficialSourceHttpError,'function');
    assert.ok(error instanceof http.OfficialSourceHttpError);
    assert.equal(error.message,'Official source HTTP 403 (www.bls.gov)');
    assert.equal(error.status,403);
    assert.equal(error.requestedUrl,requestedUrl);
    assert.equal(error.url,finalUrl);
    assert.equal(error.redirected,true);
    return true;
  });
});
