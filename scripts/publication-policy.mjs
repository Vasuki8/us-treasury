// Selected official publication history is separate from local retrieval vintages.
export const GDP_PUBLICATION_URL='https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx';
export const GDP_PUBLICATION_TITLE='Vintage History of Quarterly Gross Domestic Product (GDP) and Gross Domestic Income (GDI) Estimates';
export const publicationMetadata={
  seriesId:'gdp',period:'2026-01-01',unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',
  adjustment:'Seasonally adjusted annual rate',publicationDatePrecision:'day',publishedAt:null,
  sourceUrl:GDP_PUBLICATION_URL,sourceTitle:GDP_PUBLICATION_TITLE,
  licenseUrl:'https://www.bea.gov/help/faq/147',attribution:'Source: U.S. Bureau of Economic Analysis.',
  calculation:'Published real GDP percent change from the preceding quarter at an annual rate (NIPA Table 1.1.1, line 1). No calculation or annualization is applied.',
};
export const publicationScope=[
  {estimate:'Advance',publicationDate:'2026-04-30',row:12,releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-advance-estimate-1st-quarter-2026'},
  {estimate:'Second',publicationDate:'2026-05-28',row:11,releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026'},
  {estimate:'Third',publicationDate:'2026-06-25',row:10,releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-1st'},
];
const fail=message=>{throw new Error(`Invalid publication archive: ${message}`);};
const numeric=/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
export function publicationNumber(value){
  if(typeof value!=='string'||!numeric.test(value)||!Number.isFinite(Number(value.replaceAll(',',''))))fail('missing or invalid numeric value');
  return Number(value.replaceAll(',',''));
}
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** BEA's text dates, or whole-day dates in Excel's reviewed 1900 system. */
export function publicationDateFromSource(raw){
  if(typeof raw!=='string')fail('publication date source text');
  if(/^\d+$/.test(raw)){
    const serial=Number(raw);
    if(!Number.isSafeInteger(serial)||serial<61||serial>100000)fail('Excel publication date serial');
    return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
  }
  const match=/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})(?: GDI not published)?$/.exec(raw),month=match?months.indexOf(match[1]):-1;
  if(month<0)fail('publication date text or annotation');
  const date=`${match[3]}-${String(month+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  if(!isoDate(date))fail('publication date');
  return date;
}
export const publicationId=scope=>`bea-gdp-2026q1-${scope.estimate.toLowerCase()}-${scope.publicationDate}`;
export const publicationCells=scope=>({period:'A6',estimate:`B${scope.row}`,value:`E${scope.row}`,publicationDate:`G${scope.row}`});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function keys(value,allowed,label){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(`unreviewed ${label} field`);}

/** Pure admission for only the reviewed GDP 2026Q1 three-release sample. */
export function assertPublicationData(archive){
  keys(archive,['version','releases'],'archive');
  if(archive.version!==1||!Array.isArray(archive.releases)||![0,3].includes(archive.releases.length))fail('version or complete selected publication scope');
  const seen=new Set();
  for(const release of archive.releases){
    keys(release,[...Object.keys(publicationMetadata),'id','estimate','publicationDate','value','sourceValue','sourcePublicationDate','sourceIds','releaseEvidenceUrl','sourceCells','provenance'],'release');
    const scope=publicationScope.find(item=>item.estimate===release.estimate);
    if(!scope||release.id!==publicationId(scope)||seen.has(release.id))fail('unreviewed or duplicate publication scope');
    seen.add(release.id);
    for(const [key,value]of Object.entries(publicationMetadata))if(release[key]!==value)fail(`unreviewed publication metadata ${key}`);
    if(release.publicationDate!==scope.publicationDate||publicationDateFromSource(release.sourcePublicationDate)!==scope.publicationDate||release.sourcePublicationDate.endsWith('GDI not published')&&scope.estimate!=='Advance')fail('publication date scope');
    if(!Number.isFinite(release.value)||publicationNumber(release.sourceValue)!==release.value)fail('publication source value');
    if(!Array.isArray(release.sourceIds)||release.sourceIds.length!==1||release.sourceIds[0]!=='A191RL'||release.releaseEvidenceUrl!==scope.releaseEvidenceUrl)fail('publication source scope');
    const expected=publicationCells(scope);keys(release.sourceCells,Object.keys(expected),'source cells');
    for(const [key,value]of Object.entries(expected))if(release.sourceCells[key]!==value)fail('publication source cell scope');
    if(!Array.isArray(release.provenance)||release.provenance.length!==1)fail('publication provenance scope');
    const source=release.provenance[0];keys(source,['url','sha256','retrievedAt','lastModified'],'provenance');
    if(source.url!==GDP_PUBLICATION_URL||!/^[a-f0-9]{64}$/.test(source.sha256??'')||!utc(source.retrievedAt)||source.retrievedAt.slice(0,10)<scope.publicationDate)fail('publication provenance date, source or hash');
    if(source.lastModified!==null&&(typeof source.lastModified!=='string'||source.lastModified.length>200||!Number.isFinite(Date.parse(source.lastModified))))fail('publication provenance last-modified metadata');
  }
  return true;
}
