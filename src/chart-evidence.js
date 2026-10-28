/** Published maturity in elapsed years; all points keep exact native tenors. */
export function maturityYears(tenor){
 const match=/^(\d+(?:\.\d+)?)(M|Y)$/.exec(String(tenor));
 if(!match)throw new Error(`Unknown maturity ${tenor}`);
 return Number(match[1])/(match[2]==='M'?12:1);
}
export function observationEvidence(series,row){
 if(!row)return [];
 const notes=(row.footnotes??[]).map(note=>typeof note==='string'?note:note?.text??note?.code).filter(Boolean);
 if(row.preliminary===true&&!notes.some(note=>/prelim/i.test(note)))notes.push('Preliminary estimate');
 if(row.revisionIndicator==='Y')notes.push('Source revision flag; not a quantified publication revision');
 if(row.suppressed)notes.push('Source value suppressed');
 for(const change of series.methodologyBreaks??[]){
  if(change.kind==='real'&&['yield','nominalYield2','nominalYield3m','spread2s10s','spread3m10y'].includes(series.id))continue;
  if(typeof change.date==='string'&&row.date>=change.date)notes.push(`Method from ${change.date}: ${change.from??'previous method'} → ${change.to??change.change??'changed source method'}`);
 }
 if(['foreignTreasuryHoldings','fedTreasuryHoldings'].includes(series.id)){
  notes.push(row.date<'1952-01-01'?'Annual year-end observation; quarterly history begins 1952':'Quarterly period-end position');
  if(series.id==='fedTreasuryHoldings')notes.push(row.date<'2012-01-01'?'Historical H.4.1 source basis; not revalued to the later fair-value basis':'Fair-value reporting basis from 2012Q1');
 }
 return [...new Set(notes)];
}
