import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesNyFedBlsCalendarFeed,assertNyFedBlsCalendar} from '../scripts/bls-alternate-policy.mjs';


const calendarIndex='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html';
const octoberCalendar='https://www.newyorkfed.org/research/calendars/i-oct26.html';
const novemberCalendar='https://www.newyorkfed.org/research/calendars/i-nov26.html';
const terms='https://www.newyorkfed.org/privacy/termsofuse';
const receipt=url=>({url,sha256:'a'.repeat(64),retrievedAt:'2026-10-24T16:00:00.000Z',lastModified:null,bytes:15000});
function calendarSource(){
  return {id:'bls',provider:'new-york-fed',agency:'BLS · calendar via New York Fed',
    sourceTitle:'Economic Indicators Calendar',termsUrl:terms,licenseUrl:terms,
    attribution:'© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.',
    modificationNotice:'BLS release dates and times extracted and Eastern Time converted to UTC by Meridian. The New York Fed did not make these modifications or endorse Meridian.',
    sourceNotice:'Dates and times are tentative and subject to change. Calendar metadata is redistributed under the New York Fed Terms of Use; those permissions, conditions and restrictions continue to apply. Underlying BLS release metadata is public domain.',
    fetchedAt:'2026-10-24T16:00:00.000Z',indexMonth:'2026-10',coveredMonths:['2026-10','2026-11'],unavailableMonths:['2026-12'],coverageStart:'2026-10-01',coverageEnd:'2026-11-30',
    provenance:[receipt(calendarIndex),receipt(novemberCalendar)],events:[
      {id:'bls-employment-situation-2026-11-06',sourceId:'bls',provider:'new-york-fed',program:'employment-situation',seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],name:'Employment Situation',agency:'BLS',topic:'Labor',date:'2026-11-06',time:'08:30',scheduledAt:'2026-11-06T13:30:00.000Z',period:null,periodLabel:null,sourceUrl:novemberCalendar,sourceUid:null,scheduleBasis:'secondary-calendar'},
    ]};
}

function advancedCalendarSource(){
  const source=calendarSource();
  source.indexMonth='2026-11';
  const october={...source.events[0],id:'bls-employment-situation-2026-10-02',date:'2026-10-02',
    scheduledAt:'2026-10-02T12:30:00.000Z',sourceUrl:octoberCalendar};
  source.events[0].sourceUrl=calendarIndex;source.events.unshift(october);
  source.provenance=[receipt(calendarIndex),receipt(octoberCalendar)];
  return source;
}

test('an early next-month index requires captured current-month coverage and truthful source bindings',()=>{
  assert.doesNotThrow(()=>assertNyFedBlsCalendar(advancedCalendarSource()));
});

test('an early January index preserves December coverage, receipt clocks and the retrieval-year attribution',()=>{
  const source=advancedCalendarSource(),decemberCalendar='https://www.newyorkfed.org/research/calendars/i-dec26.html';
  source.fetchedAt='2026-12-30T16:00:00.000Z';source.indexMonth='2027-01';
  source.coveredMonths=['2026-12','2027-01'];source.unavailableMonths=['2027-02'];
  source.coverageStart='2026-12-01';source.coverageEnd='2027-01-31';
  source.provenance=[calendarIndex,decemberCalendar].map(url=>({...receipt(url),retrievedAt:source.fetchedAt}));
  source.events=[
    {...source.events[0],id:'bls-employment-situation-2026-12-04',date:'2026-12-04',
      scheduledAt:'2026-12-04T13:30:00.000Z',sourceUrl:decemberCalendar},
    {...source.events[1],id:'bls-employment-situation-2027-01-08',date:'2027-01-08',
      scheduledAt:'2027-01-08T13:30:00.000Z',sourceUrl:calendarIndex},
  ];
  assert.doesNotThrow(()=>assertNyFedBlsCalendar(source));
});

test('advanced-index admission rejects missing current evidence, false source URLs and unsupported coverage',()=>{
  const cases=[
    ['missing current receipt',source=>{source.provenance.pop();}],
    ['missing index receipt',source=>{source.provenance.shift();}],
    ['false current receipt URL',source=>{source.provenance[1].url=novemberCalendar;}],
    ['duplicate index receipt',source=>{source.provenance[1].url=calendarIndex;}],
    ['false current event URL',source=>{source.events[0].sourceUrl=calendarIndex;}],
    ['false index event URL',source=>{source.events[1].sourceUrl=novemberCalendar;}],
    ['missing current coverage',source=>{
      source.coveredMonths=['2026-11'];source.unavailableMonths=['2026-12'];source.coverageStart='2026-11-01';
      source.events.shift();
    }],
    ['uncovered advanced index',source=>{
      source.coveredMonths=['2026-10'];source.unavailableMonths=['2026-11','2026-12'];source.coverageEnd='2026-10-31';
      source.events.pop();
    }],
    ['skipped month',source=>{source.coveredMonths=['2026-10','2026-12'];}],
    ['index two months ahead',source=>{source.indexMonth='2026-12';}],
    ['index two months behind',source=>{source.indexMonth='2026-08';}],
    ['bad current receipt hash',source=>{source.provenance[1].sha256='bad';}],
    ['receipt after retrieval',source=>{source.provenance[1].retrievedAt='2026-10-24T17:00:00.000Z';}],
    ['unreviewed extra receipt',source=>{source.provenance.push(receipt('https://vendor.example/calendar'));}],
  ];
  for(const [name,mutate]of cases){
    const source=advancedCalendarSource();mutate(source);
    assert.throws(()=>assertNyFedBlsCalendar(source),/New York Fed calendar/i,name);
  }
});

test('calendar admission allows only the reviewed New York Fed index and monthly pages',()=>{
  for(const url of [calendarIndex,novemberCalendar,'https://www.newyorkfed.org/research/calendars/i-dec99.html'])assert.equal(matchesNyFedBlsCalendarFeed(url),true,url);
  for(const url of [calendarIndex+'?copy=1',calendarIndex+'#content',calendarIndex.replace('https:','http:'),calendarIndex.replace('www.newyorkfed.org','newyorkfed.org'),calendarIndex.replace('www.newyorkfed.org','www.newyorkfed.org:443'),calendarIndex.replace('www.newyorkfed.org','www.newyorkfed.org.evil.test'),calendarIndex.replace('https://','https://user@'),novemberCalendar.replace('nov26','nov2026'),novemberCalendar.replace('nov26','xxx26'),'https://www.newyorkfed.org/privacy/termsofuse'])assert.equal(matchesNyFedBlsCalendarFeed(url),false,url);
});

test('calendar admission preserves the reviewed rights and actual secondary schedule identity',()=>{
  assert.doesNotThrow(()=>assertNyFedBlsCalendar(calendarSource()));
  assert.doesNotThrow(()=>assertNyFedBlsCalendar({id:'bls',agency:'U.S. Bureau of Labor Statistics',events:[]}));
  for(const field of ['sourceTitle','termsUrl','licenseUrl','attribution','modificationNotice','sourceNotice']){
    const source=calendarSource();delete source[field];
    assert.throws(()=>assertNyFedBlsCalendar(source),/New York Fed calendar/i,field);
  }
  for(const change of [{agency:'U.S. Bureau of Labor Statistics'},{attribution:calendarSource().attribution.replace('2026','2025')},{modificationNotice:'New York Fed converted all timestamps and endorses this product'},{termsUrl:'https://example.test/terms'}]){
    assert.throws(()=>assertNyFedBlsCalendar({...calendarSource(),...change}),/New York Fed calendar/i,JSON.stringify(change));
  }
});

test('legacy calendar allowance does not admit an explicitly unreviewed publisher',()=>{
  const source={id:'bls',agency:'BLS',provider:'unreviewed-third-party',provenance:[receipt('https://www.bls.gov/schedule/2026/home.htm')],events:[]};
  assert.throws(()=>assertNyFedBlsCalendar(source),/provider|publisher|New York Fed/i);
  delete source.provider;
  source.events=[{provider:'unreviewed-third-party',sourceUrl:'https://www.bls.gov/schedule/2026/home.htm'}];
  assert.throws(()=>assertNyFedBlsCalendar(source),/provider|publisher|New York Fed/i);
});

test('calendar admission rejects publication claims and nonreviewed content in secondary BLS event rows',()=>{
  for(const change of [
    {provider:'bls'},{scheduleBasis:'listed-date'},{period:'2026-10-01'},{periodLabel:'October 2026'},
    {program:'producer-price-index'},{seriesId:'payroll'},{seriesIds:['unrate','payroll']},{agency:'New York Fed'},
    {name:'New York Fed Jobs Forecast'},{time:'09:30'},{date:'2026-11-07'},{scheduledAt:'2026-11-06T12:30:00.000Z'},
    {description:'Unreviewed copied article'},{publishedAt:'2026-11-06T13:30:00.000Z'},{html:'<p>Unreviewed copied calendar</p>'},
  ]){
    const source=calendarSource();Object.assign(source.events[0],change);
    assert.throws(()=>assertNyFedBlsCalendar(source),/New York Fed calendar/i,JSON.stringify(change));
  }
});

test('calendar admission binds events to the captured month pages and the actual retrieval clock',()=>{
  for(const mutate of [
    source=>{source.events[0].sourceUrl=calendarIndex;},
    source=>{source.events[0].date='2026-12-04';source.events[0].scheduledAt='2026-12-04T13:30:00.000Z';},
    source=>{source.provenance.pop();},
    source=>{source.provenance[1].sha256='bad';},
    source=>{source.provenance[1].retrievedAt='2026-10-24T17:00:00.000Z';},
    source=>{source.provenance.push(receipt(novemberCalendar));},
    source=>{source.coveredMonths=['2026-10','2026-12'];},
    source=>{source.unavailableMonths=['2026-11'];},
    source=>{source.coverageEnd='2026-12-31';},
    source=>{source.events.push({...source.events[0]});},
    source=>{source.indexMonth='2026-09';},
  ]){
    const source=calendarSource();mutate(source);
    assert.throws(()=>assertNyFedBlsCalendar(source),/New York Fed calendar/i);
  }
  const previousYear=calendarSource();
  previousYear.fetchedAt='2025-10-24T16:00:00.000Z';previousYear.indexMonth='2025-10';
  previousYear.attribution=previousYear.attribution.replace('2026','2025');
  previousYear.coveredMonths=['2025-10','2025-11'];previousYear.unavailableMonths=['2025-12'];
  previousYear.coverageStart='2025-10-01';previousYear.coverageEnd='2025-11-30';
  previousYear.provenance=previousYear.provenance.map(item=>({...item,url:item.url.replace('nov26','nov25'),retrievedAt:'2025-10-24T16:00:00.000Z'}));
  previousYear.events[0]={...previousYear.events[0],id:'bls-employment-situation-2025-11-07',date:'2025-11-07',scheduledAt:'2025-11-07T13:30:00.000Z',sourceUrl:novemberCalendar.replace('nov26','nov25')};
  assert.doesNotThrow(()=>assertNyFedBlsCalendar(previousYear));
});

test('New York Fed calendar evidence cannot bypass rights admission by removing or changing its provider',()=>{
  for(const provider of [undefined,'bls','another-publisher']){
    const source=calendarSource();source.provider=provider;
    assert.throws(()=>assertNyFedBlsCalendar(source),/New York Fed calendar/i);
  }
  const eventOnly={id:'bls',events:[{sourceUrl:novemberCalendar}]};
  assert.throws(()=>assertNyFedBlsCalendar(eventOnly),/New York Fed calendar/i);
  const receiptOnly={id:'bls',provenance:[receipt(calendarIndex)]};
  assert.throws(()=>assertNyFedBlsCalendar(receiptOnly),/New York Fed calendar/i);
  const legacy={id:'bls',agency:'U.S. Bureau of Labor Statistics',events:[{sourceUrl:'https://www.bls.gov/schedule/2026/home.htm'}],provenance:[receipt('https://www.bls.gov/schedule/2026/home.htm')]};
  assert.doesNotThrow(()=>assertNyFedBlsCalendar(legacy));
});
