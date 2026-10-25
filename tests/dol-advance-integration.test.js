import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {registry} from '../src/registry.js';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {asKnownOn} from '../src/vintages.js';
import {getFreshness} from '../src/freshness.js';
import {compareSeries,toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';

const ids=['claimsAdvance','continuedClaimsAdvance'];
// A synthetic retrieval must follow the independently refreshed historical feed.
const at=new Date(Math.max(Date.parse(snapshot.generatedAt),Date.parse(snapshot.sources.dol.fetchedAt),Date.parse('2026-10-22T21:10:00.000Z'))+1000).toISOString();
const nextAt=new Date(Date.parse(at)+7*86400000).toISOString();
function source(input=releaseFixture(),fetchedAt=at){return {...parseDolAdvanceText(input,{now:new Date(fetchedAt)}),fetchedAt,provenance:[{url:'https://www.dol.gov/ui/data.pdf',sha256:'a'.repeat(64),retrievedAt:fetchedAt,lastModified:null}],warnings:[]};}
function catalog(input){return Object.fromEntries(ids.map(id=>[id,{...registry[id],...input.series[id],source:{...registry[id].source,seriesIds:input.series[id].sourceIds},fetchedAt:input.fetchedAt,provenance:input.provenance,dataStatus:'official'}]));}

test('an independent advance refresh never changes revised history, calendars or earlier captured coverage',async()=>{
 const policy=structuredClone(snapshot.publicationPolicy);
 // This fixture retains only DOL statistics, so it cannot claim an approved
 // cached BLS statistical capture that is absent from its source map.
 if(policy?.cachedDataSources)policy.cachedDataSources=[];
 const previous={sources:{dol:structuredClone(snapshot.sources.dol)},calendar:structuredClone(snapshot.calendar),publicationPolicy:policy},before=JSON.stringify(previous);
 const next=await refreshSnapshot({previous,collectors:{dolAdvance:async()=>source()},now:new Date(at)});
 assert.equal(JSON.stringify(previous),before);assert.deepEqual(next.sources.dol,previous.sources.dol);assert.deepEqual(next.calendar,previous.calendar);assert.deepEqual(next.publicationPolicy,previous.publicationPolicy);assertCommercialData(next);
 assert.equal(next.vintages.captures.length,2);assert.equal(asKnownOn(next.vintages,new Date(Date.parse(at)-1).toISOString()).sources.dolAdvance,undefined);
 const replay=asKnownOn(next.vintages,at).sources.dolAdvance;
 assert.equal(replay.series.claimsAdvance.observations.at(-1).value,194);assert.equal(replay.series.continuedClaimsAdvance.observations.at(-1).date,'2026-10-10');assert.equal(replay.series.claimsAdvance.publicationNote,source().series.claimsAdvance.publicationNote);
 assert.equal(asKnownOn(next.vintages,at).sources.dol.series.claims.observations.length,3117);
});

test('advance failure retains only its own cached context and provenance without inventing captures or substituting history',async()=>{
 const good=await refreshSnapshot({previous:{sources:{dol:snapshot.sources.dol}},collectors:{dolAdvance:async()=>source()},now:new Date(at)}),prior=JSON.stringify(good.vintages);
 const failed=await refreshSnapshot({previous:good,collectors:{dolAdvance:async()=>{throw Error('Official PDF HTTP 403');}},now:new Date(Date.parse(at)+60000)});
 assert.deepEqual(failed.sources.dol,good.sources.dol);assert.equal(failed.sources.dolAdvance.status,'error');assert.equal(failed.sources.dolAdvance.fetchedAt,at);assert.deepEqual(failed.sources.dolAdvance.series,good.sources.dolAdvance.series);assert.equal(JSON.stringify(failed.vintages),prior);
 const entries=getFreshness(failed,{now:new Date(Date.parse(at)+120000)}).entries;
 assert.equal(entries.find(row=>row.id==='data:dolAdvance').status,'cached');assert.equal(entries.find(row=>row.id==='data:dol').status,'available');
 const first=await refreshSnapshot({collectors:{dolAdvance:async()=>{throw Error('Unavailable');}},now:new Date(at)});assert.equal(first.sources.dolAdvance.status,'unavailable');assert.deepEqual(first.sources.dolAdvance.series,{});
 await assert.rejects(refreshSnapshot({previous:good,collectors:{dolAdvance:async()=>{throw Error('Missing SA table');}},now:new Date(nextAt),requireAll:true}),/Required official refresh failed/);
});

test('a later release replaces current context while immutable replay retains the earlier advance and prior roles',async()=>{
 const first=await refreshSnapshot({collectors:{dolAdvance:async()=>source()},now:new Date(at)}),original=JSON.stringify(first.vintages.captures);
 const later=source(releaseFixture({header:'Thursday, October 29, 2026',initialDate:'October 24',priorInitialDate:'October 17',continuedDate:'October 17',priorContinuedDate:'October 10'}),nextAt);
 const second=await refreshSnapshot({previous:first,collectors:{dolAdvance:async()=>later},now:new Date(nextAt)});
 assert.equal(JSON.stringify(second.vintages.captures.slice(0,1)),original);
 const earlier=asKnownOn(second.vintages,at).sources.dolAdvance.series.claimsAdvance.observations.at(-1),newPrior=asKnownOn(second.vintages,nextAt).sources.dolAdvance.series.claimsAdvance.observations[0];
 assert.equal(earlier.date,'2026-10-17');assert.equal(earlier.value,194);assert.equal(earlier.releaseStage,'advance');assert.equal(earlier.publishedAt,'2026-10-22');
 assert.equal(newPrior.date,'2026-10-17');assert.equal(newPrior.value,200);assert.equal(newPrior.releaseStage,'prior-week-revised');assert.equal(newPrior.publishedAt,'2026-10-29');assertCommercialData(second);
});

test('CSV and portable pins preserve day precision, advance/prior notes and independent source weeks after refresh',async()=>{
 const input=source(),data=catalog(input),csv=toCsv(ids,{range:{preset:'all'},catalog:data}),[headers,...rows]=parseCsv(csv);
 assert.equal(rows.length,4);
 const objects=rows.map(row=>Object.fromEntries(headers.map((name,i)=>[name,row[i]])));
 for(const row of objects){assert.equal(row.publication_date,'2026-10-22');assert.equal(row.retrieved_at,at);assert.equal(row.license_url,'https://www.dol.gov/general/aboutdol/copyright');assert.match(row.coverage_note,/separate from the revised historical series/);assert.match(row.source_notes,/day precision/);}
 const initial=objects.filter(row=>row.series_id==='claimsAdvance');assert.deepEqual(initial.map(row=>[row.date,row.source_value]),[['2026-10-10','200,000'],['2026-10-17','194,000']]);assert.match(initial[0].source_notes,/Prior-week revised.*199,000/);assert.match(initial[1].source_notes,/Advance estimate/);
 const native=compareSeries(ids,'native',{preset:'all'},data);assert.equal(native.error,null);assert.equal(native.panels[0].observations.at(-1).date,'2026-10-17');assert.equal(native.panels[1].observations.at(-1).date,'2026-10-10');
 const pkg=await createResearchPackage({name:'Synthetic latest release context',now:at,state:{page:'compare',selected:ids,window:'all',comparison:'native',transform:'level'},catalog:data,sources:{dolAdvance:input},snapshot:{generatedAt:at}}),text=exportResearchPackage(pkg);
 data.claimsAdvance.observations[1].value=9999;assert.equal(exportResearchPackage(pkg),text);const imported=await importResearchPackage(text);assert.equal(exportResearchPackage(imported),text);assert.equal(researchPackageCsv(imported),csv);assert.equal(imported.catalog.claimsAdvance.publicationNote,pkg.catalog.claimsAdvance.publicationNote);
});
