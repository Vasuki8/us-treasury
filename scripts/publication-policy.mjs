import {gdpSeptemberRows} from './gdp-publication-scope.mjs';
export const GDP_LEGACY_PUBLICATION_URL='https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx';
export const GDP_PUBLICATION_URL='https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx';
export const GDP_PUBLICATION_TITLE='Vintage History of Quarterly Gross Domestic Product (GDP) and Gross Domestic Income (GDI) Estimates';
export const publicationMetadata={
  seriesId:'gdp',unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',
  adjustment:'Seasonally adjusted annual rate',publicationDatePrecision:'day',publishedAt:null,sourceTitle:GDP_PUBLICATION_TITLE,
  licenseUrl:'https://www.bea.gov/help/faq/147',attribution:'Source: U.S. Bureau of Economic Analysis.',
  calculation:'Published real GDP percent change from the preceding quarter at an annual rate (NIPA Table 1.1.1, line 1). No calculation or annualization is applied.',
};
const fail=message=>{throw new Error('Invalid publication archive: '+message);};
const numeric=/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
export function publicationNumber(value){
  if(typeof value!=='string'||!numeric.test(value)||!Number.isFinite(Number(value.replaceAll(',',''))))fail('missing or invalid numeric value');
  return Number(value.replaceAll(',',''));
}
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dateNotes=new Set(['','GDI not published','Percent change in GDI not published','GDP not open for revision','GDI percent change not published; GDP not revised']);

/** Original text/annotations, or whole-day serials in Excel's 1900 system. */
export function publicationDateFromSource(raw){
  if(typeof raw!=='string')fail('publication date source text');
  if(/^\d+$/.test(raw)){
    const serial=Number(raw);
    if(!Number.isSafeInteger(serial)||serial<61||serial>100000)fail('Excel publication date serial');
    return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
  }
  const match=/^([A-Z][a-z]{2}) +(\d{1,2}), +(\d{4})(.*)$/.exec(raw),month=match?months.indexOf(match[1]):-1;
  if(month<0||!dateNotes.has(match[4].trim()))fail('publication date text or annotation');
  const date=match[3]+'-'+String(month+1).padStart(2,'0')+'-'+match[2].padStart(2,'0');
  if(!isoDate(date))fail('publication date');return date;
}
export function publicationId(scope){
  if(!isoDate(scope.period)||!['01','04','07','10'].includes(scope.period.slice(5,7))||scope.period.slice(8)!=='01'||!['Advance','Second','Third','Preliminary','Final','Initial','Updated','Revised'].includes(scope.estimate)||!isoDate(scope.publicationDate))fail('publication identity scope');
  return 'bea-gdp-'+scope.period.slice(0,4)+'q'+(Number(scope.period.slice(5,7))+2)/3+'-'+scope.estimate.toLowerCase()+'-'+scope.publicationDate;
}
export const publicationCells=scope=>({period:'A'+scope.periodRow,estimate:'B'+scope.row,value:'E'+scope.row,publicationDate:'G'+scope.row});
export const publicationMetadataFor=scope=>({...publicationMetadata,period:scope.period,sourceUrl:scope.sourceUrl});

// This dated compilation has 98 contiguous quarters and all eight raw stage labels.
export const septemberWorkbookScope=Object.freeze(gdpSeptemberRows.map(([period,estimate,publicationDate,periodRow,row,sourceValue,sourcePublicationDate])=>{
  const scope={period,estimate,publicationDate,periodRow,row,sourceValue,sourcePublicationDate,sourceUrl:GDP_PUBLICATION_URL,releaseEvidenceUrl:GDP_PUBLICATION_URL};
  return Object.freeze({...scope,id:publicationId(scope)});
}));
export const legacyPublicationScope=Object.freeze([
  {period:'2026-01-01',estimate:'Advance',publicationDate:'2026-04-30',periodRow:6,row:12,sourceValue:'2.0',sourcePublicationDate:'Apr 30, 2026 GDI not published',releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-advance-estimate-1st-quarter-2026'},
  {period:'2026-01-01',estimate:'Second',publicationDate:'2026-05-28',periodRow:6,row:11,sourceValue:'1.6',sourcePublicationDate:'May 28, 2026',releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026'},
  {period:'2026-01-01',estimate:'Third',publicationDate:'2026-06-25',periodRow:6,row:10,sourceValue:'2.1',sourcePublicationDate:'Jun 25, 2026',releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-1st'},
].map(scope=>Object.freeze({...scope,sourceUrl:GDP_LEGACY_PUBLICATION_URL,id:publicationId(scope)})));
const legacyIds=new Set(legacyPublicationScope.map(publicationId));
export const publicationScope=Object.freeze([...legacyPublicationScope,...septemberWorkbookScope.filter(scope=>!legacyIds.has(scope.id))]);
const byId=new Map(publicationScope.map(scope=>[scope.id,scope]));
if(byId.size!==1076||septemberWorkbookScope.length!==1076)fail('reviewed scope manifest');

export function requestedPublicationIds(ids=publicationScope.map(publicationId)){
  if(!Array.isArray(ids)||ids.length>publicationScope.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!byId.has(id)))fail('unknown or duplicate requested publication IDs');
  return [...ids];
}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function keys(value,allowed,label){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('unreviewed '+label+' field');}

/** Subsets support append-only imports; ids/complete optionally require an exact batch. */
export function assertPublicationData(archive,{complete=false,ids}={}){
  keys(archive,['version','releases'],'archive');
  if(archive.version!==1||!Array.isArray(archive.releases)||archive.releases.length>publicationScope.length)fail('version or selected publication scope');
  const seen=new Set();
  for(const release of archive.releases){
    keys(release,[...Object.keys(publicationMetadata),'period','sourceUrl','id','estimate','publicationDate','value','sourceValue','sourcePublicationDate','sourceIds','releaseEvidenceUrl','sourceCells','provenance'],'release');
    const scope=byId.get(release.id);
    if(!scope||release.id!==publicationId(scope)||seen.has(release.id))fail('unreviewed or duplicate publication scope');seen.add(release.id);
    for(const [key,value]of Object.entries(publicationMetadataFor(scope)))if(release[key]!==value)fail('unreviewed publication metadata '+key);
    const legacy=scope.sourceUrl===GDP_LEGACY_PUBLICATION_URL;
    if(release.estimate!==scope.estimate||release.publicationDate!==scope.publicationDate||publicationDateFromSource(release.sourcePublicationDate)!==scope.publicationDate||release.sourcePublicationDate!==scope.sourcePublicationDate&&!(legacy&&/^\d+$/.test(release.sourcePublicationDate)))fail('publication date, annotation or estimate scope');
    if(release.sourceValue!==scope.sourceValue||!Number.isFinite(release.value)||publicationNumber(release.sourceValue)!==release.value)fail('unreviewed publication source value');
    if(!Array.isArray(release.sourceIds)||release.sourceIds.length!==1||release.sourceIds[0]!=='A191RL'||release.releaseEvidenceUrl!==scope.releaseEvidenceUrl)fail('publication source scope');
    const expected=publicationCells(scope);keys(release.sourceCells,Object.keys(expected),'source cells');
    for(const [key,value]of Object.entries(expected))if(release.sourceCells[key]!==value)fail('publication source cell scope');
    if(!Array.isArray(release.provenance)||release.provenance.length!==1)fail('publication provenance scope');
    const source=release.provenance[0];keys(source,['url','sha256','retrievedAt','lastModified'],'provenance');
    if(source.url!==scope.sourceUrl||!/^[a-f0-9]{64}$/.test(source.sha256??'')||!utc(source.retrievedAt)||source.retrievedAt.slice(0,10)<scope.publicationDate)fail('publication provenance date, source or hash');
    if(source.lastModified!==null&&(typeof source.lastModified!=='string'||source.lastModified.length>200||!Number.isFinite(Date.parse(source.lastModified))))fail('publication provenance last-modified metadata');
  }
  if(ids!==undefined||complete){const expected=requestedPublicationIds(ids);if(seen.size!==expected.length||expected.some(id=>!seen.has(id)))fail('incomplete or unrequested publication batch');}
  return true;
}
