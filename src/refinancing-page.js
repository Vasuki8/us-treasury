import {supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {summarizeRefinancing,refinancingScenario} from './refinancing.js';
import {tabularCsv} from './model.js';
import {heading,button,panel,metrics,chart,table,emptyState,escapeHtml as esc} from './ui.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const money=value=>finite(value)?`$${value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}B`:'Unavailable';
const signed=value=>finite(value)?`${value>0?'+':value<0?'−':''}${money(Math.abs(value))}`:'Unavailable';
const percent=value=>finite(value)?`${value.toFixed(2)}%`:'Unavailable';
const number=value=>finite(value)?value.toFixed(2):'Unavailable';
const textList=items=>`<ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
const row=(label,value,detail='')=>`<tr><th scope="row">${esc(label)}</th><td class="num">${esc(value)}</td><td>${esc(detail)}</td></tr>`;
const captureState=source=>source?.status==='ok'?'Captured':source?.fetchedAt?'CACHED · refresh failed':'Unavailable';
const lineage=source=>JSON.stringify(source?.provenance??[]);
const sourceUrl=source=>source?.provenance?.find(item=>{try{const url=new URL(item.url);return url.pathname.endsWith('/mspd_table_3_market')&&url.searchParams.get('filter')===`record_date:eq:${source.asOf}`;}catch{return false;}})?.url??source?.provenance?.find(item=>item.url?.includes('/mspd_table_3_market?'))?.url??'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/';

function settings(state={}) {
  return {horizonMonths:[3,12,24].includes(Number(state.refinancingHorizon))?Number(state.refinancingHorizon):12,
    shockBps:[25,50,100,200].includes(Number(state.refinancingShock))?Number(state.refinancingShock):100};
}
function controls({horizonMonths,shockBps}) {
  return `<div class="toolbar"><label for="refinancing-horizon">Scenario horizon <select id="refinancing-horizon">${[3,12,24].map(value=>`<option value="${value}"${value===horizonMonths?' selected':''}>${value} months</option>`).join('')}</select></label><label for="refinancing-shock">Rate change magnitude <select id="refinancing-shock">${[25,50,100,200].map(value=>`<option value="${value}"${value===shockBps?' selected':''}>±${value} basis points</option>`).join('')}</select></label></div>`;
}
function monthlyChange(source) {
  const current=source?.series?.marketableDebt?.observations?.find(row=>row.date===source.asOf);
  if(!current||!finite(current.value))return 'An aligned current monthly balance is unavailable.';
  const date=new Date(`${source.asOf}T00:00:00Z`),priorDate=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),0)).toISOString().slice(0,10);
  const prior=source.series.marketableDebt.observations.find(row=>row.date===priorDate);
  return finite(prior?.value)?`Eligible unmatured marketable principal changed ${signed((current.value-prior.value)*1000)} from ${priorDate} to ${source.asOf}. This is a change in outstanding principal, not the fiscal deficit.`:'The exact preceding month is missing; no monthly balance change is inferred.';
}

export function refinancingPage(state={},source=dataStatus.sources.refinancing) {
  const summary=summarizeRefinancing(source),available=summary.status==='ok',options=settings(state);
  const header=heading('REFINANCING EXPOSURE','Treasury marketable maturities · observed principal, calculated exposure and modeled rate sensitivities',
    button('CSV MATURITIES',`data-export-refinancing${available?'':' disabled aria-describedby="refinancing-availability"'}`));
  if(!available)return header+panel('01','OFFICIAL MATURITY PROFILE',`<div id="refinancing-availability">${emptyState('Refinancing data unavailable.','A validated Treasury MSPD security profile is required. Missing maturities and principal are never replaced with zeros.')}</div>${source?.error?`<p class="panel-note amber">${esc(source.error)}</p>`:''}`)+panel('02','MODELED SCENARIOS',controls(options)+emptyState('Scenarios unavailable.','Rate scenarios require verified outstanding instruments.'));
  const higher=refinancingScenario(source,{horizonMonths:options.horizonMonths,rateShockBps:options.shockBps});
  const lower=refinancingScenario(source,{horizonMonths:options.horizonMonths,rateShockBps:-options.shockBps});
  const maturityRows=summary.maturing.map(item=>row(`${item.months} months`,money(item.principal),`${percent(item.sharePct)} of eligible principal · through ${item.endDate}, inclusive`)).join('');
  const instrumentRows=summary.byType.map(item=>row(item.type,money(item.principal),`${percent(item.sharePct)} of eligible principal · ${number(item.weightedAverageMaturityYears)} years remaining`)).join('');
  const scenarioRows=[higher,lower].map(item=>`<tr><th scope="row">${item.rateShockBps>0?'+':'−'}${Math.abs(item.rateShockBps)} bp · ${item.modeledRatePct.toFixed(2)}%</th><td class="num">${esc(signed(item.accruedImpact))}</td><td class="num">${esc(signed(item.annualizedImpactAtHorizon))}</td></tr>`).join('');
  const contributions=higher.byType.map(item=>`<tr><th scope="row">${esc(item.type)}</th><td class="num">${esc(money(item.repricingPrincipal))}</td><td class="num">${esc(signed(item.accruedImpact))}</td><td class="num">${esc(signed(lower.byType.find(row=>row.type===item.type).accruedImpact))}</td></tr>`).join('');
  const totals=source.totals??{};
  const reconciliation=table(['OFFICIAL / CALCULATED SCOPE','USD BILLIONS','DEFINITION'],
    row('Eligible unmatured principal',money(summary.totalPrincipal),'Five instrument types with future contractual maturities.')+
    row('Federal Financing Bank',money(totals.ffbPrincipal),'Excluded from this maturity profile.')+
    row('Matured, unredeemed principal',money(totals.maturedUnredeemedPrincipal),'Excluded; already past final maturity.')+
    row('Reported total marketable',money(totals.reportedMarketablePrincipal),'Eligible principal + FFB + matured-unredeemed balances.')+
    row('Reported marketable held by the public',money(totals.reportedMarketableHeldByPublic),'Aggregate ownership scope; not a CUSIP-level maturity allocation.')+
    row('Reported marketable intragovernmental',money(totals.reportedMarketableIntragovernmental),'Small holdings are included in the security-level profile.'), 'Marketable profile scope reconciliation');
  return header+`<p class="panel-note"><strong>WHAT CHANGED.</strong> ${esc(monthlyChange(source))}</p><p class="panel-note">Observation as of <strong>${esc(summary.asOf)}</strong> · retrieved ${esc(source.fetchedAt??'unavailable')} · ${esc(captureState(source))}. Release date: unknown; the month-end observation date is not a publication date.</p>${source.error?`<p class="panel-note amber">${esc(source.error)}</p>`:''}${(source.warnings??[]).length?`<div class="panel-note">${textList(source.warnings)}</div>`:''}`
    +`<p class="panel-note">Eligible unmatured marketable principal is not gross federal debt or debt held by the public alone. It excludes nonmarketable debt, Federal Financing Bank and matured-unredeemed balances, and includes small intragovernmental holdings. TIPS principal includes the current inflation adjustment; future inflation is unknown.</p>`
    +metrics(['marketableDebt'])
    +`<section class="metrics" aria-label="Calculated refinancing exposure"><div class="metric"><span class="metric-name">Bill share</span><strong class="metric-value">${esc(percent(summary.billSharePct))}</strong><span class="metric-period">Calculated · eligible principal</span></div><div class="metric"><span class="metric-name">Weighted-average remaining maturity</span><strong class="metric-value">${esc(number(summary.weightedAverageMaturityYears))} years</strong><span class="metric-period">Calculated · principal weighted</span></div><div class="metric"><span class="metric-name">Eligible instrument count</span><strong class="metric-value">${source.securities.length}</strong><span class="metric-period">Unique securities · official facts</span></div></section>`
    +`<div class="grid g11">${panel('01','CONTRACTUAL MATURITIES',table(['CUMULATIVE HORIZON','PRINCIPAL','SHARE / END DATE'],maturityRows),'','Calculated from official current principal and final maturity dates. Horizons preserve calendar month ends; TIPS amounts include current accrued inflation adjustment.')}${panel('02','CURRENT INSTRUMENT MIX',table(['INSTRUMENT','PRINCIPAL','SHARE / REMAINING MATURITY'],instrumentRows),'','Bill maturity values, nominal notes/bonds, FRNs and inflation-adjusted TIPS. This is a current composition, not an attribution of historical issuance changes.')}</div>`
    +panel('03','OUTSTANDING PRINCIPAL HISTORY',chart(['marketableDebt'],{height:210,range:36}),'','USD trillions · calculated sum of the five official unmatured instrument totals; missing months remain gaps.')
    +panel('04','HIGHER / LOWER RATE SCENARIOS',controls(options)+`<p class="panel-note"><strong>MODELED.</strong> A flat <strong>4% hypothetical baseline</strong> is compared with +${options.shockBps} / −${options.shockBps} basis points through ${esc(higher.endDate)}. These are sensitivity assumptions, not observed rates or forecasts.</p><p class="panel-note">Only currently outstanding principal is modeled, assumed fully refinanced into nominal fixed-rate debt at maturity and maintained through the horizon. FRNs use an assumed 7-day reset lag. TIPS principal is held constant with its original-principal floor; future inflation and deficits are not projected. Replacement and FRN rates use a zero-rate floor.</p>`+table(['MODELED RATE','INTEREST ACCRUED WITHIN HORIZON','ANNUALIZED AT HORIZON'],scenarioRows,'Modeled higher and lower rate sensitivities'),button('CSV SCENARIOS','data-export-refinancing-scenario'),'USD billions · incremental sensitivity relative to the same hypothetical baseline. At-horizon annualized impact differs from interest accruing during the period.')
    +panel('05','WHAT CONTRIBUTED',table(['INSTRUMENT','PRINCIPAL REPRICING BY HORIZON',`+${options.shockBps} BP ACCRUED`,`−${options.shockBps} BP ACCRUED`],contributions,'Modeled instrument contributions')+`<p class="panel-note">Bills reprice when refinanced; fixed coupons stay unchanged until maturity. FRNs can reset before final maturity. TIPS retain existing real coupons and their original-principal floor. Instrument contributions describe the modeled sensitivity; no unobserved cause of the monthly stock change is assigned.</p>`)
    +supportingDetails('refinancing:assumptions-methods','Full model assumptions, scope & methodology',panel('06','MODEL ASSUMPTIONS',textList(higher.assumptions),'','Original observed maturities are distinct from assumptions about future refinancing. Lower-rate results use the same assumptions and zero-rate floor.')
    +panel('07','SCOPE & RECONCILIATION',reconciliation,'','Marketable debt is not gross federal debt or debt held by the public alone. Do not equate the deficit with this stock change; cash balances and other financing affect borrowing.')
    +panel('08','WHY IT MATTERS & LIMITATIONS',`<div class="explain"><p><strong>WHY IT MATTERS.</strong> The timing and instrument mix of current principal describe how quickly a changed rate environment could reach financing costs. This partial exposure measure does not predict auction demand, yields or default.</p><p><strong>LIMITATIONS.</strong></p>${textList(higher.limitations)}<p><strong>Methodology.</strong> ${esc(summary.methodology)}</p><p>Original agency identifiers are used internally for deduplication. Published security IDs are generated by Meridian and are not official Treasury identifiers; raw third-party assigned identifiers are not exported.</p><p><a href="https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/" target="_blank" rel="noopener noreferrer">Treasury MSPD data and dictionary ↗</a>. Source URLs, response hashes, input principal and assumptions accompany CSV exports.</p></div>`));
}

const COLUMNS=['row_type','as_of','security_id','instrument','maturity_date','principal_usd_billions','original_principal_usd_billions','inflation_adjustment_usd_billions','coupon_rate_pct','metric','value','unit','horizon_months','horizon_end','shock_bps','baseline_rate_pct','scenario_rate_pct','frn_reset_lag_days','repricing_principal_usd_billions','accrued_impact_usd_billions','annualized_impact_at_horizon_usd_billions','data_status','observation_type','source_name','source_url','retrieved_at','release_date','methodology','assumptions','limitations','provenance'];
export function refinancingCsv(source,{scenario=false,horizonMonths=12,shockBps=100}={}) {
  const summary=summarizeRefinancing(source);
  if(summary.status!=='ok')return tabularCsv(COLUMNS,[]);
  const common={as_of:source.asOf,data_status:source.status==='ok'?'captured':'cached',source_name:'U.S. Treasury Bureau of the Fiscal Service, MSPD',source_url:sourceUrl(source),retrieved_at:source.fetchedAt,release_date:null,methodology:summary.methodology,limitations:[...summary.limitations,...(source.warnings??[])].join('\n'),provenance:lineage(source)};
  const rows=[];
  for(const security of source.securities)rows.push({...common,row_type:'security',security_id:security.securityId,instrument:security.type,maturity_date:security.maturityDate,principal_usd_billions:security.principal,original_principal_usd_billions:security.unadjustedPrincipal,inflation_adjustment_usd_billions:security.inflationAdjustment,coupon_rate_pct:security.couponRatePct,unit:'USD billions; coupon in percent',observation_type:'Official security facts; calculated unit conversion and reopening sums',methodology:'Principal and inflation amounts are USD millions / 1000. Original principal sums signed issued and redeemed amounts across reopening rows. One outstanding balance per security. security_id is Meridian-generated, not an official identifier.'});
  const metric=(name,value,unit='USD billions')=>rows.push({...common,row_type:'summary',metric:name,value,unit,observation_type:'Calculated metric'});
  metric('eligible_principal',summary.totalPrincipal);metric('bill_share',summary.billSharePct,'Percent');metric('weighted_average_remaining_maturity',summary.weightedAverageMaturityYears,'Years');
  for(const item of summary.maturing)rows.push({...common,row_type:'summary',metric:`maturing_${item.months}_months`,value:item.principal,unit:'USD billions',horizon_months:item.months,horizon_end:item.endDate,observation_type:'Calculated metric'});
  for(const [key,label] of [['reportedMarketablePrincipal','reported_marketable_principal'],['ffbPrincipal','federal_financing_bank_principal'],['maturedUnredeemedPrincipal','matured_unredeemed_principal'],['reportedMarketableHeldByPublic','reported_marketable_held_by_public'],['reportedMarketableIntragovernmental','reported_marketable_intragovernmental']])metric(label,source.totals?.[key]);
  if(scenario){
    if(!finite(shockBps)||shockBps<=0)throw new RangeError('Scenario shock magnitude must be a positive finite number');
    for(const direction of [1,-1]){
      const result=refinancingScenario(source,{horizonMonths,rateShockBps:direction*shockBps});
      const modeled={...common,row_type:'scenario',unit:'USD billions',horizon_months:result.horizonMonths,horizon_end:result.endDate,shock_bps:result.rateShockBps,baseline_rate_pct:result.baselineRatePct,scenario_rate_pct:result.modeledRatePct,frn_reset_lag_days:result.frnResetLagDays,observation_type:'Modeled scenario',assumptions:result.assumptions.join('\n'),limitations:result.limitations.join('\n'),methodology:'Signed incremental interest sensitivity; existing FRNs use actual/360 after the assumed reset lag, replacement financing actual/365. Each original principal is counted once; TIPS preserve the original-principal redemption floor.'};
      rows.push({...modeled,instrument:'All eligible instruments',accrued_impact_usd_billions:result.accruedImpact,annualized_impact_at_horizon_usd_billions:result.annualizedImpactAtHorizon});
      for(const item of result.byType)rows.push({...modeled,instrument:item.type,repricing_principal_usd_billions:item.repricingPrincipal,accrued_impact_usd_billions:item.accruedImpact,annualized_impact_at_horizon_usd_billions:item.annualizedImpactAtHorizon});
    }
  }
  return tabularCsv(COLUMNS,rows.map(row=>COLUMNS.map(key=>row[key])));
}
