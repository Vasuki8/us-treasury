import {extractZipEntry} from './zip.mjs';
import {requestBytes} from './http.mjs';
import {GDP_PUBLICATION_URL,GDP_LEGACY_PUBLICATION_URL,GDP_PUBLICATION_TITLE,publicationMetadataFor,publicationScope,septemberWorkbookScope,legacyPublicationScope,publicationId,publicationCells,publicationNumber,publicationDateFromSource,requestedPublicationIds,assertPublicationData} from '../publication-policy.mjs';
export {GDP_PUBLICATION_URL,GDP_LEGACY_PUBLICATION_URL};
const sheetNamespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const fail=message=>{throw new Error(`Invalid BEA publication workbook: ${message}`);};

function entities(text){
  return text.replace(/&([^;]*);|&/g,(all,entity)=>{
    const named={amp:'&',lt:'<',gt:'>',apos:"'",quot:'"'};
    if(Object.hasOwn(named,entity))return named[entity];
    if(!/^#(?:\d+|x[0-9a-fA-F]+)$/.test(entity??''))fail('XML entity');
    const value=entity[1]==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
    if(!Number.isSafeInteger(value)||value>0x10ffff||value===0||value>=0xd800&&value<=0xdfff||value<32&&![9,10,13].includes(value))fail('XML character');
    return String.fromCodePoint(value);
  });
}

// Small bounded XML tree reader for four OOXML members. It cannot resolve
// external entities, evaluate formulas or follow relationships on the network.
function xml(bytes){
  let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('XML UTF-8 encoding');}
  source=source.replace(/^\ufeff/,'');
  const document={name:'#document',attrs:{},children:[],text:''},stack=[document];let offset=0,nodes=0;
  while(offset<source.length){
    if(source.startsWith('<!--',offset)){
      const end=source.indexOf('-->',offset+4),body=source.slice(offset+4,end);
      if(end<0||body.includes('--')||body.endsWith('-'))fail('XML comment');offset=end+3;continue;
    }
    if(source.startsWith('<?xml ',offset)&&offset===0){const end=source.indexOf('?>',offset);if(end<0)fail('XML declaration');offset=end+2;continue;}
    if(source[offset]!=='<'){
      let end=source.indexOf('<',offset);if(end<0)end=source.length;
      const value=source.slice(offset,end);if(value.includes(']]>')||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))fail('XML text');
      stack.at(-1).text+=entities(value);offset=end;continue;
    }
    const close=/^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(source.slice(offset));
    if(close){if(stack.length===1||stack.at(-1).name!==close[1])fail('XML closing tag');stack.pop();offset+=close[0].length;continue;}
    const start=/^<([A-Za-z_][\w.:-]*)/.exec(source.slice(offset));if(!start)fail('XML declaration or tag');
    const node={name:start[1],attrs:{},children:[],text:''};let cursor=offset+start[0].length,selfClosing=false;
    while(true){
      if(source.startsWith('/>',cursor)){selfClosing=true;cursor+=2;break;}
      if(source[cursor]==='>'){cursor++;break;}
      const attr=/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(source.slice(cursor));
      if(!attr){const end=/^\s*(\/?>)/.exec(source.slice(cursor));if(end){selfClosing=end[1]==='/>';cursor+=end[0].length;break;}fail('XML attribute');}
      if(Object.hasOwn(node.attrs,attr[1]))fail('duplicate XML attribute');node.attrs[attr[1]]=entities(attr[2]??attr[3]);cursor+=attr[0].length;
    }
    if(++nodes>100000||stack.length>32)fail('XML node or depth limit');
    stack.at(-1).children.push(node);if(!selfClosing)stack.push(node);offset=cursor;
  }
  if(stack.length!==1||document.children.length!==1||document.text.trim())fail('XML document structure');
  return document.children[0];
}
const children=(node,name)=>node.children.filter(item=>item.name===name);
function one(node,name){const found=children(node,name);if(found.length!==1)fail(`missing or duplicate XML ${name}`);return found[0];}
function text(node){if(node.children.length)fail('XML text cell schema');return node.text;}
function member(bytes,name,maxOutputBytes=1024*1024){return xml(extractZipEntry(bytes,name,{maxOutputBytes,maxEntries:30}));}

function workbookCells(bytes){
  if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))fail('workbook bytes');
  if(bytes.length>2*1024*1024)fail('workbook byte limit');
  const book=member(bytes,'xl/workbook.xml',32*1024);
  if(book.name!=='workbook'||book.attrs.xmlns!==sheetNamespace||book.attrs['xmlns:r']!=='http://schemas.openxmlformats.org/officeDocument/2006/relationships')fail('workbook XML namespace');
  const properties=children(book,'workbookPr');if(properties.length>1||properties[0]?.attrs.date1904&&!['0','false'].includes(properties[0].attrs.date1904))fail('unsupported Excel date system');
  const sheets=children(one(book,'sheets'),'sheet').filter(node=>node.attrs.name==='Vintage History');
  if(sheets.length!==1||!sheets[0].attrs['r:id'])fail('missing or duplicate Vintage History worksheet');
  const relationships=member(bytes,'xl/_rels/workbook.xml.rels',32*1024);
  if(relationships.name!=='Relationships'||relationships.attrs.xmlns!=='http://schemas.openxmlformats.org/package/2006/relationships')fail('XML relationship namespace');
  const selected=children(relationships,'Relationship').filter(node=>node.attrs.Id===sheets[0].attrs['r:id']);
  if(selected.length!==1||selected[0].attrs.Target!=='worksheets/sheet2.xml'||selected[0].attrs.TargetMode||selected[0].attrs.Type!=='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet')fail('unreviewed worksheet relationship');
  const shared=member(bytes,'xl/sharedStrings.xml',256*1024);
  if(shared.name!=='sst'||shared.attrs.xmlns!==sheetNamespace)fail('XML shared string namespace');
  const strings=children(shared,'si').map(item=>{
    if(item.children.length===1&&item.children[0].name==='t')return text(item.children[0]);
    if(item.children.length&&item.children.every(run=>run.name==='r'))return item.children.map(run=>text(one(run,'t'))).join('');
    fail('XML shared string schema');
  });
  if(!/^\d+$/.test(shared.attrs.uniqueCount??'')||Number(shared.attrs.uniqueCount)!==strings.length)fail('XML shared string count');
  const sheet=member(bytes,'xl/worksheets/sheet2.xml');if(sheet.name!=='worksheet'||sheet.attrs.xmlns!==sheetNamespace)fail('worksheet namespace');
  const cells=new Map(),rows=new Set();
  for(const row of children(one(sheet,'sheetData'),'row')){
    if(!/^[1-9]\d*$/.test(row.attrs.r??'')||rows.has(row.attrs.r))fail('duplicate or invalid worksheet row');rows.add(row.attrs.r);
    for(const cell of children(row,'c')){
      const ref=cell.attrs.r;if(!/^[A-Z]{1,3}[1-9]\d*$/.test(ref??'')||ref.match(/\d+$/)[0]!==row.attrs.r||cells.has(ref))fail('duplicate cell or inconsistent row');
      if(children(cell,'f').length)fail('formula cell');
      const values=children(cell,'v');if(values.length>1||cell.children.some(node=>node.name!=='v'))fail('XML cell schema');
      if(!values.length){cells.set(ref,'');continue;}
      const raw=text(values[0]);let value=raw;
      if(cell.attrs.t==='s'){
        if(!/^\d+$/.test(raw)||Number(raw)>=strings.length)fail('invalid shared string cell index');value=strings[Number(raw)];
      }else if(cell.attrs.t&&!['n'].includes(cell.attrs.t))fail('unsupported worksheet cell type');
      cells.set(ref,value);
    }
  }
  return cells;
}

function reviewedTable(cells,scopes,legacy){
  const headers={A1:GDP_PUBLICATION_TITLE,A2:legacy?'Last Updated June 25, 2026':'Last Updated September 30, 2026'};
  const quarters=new Map(scopes.map(scope=>[scope.periodRow,scope.period]));
  for(const [p,period]of quarters){
    const quarter=period.slice(0,4)+'Q'+(Number(period.slice(5,7))+2)/3;
    Object.assign(headers,{['A'+p]:quarter,['E'+(p+1)]:'Percent Change',['B'+(p+2)]:'Vintage',['C'+(p+2)]:'Billions of Current Dollars',['E'+(p+2)]:'from Preceding Period',['C'+(p+3)]:'GDP',['D'+(p+3)]:'GDI',['E'+(p+3)]:'Real GDP',['F'+(p+3)]:'Real GDI',['G'+(p+3)]:'Release Date'});
    if([...cells].filter(([ref,value])=>/^A\d+$/.test(ref)&&value===quarter).length!==1)fail('duplicate or missing estimate quarter');
  }
  for(const [ref,value]of Object.entries(headers))if(cells.get(ref)!==value)fail(`unreviewed header ${ref}`);
  if(!legacy){
    if(!cells.get('A4')?.includes('first quarter of 2002'))fail('unreviewed historical coverage header');
    const markers=[...cells].filter(([ref,value])=>/^A\d+$/.test(ref)&&/^\d{4}Q[1-4]$/.test(value));
    if(markers.length!==quarters.size)fail('unreviewed estimate quarter coverage');
    const rows=new Set(scopes.map(scope=>scope.row));
    for(const [ref,value]of cells)if(/^B\d+$/.test(ref)&&value&&value!=='Vintage'&&!rows.has(Number(ref.slice(1))))fail('unreviewed publication row');
  }else if(cells.get('B13'))fail('duplicate selected estimate row');
  const values=new Map();
  for(const scope of scopes){
    const refs=publicationCells(scope),sourceValue=cells.get(refs.value),sourcePublicationDate=cells.get(refs.publicationDate);
    if(cells.get(refs.estimate)!==scope.estimate)fail('unreviewed estimate header');
    if(publicationDateFromSource(sourcePublicationDate)!==scope.publicationDate||sourcePublicationDate!==scope.sourcePublicationDate&&!(legacy&&/^\d+$/.test(sourcePublicationDate)))fail('unreviewed publication date or annotation scope');
    if(sourceValue!==scope.sourceValue)fail('unreviewed publication source value token');
    const value=publicationNumber(sourceValue),old=legacyPublicationScope.find(item=>item.id===scope.id);
    // These three facts already exist immutably under the June source. A newer
    // compilation cannot silently contradict them while default output omits them.
    if(!legacy&&old&&value!==publicationNumber(old.sourceValue))fail('legacy publication overlap value changed');
    values.set(scope.id,{sourceValue,sourcePublicationDate,value});
  }
  return values;
}

/** Validate every reviewed row before returning a requested subset. */
export function parseGdpPublicationWorkbook(bytes,{provenance,ids}={}){
  const legacy=provenance?.url===GDP_LEGACY_PUBLICATION_URL;
  if(!legacy&&provenance?.url!==GDP_PUBLICATION_URL)fail('unreviewed source URL');
  const eligible=publicationScope.filter(scope=>scope.sourceUrl===provenance.url);
  const requested=requestedPublicationIds(ids??eligible.map(publicationId));
  if(requested.some(id=>!eligible.some(scope=>scope.id===id)))fail('requested publication has a different reviewed source workbook');
  const values=reviewedTable(workbookCells(bytes),legacy?legacyPublicationScope:septemberWorkbookScope,legacy);
  const byId=new Map(eligible.map(scope=>[scope.id,scope]));
  const releases=requested.map(id=>{
    const scope=byId.get(id),{sourceValue,sourcePublicationDate,value}=values.get(id);
    return {...publicationMetadataFor(scope),id,estimate:scope.estimate,publicationDate:scope.publicationDate,value,sourceValue,sourcePublicationDate,sourceIds:['A191RL'],releaseEvidenceUrl:scope.releaseEvidenceUrl,sourceCells:publicationCells(scope),provenance:[provenance]};
  });
  const result={version:1,releases};assertPublicationData(result,{ids:requested});return result;
}

/** Defaults to only the new September facts; June is fetched for explicit legacy IDs. */
export async function collectPublications({fetchImpl=globalThis.fetch,ids}={}){
  const requested=requestedPublicationIds(ids===undefined?publicationScope.filter(scope=>scope.sourceUrl===GDP_PUBLICATION_URL).map(publicationId):ids);
  const byId=new Map(publicationScope.map(scope=>[scope.id,scope]));
  const urls=[...new Set(requested.map(id=>byId.get(id).sourceUrl))];
  const results=await Promise.all(urls.map(async sourceUrl=>{
    const response=await requestBytes(sourceUrl,{maxBytes:2*1024*1024,headers:{Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},fetchImpl:async(url,options)=>{
      const result=await fetchImpl(url,options);if(result.redirected||result.url&&result.url!==url)fail('unreviewed source URL or redirect');return result;
    }});
    const {bytes,...provenance}=response;
    return parseGdpPublicationWorkbook(bytes,{provenance,ids:requested.filter(id=>byId.get(id).sourceUrl===sourceUrl)});
  }));
  const records=new Map(results.flatMap(result=>result.releases).map(release=>[release.id,release]));
  const result={version:1,releases:requested.map(id=>records.get(id))};assertPublicationData(result,{ids:requested});return result;
}
