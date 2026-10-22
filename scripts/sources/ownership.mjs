import { parseCsv, requestBytes, requestText } from './http.mjs';
import { extractZipEntry } from './zip.mjs';
import { decodeHtmlText } from './calendar-utils.mjs';

export const Z1_URL = 'https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip';
export const Z1_RELEASE_URL = 'https://www.federalreserve.gov/releases/z1/default.htm';
export const SOMA_URL = 'https://markets.newyorkfed.org/api/soma/summary.json';
export const SOMA_TERMS_URL = 'https://www.newyorkfed.org/privacy/termsofuse.html';
const CODES = [
  ['LM153061105.Q','Households and nonprofit organizations'],['LM103061103.Q','Nonfinancial corporate business'],
  ['LM113061003.Q','Nonfinancial noncorporate business'],['LM213061103.Q','State and local governments'],
  ['LM713061103.Q','Federal Reserve / central bank'],['LM763061100.Q','U.S.-chartered depository institutions'],
  ['LM753061103.Q','Foreign banking offices in the U.S.'],['LM743061103.Q','Banks in U.S.-affiliated areas'],
  ['LM473061105.Q','Credit unions'],['LM513061105.Q','Property-casualty insurance companies'],
  ['LM543061105.Q','Life insurance companies'],['LM573061105.Q','Private pension funds'],
  ['LM343061105.Q','Federal government pension funds'],['LM223061143.Q','State and local government pension funds'],
  ['FL633061105.Q','Money market funds'],['LM653061105.Q','Mutual funds'],['LM553061103.Q','Closed-end funds'],
  ['LM563061103.Q','Exchange-traded funds'],['LM623061103.Q','Domestic hedge funds, net of short sales'],
  ['LM403061105.Q','Government-sponsored enterprises'],['FL673061103.Q','Issuers of asset-backed securities'],
  ['LM663061105.Q','Security brokers and dealers, net'],['LM733061103.Q','Holding companies'],
  ['FL503061123.Q','Central clearing counterparties'],['LM263061105.Q','Rest of the world'],
];
const TOTALS = ['FL313161105.Q','FL893061105.Q','LM903061103.Q'];
const fail = detail => { throw new Error(`Official ownership data: ${detail}`); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const sum = values => values.reduce((total, value) => total + value, 0);
function number(raw, { missing = false } = {}) {
  if (missing && ['ND','NA','N/A','',null,undefined].includes(raw)) return null;
  if (raw === null || raw === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(raw)) || !Number.isFinite(Number(raw))) fail('missing or invalid numeric holding');
  return Number(raw);
}
function date(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail('invalid date');
  const value = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0,10) !== raw) fail('invalid date');
  return raw;
}
function quarter(raw) {
  const match = /^(\d{4}):Q([1-4])$/.exec(raw);
  if (!match) fail('invalid Z1 quarter');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) * 3, 0)).toISOString().slice(0,10);
}

export function parseZ1Ownership(text, dictionary, { now = new Date() } = {}) {
  const [header,...rawRows] = parseCsv(text);
  const required = [...TOTALS,...CODES.map(([code]) => code)];
  if (!header || header[0] !== 'date' || new Set(header).size !== header.length || required.some(code => !header.includes(code))) fail('Z1 headers or required series');
  const definitions = new Map();
  for (const line of String(dictionary).trim().split(/\r?\n/)) {
    const fields = line.split('\t');
    if (definitions.has(fields[0])) fail('duplicate Z1 dictionary series');
    definitions.set(fields[0],fields);
  }
  for (const code of required) {
    const fields = definitions.get(code);
    if (!fields || fields.length !== 5 || fields[3] !== 'F3.2.s Treasury securities' || !fields[4].startsWith('Millions of dollars; amounts outstanding end of period,') || !fields[4].endsWith('not seasonally adjusted')) fail('Z1 dictionary identity or units');
    if (code.startsWith('LM') && !fields[4].includes('market value')) fail('Z1 market valuation definition');
  }
  if (!definitions.get('LM713061103.Q')[1].includes('Central bank; total Treasury securities') || !definitions.get('LM263061105.Q')[1].includes('Rest of the world; Treasury securities')) fail('Z1 holder identity');
  const cutoff = now.toISOString().slice(0,10), dates = new Set();
  const allRows = rawRows.map(row => {
    if (row.length !== header.length) fail('Z1 row schema');
    const period = quarter(row[0]);
    if (dates.has(period)) fail('duplicate Z1 quarter');
    dates.add(period); return { period, row };
  }).filter(({period}) => period <= cutoff).sort((a,b) => a.period.localeCompare(b.period)).slice(-36);
  if (!allRows.length) fail('no Z1 observations');
  const warnings=[];
  const history=allRows.map(({period,row}) => {
    const get = code => { const value = number(row[header.indexOf(code)],{missing:true}); return value === null ? null : value/1000; };
    const sectors=CODES.map(([code,label]) => ({code,label,value:get(code),valuation:code.startsWith('LM')?'market value':'reported non-market basis',sourceDescription:definitions.get(code)[1]}));
    const [liabilities,assets,valuationDiscrepancy]=TOTALS.map(get);
    const complete=[liabilities,assets,valuationDiscrepancy,...sectors.map(row=>row.value)].every(finite);
    if (complete && (Math.abs(sum(sectors.map(row=>row.value))-assets)>0.025 || Math.abs(liabilities-assets-valuationDiscrepancy)>0.025)) fail(`Z1 reconciliation at ${period}`);
    if (!complete) warnings.push(`Incomplete Z1 sector observations at ${period}; missing values are not filled and reconciliation is unavailable.`);
    return {date:period,sectors,liabilities,assets,valuationDiscrepancy,reconciled:complete};
  });
  const latest=history.at(-1);
  return {asOf:latest.date,unit:'USD billions',...Object.fromEntries(['sectors','liabilities','assets','valuationDiscrepancy','reconciled'].map(key=>[key,latest[key]])),history,warnings};
}

export function parseSomaOwnership(payload, { now = new Date() } = {}) {
  if (!Array.isArray(payload?.soma?.summary) || !payload.soma.summary.length) fail('empty SOMA summary');
  const cutoff=now.toISOString().slice(0,10),seen=new Set();
  const eligible=payload.soma.summary.map(row=>{
    const period=date(row.asOfDate);
    if (seen.has(period)) fail('duplicate SOMA date');
    seen.add(period);return {period,row};
  }).filter(({period})=>period<=cutoff).sort((a,b)=>a.period.localeCompare(b.period)).slice(-104);
  if (!eligible.length) fail('no SOMA observations');
  const history=eligible.map(({period,row})=>{
    const components=Object.fromEntries(['bills','notesbonds','tips','frn','tipsInflationCompensation'].map(key=>[key,number(row[key])/1e9]));
    if (['bills','notesbonds','tips','frn'].some(key=>components[key]<0)) fail('negative SOMA principal');
    const principal=sum(['bills','notesbonds','tips','frn'].map(key=>components[key]));
    return {date:period,principal,inflationCompensation:components.tipsInflationCompensation,adjustedPrincipal:principal+components.tipsInflationCompensation,components};
  });
  const latest=history.at(-1);
  const warnings=history.filter(row=>new Date(`${row.date}T00:00:00Z`).getUTCDay()!==3).map(row=>`SOMA explicitly posted exception date ${row.date}; usual Wednesday timing is not substituted for that observation.`);
  return {asOf:latest.date,unit:'USD billions',principal:latest.principal,inflationCompensation:latest.inflationCompensation,adjustedPrincipal:latest.adjustedPrincipal,history,warnings};
}

function releaseMetadata(html) {
  const text=decodeHtmlText(html);
  const match=/Release Date:\s*([A-Z][a-z]+) (\d{1,2}), (\d{4}) (\d{4}):Q([1-4]) Release/.exec(text);
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month=match?months.indexOf(match[1]):-1;
  if (month<0) fail('unrecognized Z1 release metadata');
  return {releaseDate:date(`${match[3]}-${String(month+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`),period:quarter(`${match[4]}:Q${match[5]}`)};
}

export async function collectOwnership({ fetchImpl=globalThis.fetch, now=new Date() }={}) {
  const [archive,page,somaResponse]=await Promise.all([
    requestBytes(Z1_URL,{fetchImpl,maxBytes:24*1024*1024}),
    requestText(Z1_RELEASE_URL,{fetchImpl,maxBytes:2*1024*1024}),
    requestText(SOMA_URL,{fetchImpl,maxBytes:2*1024*1024}),
  ]);
  const z1=parseZ1Ownership(
    extractZipEntry(archive.bytes,'csv/F3_2_s.csv',{maxEntries:1000,maxOutputBytes:2*1024*1024}).toString('utf8'),
    extractZipEntry(archive.bytes,'data_dictionary/F3_2_s.txt',{maxEntries:1000,maxOutputBytes:128*1024}).toString('utf8'),{now});
  const metadata=releaseMetadata(page.text);
  if (metadata.period!==z1.asOf || metadata.releaseDate>now.toISOString().slice(0,10)) fail('Z1 release quarter mismatch or future release');
  z1.releaseDate=metadata.releaseDate;
  const soma=parseSomaOwnership(JSON.parse(somaResponse.text),{now});
  const attribution=`© ${now.getUTCFullYear()} Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.`;
  const redistributionNotice='SOMA Holdings content must remain available under the same permissions, conditions and restrictions in the New York Fed Terms of Use. Retain source attribution and terms link. Treasury-only aggregation and inclusion of TIPS inflation compensation are Meridian calculations, not New York Fed modifications or endorsement.';
  Object.assign(soma,{title:'SOMA Holdings',attribution,termsUrl:SOMA_TERMS_URL,redistributionNotice});
  const series={};
  for (const [id,code] of [['foreignTreasuryHoldings','LM263061105.Q'],['fedTreasuryHoldings','LM713061103.Q']]) {
    series[id]={observations:z1.history.map(row=>{const value=row.sectors.find(item=>item.code===code).value;return {date:row.date,value:value===null?null:value/1000,publishedAt:null};}),sourceUrl:Z1_URL,sourceIds:[code],dataStatus:'official',calculation:'Official Z.1 quarter-end sector position in USD millions / 1e6; market valuation, not seasonally adjusted',attribution:'Source: Board of Governors of the Federal Reserve System, Financial Accounts of the United States (Z.1), F3.2.s Treasury securities.'};
  }
  series.somaTreasuryHoldings={observations:soma.history.map(row=>({date:row.date,value:row.adjustedPrincipal/1000,publishedAt:null})),sourceUrl:SOMA_URL,sourceTitle:'SOMA Holdings',sourceIds:['SOMA:treasury-adjusted-par'],dataStatus:'calculated',calculation:'Sum SOMA bills + notesbonds + frn + tips + tipsInflationCompensation in USD / 1e12; excludes agency debt, MBS and CMBS',attribution,termsUrl:SOMA_TERMS_URL,redistributionNotice};
  const responses=[archive,page,somaResponse];
  return {id:'ownership',fetchedAt:responses.map(response=>response.retrievedAt).sort().at(-1),series,z1,soma,attribution,termsUrl:SOMA_TERMS_URL,redistributionNotice,
    provenance:responses.map(({bytes,text,...metadata})=>metadata),warnings:[...z1.warnings,...soma.warnings],
    limitations:[
      'Z.1 sectors are quarter-end positions. LM series are market values; FL sector positions retain their reported non-market basis. The instrument valuation discrepancy reconciles reported assets and liabilities; neither is substituted for MSPD par debt.',
      'SOMA is a separately dated weekly Wednesday Treasury par measure with TIPS inflation compensation shown separately. It is not added to quarterly Z.1 central-bank market-value holdings.',
      'Holdings changes can reflect valuation, maturities, reclassifications, reporting revisions and transactions. Position changes are not automatically purchases or sales.',
      'TIC country holdings are not ingested pending a source-specific commercial reuse review. Z.1 rest-of-world holdings provide aggregate foreign coverage. TIC country figures can reflect custodial locations rather than ultimate owners.',
      'Z.1 current-release data can revise earlier quarters. This capture records the current release date and retrieval provenance; original historical release dates and uncaptured vintages remain unknown.',
    ]};
}
