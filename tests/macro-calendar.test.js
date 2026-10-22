import test from 'node:test';import assert from 'node:assert/strict';
import {calendarRelatedIds} from '../src/macro-calendar.js';import {registry} from '../src/registry.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
test('program associations connect new measures without rewriting the original cached schedule evidence',()=>{
 const event={sourceId:'bls',program:'consumer-price-index',seriesId:'cpi',seriesIds:['cpi']},before=structuredClone(event);
 const ids=calendarRelatedIds(event);assert.ok(ids.includes('cpiCoreMonthly'));assert.deepEqual(event,before);
 for(const [sourceId,program,id]of [['bls','employment-situation','weeklyHours'],['bea','personal-income-outlays','realSpending'],['dol','weekly-claims','continuedClaims'],['census','housing-construction','housingCompletions']])assert.ok(calendarRelatedIds({sourceId,program}).includes(id));
 assert.ok(ids.every(id=>Object.hasOwn(registry,id)));assert.deepEqual(calendarRelatedIds({sourceId:'vendor',program:'consumer-price-index'}),[]);
});
test('Census housing schedule admits only the exact reviewed factual program and registered indicator group',()=>{
 const url='https://www.census.gov/economic-indicators/calendar-listview.html';
 const event={id:'census-housing-example',sourceId:'census',program:'housing-construction',seriesId:'housingStarts',seriesIds:['housingStarts','housingPermits','housingCompletions'],sourceUrl:url,scheduleBasis:'listed-date'};
 const snapshot={calendar:{sources:{census:{events:[event],provenance:[{url,sha256:'a'.repeat(64)}]}}},releases:[event]};
 assert.doesNotThrow(()=>assertCommercialData(snapshot));
 const bad=structuredClone(snapshot);bad.calendar.sources.census.events[0].seriesIds.push('retail');bad.releases=bad.calendar.sources.census.events;assert.throws(()=>assertCommercialData(bad),/calendar/i);
});
