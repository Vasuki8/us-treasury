import {currentAccountGdpContext} from './current-account-gdp.js';
import {BEA_ITA_URL,BEA_ITA_LICENSE} from './current-account-registry.js';
import {csvCell,tabularCsv} from './model.js';
import {panel,table,button,escapeHtml as esc} from './ui.js';

const GDP_URL='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const CREDIT='Source: U.S. Bureau of Economic Analysis. Ratio calculated by Meridian.';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const quarter=date=>typeof date==='string'&&/^\d{4}-(?:01|04|07|10)-01$/.test(date)?`Q${Math.ceil(Number(date.slice(5,7))/3)} ${date.slice(0,4)}`:'Unavailable';
const number=(value,precision=2)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'Unavailable';
const amount=value=>finite(value)?`${value<0?'-':''}$${Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:6})}B`:'Unavailable';
const percent=value=>finite(value)?`${number(value)}%`:'Unavailable';
function safeUrl(value,fallback){
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{/* Missing/unsafe recorded links use the reviewed official reference. */}
 return fallback;
}
function input(source={},id){
 const item=source?.series?.[id]??{},isGdp=id==='nominalGdp',url=item.sourceUrl??(isGdp?GDP_URL:BEA_ITA_URL);
 const provenance=(item.provenance??source?.provenance??[]).filter(row=>row.url===url);
 return {source,item,url,provenance,retrievedAt:provenance.at(-1)?.retrievedAt??item.fetchedAt??source?.fetchedAt??null,
  capturedAt:item.fetchedAt??source?.fetchedAt??null,status:source?.status==='ok'?'official':source?.fetchedAt?'cached':'unavailable',
  title:item.sourceTitle??(isGdp?'NIPA Table 1.1.5 line 1 · current-dollar GDP':'ITA Table 1.1 line 30 · current-account balance'),
  license:item.licenseUrl??BEA_ITA_LICENSE,attribution:item.attribution??'Source: U.S. Bureau of Economic Analysis.'};
}
function inputs(sources){return {numerator:input(sources?.beaIta,'currentAccountBalance'),denominator:input(sources?.bea,'nominalGdp')};}
function sourceStatus(details,label,frozen){
 const status=details.status==='official'?'Official capture':details.status==='cached'?'Cached input':'Unavailable';
 return `<p class="panel-note"><strong>${esc(label)} · ${esc(frozen?'Recorded '+status:status)}</strong> · Retrieved ${esc(details.retrievedAt??'not recorded')}.${details.source?.error?` <span class="amber">${esc(details.source.error)}</span>`:''} <a href="${esc(safeUrl(details.url,label==='Nominal GDP'?GDP_URL:BEA_ITA_URL))}" target="_blank" rel="noopener noreferrer">${esc(details.title)} ↗</a></p>`;
}

/** Calculated current/prior context; callers must supply live or frozen sources explicitly. */
export function currentAccountGdpPanel(sources={}, {frozen=false}={}){
 const result=currentAccountGdpContext(sources),{numerator,denominator}=inputs(sources);
 const rows=[result.current,result.previous].map(point=>`<tr><th scope="row">${esc(quarter(point.date))}${point.reason?`<span class="table-code amber">${esc(point.reason)}</span>`:''}</th><td class="num">${esc(percent(point.value))}</td><td class="num">${esc(amount(point.currentAccountBalance))}</td><td class="num">${esc(amount(point.nominalGdpSaar))}</td><td class="num">${esc(amount(point.nominalGdpQuarter))}</td></tr>`).join('');
 const summary=`<p class="panel-note"><strong>${frozen?'Frozen calculated metric · recorded inputs':'Calculated metric · captured BEA inputs'}</strong>. ${esc(quarter(result.date))}: ${esc(percent(result.current.value))} of nominal GDP. Change from the exact preceding quarter: ${esc(number(result.change))} percentage points.</p>`;
 const body=summary+table(['REFERENCE QUARTER','RATIO / NOMINAL GDP','CURRENT ACCOUNT · QUARTER','NOMINAL GDP · SAAR','GDP · SAAR ÷ 4'],rows,'Calculated current-account-to-GDP ratio with exact-quarter inputs and annual-rate conversion')
  +`<p class="panel-note"><strong>Calculation:</strong> ${esc(result.formula)}. Numerator and denominator use USD billions; only GDP is divided by four. Negative is deficit, positive surplus. ${frozen?'These recorded quarters are retained in the frozen result.':'This latest-quarter context is separate from the focused history window.'}</p>`
  +sourceStatus(numerator,'Current account',frozen)+sourceStatus(denominator,'Nominal GDP',frozen)
  +`<p class="panel-note">ITA table release date: ${esc(sources?.beaIta?.tableReleaseDate??'unknown')}; it does not date the GDP input. GDP publication date: ${esc(result.current.denominatorObservation?.publishedAt??'unknown')}. Publication dates and retrieval dates remain distinct. Inputs can have different retrieval vintages; either input can revise.</p>`
  +`<p class="panel-note">This compares the international balance with the size of domestic production. It is not an exact GDP accounting component or a causal explanation. ${esc(result.notice)}</p>`
  +`<p class="panel-note">${CREDIT} <a href="${esc(safeUrl(numerator.license,BEA_ITA_LICENSE))}" target="_blank" rel="noopener noreferrer">ITA reuse terms ↗</a> · <a href="${esc(safeUrl(denominator.license,BEA_ITA_LICENSE))}" target="_blank" rel="noopener noreferrer">GDP reuse terms ↗</a></p>`;
 return panel('G',`${frozen?'FROZEN ':''}CURRENT ACCOUNT / NOMINAL GDP`,body,frozen?'':button('CSV RATIO & INPUTS',`data-export-current-account-gdp${!result.date?' disabled title="A retained current-account quarter is required."':''}`));
}

/** Two displayed quarters, original strings, independent receipts and full formula. */
export function currentAccountGdpCsv(sources={}){
 const result=currentAccountGdpContext(sources),{numerator:n,denominator:d}=inputs(sources);
 const headers=['ratio_id','reference_quarter','date_convention','value_percent','unit','observation_type','missing','unavailable_reason','change_percentage_points','numerator_value','numerator_unit','numerator_source_value','numerator_source_unit','numerator_source_period_label','numerator_source_ids','numerator_source_url','numerator_source_title','numerator_retrieved_at','numerator_source_captured_at','numerator_capture_status','numerator_publication_date','numerator_table_release_date','numerator_footnotes_json','numerator_provenance_json','denominator_saar_value','denominator_saar_unit','denominator_quarter_value','denominator_quarter_unit','denominator_saar_divisor','denominator_source_value','denominator_source_unit','denominator_source_period_label','denominator_source_ids','denominator_source_url','denominator_source_title','denominator_retrieved_at','denominator_source_captured_at','denominator_capture_status','denominator_publication_date','denominator_footnotes_json','denominator_provenance_json','calculation','limitations','attribution','license_url','numerator_license_url','denominator_license_url'];
 const rows=result.date?[result.previous,result.current].map(point=>{
  const ca=point.numeratorObservation,gdp=point.denominatorObservation;
  return ['currentAccountToGdp',point.date,'quarter-start',point.value,'Percent of nominal GDP','calculated',!finite(point.value),point.reason,point===result.current?result.change:null,
   point.currentAccountBalance,'USD billions per quarter (not annualized)',ca?.sourceValue??null,'USD millions per quarter (not annualized)',ca?.sourcePeriodLabel??null,(n.item.sourceIds??[]).join('; '),n.url,n.title,n.retrievedAt,n.capturedAt,n.status,ca?.publishedAt??null,sources?.beaIta?.tableReleaseDate??null,JSON.stringify(ca?.footnotes??[]),JSON.stringify(n.provenance),
   point.nominalGdpSaar,'USD billions (SAAR)',point.nominalGdpQuarter,'USD billions per quarter',4,gdp?.sourceValue??null,'USD millions (SAAR)',gdp?.sourcePeriodLabel??null,(d.item.sourceIds??[]).join('; '),d.url,d.title,d.retrievedAt,d.capturedAt,d.status,gdp?.publishedAt??null,JSON.stringify(gdp?.footnotes??[]),JSON.stringify(d.provenance),
   result.formula,result.notice,CREDIT,BEA_ITA_LICENSE,n.license,d.license];
 }):[];
 const raw=new Set(['numerator_source_value','denominator_source_value'].map(key=>headers.indexOf(key)));
 return tabularCsv(headers,[])+rows.map(row=>row.map((value,index)=>csvCell(value,raw.has(index))).join(',')+'\r\n').join('');
}
