import {requestText} from './http.mjs';
import {cpiPublicationScope,cpiPublicationMetadataFor,requestedCpiPublicationIds,assertCpiPublicationData} from '../cpi-publication-policy.mjs';
const fail=message=>{throw Error('Invalid CPI publication: '+message);};
const clean=text=>text.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const shortMonths=['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.'];
const label=date=>`${shortMonths[Number(date.slice(5,7))-1]} ${date.slice(0,4)}`;
const unique=(values,description)=>{if(values.length!==1)fail('missing or duplicate '+description);return values[0];};
const attribute=(text,name)=>new RegExp(`\\b${name}="([^"]*)"`,'i').exec(text)?.[1];
/** Deliberately restricted to the reviewed Table A layout and exact cell identities. */
export function parseCpiPublication(html,{provenance,ids}={}){
 if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)fail('HTML byte limit');
 const scopes=cpiPublicationScope.filter(row=>row.sourceUrl===provenance?.url);if(!scopes.length)fail('unreviewed source URL');
 const requested=requestedCpiPublicationIds(ids??scopes.map(row=>row.id));if(requested.some(id=>!scopes.some(row=>row.id===id)))fail('requested scope from another edition');
 const headings=[...html.matchAll(/<h1\b[^>]*>([^]*?)<\/h1>/gi)].map(match=>clean(match[1]));
 if(unique(headings,'heading')!=='Consumer Price Index News Release')fail('release title');
 const scope=scopes[0],pre=unique([...html.matchAll(/<pre\b[^>]*>([^]*?)<\/pre>/gi)].map(match=>clean(match[1])).filter(text=>text.includes('CONSUMER PRICE INDEX -')),'release narrative');
 const publicationText=`${months[Number(scope.publicationDate.slice(5,7))-1]} ${Number(scope.publicationDate.slice(8,10))}, ${scope.publicationDate.slice(0,4)}`;
 const referenceText=`CONSUMER PRICE INDEX - ${months[Number(scope.referencePeriod.slice(5,7))-1].toUpperCase()} ${scope.referencePeriod.slice(0,4)}`;
 if(!pre.includes(publicationText)||!pre.includes(referenceText)||unique([...pre.matchAll(/USDL-\d{2}-\d{4}/g)].map(match=>match[0]),'release number')!==scope.releaseNumber)fail('publication day, reference period or USDL identity');
 const table=unique([...html.matchAll(/<table\b([^>]*)>([^]*?)<\/table>/gi)].filter(match=>attribute(match[1],'id')==='cpi_pressa'),'Table A')[2];
 if(clean(unique([...table.matchAll(/<caption\b[^>]*>([^]*?)<\/caption>/gi)],'caption')[1])!=='Table A. Percent changes in CPI for All Urban Consumers (CPI-U): U.S. city average')fail('population or caption');
 const missingNotice=clean(table).includes('NOTE: The Oct and Nov 2025 data values are not available due to the 2025 lapse in appropriations.');
 if(missingNotice!==(scope.publicationDate<='2026-06-10'))fail('reviewed Table A missing-data notice changed');
 if(scope.publicationDate==='2026-02-13'&&!clean(html).includes('seasonal adjustment factors were recalculated to reflect price movements from the just-completed calendar year. This process results in revisions to seasonally adjusted indexes for the previous 5 years.'))fail('February seasonal adjustment notice changed');
 const headers=[...table.matchAll(/<th\b([^>]*)>([^]*?)<\/th>/gi)];
 const header=id=>unique(headers.filter(match=>attribute(match[1],'id')===id),id);
 if(clean(header('cpi_pressa.h.1.2')[2])!=='Seasonally adjusted changes from preceding month')fail('monthly adjustment header');
 if(clean(header('cpi_pressa.h.1.9')[2])!==`Un- adjusted 12-mos. ended ${label(scope.referencePeriod)}`)fail('annual horizon/header');
 for(const current of scopes){
  const expectedRow=current.rowId==='cpi_pressa.r.1'?'All items':'All items less food and energy';if(clean(header(current.rowId)[2])!==expectedRow)fail('row population');
  if(current.seriesId.endsWith('Monthly')){const column=header(current.columnId);if(clean(column[2])!==label(current.period)||attribute(column[1],'headers')!=='cpi_pressa.h.1.2')fail('monthly reference header');}
 }
 const cells=[...table.matchAll(/<td\b([^>]*)>([^]*?)<\/td>/gi)];
 const releases=scopes.map(current=>{
  const cell=unique(cells.filter(match=>attribute(match[1],'headers')===current.headers),current.headers),sourceValue=clean(cell[2]);
  if(!/^-?\d+\.\d$/.test(sourceValue)||sourceValue!==current.sourceValue)fail('reviewed published value changed');
  return {...cpiPublicationMetadataFor(current),provenance:[provenance]};
 });
 const archive={version:1,releases:releases.filter(row=>requested.includes(row.id))};assertCpiPublicationData(archive,{ids:requested});return archive;
}
export async function collectCpiPublications({fetchImpl=globalThis.fetch,ids}={}){
 const requested=requestedCpiPublicationIds(ids),wanted=new Set(requested),scopes=cpiPublicationScope.filter(row=>wanted.has(row.id)),rows=new Map();
 for(const url of new Set(scopes.map(row=>row.sourceUrl))){
  const {text,...provenance}=await requestText(url,{fetchImpl,maxBytes:2*1024*1024});if(provenance.url!==url)fail('unreviewed redirect');
  const batch=parseCpiPublication(text,{provenance,ids:scopes.filter(row=>row.sourceUrl===url).map(row=>row.id)});for(const row of batch.releases)rows.set(row.id,row);
 }
 const archive={version:1,releases:requested.map(id=>rows.get(id))};assertCpiPublicationData(archive,{ids:requested});return archive;
}
