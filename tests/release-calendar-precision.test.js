import test from 'node:test';
import assert from 'node:assert/strict';
import * as refresh from '../scripts/sources/refresh.mjs';
const day={sourceId:'fomc',date:'2026-12-09',time:null,scheduledAt:null,datePrecision:'day'};
test('date-only FOMC schedules retain their date without inventing a UTC publication clock',()=>{
 assert.equal(typeof refresh.validateCalendarEventTiming,'function');
 assert.doesNotThrow(()=>refresh.validateCalendarEventTiming('fomc',day));
 for(const change of [{date:'2026-02-30'},{time:'14:00'},{scheduledAt:'2026-12-09T19:00:00Z'},{datePrecision:'minute'}])assert.throws(()=>refresh.validateCalendarEventTiming('fomc',{...day,...change}),/date|time|precision/i);
 assert.throws(()=>refresh.validateCalendarEventTiming('bea',{...day,sourceId:'bea'}),/date|time|precision|instant/i);
});
