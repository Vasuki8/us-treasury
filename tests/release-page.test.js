import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {claimsFact as fixtureClaimsFact} from './helpers/claims-publications-fixture.js';
const claimsFact=(overrides={})=>{const row=fixtureClaimsFact(overrides);return {...row,id:`dol-${row.seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`};};
const api=await import('../src/release-page.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const event={id:'claims-test',name:'Unemployment Insurance Weekly Claims',sourceId:'dol',program:'weekly-claims',date:'2026-03-19',time:'08:30',scheduledAt:'2026-03-19T12:30:00.000Z',scheduleBasis:'recurring-rule',sourceUrl:'https://oui.doleta.gov/unemploy/claims_arch.asp'};
const state={page:'release',eventId:event.id,publicationSeries:'claimsAdvance',publicationPeriod:'',publicationCutoff:''};
const archive={version:1,releases:[claimsFact({period:'2026-03-07',publicationDate:'2026-03-12',value:200}),claimsFact({period:'2026-03-07',publicationDate:'2026-03-19',releaseStage:'prior-week-revised',value:201}),claimsFact({period:'2026-03-14',publicationDate:'2026-03-19',value:202})]};

test('release comparison names its preset pair while its return preserves the complete originating selection',()=>{
 const selection=['claimsAdvance','unrate','cpi'],origin=routeFor({...parseRoute('#/series/claimsAdvance?window=custom&start=2025-01-01&end=2026-06-01'),selected:selection});
 const contextual={...state,selected:selection,window:'custom',startDate:'2025-01-01',endDate:'2026-06-01',returnTo:origin};
 const html=api.releasePage(contextual,{archive,publicationState:{status:'ready'},events:[event]});
 const action=[...html.matchAll(/<a class="action" href="([^"]+)">([^<]+)<\/a>/g)].find(([,href])=>href.startsWith('#/explore?'));
 assert.ok(action);assert.equal(action[2],'COMPARE WITH UNEMPLOYMENT');
 const comparison=parseRoute(action[1].replaceAll('&amp;','&'));
 assert.deepEqual(comparison.selected,['claimsAdvance','unrate']);
 const returning=parseRoute(comparison.returnTo);assert.deepEqual(returning.selected,selection);assert.equal(returning.returnTo,origin);
 assert.equal(returning.startDate,'2025-01-01');assert.equal(returning.endDate,'2026-06-01');
});
test('release workspace exposes all clocks and separate earlier and same-release priors',()=>{
 assert.equal(typeof api.releasePage,'function');
 const html=api.releasePage(state,{archive,publicationState:{status:'ready'},events:[event]});
 assert.match(html,/Verified official result/);assert.match(html,/2026-03-14|Mar 14, 2026/);assert.match(html,/Same-release prior/);assert.match(html,/Earlier published prior/);assert.match(html,/Recurring rule/);assert.match(html,/day precision/);assert.match(html,/Schedule-to-retrieval/);assert.match(html,/Backfill/);assert.match(html,/CSV/);assert.match(html,/data-save="claimsAdvance"/);assert.doesNotMatch(html,/Publication instant: 2026/);
});
test('unmatched schedules, failed loaders and missing explanations never imply a published result',()=>{
 assert.equal(typeof api.releasePage,'function');
 const empty=api.releasePage(state,{archive:{releases:[]},publicationState:{status:'ready'},events:[event]});
 assert.match(empty,/Schedule only/);assert.match(empty,/does not verify publication/);assert.doesNotMatch(empty,/Verified official result/);
 const failed=api.releasePage(state,{publicationState:{status:'error',error:'Network failed'},events:[event]});
 assert.match(failed,/Network failed/);assert.match(failed,/data-retry-publications/);assert.doesNotMatch(failed,/Verified official result/);
 const selected=api.releasePage({...state,eventId:'',publicationPeriod:'2026-03-14',publicationCutoff:'2026-03-19'},{archive,publicationState:{status:'ready'}});
 assert.match(selected,/No schedule selected for this publication/);assert.match(selected,/Agency explanation unavailable/);
});
test('GDP workspace uses only the selected publication explanation and labels its earlier estimate',()=>{
 assert.equal(typeof api.releasePage,'function');
 const sourceUrl='https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx';
 const row={id:'bea-gdp-2026q1-second-2026-05-28',seriesId:'gdp',period:'2026-01-01',estimate:'Second',value:1.6,unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',adjustment:'Seasonally adjusted annual rate',publicationDate:'2026-05-28',publicationDatePrecision:'day',publishedAt:null,releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-second',sourceUrl,sourceIds:['A191RL'],provenance:[{url:sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T00:00:00.000Z'}]};
 const explanation={publicationId:row.id,seriesId:'gdp',period:row.period,estimate:'Second',publicationDate:row.publicationDate,summary:'Reviewed agency explanation.',details:[],sourceUrl:row.releaseEvidenceUrl,sourceTitle:'BEA release',attribution:'Source: BEA',provenance:[],licenseUrl:'https://www.bea.gov/help/faq/147'};
 const html=api.releasePage({publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate},{archive:{releases:[{...row,id:'bea-gdp-2026q1-advance-2026-04-30',estimate:'Advance',value:2,publicationDate:'2026-04-30'},row]},publicationState:{status:'ready'},explanations:{explanations:[explanation,{...explanation,publicationId:'other',summary:'WRONG QUARTER'}]},explanationState:{status:'ready'}});
 assert.match(html,/Earlier estimate of this quarter/);assert.match(html,/Reviewed agency explanation/);assert.doesNotMatch(html,/WRONG QUARTER/);assert.match(html,/percentage points/);
});
test('matched release offers a calendar return with the original filters',()=>{
 const html=api.releasePage({...state,calendarMonth:'2026-03',day:'2026-03-19',calendarTopic:'Labor',watchOnly:true},{archive,publicationState:{status:'ready'},events:[event]});
 assert.match(html,/RETURN TO CALENDAR/);assert.match(html,/href="#\/calendar\?month=2026-03&amp;day=2026-03-19&amp;calendarTopic=Labor&amp;watch=1&amp;event=claims-test"/);
});
test('a GDP not-open-for-revision record stays an unchanged confirmation in the release workspace',async()=>{
 const {publicationArchive}=await import('../src/publication-archive.js');
 const row=publicationArchive.releases.find(row=>/GDP not open for revision/.test(row.sourcePublicationDate));
 const html=api.releasePage({publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate},{archive:publicationArchive,publicationState:{status:'ready'}});
 assert.match(html,/unchanged GDP confirmation/);assert.doesNotMatch(html,/Earlier estimate revision:/);
});
test('a status-unknown claims prior stays unknown even when its published value differs',()=>{
 const unknown={...archive,releases:archive.releases.map(row=>row.releaseStage==='prior-week-revised'?claimsFact({period:row.period,publicationDate:row.publicationDate,releaseStage:'prior-week-status-unknown',value:row.value}):row)};
 const html=api.releasePage(state,{archive:unknown,publicationState:{status:'ready'},events:[event]});
 assert.match(html,/Prior comparison \(status unknown\)/);assert.match(html,/\+1 thousand/);assert.doesNotMatch(html,/Revision to the same-release prior/);
});
