const finite=value=>typeof value==='number'&&Number.isFinite(value);
function previousQuarter(raw) {
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
  const value=new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(value.getTime())?new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()-2,0)).toISOString().slice(0,10):null;
}
export function summarizeOwnership(source) {
  if(!source?.z1?.asOf||!Array.isArray(source.z1.sectors)||!source.z1.sectors.length)return {status:'unavailable',reason:'Verified official ownership positions are unavailable.'};
  const z1=source.z1;
  const prior=z1.history?.find(row=>row.date===previousQuarter(z1.asOf));
  const sectors=z1.sectors.map(row=>{
    const previous=prior?.sectors?.find(item=>item.code===row.code)?.value;
    return {...row,change:finite(row.value)&&finite(previous)?row.value-previous:null,previousDate:prior?.date??null};
  });
  let soma=null;
  if(source.soma?.asOf&&Array.isArray(source.soma.history)) {
    const current=source.soma,history=current.history,previous=history.find(row=>row.date===new Date(Date.parse(`${current.asOf}T00:00:00Z`)-7*86400000).toISOString().slice(0,10));
    soma={asOf:current.asOf,principal:current.principal,inflationCompensation:current.inflationCompensation,adjustedPrincipal:current.adjustedPrincipal,change:finite(current.adjustedPrincipal)&&finite(previous?.adjustedPrincipal)?current.adjustedPrincipal-previous.adjustedPrincipal:null,previousDate:previous?.date??null,valuation:'par plus accrued TIPS inflation compensation'};
  }
  return {status:'ok',dataStatus:'calculated',asOf:z1.asOf,releaseDate:z1.releaseDate??null,unit:'USD billions',sectors,
    assets:z1.assets,liabilities:z1.liabilities,valuationDiscrepancy:z1.valuationDiscrepancy,reconciled:z1.reconciled,soma,
    limitations:[...(source.limitations??[]),
      'Quarterly Z.1 market valuation and sector definitions differ from separately dated weekly SOMA par holdings. Cross-source totals and ownership shares are not inferred.',
      'Changes are changes in reported positions; they do not establish purchases, sales or causal effects on yields.',
    ]};
}

export const SOMA_2014_GAP_URL='https://www.newyorkfed.org/medialibrary/Interactives/markets/soma-interactive/soma-data/total-portfolio-summary.json';
export const SOMA_2014_GAP_DATES=Object.freeze(['2014-02-05','2014-02-12','2014-02-19','2014-02-26','2014-03-05','2014-03-12','2014-03-19','2014-03-26','2014-04-02','2014-04-09','2014-04-16','2014-04-23','2014-04-30','2014-05-07','2014-05-14']);
export const SOMA_2014_GAP_NOTE='Official New York Fed SOMA visualization aggregate reports FRN zero; the primary API field is blank and retained as null. This date uses matched visualization Treasury components, not an imputed API observation.';
