import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeControls} from '../src/research-controls.js';
import {currentAccountGdpHistoryPanel} from '../src/current-account-gdp-history-view.js';
import {currentAccountGdpFixture} from './helpers/current-account-gdp-fixture.js';

test('scoped date controls use calculated calendar points, including null quarters',()=>{
 const id='currentAccountToGdp',observations=['2025-01-01','2025-04-01','2025-07-01','2025-10-01','2026-01-01','2026-04-01'].map((date,i)=>({date,value:i===3?null:-3}));
 const catalog={[id]:{id,frequency:'Quarterly',unit:'Percent of nominal GDP',observations}};
 const html=rangeControls({window:'observations',range:6},[id],{catalog});
 assert.match(html,/id="window-start"[^>]*value="2025-01-01"/);assert.match(html,/id="window-end"[^>]*value="2026-04-01"/);
});

test('history panel can host one date-control set resolved from its own series',()=>{
 const sources=currentAccountGdpFixture(),state={window:'all'};
 const html=currentAccountGdpHistoryPanel(sources,{preset:'all'},{state});
 assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.match(html,/id="window-start"[^>]*value="2026-01-01"/);
 assert.doesNotMatch(currentAccountGdpHistoryPanel(sources,{preset:'all'},{state,frozen:true}),/id="window-start"/);
});
