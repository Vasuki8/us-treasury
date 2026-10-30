import test from 'node:test';
import assert from 'node:assert/strict';
import {heading,panel,button,metrics,coverageBadge,seriesStatus,freshnessBanner} from '../src/ui.js';
import {getSeries,formatValue} from '../src/model.js';
import {renderResearchSave} from '../src/research-save.js';

test('shared UI uses sentence case, preserves economic acronyms and uses internal link labels without external arrows',()=>{
 assert.ok(heading('FISCAL PRESSURE','').includes('Fiscal pressure'));
 assert.ok(panel('01','GDP CONTRIBUTIONS','').includes('GDP contributions'));
 assert.ok(button('DOWNLOAD CSV').includes('Download CSV'));
 assert.ok(coverageBadge({coverageNote:'retained note'}).includes('>Notes<'));
 assert.doesNotMatch(metrics(['receiptsTtm']),/Calculated metric|Details ↗/);
 assert.doesNotMatch(seriesStatus(getSeries('receiptsTtm')),/Calculated metric/);
});

test('payroll cards show the prior level rather than a second difference',()=>{
 const current=getSeries('payroll'),prior=current.observations.at(-2);
 assert.ok(metrics(['payroll']).includes('Prior month: '+formatValue(current,prior.value)));
 assert.doesNotMatch(metrics(['payroll']),/>Change in gains/);
});

test('snapshot action retains its existing selectors with user-facing snapshot terminology',()=>{
 const html=renderResearchSave({scope:'test',draft:{selected:['unrate']},candidates:['unrate'],catalog:{unrate:getSeries('unrate')}});
 assert.ok(html.includes('data-pin-result'));
 assert.ok(html.includes('>Save snapshot</button>'));
 assert.doesNotMatch(html,/Freeze Result|FREEZE RESULT|FROZEN RESULTS/);
});

test('compact freshness uses a human Eastern timestamp with machine ISO retained',()=>{
 const html=freshnessBanner({generatedAt:'2026-10-29T02:48:00Z',sources:{}},{compact:true});
 assert.ok(html.includes('10:48 pm ET, 28 Oct'));
 assert.ok(html.includes('datetime="2026-10-29T02:48:00Z"'));
 assert.doesNotMatch(html,/>2026-10-29 02:48:00 UTC</);
});
