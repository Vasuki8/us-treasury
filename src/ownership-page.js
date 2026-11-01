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
const ticLast=series=>series?.observations?.at(-1);
const ticExact=(series,date)=>series?.observations?.find(row=>row.date===date)??null;
const ticTrillions=value=>finite(value)?formatDisplayValue({format:'billions',unit:'USD billions'},value,{currencyUnit:'T'}):'Unavailable';
function ticPriorMonth(date){const parsed=new Date(`${date}T00:00:00Z`);return Number.isFinite(parsed.getTime())?new Date(Date.UTC(parsed.getUTCFullYear(),parsed.getUTCMonth(),0)).toISOString().slice(0,10):null;}
function ticChange(series,date){const current=ticExact(series,date),previous=ticExact(series,ticPriorMonth(date));return finite(current?.value)&&finite(previous?.value)?current.value-previous.value:null;}

/** These aliases keep the native TIC billions and exact conversion inputs inspectable. */
export function ownershipDeskChartCatalog(ownershipSource,ticSource,{frozen=false}={}){
 const source=ticCatalog(ticSource),catalog={};
 for(const [id,inputId,short]of [['ticForeignHoldings','ticTotal','Foreign holdings'],['ticOfficialHoldings','ticOfficial','Foreign official']]){
  const input=source[inputId];catalog[id]={...input,id,name:`${short} · TIC month-end stock`,short,unit:'USD trillions',format:'trillions',precision:3,observationType:'calculated',calculation:'TIC Table 5 native USD billions / 1,000; exact source month ends.',observations:input.observations.map(row=>({...row,value:finite(row.value)?row.value/1000:null,inputValues:[row.value],inputDates:[row.date]}))};
 }
 return {'ownership-tic':{catalog,evidenceLabel:`${frozen?'Frozen':'Captured'} U.S. Treasury TIC Table 5; billions converted to trillions`}};
}

/** The canonical TIC composition accompanies the retained Z.1/SOMA research tool. */
export function ownershipReferencePage(ownershipSource=dataStatus.sources.ownership,ticSource,{catalog={}}={}){
 if(arguments.length===0)ticSource=dataStatus.sources.ticHolders;
 const tic=ticCatalog(ticSource),total=ticLast(tic.ticTotal),date=total?.date,official=ticExact(tic.ticOfficial,date),privateValue=finite(total?.value)&&finite(official?.value)&&official.value>=0&&official.value<=total.value?total.value-official.value:null;
 const share=finite(total?.value)&&total.value>0&&finite(official?.value)?100*official.value/total.value:null;
 const debt=catalog.debt,debtRow=debt?.observations?.at(-1),debtValue=debt?formatDisplayValue(debt,debtRow?.value):'Unavailable';
 const readings=deskReadings('TIC & Treasury ownership readings',[
  {label:'Total federal debt',value:debtValue,change:'Gross federal debt, including intragovernmental holdings',basis:debtRow?`${humanDate(debtRow.date)} · ${debt.unit}`:'Separate Treasury par-debt source required'},
  {label:'Foreign holdings',value:ticTrillions(total?.value),change:`Exact prior-month change ${signed(ticChange(tic.ticTotal,date))}`,basis:`${humanDate(date)||'No retained month'} · TIC stock, not net purchases`},
  {label:'Official vs private',value:`${ticTrillions(official?.value)} / ${ticTrillions(privateValue)}`,change:finite(share)?`Official share of TIC foreign total ${share.toFixed(1)}%`:'Exact same-month official/total inputs required',basis:`${humanDate(date)||'No retained month'} · same TIC population`},
  {label:'Japan · custodial residence',value:money(ticExact(tic.ticJapan,date)?.value),change:`Exact prior-month change ${signed(ticChange(tic.ticJapan,date))}`,basis:`${humanDate(date)||'No retained month'} · USD billions`},
  {label:'China · custodial residence',value:money(ticExact(tic.ticChina,date)?.value),change:`Exact prior-month change ${signed(ticChange(tic.ticChina,date))}`,basis:`${humanDate(date)||'No retained month'} · USD billions`},
  {label:'FRBNY foreign official custody',value:'Unavailable',change:'A separate foreign-official custody capture is required',basis:'SOMA own-account holdings are a different population'},
  {label:'12-month net foreign inflow',value:'Unavailable',change:'Net purchases require TIC transaction data',basis:'Changes in holdings include valuation and other changes'},
 ]);
 const countries=Object.entries(TIC_COUNTRIES).filter(([id])=>!['ticTotal','ticOfficial','ticOfficialBills','ticOfficialCoupons','ticOther'].includes(id)).map(([id,label])=>({id,label,row:ticExact(tic[id],date)})).sort((a,b)=>(b.row?.value??-Infinity)-(a.row?.value??-Infinity)).slice(0,15);
 const countryRows=countries.map(({id,label,row},index)=>`<tr${id==='ticJapan'||id==='ticChina'?' class="selected-row"':''}><th scope="row">${index+1}. ${esc(label)}</th><td class="num">${esc(money(row?.value))}</td><td class="num">${esc(signed(ticChange(tic[id],date)))}</td><td class="num">${finite(row?.value)&&finite(total?.value)&&total.value>0?`${(100*row.value/total.value).toFixed(2)}%`:'Unavailable'}</td><td>${esc(humanDate(date)||'Not retained')} · custodial residence</td></tr>`).join('');
 const pillars=deskContext('Ownership analytical framework',[
  {kicker:'Pillar I · custodial geography',title:'Custody is not beneficial ownership',value:'TIC residence basis',note:'Positions can be attributed to a custodian or broker-dealer country. Japan, China and financial-center holdings are not adjusted with invented beneficial-owner estimates.'},
  {kicker:'Pillar II · stock vs flow',title:'Nominal holdings & reported changes',value:ticTrillions(total?.value),note:'Changes in Treasury positions include transactions, valuation and other changes. A rising stock does not establish net purchases or a causal effect on yields.'},
  {kicker:'Pillar III · official / private',title:'Foreign investor composition',value:finite(share)?`${share.toFixed(1)}% official`:'Unavailable',note:'Official and private positions use the same TIC reference month. Z.1 market-value sectors and weekly SOMA par positions remain separate below.'},
 ]);
 const summary=summarizeOwnership(ownershipSource),sectors=summary.sectors??[];
 const sectorCards=sectors.map(item=>`<article class="ownership-sector-card"><h3>${esc(item.label)}</h3><strong>${esc(money(item.value))}</strong><p>${esc(item.valuation)}</p><small>${esc(humanDate(summary.asOf))} · ${esc(item.code)}</small></article>`).join('');
 const plot=chart(['ticForeignHoldings','ticOfficialHoldings'],{height:300,range:{preset:'all'},legend:true,endLabels:true}).replace('data-chart ','data-chart data-chart-catalog="ownership-tic" ');
 const actions=button('Export TIC holdings CSV',`data-export-tic${total?'':' disabled'}`)+button('Export Z.1 / SOMA CSV',`data-export-ownership${summary.status==='ok'?'':' disabled'}`);
 return '<div class="stitch-desk stitch-ownership-desk stitch-ownership-reference"><nav class="desk-breadcrumbs"><a href="#/yields">Rates & curves</a><span>Workspace / Treasury & Fiscal / Debt ownership</span></nav>'
  +heading('U.S. Treasury debt ownership & foreign holdings desk','TIC Table 5 · custodial residence, official/private split and distinct domestic sector evidence',actions)
  +`<div class="workspace-basis"><p class="panel-note">TIC reference ${esc(humanDate(date)||'unavailable')} · ${esc(state(ticSource))} · captured ${esc(ticSource?.fetchedAt??'Not captured')}. Holdings are month-end stocks, distinct from publication and retrieval dates.</p>${ticSource?.error?`<p class="amber" role="status">${esc(ticSource.error)}</p>`:''}</div>`+readings
  +`<div class="grid g21 stitch-chart-context">${panel('','Foreign ownership evolution & official/private composition',plot,'','USD trillions · exact retained TIC month ends. Marketable-debt ownership shares and a domestic absorption wedge require a matching compatible denominator and are not inferred.')}${panel('','Custodial geography & methodological audit','<div class="explain"><h3>Official reporting basis</h3><p>Long-term Treasury holdings at market value plus Treasury bills; custodial geography does not establish ultimate beneficial ownership.</p><h3>Foreign share of marketable debt</h3><p>Unavailable without a matching compatible Treasury denominator. Gross federal debt is not substituted.</p><h3>Reporting coverage</h3><p>The retained current-vintage table covers thirteen months. It does not reconstruct the reference’s 2011–2024 history.</p></div>')}</div>`
  +pillars+panel('','Major foreign holders of U.S. Treasury securities · TIC Table 5',table(['Holder / custodial residence',{label:'Position · USD B',numeric:true},{label:'Exact month change · USD B',numeric:true},{label:'Share of TIC foreign total',numeric:true},'Reference / scope'],countryRows,'Fifteen largest retained foreign country holdings; custodial residence, not beneficial ownership'),'','These rows are a ranked subset. Grand total includes other holders. Country shares use only the same-month TIC foreign grand total.')
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
