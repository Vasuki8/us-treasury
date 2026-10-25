import test from 'node:test';
import assert from 'node:assert/strict';

let policy;
try {policy=await import('../scripts/bls-api-policy.mjs');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('bls-api-policy.mjs'))throw error;}

test('BLS API matching admits only the two literal reviewed endpoint URLs',()=>{
  assert.ok(policy,'Exact BLS API admission helper must exist');
  const v1='https://api.bls.gov/publicAPI/v1/timeseries/data/';
  const v2='https://api.bls.gov/publicAPI/v2/timeseries/data/';
  assert.equal(policy.BLS_API_V1,v1);
  assert.equal(policy.BLS_API_V2,v2);
  for(const endpoint of [v1,v2]){
    assert.equal(policy.matchesBlsApiFeed(endpoint),true);
    for(const value of [endpoint+'?registrationkey=secret',endpoint+'?',endpoint+'#',endpoint+'#data',endpoint.replace('https://','https://user:secret@'),endpoint.replace('api.bls.gov','api.bls.gov:443'),endpoint.replace('api.bls.gov','api.bls.gov:444'),endpoint.replace('api.bls.gov','api.bls.gov.example'),endpoint.replace('https://','http://'),endpoint.replace('/data/','/data'),endpoint.replace('/data/','/data/extra'),endpoint.replace('/publicAPI/','/publicAPI/../publicAPI/'),new URL(endpoint)])assert.equal(policy.matchesBlsApiFeed(value),false,String(value));
  }
  for(const value of [null,undefined,'',123])assert.equal(policy.matchesBlsApiFeed(value),false);
});
