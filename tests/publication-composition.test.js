import test from 'node:test';
import assert from 'node:assert/strict';
import {researchPage} from '../src/research-page.js';
import {parseRoute} from '../src/router.js';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';
import {publicationArchive} from '../src/publication-archive.js';
import {claimsFixture} from './helpers/claims-publications-fixture.js';

const withoutDisclosures=html=>html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
for(const [name,state,archive,value,measurement] of [
 ['cpi',{publicationSeries:'cpiMonthly',publicationPeriod:'2026-09-01',publicationCutoff:'2026-10-14'},cpiPublicationArchive,'0.6%','Headline CPI'],
 ['claims',{publicationSeries:'claimsAdvance',publicationPeriod:'2026-03-07',publicationCutoff:'2026-03-19'},claimsFixture(),'201k','Initial claims'],
 ['gdp',{publicationSeries:'gdp',publicationPeriod:'2026-01-01',publicationCutoff:'2026-06-25'},publicationArchive,'2.1%','Real GDP growth'],
])test(`${name} publication result leads the workspace while receipts remain in remembered source disclosures`,()=>{
 const original=JSON.stringify(archive),html=researchPage({...parseRoute('#/research?view=publications'),...state},{publicationArchive:archive,publicationState:{status:'ready'}}),lead=withoutDisclosures(html);
 assert.match(html,/class="publication-result publication-selected-result"/);
 assert.ok(html.indexOf('publication-selected-result')<html.indexOf('id="publication-period"'));
 assert.ok(lead.includes(measurement));assert.ok(lead.includes(value));assert.ok(lead.includes('day precision'));
 assert.match(html,new RegExp(`data-page-disclosure="research:publications:${name}:source:`));
 assert.doesNotMatch(html,/<\/summary>p class=/,'Methods retain valid paragraph markup');
 assert.match(html,/Retrieved/);assert.doesNotMatch(lead,/Retrieved|cpi_pressa\.h/);
 assert.match(html,new RegExp(`data-page-disclosure="research:publications:${name}:methods"`));
 assert.match(lead,/data-export-publications/);assert.match(lead,/data-pin-publication/);
 assert.equal(JSON.stringify(archive),original,'Presentation does not mutate official archive facts');
});
