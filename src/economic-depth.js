const finite=value=>typeof value==='number'&&Number.isFinite(value);
const offsetMonth=(date,offset)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCMonth(value.getUTCMonth()+offset);return value.toISOString().slice(0,10);};
const byDate=rows=>new Map((rows??[]).map(row=>[row.date,row]));
const quarterEnd=date=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCMonth(value.getUTCMonth()+3,0);return value.toISOString().slice(0,10);};

/** Latest-revised accounting context, not an as-known publication vintage. */
export function fiscalGdpContext(sources={}) {
  const bea=sources.bea,treasury=sources.treasury,fiscal=sources.fiscal;
  const nominal=bea?.series?.nominalGdp?.observations??[],latest=[...nominal].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  if(!latest)return null;
  const quarterDate=latest.date,end=quarterEnd(quarterDate),gdpMap=byDate(nominal),fiscalMap=byDate(fiscal?.monthly);
  const denominatorCapturedAt=bea.series.nominalGdp.fetchedAt??bea.fetchedAt??null;
  const stock=(measurement,source,label)=>{
    const observation=[...(measurement?.observations??[])].filter(row=>row.date<=end&&row.date>=quarterDate).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
    const lag=observation?(Date.parse(end)-Date.parse(observation.date))/86400000:Infinity;
    const value=lag<=7&&finite(observation?.value)&&finite(latest.value)&&latest.value>0?100*observation.value*1000/latest.value:null;
    return {value,numerator:label,numeratorDate:observation?.date??null,numeratorUnit:'USD trillions',denominator:latest.value,denominatorUnit:'Billions of current dollars (SAAR)',denominatorPeriod:quarterDate,numeratorCapturedAt:measurement?.fetchedAt??source?.fetchedAt??null,denominatorCapturedAt,formula:'100 × (quarter-end debt in trillions × 1000) / same-quarter nominal GDP SAAR in billions; latest published debt record within seven days of quarter end'};
  };
  const quarters=Array.from({length:4},(_,i)=>gdpMap.get(offsetMonth(quarterDate,-3*i)));
  const annualGdp=quarters.every(row=>finite(row?.value)&&row.value>0)?quarters.reduce((sum,row)=>sum+row.value/4,0):null;
  const endMonth=end.slice(0,7)+'-01',months=Array.from({length:12},(_,i)=>fiscalMap.get(offsetMonth(endMonth,-i)));
  const flow=(field,label)=>{
    const available=months.every(row=>row&&(field==='deficit'?finite(row.receipts)&&finite(row.outlays):finite(row.netInterest)));
    const numerator=available?months.reduce((sum,row)=>sum+(field==='deficit'?row.outlays-row.receipts:row.netInterest),0):null;
    return {value:finite(numerator)&&finite(annualGdp)&&annualGdp>0?100*numerator/annualGdp:null,numerator:label,numeratorValue:numerator,numeratorUnit:'USD billions, actual trailing 12 months',numeratorStart:offsetMonth(endMonth,-11),numeratorEnd:end,denominator:annualGdp,denominatorUnit:'USD billions, actual trailing four quarters',denominatorPeriods:quarters.map((row,i)=>row?.date??offsetMonth(quarterDate,-3*i)),numeratorCapturedAt:fiscal?.fetchedAt??null,denominatorCapturedAt,formula:'100 × sum of 12 exact monthly fiscal actuals / sum of four exact quarterly nominal GDP SAAR levels divided by 4; incomplete windows remain unavailable'};
  };
  return {basis:'latest-revised',quarterDate,quarterEnd:end,grossDebtToGdp:stock(treasury?.series?.debt,treasury,'Gross federal debt, including intragovernmental holdings'),publicDebtToGdp:stock(fiscal?.series?.publicDebt,fiscal,'Federal debt held by the public, excluding intragovernmental holdings'),deficitToGdp:flow('deficit','Budget outlays minus receipts; positive is deficit'),netInterestToGdp:flow('interest','Net budget interest; not gross Treasury interest expense'),notice:'Current revised nominal GDP and independently captured Treasury actuals. Debt is a stock at the named quarter end; fiscal flows and GDP use matching trailing-year windows. Captured-at dates are retrieval vintages, not verified publication times. Chained-dollar measures are never denominators.'};
}
