import {humanDate} from './ui-time.js';
import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {summarizeOwnership} from './ownership.js';
import {tabularCsv} from './model.js';
import {formatDisplayValue} from './display-format.js';
import {deskReadings,deskContext} from './stitch-desk.js';
import {heading,button,panel,chart,table,emptyState,escapeHtml as esc} from './ui.js';
import {ticDeskDefinitions,TIC_COUNTRIES,TIC_HOLDERS_URL} from './treasury-desk-definitions.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const money=value=>finite(value)
  ?`${value<0?'−':''}$${Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}B`:'Unavailable';
const signed=value=>finite(value)?`${value>0?'+':value<0?'−':''}${money(Math.abs(value))}`:'Unavailable';
const lists=items=>`<ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
const row=(label,value,basis='')=>`<tr><th scope="row">${esc(label)}</th><td class="num">${esc(value)}</td><td>${esc(basis)}</td></tr>`;
const capture=(source,part)=>source?.provenance?.find(item=>item.url?.includes(part));
const state=source=>source?.status==='ok'?'Captured':source?.fetchedAt?'CACHED · refresh failed':'Unavailable';
const FED_URL='https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip';
const SOMA_URL='https://markets.newyorkfed.org/api/soma/summary.json';
const TERMS='https://www.newyorkfed.org/privacy/termsofuse.html';

export function ownershipPage(source=dataStatus.sources.ownership) {
  const summary=summarizeOwnership(source),available=summary.status==='ok';
  const header='<div class="stitch-desk stitch-ownership-desk">'+heading('DEBT OWNERSHIP','Official sector positions · distinct reporting dates, valuation bases and coverage',button('CSV OWNERSHIP',`data-export-ownership${available?'':' disabled aria-describedby="ownership-availability"'}`));
  if(!available)return header+panel('01','OFFICIAL OWNERSHIP POSITIONS',`<div id="ownership-availability">${emptyState('Ownership data unavailable.','Verified Federal Reserve sector positions and source metadata are required; missing holdings are not treated as zero.')}</div>${source?.error?`<p class="panel-note amber">${esc(source.error)}</p>`:''}`)+panel('02','SOURCE LIMITATIONS',`<p class="panel-note">TIC country holdings are a separate source family. This Z.1/SOMA capture does not supply country positions or a combined ownership share.</p>`)+'</div>';
  const z1=source.z1,soma=source.soma??{},fedCapture=capture(source,'/z1/current/z1_csv_files.zip'),somaCapture=capture(source,'/api/soma/summary.json');
  const weeklyException=note=>/SOMA|FRN|weekly|2014-0[2-5]/i.test(note);
  const weeklyNotes=(source.warnings??[]).filter(weeklyException),quarterNotes=(source.warnings??[]).filter(note=>!weeklyException(note));
  const readings=deskReadings('Quarter-end Treasury holder readings',[
    ['LM263061105.Q','Foreign holdings','foreignTreasuryHoldings'],['LM713061103.Q','Federal Reserve holdings','fedTreasuryHoldings'],
    ['LM153061105.Q','Households & nonprofit organizations'],['LM653061105.Q','Mutual funds'],
  ].map(([code,label,seriesId])=>{const sector=summary.sectors.find(item=>item.code===code),display=value=>finite(value)?formatDisplayValue({format:'billions',unit:'USD billions'},value,{currencyUnit:'T'}):'Unavailable';return {label,seriesId,value:display(sector?.value),change:`Quarter change ${finite(sector?.change)&&sector.change>0?'+':''}${display(sector?.change)}`,basis:`${humanDate(summary.asOf)} · USD trillions · ${sector?.valuation??'sector position unavailable'}`};}));
  const changes=summary.sectors.filter(item=>finite(item.change)).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,6);
  const pillars=deskContext('Ownership evidence & coverage',[
    {kicker:'Pillar I · cross-border coverage',title:'Country holdings',value:'Not covered',note:'TIC country holdings and official/private foreign splits are separate from this Z.1/SOMA capture. Country custody locations do not establish ultimate beneficial ownership.'},
    {kicker:'Pillar II · position changes',title:'Sector absorption',value:`${changes.length} largest retained changes`,note:'Reported positions can change through transactions and valuation. Exact preceding-quarter comparisons are shown without treating changes as purchases, sales or causal contributions to yields.'},
    {kicker:'Pillar III · valuation basis',title:'Federal Reserve & SOMA',value:'Separate observations',note:'Quarterly Z.1 central-bank market values and weekly Treasury-only SOMA par holdings have different dates and valuation bases. They are not added into a combined ownership total.'},
  ]);
  const sectors=summary.sectors.map(item=>`<tr><th scope="row">${esc(item.label)}<span class="table-code mono muted">${esc(item.code)
  }</span></th><td class="num">${esc(money(item.value))}</td><td class="num">${esc(signed(item.change))}</td><td>${esc(item.valuation)}${
  item.previousDate?` · change since ${esc(humanDate(item.previousDate))}`:' · exact prior quarter unavailable'}</td></tr>`).join('');
  const contributions=changes.length?table(['SECTOR',{label:'POSITION CHANGE',numeric:true},'BASIS'],changes.map(item=>row(item.label,signed(item.change),item.valuation)).join('')):emptyState('Aligned sector changes unavailable.','The exact preceding quarter is required; missing values are not filled.');
  const reconciliation=table(['Z.1 RECONCILIATION',{label:'USD BILLIONS',numeric:true},'DEFINITION'],row('Reported sector asset total',money(summary.assets),'Sum of reviewed top-level holder positions.')+row('Published valuation discrepancy',money(summary.valuationDiscrepancy),'Accumulated valuation difference between issuance and holdings.')+row('Reported Treasury liabilities',money(summary.liabilities),'Assets + published valuation discrepancy; not MSPD par debt.'));
  const somaBlock=summary.soma?(`<p class="panel-note"><strong>SOMA Holdings</strong> · observation ${esc(humanDate(summary.soma.asOf))
  } · retrieved ${esc(somaCapture?.retrievedAt??source.fetchedAt??'unavailable')
  }. Actual release date: unknown. Usual Wednesday observations and Thursday publication can `+
  `have posted holiday exceptions.</p>`)+chart(['somaTreasuryHoldings'],{height:210,range:36})+table(['TREASURY-ONLY SOMA MEASURE',
  {label:'USD BILLIONS',numeric:true},'VALUATION / CHANGE'],row('Treasury principal',money(summary.soma.principal),
  'Par sum of bills, notes/bonds, TIPS and FRNs.')+row('Accrued TIPS inflation compensation',money(summary.soma.inflationCompensation),
  'Shown separately from unadjusted principal.')+row('Calculated adjusted Treasury principal',money(summary.soma.adjustedPrincipal),
  'Par plus accrued TIPS inflation compensation.')+row('Exact preceding-week change',signed(summary.soma.change),summary.soma.previousDate
  ??'No exact preceding-week capture.')):emptyState('SOMA Holdings unavailable.','No weekly holdings are substituted for quarter-end Z.1 positions.');
  return header+`<div class="workspace-basis"><p class="panel-note"><strong>WHAT CHANGED.</strong> Sector positions are compared with the exact preceding quarter. Weekly SOMA changes appear separately. Holdings changes can reflect valuation and transactions; they are not automatically purchases or sales.</p>${source.error?`<p class="panel-note amber">${esc(source.error)}</p>`:''}${summary.reconciled?'':'<p class="panel-note amber">Incomplete source positions: reconciliation is unavailable. Missing holdings are not assigned to a residual owner.</p>'}</div>`
    +readingGroup('Quarterly Z.1 positions',`<p class="panel-note">Quarter end ${esc(humanDate(summary.asOf))}`
    +`${summary.releaseDate?` · Released ${esc(humanDate(summary.releaseDate))}`:''}</p>`
    +readings
    +`${quarterNotes.length?`<div class="panel-note">${lists(quarterNotes)}</div>`:''}`
    +'<div class="grid g11 workspace-analysis">'
    +panel('01','QUARTER-END FOREIGN & FEDERAL RESERVE POSITIONS',
      chart(['foreignTreasuryHoldings','fedTreasuryHoldings'],{height:260,legend:true,endLabels:true}),'',
      'USD trillions · Z.1 rest-of-world and central-bank market values; matching quarter ends, not Treasury par values.')
    +panel('02','WHAT CONTRIBUTED',contributions,'',
      'Largest absolute changes in reported sector positions, not an attribution of purchases or a causal explanation of yields. '
      +'Nested bill and pension subcomponents are excluded to avoid double counting.')+'</div>'+pillars
    +panel('03','OFFICIAL Z.1 SECTOR POSITIONS',table(['HOLDER SECTOR',{label:'CURRENT POSITION',numeric:true},{label:'QUARTER CHANGE',numeric:true},'VALUATION / COMPARISON'],sectors,'Official Z.1 Treasury holder positions'),'','USD billions · LM lines are market valued; FL lines retain their reported non-market basis. Net dealer and hedge-fund positions remain net.'),'Quarter-end sector positions and exact preceding-quarter changes retain the Z.1 valuation basis. Foreign and central-bank chart readings are market values, not Treasury par principal.')
    +readingGroup('Weekly SOMA holdings',panel('04','SOMA Holdings',somaBlock+(weeklyNotes.length?`<div class="panel-note weekly-source-exceptions"><strong>Weekly history exceptions</strong>${lists(weeklyNotes)}</div>`:''),'','This separately dated par measure is not added to Z.1 central-bank market-value holdings. Agency debt, MBS and CMBS are excluded from the Treasury-only calculation.')
    +panel('05','SOMA Holdings — SOURCE TERMS',`<div class="explain"><p>${esc(soma.attribution??source.attribution??'Required source attribution unavailable.')}</p><p>${esc(soma.redistributionNotice??source.redistributionNotice??'Source redistribution conditions unavailable.')}</p><p><a href="${TERMS}" target="_blank" rel="noopener noreferrer">New York Fed Terms of Use ↗</a> · <a href="https://www.newyorkfed.org/markets/soma-holdings.html" target="_blank" rel="noopener noreferrer">SOMA Holdings ↗</a>. Meridian’s Treasury-only sum and inclusion of TIPS inflation compensation are calculated modifications; the New York Fed does not endorse this website.</p></div>`),'Weekly par holdings keep their own observation and retrieval dates. They are not added to quarterly Z.1 market values.')
    +'<div class="stitch-methods">'+supportingDetails('ownership:reconciliation','Z.1 asset / liability reconciliation',panel('06','ASSET / LIABILITY RECONCILIATION',reconciliation,'',summary.reconciled?'Captured sector sums and published discrepancy reconcile within the bounded source rounding tolerance.':'Incomplete source positions: reconciliation is unavailable. Missing holdings are not assigned to a residual owner.'))
    +supportingDetails('ownership:methods','About this data',`<p class="panel-note">Z.1 retrieved ${esc(source.fetchedAt
  ??'unavailable')} · ${esc(state(source))}. Current vintage and original historical publication dates are distinct.</p>`+panel('07',
  'WHY IT MATTERS & LIMITATIONS',(`<div class="explain"><p><strong>WHY IT MATTERS.</strong> Sector positions describe who `+
  `reports Treasury exposure and how that distribution changes. Differences in investor `+
  `mandates and instrument demand can inform research, but these stock measures alone do not `+
  `establish the cause of a yield move.</p><p><strong>LIMITATIONS.</strong></p>${lists(summary.limitations)
  }<p>TIC country holdings require their own separately captured source `+
  `evidence. Country figures can reflect custody locations rather than ultimate ownership. No `+
  `incompatible cross-source pie chart or total is calculated.</p><p>Source release dates, `+
  `retrieval timestamps and period ends remain distinct. Previously uncaptured original `+
  `vintages are unavailable. Missing values and exact-prior-period gaps remain `+
  `visible.</p><p><a href="https://www.federalreserve.gov/releases/z1/current/html/F3_2_s.htm`+
  `" target="_blank" rel="noopener noreferrer">Federal Reserve Z.1 Treasury securities ↗</a> `+
  `· <a href="https://home.treasury.gov/data/treasury-international-capital-tic-system" `+
  `target="_blank" rel="noopener noreferrer">Treasury TIC methodology and limitations ↗</a>. `+
  `Provenance and per-row valuations accompany CSV exports.</p></div>`)))+'</div></div>';
}

function ticCatalog(source){
 return Object.fromEntries(Object.entries(ticDeskDefinitions).map(([id,definition])=>{const native=source?.series?.[id];return [id,{...definition,...native,source:{...definition.source,seriesIds:native?.sourceIds??[]},observations:native?.observations??[],fetchedAt:source?.fetchedAt??null,provenance:source?.provenance??[],dataStatus:native?(source?.status==='ok'?'official':'cached'):'unavailable'}];}));
}
const ticExact=(series,date)=>series?.observations?.find(row=>row.date===date)??null;
const ticTrillions=value=>finite(value)?formatDisplayValue({format:'billions',unit:'USD billions'},value,{currencyUnit:'T'}):'Unavailable';
const ticMoney=value=>finite(value)?`${value<0?'−':''}$${Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})}B`:'Unavailable';
const ticSigned=value=>finite(value)?`${value>0?'+':value<0?'−':''}${ticMoney(Math.abs(value))}`:'Unavailable';
const TIC_VIEWS={total:{label:'Total ($T)',ids:['ticForeignHoldings']},'official-private':{label:'Official / private',ids:['ticOfficialHoldings','ticPrivateHoldings']},'top-holders':{label:'Top 5 holders',ids:[]}};
const TIC_COUNTRY_IDS=Object.keys(TIC_COUNTRIES).filter(id=>!['ticTotal','ticOfficial','ticOfficialBills','ticOfficialCoupons','ticOther'].includes(id));
function ticMonthEnd(date,offset=0){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const parsed=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
 return new Date(Date.UTC(parsed.getUTCFullYear(),parsed.getUTCMonth()+offset+1,0)).toISOString().slice(0,10);
}
const ticDifference=(current,previous)=>finite(current)&&finite(previous)?Number((current-previous).toFixed(10)):null;
function ticComparison(series,date){
 const current=ticExact(series,date),priorMonth=ticMonthEnd(date,-1),priorYear=ticMonthEnd(date,-12);
 const prior=ticExact(series,priorMonth),year=ticExact(series,priorYear);
 return {value:finite(current?.value)?current.value:null,priorValue:finite(prior?.value)?prior.value:null,yearValue:finite(year?.value)?year.value:null,monthChange:ticDifference(current?.value,prior?.value),yearChange:ticDifference(current?.value,year?.value),priorMonth,priorYear};
}

/** Native TIC stocks and exact-date comparisons are resolved before the display window. */
export function ownershipTicModel(source,state={}){
 const tic=ticCatalog(source),view=Object.hasOwn(TIC_VIEWS,state.ownershipView)?state.ownershipView:'total';
 const range=['3m','6m','all'].includes(state.ownershipRange)?state.ownershipRange:'all';
 const totalDates=tic.ticTotal.observations.map(row=>row.date).filter(date=>ticMonthEnd(date)===date).sort();
 const date=totalDates.at(-1)??null;
 const allDates=[...new Set(Object.values(tic).flatMap(series=>series.observations.map(row=>row.date)))].filter(value=>ticMonthEnd(value)===value&&value<=date).sort();
 const start=range==='all'?null:ticMonthEnd(date,1-Number(range.slice(0,-1)));
 const dates=allDates.filter(value=>start===null||value>=start);
 const native={};
 const definitions=[['ticForeignHoldings','ticTotal','Foreign holdings'],['ticOfficialHoldings','ticOfficial','Foreign official'],...TIC_COUNTRY_IDS.map(id=>[id,id,`${TIC_COUNTRIES[id]} · custodial residence`])];
 for(const [id,inputId,short]of definitions){
  const input=tic[inputId];native[id]={...input,id,name:`${short} · TIC month-end stock`,short,observations:allDates.map(date=>{const row=ticExact(input,date);return {...row,date,value:finite(row?.value)?row.value:null,publishedAt:row?.publishedAt??null,inputValues:[finite(row?.value)?row.value:null],inputDates:[date]};})};
 }
 native.ticPrivateHoldings={...tic.ticTotal,id:'ticPrivateHoldings',name:'Foreign private · TIC month-end stock',short:'Foreign private',observationType:'calculated',calculation:'Same-month TIC foreign grand total minus foreign official holdings; USD billions. Both compatible inputs required.',observations:allDates.map(date=>{
  const total=ticExact(tic.ticTotal,date),official=ticExact(tic.ticOfficial,date);
  const valid=finite(total?.value)&&finite(official?.value)&&total.value>=0&&official.value>=0&&official.value<=total.value;
  return {date,value:valid?ticDifference(total.value,official.value):null,publishedAt:null,inputValues:[total?.value??null,official?.value??null],inputDates:[date,date],footnotes:[...(total?.footnotes??[]),...(official?.footnotes??[])]};
 })};
 const catalog=Object.fromEntries(Object.entries(native).map(([id,input])=>[id,{...input,unit:'USD trillions',format:'trillions',precision:3,observationType:'calculated',calculation:`${input.calculation??'Official TIC Table 5 month-end stock in native USD billions.'} Native USD billions / 1,000 for chart display.`,observations:input.observations.filter(row=>dates.includes(row.date)).map(row=>({...row,value:finite(row.value)?row.value/1000:null}))}]));
 const total=ticComparison(tic.ticTotal,date),official=ticComparison(tic.ticOfficial,date),privatePosition=ticComparison(native.ticPrivateHoldings,date);
 const countries=TIC_COUNTRY_IDS.map(id=>({id,label:TIC_COUNTRIES[id],...ticComparison(tic[id],date)})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)||a.id.localeCompare(b.id));
 const seriesIds=view==='top-holders'?countries.filter(item=>finite(item.value)).slice(0,5).map(item=>item.id):TIC_VIEWS[view].ids;
 return {view,range,date,dates,allDates,priorMonth:ticMonthEnd(date,-1),priorYear:ticMonthEnd(date,-12),total,official,privatePosition,countries,seriesIds,catalog,native};
}

/** These aliases keep the native TIC billions and exact conversion inputs inspectable. */
export function ownershipDeskChartCatalog(ownershipSource,ticSource,{frozen=false,state={}}={}){
 return {'ownership-tic':{catalog:ownershipTicModel(ticSource,state).catalog,evidenceLabel:`${frozen?'Frozen':'Captured'} U.S. Treasury TIC Table 5; billions converted to trillions`}};
}

function ticViewControls(model){
 return `<div class="specialist-chart-controls"><div class="segmented" role="group" aria-label="TIC chart view">${Object.entries(TIC_VIEWS).map(([value,{label}])=>button(label,`data-ownership-view="${value}" aria-pressed="${value===model.view}"`)).join('')}${button('Marketable share · unavailable','disabled title="A compatible same-date marketable-debt denominator is not retained."')}</div><div class="segmented specialist-ranges" role="group" aria-label="TIC chart history range">${[['3m','3 months'],['6m','6 months'],['all','All retained']].map(([value,label])=>button(label,`data-ownership-range="${value}" aria-pressed="${value===model.range}"`)).join('')}</div></div>`;
}

/** The view CSV keeps native billions and comparisons from the full retained lookback. */
export function ticViewCsv(source,state={}){
 const model=ownershipTicModel(source,state),rows=[];
 for(const id of model.seriesIds)for(const observation of model.catalog[id].observations){
  const series=model.native[id],comparison=ticComparison(series,observation.date);
  rows.push(['ticHolders',id,series.name,observation.date,comparison.value,'USD billions',comparison.priorMonth,comparison.priorValue,comparison.monthChange,comparison.priorYear,comparison.yearValue,comparison.yearChange,model.view,model.range,'Reported stock changes include valuation and other changes; not net purchases.',series.calculation??'Official TIC Table 5 month-end stock; native USD billions.',JSON.stringify(observation.inputValues),JSON.stringify(observation.inputDates),source?.status==='ok'?'captured':'cached',source?.fetchedAt??'',TIC_HOLDERS_URL,JSON.stringify(source?.provenance??[]),observation.publishedAt??'',series.attribution??'Source: U.S. Department of the Treasury.',series.licenseUrl??'',series.sourceNotice??'',(observation.footnotes??[]).join('; ')]);
 }
 return tabularCsv(['source_id','series_id','name','reference_month','value','unit','prior_month','prior_month_position','month_position_change','prior_year_month','prior_year_position','year_position_change','view','range','change_basis','calculation','input_values','input_dates','data_status','retrieved_at','source_url','provenance','publication_date','attribution','license_url','source_notice','source_notes'],rows);
}

/** The canonical TIC composition accompanies the retained Z.1/SOMA research tool. */
export function ownershipReferencePage(ownershipSource=dataStatus.sources.ownership,ticSource,{catalog={},state:renderState={}}={}){
 if(arguments.length===0)ticSource=dataStatus.sources.ticHolders;
 const model=ownershipTicModel(ticSource,renderState),{total,official,date}=model,privateValue=model.privatePosition.value;
 const share=finite(total?.value)&&total.value>0&&finite(privateValue)?100*official.value/total.value:null;
 const debt=catalog.debt,debtRow=debt?.observations?.at(-1),debtValue=debt?formatDisplayValue(debt,debtRow?.value):'Unavailable';
 const readings=deskReadings('TIC & Treasury ownership readings',[
  {label:'Total federal debt',value:debtValue,change:'Gross federal debt, including intragovernmental holdings',basis:debtRow?`${humanDate(debtRow.date)} · ${debt.unit}`:'Separate Treasury par-debt source required'},
  {label:'Foreign holdings',value:ticTrillions(total?.value),change:`Exact prior-month change ${ticSigned(total.monthChange)}`,basis:`${humanDate(date)||'No retained month'} · TIC stock, not net purchases`},
  {label:'Official vs private',value:`${ticTrillions(official?.value)} / ${ticTrillions(privateValue)}`,change:finite(share)?`Official share of TIC foreign total ${share.toFixed(1)}%`:'Exact same-month official/total inputs required',basis:`${humanDate(date)||'No retained month'} · same TIC population`},
  ...[['ticJapan','Japan'],['ticChina','China']].map(([id,label])=>{const country=model.countries.find(item=>item.id===id);return {label:`${label} · custodial residence`,value:ticMoney(country.value),change:`Exact prior-month change ${ticSigned(country.monthChange)}`,basis:`${humanDate(date)||'No retained month'} · USD billions`};}),
  {label:'FRBNY foreign official custody',value:'Unavailable',change:'A separate foreign-official custody capture is required',basis:'SOMA own-account holdings are a different population'},
  {label:'12-month net foreign inflow',value:'Unavailable',change:'Net purchases require TIC transaction data',basis:'Changes in holdings include valuation and other changes'},
 ]);
 const countryRows=model.countries.slice(0,15).map((country,index)=>`<tr${country.id==='ticJapan'||country.id==='ticChina'?' class="selected-row"':''}><th scope="row">${index+1}. ${esc(country.label)}</th><td class="num">${esc(ticMoney(country.value))}</td><td class="num">${esc(ticMoney(country.priorValue))}</td><td class="num">${esc(ticSigned(country.monthChange))}</td><td class="num">${esc(ticSigned(country.yearChange))}</td><td class="num">${finite(country.value)&&finite(total?.value)&&total.value>0?`${(100*country.value/total.value).toFixed(2)}%`:'Unavailable'}</td><td>${esc(humanDate(date)||'Not retained')} · custodial residence</td></tr>`).join('');
 const pillars=deskContext('Ownership analytical framework',[
  {kicker:'Pillar I · custodial geography',title:'Custody is not beneficial ownership',value:'TIC residence basis',note:'Positions can be attributed to a custodian or broker-dealer country. Japan, China and financial-center holdings are not adjusted with invented beneficial-owner estimates.'},
  {kicker:'Pillar II · stock vs flow',title:'Nominal holdings & reported changes',value:ticTrillions(total?.value),note:'Changes in Treasury positions include transactions, valuation and other changes. A rising stock does not establish net purchases or a causal effect on yields.'},
  {kicker:'Pillar III · official / private',title:'Foreign investor composition',value:finite(share)?`${share.toFixed(1)}% official`:'Unavailable',note:'Official and private positions use the same TIC reference month. Z.1 market-value sectors and weekly SOMA par positions remain separate below.'},
 ]);
 const summary=summarizeOwnership(ownershipSource),sectors=summary.sectors??[];
 const sectorCards=sectors.map(item=>`<article class="ownership-sector-card"><h3>${esc(item.label)}</h3><strong>${esc(money(item.value))}</strong><p>${esc(item.valuation)}</p><small>${esc(humanDate(summary.asOf))} · ${esc(item.code)}</small></article>`).join('');
 const plot=ticViewControls(model)+(model.seriesIds.length?chart(model.seriesIds,{height:300,range:{preset:'all'},legend:true,endLabels:true}).replace('data-chart ','data-chart data-chart-catalog="ownership-tic" '):emptyState('Top-holder histories unavailable.','Exact current-month country positions are required to rank the plotted holders.'));
 const actions=button('Export TIC holdings CSV',`data-export-tic${date?'':' disabled'}`)+button('Export Z.1 / SOMA CSV',`data-export-ownership${summary.status==='ok'?'':' disabled'}`);
 const strip=deskReadings('TIC stock comparison',[
  {label:'Total foreign position',value:ticTrillions(total.value),change:`Month ${ticSigned(total.monthChange)} · year ${ticSigned(total.yearChange)}`,basis:`${humanDate(date)||'No retained month'} · stock changes, not purchases`},
  {label:'Foreign official position',value:ticTrillions(official.value),change:`Month ${ticSigned(official.monthChange)} · year ${ticSigned(official.yearChange)}`,basis:'Same-month TIC reporting population'},
  {label:'Foreign private position',value:ticTrillions(privateValue),change:`Month ${ticSigned(model.privatePosition.monthChange)} · year ${ticSigned(model.privatePosition.yearChange)}`,basis:'Same-month total minus official; exact inputs required'},
 ]);
 return '<div class="stitch-desk stitch-ownership-desk stitch-ownership-reference"><nav class="desk-breadcrumbs"><a href="#/yields">Rates & curves</a><span>Workspace / Treasury & Fiscal / Debt ownership</span></nav>'
  +heading('U.S. Treasury debt ownership & foreign holdings desk','TIC Table 5 · custodial residence, official/private split and distinct domestic sector evidence',actions)
  +`<div class="workspace-basis"><p class="panel-note">TIC reference ${esc(humanDate(date)||'unavailable')} · ${esc(state(ticSource))} · captured ${esc(ticSource?.fetchedAt??'Not captured')}. Holdings are month-end stocks, distinct from publication and retrieval dates.</p>${ticSource?.error?`<p class="amber" role="status">${esc(ticSource.error)}</p>`:''}</div>`+readings
  +`<div class="grid g21 stitch-chart-context">${panel('','Foreign ownership evolution & official/private composition',plot+strip,button('CSV chart view',`data-export-tic-view${date?'':' disabled'}`),`USD trillions · ${model.dates.length} retained month ends${model.dates.length?`, ${humanDate(model.dates[0])} through ${humanDate(model.dates.at(-1))}`:''}. Top holders are ranked at the latest reference month and kept fixed across the displayed window. Marketable-debt shares require a compatible dated denominator and are not inferred.`)}${panel('','Custodial geography & methodological audit','<div class="explain"><h3>Official reporting basis</h3><p>Long-term Treasury holdings at market value plus Treasury bills; custodial geography does not establish ultimate beneficial ownership.</p><h3>Foreign share of marketable debt</h3><p>Unavailable without a matching compatible Treasury denominator. Gross federal debt is not substituted.</p><h3>Reporting coverage</h3><p>The retained current-vintage table covers thirteen months. It does not reconstruct the reference’s 2011–2024 history.</p></div>')}</div>`
  +pillars+panel('','Major foreign holders of U.S. Treasury securities · TIC Table 5',table(['Holder / custodial residence',{label:'Position · USD B',numeric:true},{label:'Prior month · USD B',numeric:true},{label:'1-month stock change · USD B',numeric:true},{label:'1-year stock change · USD B',numeric:true},{label:'Share of TIC foreign total',numeric:true},'Reference / scope'],countryRows,'Fifteen largest retained foreign country holdings; custodial residence, not beneficial ownership'),'',`These rows are a ranked subset. Prior month ${humanDate(model.priorMonth)||'unavailable'}; prior-year month ${humanDate(model.priorYear)||'unavailable'}. Changes require those exact month ends from the full retained table, even when the chart window is shorter. Stock changes include valuation and other changes, not net purchases. Grand total includes other holders; country shares use only the same-month TIC foreign grand total.`)
  +panel('','Total Treasury ownership decomposition by sector · separate Z.1 evidence',`<p class="panel-note">${esc(humanDate(summary.asOf)||'Quarter unavailable')} · ${esc(state(ownershipSource))}. Quarterly sector positions retain their reported valuation bases. TIC, Z.1 and weekly SOMA are not added into a cross-source ownership pie.</p><div class="ownership-sector-grid">${sectorCards||emptyState('Z.1 sector positions unavailable.','No residual owner or zero holding is invented.')}</div>`)
  +`<div class="ownership-source-dock">${panel('','Official source access & local research',`<div class="explain"><p><a href="${TIC_HOLDERS_URL}" target="_blank" rel="noopener noreferrer">U.S. Treasury TIC Table 5 ↗</a></p><p>${esc(ticSource?.coverageNote??'Official TIC capture unavailable.')}</p><pre><code>source_id,series_id,reference_month,value,unit,retrieved_at,source_url,provenance</code></pre></div>`,actions,'Actual receipts accompany exports. Publication dates remain unknown unless independently supplied.')}</div>`
  +supportingDetails('ownership:z1-soma','Quarterly Z.1 positions & weekly SOMA holdings · full retained research',ownershipPage(ownershipSource))+'</div>';
}

export function ticHoldingsCsv(source){
 const catalog=ticCatalog(source),rows=[];
 for(const [id,s]of Object.entries(catalog))for(const row of s.observations)rows.push(['ticHolders',id,s.name,row.date,row.value,'USD billions',source?.status==='ok'?'captured':'cached',source?.fetchedAt??'',TIC_HOLDERS_URL,JSON.stringify(source?.provenance??[]),row.sourceValue??'',row.publishedAt??'',s.attribution??'Source: U.S. Department of the Treasury.',s.licenseUrl??'',s.sourceNotice??'',(row.footnotes??[]).join('; ')]);
 return tabularCsv(['source_id','series_id','name','reference_month','value','unit','data_status','retrieved_at','source_url','provenance','source_value','publication_date','attribution','license_url','source_notice','source_notes'],rows);
}

const COLUMNS=['dataset','series_code','holder','period','value','unit','source_unit','valuation','change_from_exact_prior','prior_period','observation_type','data_status','source_name','source_title','source_url','retrieved_at','release_date','vintage_release_date','release_date_basis','methodology','attribution','terms_url','redistribution_notice','limitations','provenance'];
import {SOMA_2014_GAP_NOTE} from './ownership.js';
export function ownershipCsv(source,{z1Periods,somaPeriods}={}) {
  if(z1Periods!==undefined&&(!Number.isSafeInteger(z1Periods)||z1Periods<1))throw new RangeError('Z.1 CSV period count must be a positive integer.');
  if(somaPeriods!==undefined&&(!Number.isSafeInteger(somaPeriods)||somaPeriods<1))throw new RangeError('SOMA CSV period count must be a positive integer.');
  if(!source?.z1?.history?.length)return tabularCsv(COLUMNS,[]);
  const rows=[],status=source.status==='ok'?'captured':'cached';
  const fed=capture(source,'/z1/current/z1_csv_files.zip'),somaCapture=capture(source,'/api/soma/summary.json');
  const base={unit:'USD billions',data_status:status,limitations:(source.limitations??[]).join('\n')};
  const z1Provenance=(source.provenance??[]).filter(item=>item.url===FED_URL||item.url==='https://www.federalreserve.gov/releases/z1/default.htm');
  const z1=source.z1;
  const z1Base={...base,dataset:'Z.1',source_unit:'USD millions',source_name:'Board of Governors of the Federal Reserve System',source_title:'Financial Accounts of the United States, F3.2.s Treasury securities',source_url:fed?.url??FED_URL,retrieved_at:fed?.retrievedAt??source.fetchedAt,vintage_release_date:z1.releaseDate,release_date_basis:'Current Z.1 vintage release date. Historical original publication dates are unknown.',attribution:'Source: Board of Governors of the Federal Reserve System, Financial Accounts of the United States (Z.1).',methodology:'Official reported position in USD millions / 1000. Per-period reported valuation bases and historical-method qualifications are preserved; changes are positions, not purchases or sales.',provenance:JSON.stringify(z1Provenance)};
  for(const period of z1Periods===undefined?z1.history:z1.history.slice(-z1Periods)){
    const parsed=new Date(`${period.date}T00:00:00Z`),priorDate=new Date(Date.UTC(parsed.getUTCFullYear(),parsed.getUTCMonth()-2,0)).toISOString().slice(0,10),prior=z1.history.find(item=>item.date===priorDate);
    const common={...z1Base,period:period.date,release_date:period.date===z1.asOf?z1.releaseDate:null};
    for(const sector of period.sectors??[]){const previous=prior?.sectors?.find(item=>item.code===sector.code)?.value;rows.push({...common,series_code:sector.code,holder:sector.label,value:sector.value,valuation:sector.valuation,change_from_exact_prior:finite(sector.value)&&finite(previous)?sector.value-previous:null,prior_period:prior?.date,observation_type:'Official observation'});}
    for(const [key,code,label,valuation] of [['assets','FL893061105.Q','Reported sector asset total','Reported table aggregate; mixed sector valuation bases'],['liabilities','FL313161105.Q','Reported Treasury liabilities','Reported liability basis'],['valuationDiscrepancy','LM903061103.Q','Published valuation discrepancy','Accumulated issuance / holdings valuation difference']])rows.push({...common,series_code:code,holder:label,value:period[key],valuation,observation_type:'Official observation'});
  }
  const soma=source.soma;
  if(soma?.history?.length){
    const common={...base,dataset:'SOMA Holdings',source_unit:'USD',source_name:'Federal Reserve Bank of New York',source_title:'SOMA Holdings',source_url:somaCapture?.url??SOMA_URL,retrieved_at:somaCapture?.retrievedAt??source.fetchedAt,release_date:null,vintage_release_date:null,release_date_basis:'Actual historical publication dates are unknown; period is the explicitly posted as-of date.',attribution:soma.attribution??source.attribution,terms_url:soma.termsUrl??source.termsUrl??TERMS,redistribution_notice:soma.redistributionNotice??source.redistributionNotice,provenance:JSON.stringify((source.provenance??[]).filter(item=>item.url===SOMA_URL))};
    for(const period of somaPeriods===undefined?soma.history:soma.history.slice(-somaPeriods)){
      const priorDate=new Date(Date.parse(`${period.date}T00:00:00Z`)-7*86400000).toISOString().slice(0,10),prior=soma.history.find(item=>item.date===priorDate);
      const sourceUrl=period.sourceUrl??SOMA_URL,periodProvenance=(source.provenance??[]).filter(item=>item.url===sourceUrl),periodCapture=periodProvenance[0];
      const periodSource={source_url:sourceUrl,retrieved_at:periodCapture?.retrievedAt??source.fetchedAt,provenance:JSON.stringify(periodProvenance)};
      const frnNote=period.frnStatus==='not-issued'?' FRNs were not yet issued before 2014-01-31; the source blank is retained as null and excluded from the sum of then-existing Treasury classes.':period.frnStatus==='unavailable'?' The FRN field is unavailable after issuance; Treasury principal and adjusted principal remain unavailable, not zero.':period.frnStatus==='alternate-source'?` ${SOMA_2014_GAP_NOTE}`:'';
      for(const [key,code,label,kind,methodology] of [
        ['principal','SOMA:treasury-par','Treasury principal','Calculated metric','Meridian sum of official bills + notesbonds + frn + tips in USD / 1e9; excludes agency debt, MBS and CMBS.'],
        ['inflationCompensation','SOMA:tips-inflation-compensation','Accrued TIPS inflation compensation','Official observation','Official tipsInflationCompensation in USD / 1e9.'],
        ['adjustedPrincipal','SOMA:treasury-adjusted-par','Adjusted Treasury principal','Calculated metric','Meridian sum of Treasury par plus reported TIPS inflation compensation in USD / 1e9; this modification is not attributed to the New York Fed.'],
      ])rows.push({...common,...periodSource,series_code:code,holder:label,period:period.date,value:period[key],valuation:key==='principal'?'Par':key==='inflationCompensation'?'Accrued inflation adjustment':'Par plus accrued TIPS inflation compensation',change_from_exact_prior:finite(period[key])&&finite(prior?.[key])?period[key]-prior[key]:null,prior_period:prior?.date,observation_type:kind,methodology:methodology+frnNote});
    }
  }
  return tabularCsv(COLUMNS,rows.map(row=>COLUMNS.map(key=>row[key])));
}
