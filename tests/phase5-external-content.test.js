import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpPanel} from '../src/current-account-gdp-view.js';
import {currentAccountPanel} from '../src/current-account-view.js';
import {currentAccountGdpFixture} from './helpers/current-account-gdp-fixture.js';

test('external headline contexts lead with readings and retain methods in a closed panel below',()=>{
 const sources=currentAccountGdpFixture();
 const ratio=currentAccountGdpPanel(sources,{compact:true});
 const about=ratio.indexOf('About this data'),reading=ratio.indexOf('class="metric-value"');
 assert.ok(reading>=0&&about>reading);
 assert.ok(ratio.includes('data-page-disclosure="current-account-gdp:context-evidence"'));
 const account=currentAccountPanel(sources.beaIta,{compact:true});
 assert.ok(account.indexOf('About this data')>account.indexOf('<table>'));
 assert.ok(account.includes('data-page-disclosure="current-account:accounting-evidence"'));
});
