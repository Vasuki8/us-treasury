import test from 'node:test';import assert from 'node:assert/strict';
import {relevantRefreshIds} from '../src/research-status.js';
test('GDP, all CPI rates and both claims series retain separate correct calendar/data warnings',()=>{
 assert.deepEqual(relevantRefreshIds({page:'release',publicationSeries:'gdp'},{}),['calendar:bea','data:bea']);
 for(const id of ['cpi','cpiCore','cpiMonthly','cpiCoreMonthly'])assert.deepEqual(relevantRefreshIds({page:'release',publicationSeries:id},{}),['calendar:bls','data:bls']);
 for(const id of ['claimsAdvance','continuedClaimsAdvance'])assert.deepEqual(relevantRefreshIds({page:'release',publicationSeries:id},{}),['calendar:dol','data:dolAdvance']);
 assert.deepEqual(relevantRefreshIds({page:'release',publicationSeries:'unknown'},{}),[]);
});
