import {humanDate} from './ui-time.js';
import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {NOMINAL_YIELD_TENORS,REAL_YIELD_TENORS,selectCurveOverlays,H15_3M_GAP_NOTE,yieldComparisonShortcuts,selectedYieldChanges,yieldEventComparisons} from './yields.js';
import {tabularCsv} from './model.js';
import {deskReadings,deskContext} from './stitch-desk.js';
import {heading,button,panel,metrics,chart,table,emptyState,escapeHtml as esc} from './ui.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const display=(value,unit='%')=>finite(value)?`${value.toFixed(2)}${unit}`:'Unavailable';
export function yieldOverlayDates(source={},state={}){
  const dates=(source.curveHistory??[]).map(row=>row.date).sort();
  return [state.yieldDateA||dates.at(-1),state.yieldDateB||dates.at(-253)||dates[0]].filter(Boolean);
}
const feedCaptures=(source,year,kind)=>source.provenance?.filter(item=>item.url.includes(`.csv/${year}/all`)&&(kind==='inflation compensation'||new URL(item.url).searchParams.get('type')===(kind==='real'?'daily_treasury_real_yield_curve':'daily_treasury_yield_curve')))??[];
export function yieldCurvesCsv(source={},state={}){
  const selected=selectCurveOverlays(source,[...new Set(yieldOverlayDates(source,state))]);
  const rows=selected.flatMap(curve=>curve.available?NOMINAL_YIELD_TENORS.flatMap(tenor=>{
    const nominal=curve.nominal[tenor],real=curve.real[tenor];
    const facts=[[curve.date,tenor,'nominal',finite(nominal)?nominal:null,'Percent','official','Published Treasury nominal par yield']];
    if(REAL_YIELD_TENORS.includes(tenor))facts.push([curve.date,tenor,'real',finite(real)?real:null,'Percent','official','Published Treasury TIPS real par yield'],[curve.date,tenor,'inflation compensation',finite(nominal)&&finite(real)?Number((100*(nominal-real)).toFixed(10)):null,'Basis points','calculated','100 × same-date nominal minus real par yield; includes risk/liquidity effects, not pure expected inflation']);
    return facts.map(row=>{const supplement=row[2]==='nominal'?curve.nominalSupplements?.[tenor]:null,captures=feedCaptures(source,curve.date.slice(0,4),row[2]);if(supplement){const receipt=source.provenance?.find(item=>item.url===supplement.sourceUrl&&item.sha256===supplement.sourceSha256&&item.retrievedAt===supplement.retrievedAt);if(!receipt)throw new Error('Missing H15 curve supplement receipt');captures.push(receipt);row[6]+=`; ${H15_3M_GAP_NOTE}`;}return [...row,source.fetchedAt,source.status==='ok'?'official':'cached',null,curve.methodology,row[2]==='nominal'?null:curve.realCurveInputs,`U.S. Treasury, Office of Debt Management${supplement?'; Federal Reserve Board H.15 RIFLGFCM03_N.B':''}`,captures.map(item=>item.url).join('; '),JSON.stringify(captures)];});
  }):[]);
  return tabularCsv(['date','tenor','measure','value','unit','observation_type','calculation','retrieved_at','data_status','release_date','curve_methodology','real_curve_inputs','source','source_urls','input_provenance'],rows);
}
export function yieldsPage(state={},source=dataStatus.sources.yields){
  source??={};
  const dates=yieldOverlayDates(source,state),curves=selectCurveOverlays(source,dates),current=curves[0],prior=curves[1];
  const retainedDates=(source.curveHistory??[]).map(row=>row.date).sort();
  const dateInput=(id,selected)=>`<input id="yield-curve-date-${id}" type="date"`
    +` min="${esc(retainedDates[0])}" max="${esc(retainedDates.at(-1))}" value="${esc(selected)}" aria-describedby="yield-date-help">`;
  const shortcutButton=item=>button(item.label,`data-yield-shortcut data-yield-date-a="${esc(item.dateA)}" data-yield-date-b="${esc(item.dateB??'')}" title="${esc(`${item.basis} Target ${item.targetDate??item.dateB??'unavailable'}; actual Curve B ${item.dateB??'unavailable'}.`)}"${item.dateB?'':' disabled'}`);
  const shortcuts=yieldComparisonShortcuts(source,dates[0]),events=yieldEventComparisons(source,dataStatus.calendar?.sources?.fomc?.events??[]);
  const shortcutControls=`<div class="toolbar" role="group" aria-label="Curve comparison shortcuts">${shortcuts.map(shortcutButton).join('')}</div><p class="panel-note">1D uses the previous retained observation; 1W / 1M use the last retained observation on or before the calendar target. YTD uses the prior year-end observation. Actual Curve A and B dates are shown below; no date after the target is substituted.</p>${events.length?`<details data-page-disclosure="yields:event-method-presets"><summary>Verified event and methodology dates</summary><div class="actions">${events.map(shortcutButton).join('')}</div><p class="panel-note">FOMC buttons identify official scheduled decision dates; methodology buttons identify documented Treasury changes. Neither establishes the cause of a yield move.</p></details>`:''}`;
  const controls=dates.length?'<div class="toolbar">'
    +`<label for="yield-curve-date-a">Curve A ${dateInput('a',dates[0])}</label>`
    +`<label for="yield-curve-date-b">Curve B ${dateInput('b',dates[1])}</label></div>`
    +'<p class="panel-note" id="yield-date-help">Date choices snap to the nearest retained trading day; ties choose the earlier date.</p>'
    +shortcutControls+(curves.some(curve=>!curve.available)?
      '<p class="panel-note amber">A selected date is unavailable. No other date is substituted.</p>':''):'';
  const curveTable=current?table(['TENOR',{label:`${humanDate(current.date)} NOMINAL`,numeric:true},{label:`${humanDate(prior?.date)
  ||'Unavailable'} NOMINAL`,numeric:true},{label:'CHANGE / BP',numeric:true}],
  NOMINAL_YIELD_TENORS.map(tenor=>`<tr><th scope="row">${esc(tenor)}</th><td class="num">${esc(display(current.nominal[tenor]))
  }</td><td class="num">${esc(display(prior?.nominal[tenor]))}</td><td class="num">${esc(display(finite(current.nominal[tenor])&&finite(prior
  ?.nominal[tenor])?100*(current.nominal[tenor]-prior.nominal[tenor]):null,' bp'))}</td></tr>`).join('')):emptyState
  ('No verified historical curves available.');
  const matched=current&&prior?table(['TENOR / MEASURE',{label:humanDate(current.date),numeric:true},{label:humanDate(prior.date),numeric:true},
  {label:'CHANGE / BP',numeric:true}],REAL_YIELD_TENORS.flatMap(tenor=>Object.entries(selectedYieldChanges(source,current.date,prior.date,
  {tenor})).map(([measure,values])=>`<tr><th scope="row">${esc(tenor)} · ${esc({nominal:'Nominal',real:'Real',
  inflationCompensation:'Inflation compensation'}[measure])}</th><td class="num">${esc(display(values.a,
  measure==='inflationCompensation'?' bp':'%'))}</td><td class="num">${esc(display(values.b,
  measure==='inflationCompensation'?' bp':'%'))}</td><td class="num">${esc(display(values.changeBps,
  ' bp'))}</td></tr>`)).join('')):emptyState('Matched yield observations unavailable.');
  const collection=(`<div class="workspace-basis"><p class="panel-note"><strong>WHAT CHANGED.</strong> Select `+
  `two actual observation dates to compare historical nominal, real and `+
  `inflation-compensation changes. Captured ${esc(source.fetchedAt
  ??'unavailable')} · ${source.status==='ok'?'Official source capture':source.fetchedAt?'CACHED':'Unavailable'
  }. Release instants are not supplied.</p><p class="panel-note">Current revised Treasury `+
  `par-yield history · no reconstructed original release vintages.${source.error?` <span class="amber">${esc(source.error)}</span>`:''}</p></div>`);
  const nominal=current?.nominal?.['10Y'],real=current?.real?.['10Y'],twoYear=current?.nominal?.['2Y'];
  const selectedBasis=current?.available?`${humanDate(current.date)} · selected Curve A`:'Selected Curve A unavailable';
  const readings=deskReadings('Selected Curve A readings',[
    {label:'10Y nominal par yield',value:display(nominal),change:'Official Treasury fitted par yield',basis:selectedBasis},
    {label:'10Y TIPS real par yield',value:display(real),change:'Official Treasury fitted real par yield',basis:selectedBasis},
    {label:'10Y inflation compensation',value:display(finite(nominal)&&finite(real)?100*(nominal-real):null,' bp'),change:'100 × same-date nominal − real',basis:selectedBasis},
    {label:'10Y − 2Y curve slope',value:display(finite(nominal)&&finite(twoYear)?100*(nominal-twoYear):null,' bp'),change:'100 × same-date 10Y − 2Y',basis:selectedBasis},
  ]);
  const pillars=deskContext('Curve evidence & model coverage',[
    {kicker:'Component 01 · retained observations',title:'Nominal & real par yields',value:'Official fitted curves',note:'Nominal and real yields use the selected actual observation dates and matching tenors. Distinct underlying securities and cash flows limit an economic decomposition.'},
    {kicker:'Component 02 · model coverage',title:'Inflation risk premium',value:'Not covered',note:'A separate model-derived expected inflation or inflation risk premium is not retained. Inflation compensation includes risk and liquidity effects; it is not pure expected inflation.'},
    {kicker:'Component 03 · liquidity coverage',title:'TIPS liquidity premium',value:'Not covered',note:'No retained model isolates a TIPS liquidity discount, CPI-to-PCE adjustment or forward inflation forecast. These components are not inferred from the nominal-minus-real difference.'},
  ]);
  return '<div class="stitch-desk stitch-yields-desk">'+(source?.error?`<p class="panel-note amber">${esc(source.error)}</p>`:'')+heading('RATES & CURVES',
  'Treasury par curves · same-date spreads and matched nominal / real yields',button('CSV CURVES',
  `data-export-yield-curves${curves.some(curve=>curve.available)?'':' disabled'}`)+button('CSV INDICATORS','data-export-yield-indicators'))
    +readingGroup('Selected curve comparison',controls+readings+panel('00','HISTORICAL CURVE OVERLAYS',(dates.length?`<div class="chart" data-chart data-kind="history-curve" data-dates="${esc(dates.join(','))}" data-height="300" data-legend="true" data-end-labels="true"><p class="muted">Historical Treasury nominal par curves</p></div>`:emptyState('No verified curves captured.')),'','Percent · solid A / dashed B · maturity axis uses elapsed years; exact values available by pointer or keyboard.')
    +pillars
    +`<div class="grid g11 workspace-analysis">${panel('01','SELECTED-DATE RATE CHANGES',curveTable,'',
  ('100 × (Curve A − Curve B), basis points; exact selected observation dates, missing tenors '+
  'remain unavailable. Published fitted par yields are reference measures, not executable '+
  'quotes or average outstanding-debt costs. These are par yields, not zero-coupon yields. '+
  'Selected dates crossing December 6, 2021 span a Treasury fitting-method change; methods '+
  'and exceptions are below.'))}${panel('02','SELECTED NOMINAL / REAL / COMPENSATION CHANGES',matched,'',
  ('Both selected dates · change = Curve A − Curve B, in basis points for all three measures. '+
  'Compensation = 100 × (nominal − real), matching tenor and date; its change equals the '+
  'nominal change minus the real change. This is not pure expected inflation.'))}</div>`,`Selected observations: Curve A ${humanDate(dates[0])
  ||'unavailable'} · Curve B ${humanDate(dates[1])||'unavailable'}. Nominal and real par yields are percent; differences are basis points.`)
    +readingGroup('Current retained rate context',panel('03','CURRENT RETAINED RATE CONTEXT',metrics(['spread2s10s','spread3m10y','realYield10','inflationComp10']),'','Current retained observations use their own dates; these readings do not track the selected historical Curve A or Curve B dates.')
    +panel('04','CURVE SPREADS',chart(['spread2s10s','spread3m10y'],{height:210}),'','Basis points: 100 × (10Y − 2Y), and 100 × (10Y − 3M), exact same observation date.'),'Retained indicators use their own dates; they do not move with selected historical curve dates.')
    +'<div class="stitch-methods">'+supportingDetails('yields:policy-context','Policy & overnight funding context',panel('05','POLICY & OVERNIGHT CONTEXT',metrics(['policyTargetLower','policyTargetUpper','effr','sofr']),'','Current retained observations use their own dates; not a decomposition of selected-date yields.'))
    +supportingDetails('yields:source-coverage','Historical coverage & source exceptions',`<p class="panel-note">${esc(source.coverageNote
  ??'Yield history not captured.')}</p>`)+supportingDetails('yields:methods','About this data',collection+panel('06',
  'WHAT CONTRIBUTED / WHY IT MATTERS / LIMITATIONS',(`<div class="explain"><p><strong>WHAT CONTRIBUTED.</strong> Real par yields and inflation `+
  `compensation provide context for nominal yields. Inflation compensation includes `+
  `inflation-risk and liquidity effects. The curves alone cannot identify causal `+
  `contributions from monetary policy, growth, inflation or investor `+
  `demand.</p><p><strong>WHY IT MATTERS.</strong> Curve slope and real rates help compare `+
  `borrowing conditions across maturities.</p><p><strong>LIMITATIONS.</strong> Nominal and `+
  `real curves have distinct underlying securities and cash flows; their difference is not an `+
  `exact economic decomposition or a pure forecast of inflation. Retention begins in 2003 and `+
  `uses currently published revised history, with no reconstructed original release vintages. `+
  `On December 1, 2008, Treasury changed the TIPS curve knot points from all securities to `+
  `the most recently auctioned TIPS; earlier published rates remain official. The December 6, `+
  `2021 spline-method change applies to both curves.</p><p><strong>Term premium.</strong> ACM `+
  `model estimates are not integrated pending dataset-specific workbook/input admission. `+
  `Subtracting an ACM component from a different Treasury curve would not create an exact `+
  `decomposition. A model estimate must remain labeled as modeled.</p><p><a `+
  `href="https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-stati`+
  `stics/treasury-yield-curve-methodology" target="_blank" rel="noopener noreferrer">Treasury `+
  `curve methodology ↗</a> · source credit: U.S. Treasury, Office of Debt Management.</p></div>`)))+'</div></div>';
}
