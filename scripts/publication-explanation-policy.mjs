import {publicationScope} from './publication-policy.mjs';
import {publicationExplanationScope2024} from './publication-explanation-scope-2024.mjs';
import {publicationExplanationScope2023And2025} from './publication-explanation-scope-2023-2025.mjs';
import {publicationExplanationScopeUpdates} from './publication-explanation-scope-updates.mjs';

const base='https://www.bea.gov/news/2026/';
const thirdTitle=quarter=>'GDP (Third Estimate), Industries, Corporate Profits, State GDP, and State Personal Income, '+quarter;
const technical='Technical Notes';
const annualUpdate={startPeriod:'2021-01-01',endPeriod:'2026-01-01',summary:'BEA identifies the 2026 annual update as covering 2021Q1 through 2026Q1, with 2017 remaining the reference year. This is general update coverage, not a quarter-specific explanation for every revised observation.'};
const annualPassage='The update covered the first quarter of 2021 through the first quarter of 2026 and resulted in revisions to GDP, GDP by industry, GDI, and their major components. The reference year remains 2017.';
const definitions=[
 {
  publicationId:'bea-gdp-2026q1-advance-2026-04-30',kind:'first-publication',previousValue:null,
  slug:'gdp-advance-estimate-1st-quarter-2026',sourceTitle:'GDP (Advance Estimate), 1st Quarter 2026',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, April 30, 2026',sectionHeading:technical,
  sourceSection:'Opening estimate and Technical Notes / Sources of change for real GDP',
  summary:'BEA published its advance estimate of 2.0% annualized real GDP growth for 2026Q1. This is the first estimate in the reviewed quarter sequence, so there is no same-quarter revision to explain.',
  details:['The release describes the components of growth; those contributions are not causes of a revision from a previous quarter estimate.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 2.0 percent','according to the advance estimate released today'],
  sectionPassages:['Sources of change for real GDP','Real GDP increased at an annual rate of 2.0 percent'],
 },
 {
  publicationId:'bea-gdp-2026q1-second-2026-05-28',kind:'revision',previousValue:'2.0',
  slug:'gdp-second-estimate-and-corporate-profits-1st-quarter-2026',sourceTitle:'GDP (Second Estimate) and Corporate Profits, 1st Quarter 2026',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, May 28, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of change for real GDP',
  summary:'BEA lowered 2026Q1 real GDP growth from 2.0% to 1.6%, mainly because it revised investment and consumer spending downward.',
  details:['Revised Census inventory data lowered nonfarm inventory investment, especially manufacturing and retail trade.','New services-survey data lowered health-care spending; revised retail data raised goods spending and partly offset the services reduction.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 1.6 percent'],
  sectionPassages:['a downward revision of 0.4 percentage point from the previous estimate, primarily reflecting downward revisions to investment and consumer spending.','private nonfarm inventory investment, led by manufacturing and retail trade','health care (outpatient services as well as hospital and nursing home services)','revised Census Bureau Monthly Retail Trade Survey data for February and March.'],
 },
 {
  publicationId:'bea-gdp-2026q1-third-2026-06-25',kind:'revision',previousValue:'1.6',
  slug:'gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-1st',sourceTitle:thirdTitle('1st Quarter 2026'),releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, June 25, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of revisions to real GDP in the third estimate',
  summary:'BEA raised 2026Q1 real GDP growth from 1.6% to 2.1%. Lower estimated imports, which subtract from GDP, more than offset a reduction in consumer spending.',
  details:['The import changes affected goods and transport services and primarily incorporated the annual update of BEA’s International Transactions Accounts.','Updated Census services-survey data and international transactions data lowered selected financial services and international travel spending. This ITA update is distinct from the September NIPA annual update.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 2.1 percent'],
  sectionPassages:['primarily reflecting a downward revision to imports that was partly offset by a downward revision to consumer spending.','The revisions primarily reflected the incorporation of the annual update of BEA’s International Transactions Accounts (ITAs)','financial services and insurance (led by portfolio management and investment advice)','other services (led by international travel), based on revised data from the ITAs.'],
 },
 {
  publicationId:'bea-gdp-2026q2-advance-2026-07-30',kind:'first-publication',previousValue:null,
  slug:'gdp-advance-estimate-2nd-quarter-2026',sourceTitle:'GDP (Advance Estimate), 2nd Quarter 2026',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, July 30, 2026',sectionHeading:technical,
  sourceSection:'Opening estimate and Technical Notes / Sources of change for real GDP',
  summary:'BEA published its advance estimate of 1.5% annualized real GDP growth for 2026Q2. This is the first estimate in the reviewed quarter sequence, so there is no same-quarter revision to explain.',
  details:['The release describes the components of growth; those contributions are not causes of a revision from a previous quarter estimate.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 1.5 percent','according to the advance estimate released today'],
  sectionPassages:['Sources of change for real GDP','Real GDP increased at an annual rate of 1.5 percent'],
 },
 {
  publicationId:'bea-gdp-2026q2-second-2026-08-26',kind:'revision',previousValue:'1.5',
  slug:'gdp-second-estimate-and-corporate-profits-2nd-quarter-2026',sourceTitle:'GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Wednesday, August 26, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of revision to real GDP in the second estimate',
  summary:'Both published 2026Q2 estimates round to 1.5%, but BEA explicitly reports a downward revision of less than 0.1 percentage point. Revised consumer spending and imports underlie the change; it is not a documented no-revision release.',
  details:['New Census services-survey data raised health-care spending, while revised retail and energy data lowered selected goods spending.','New Census trade data raised imports of other goods, notably the territorial adjustment for Puerto Rico. Imports subtract from GDP.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 1.5 percent'],
  sectionPassages:['a downward revision of less than 0.1 percentage point.','An upward revision to consumer spending was partly offset by an upward revision to imports.','health care (mainly hospitals and physician services)','other goods (notably the territorial adjustment for Puerto Rico)'],
 },
 {
  publicationId:'bea-gdp-2026q2-third-2026-09-30',kind:'revision',previousValue:'1.5',annualUpdate,
  slug:'gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd',sourceTitle:thirdTitle('2nd Quarter 2026; State PCE, 2025'),releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Wednesday, September 30, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of revisions to real GDP in the third estimate',
  summary:'BEA raised 2026Q2 real GDP growth from 1.5% to 2.2%, mainly because it revised investment, consumer spending and government spending upward.',
  details:['New and revised Census and Agriculture data raised nonfarm and farm inventory investment. Revised construction and remodelers’ payroll data raised fixed investment.','Services-survey, retail and updated deflation data raised selected consumer spending; updated seasonal factors raised federal defense spending.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 2.2 percent',annualPassage],
  sectionPassages:['an upward revision of 0.7 percentage point, primarily reflecting upward revisions to investment, consumer spending, and government spending.','upward revisions to both private inventory investment and private fixed investment.','farm inventory investment (both crops and livestock), based on data from the U.S. Department of Agriculture.','based on updated BEA seasonal adjustment factors for defense spending.'],
 },
 {
  publicationId:'bea-gdp-2026q1-revised-2026-09-30',kind:'annual-update',previousValue:'2.1',annualUpdate,
  slug:'gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd',sourceTitle:thirdTitle('2nd Quarter 2026; State PCE, 2025'),releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Wednesday, September 30, 2026',sectionHeading:'Updates for the First Quarter of 2026',
  sourceSection:'Updates for the First Quarter of 2026',
  summary:'In the 2026 annual update, BEA raised 2026Q1 real GDP growth from 2.1% to 2.5%. Its quarter-specific explanation cites higher exports of services and higher consumer spending on goods and services.',
  details:['This explanation is specific to 2026Q1. The release’s general annual-update coverage does not establish causes for other quarters.'],
  sourcePassages:[annualPassage],
  sectionPassages:['For the first quarter of 2026, real GDP is now estimated to have increased 2.5 percent','an upward revision of 0.4 percentage point from the previously published estimate, primarily reflecting upward revisions to exports of services and consumer spending on both goods and services.'],
 },
 {
  publicationId:'bea-gdp-2025q3-updated-2026-01-22',kind:'revision',previousValue:'4.3',
  slug:'gross-domestic-product-3rd-quarter-2025-updated-estimate-gdp-industry-and-corporate',sourceTitle:'Gross Domestic Product, 3rd Quarter 2025 (Updated Estimate), GDP by Industry, and Corporate Profits (Revised)',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EST, Thursday, January 22, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of revisions to real GDP',
  summary:'BEA raised 2025Q3 real GDP growth from 4.3% to 4.4%. Higher exports and investment were partly offset by lower consumer spending; imports were also revised upward.',
  details:['Updated International Transactions Accounts data changed goods trade. Updated Census inventory data raised inventory investment, partly offset by lower residential construction.','This Updated estimate replaced the scheduled Third estimate after the government shutdown; it is not relabeled as a routine Third release.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 4.4 percent','this updated report for the third quarter of 2025 replaces the release of the third estimate originally scheduled for December 19, 2025.'],
  sectionPassages:['an upward revision of 0.1 percentage point from the previous estimate, primarily reflecting upward revisions to exports and investment that were partly offset by a downward revision to consumer spending. Imports were revised up.','the revised estimates primarily reflected updated data from BEA’s International Transactions Accounts (ITAs).','an upward revision to private inventory investment was partly offset by a downward revision to residential fixed investment.'],
 },
 {
  publicationId:'bea-gdp-2025q4-second-2026-03-13',kind:'revision',previousValue:'1.4',
  slug:'gdp-second-estimate-4th-quarter-and-year-2025',sourceTitle:'GDP (Second Estimate), 4th Quarter and Year 2025',releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Friday, March 13, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of change for real GDP',
  summary:'BEA lowered 2025Q4 real GDP growth from 1.4% to 0.7%, reflecting downward revisions to exports, consumer spending, government spending and investment.',
  details:['Updated international transactions data lowered service exports, especially intellectual-property charges. New services-survey data lowered health-care spending, partly offset by higher goods spending.','New and revised construction data lowered state and local structures and manufacturing structures; new services-survey data lowered software investment.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 0.7 percent'],
  sectionPassages:['a downward revision of 0.7 percentage point from the previous estimate, reflecting downward revisions to exports, consumer spending, government spending, and investment.','charges for the use of intellectual property','health care (both hospital and nursing home services as well as outpatient services)','a downward revision to state and local government structures investment','a downward revision to software, based on new U.S Census Bureau QSS data.'],
 },
 {
  publicationId:'bea-gdp-2025q4-third-2026-04-09',kind:'revision',previousValue:'0.7',
  slug:'gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-4th',sourceTitle:thirdTitle('4th Quarter and Year 2025'),releaseDateText:'EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, April 9, 2026',sectionHeading:technical,
  sourceSection:'Technical Notes / Sources of revisions to real GDP in the third estimate',
  summary:'BEA lowered 2025Q4 real GDP growth from 0.7% to 0.5%, mainly because it revised investment downward.',
  details:['Updated Census inventory data lowered private inventory investment, especially wholesale trade. The release identifies this as the leading source of the investment revision.'],
  sourcePassages:['Real gross domestic product (GDP) increased at an annual rate of 0.5 percent'],
  sectionPassages:['a downward revision of 0.2 percentage point from the previous estimate, primarily reflecting a downward revision to investment.','the downward revision was led by private inventory investment, particularly wholesale trade, based on updated U.S. Census Bureau inventory data.'],
 },
];
const fail=message=>{throw new Error('Invalid publication explanation archive: '+message);};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const publications=new Map(publicationScope.map(row=>[row.id,row]));
export const publicationExplanationScope=freeze([...definitions,...publicationExplanationScope2024,...publicationExplanationScope2023And2025,...publicationExplanationScopeUpdates].map(definition=>{
 const release=publications.get(definition.publicationId);if(!release)fail('unreviewed publication identity');
 for(const key of ['seriesId','period','estimate','publicationDate','sourceValue'])if(Object.hasOwn(definition,key)&&definition[key]!==({...release,seriesId:'gdp'})[key])fail('mismatched reviewed publication '+key);
 return {...definition,seriesId:'gdp',period:release.period,estimate:release.estimate,publicationDate:release.publicationDate,sourceValue:release.sourceValue,sourceUrl:definition.sourceUrl??base+definition.slug,annualUpdate:definition.annualUpdate??null};
}));
const byId=new Map(publicationExplanationScope.map(row=>[row.publicationId,row]));
const metadataKeys=['publicationId','seriesId','period','estimate','publicationDate','kind','sourceValue','previousValue','summary','details','annualUpdate','sourceUrl','sourceTitle','sourceSection'];
export function explanationMetadataFor(scope){
 const record=Object.fromEntries(metadataKeys.map(key=>[key,structuredClone(scope[key])]));
 return {...record,textType:'paraphrase',publicationDatePrecision:'day',publishedAt:null,licenseUrl:'https://www.bea.gov/help/faq/147',attribution:'Source: U.S. Bureau of Economic Analysis. Explanation paraphrased by Meridian from the cited BEA release.'};
}
export function requestedExplanationIds(ids=publicationExplanationScope.map(row=>row.publicationId)){
 if(!Array.isArray(ids)||ids.length>byId.size||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!byId.has(id)))fail('unreviewed or duplicate requested scope');
 return [...ids];
}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function keys(value,allowed,label){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('unreviewed '+label+' field');}
const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function equal(actual,expected){
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((value,index)=>equal(actual[index],value));
 if(plain(expected))return plain(actual)&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>equal(actual[key],value));
 return actual===expected;
}
/** Exact reviewed prose and identity; absent publication IDs have no inferred cause. */
export function assertPublicationExplanations(archive,{complete=false,ids}={}){
 keys(archive,['version','explanations'],'archive');
 if(archive.version!==1||!Array.isArray(archive.explanations)||archive.explanations.length>byId.size)fail('version or explanation scope');
 const seen=new Set();
 for(const record of archive.explanations){
  const scope=byId.get(record?.publicationId);if(!scope||seen.has(record.publicationId))fail('unreviewed or duplicate publication explanation');seen.add(record.publicationId);
  const expected=explanationMetadataFor(scope);keys(record,[...Object.keys(expected),'provenance'],'explanation');
  for(const [key,value]of Object.entries(expected))if(!equal(record[key],value))fail('unreviewed publication explanation '+key);
  if(!Array.isArray(record.provenance)||record.provenance.length!==1)fail('publication explanation provenance scope');
  const source=record.provenance[0];keys(source,['url','sha256','retrievedAt','lastModified'],'provenance');
  if(source.url!==scope.sourceUrl||typeof source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256)||!utc(source.retrievedAt)||source.retrievedAt.slice(0,10)<scope.publicationDate)fail('publication explanation provenance source, hash or date');
  if(source.lastModified!==null&&(typeof source.lastModified!=='string'||source.lastModified.length>200||!Number.isFinite(Date.parse(source.lastModified))))fail('publication explanation last-modified metadata');
 }
 if(ids!==undefined||complete){const requested=requestedExplanationIds(ids);if(seen.size!==requested.length||requested.some(id=>!seen.has(id)))fail('incomplete or unrequested publication explanation batch');}
 return true;
}
