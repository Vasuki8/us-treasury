const finite=value=>typeof value==='number'&&Number.isFinite(value);
const scales={trillions:1e12,billions:1e9,millions:1e6,thousands:1e3};
const currencyUnits={T:1e12,B:1e9,M:1e6,K:1e3,'':1};
const isYield=s=>s.id==='yield'||s.code==='DGS10'||s.changeInBasisPoints===true;
const significant=new Intl.NumberFormat('en-US',{maximumSignificantDigits:3});
const money=new Intl.NumberFormat('en-US',{minimumSignificantDigits:3,maximumSignificantDigits:3});
const integer=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});

function currencyScale(s){
  if(!s)return null;
  if(['trillions','billions'].includes(s.format)||/\b(?:USD|dollars)\b/i.test(s.unit??''))return scales[s.format]??1;
  return null;
}

/** Choose once for a displayed group; never rescale the retained observations. */
export function displayCurrencyUnit(seriesList=[]){
  let maximum=0,fallback=0;
  for(const s of seriesList){
    const scale=currencyScale(s);
    if(scale===null)continue;
    fallback=Math.max(fallback,scale);
    for(const row of s.observations??[])if(finite(row.value))maximum=Math.max(maximum,Math.abs(row.value)*scale);
  }
  const magnitude=maximum||fallback;
  return magnitude?Object.keys(currencyUnits).find(unit=>magnitude>=currencyUnits[unit])??'':undefined;
}

/** Match a compact monetary reading without dropping price bases or annualization. */
export function displayUnitLabel(s,{currencyUnit=displayCurrencyUnit([s])}={}){
  const native=s?.unit??'';
  if(currencyScale(s)===null||currencyUnit===undefined)return native;
  if(currencyUnit==='')return native.replace(/\b(?:trillions|billions|millions|thousands)(?: of)?\s*/i,'').trim();
  const scale={T:'trillions',B:'billions',M:'millions',K:'thousands'}[currencyUnit];
  if(!scale)throw new RangeError(`Unknown display currency unit: ${currencyUnit}`);
  if(!/trillions|billions|millions|thousands/i.test(native))return native?`${native} (displayed in ${scale})`:`USD ${scale}`;
  return native.replace(/trillions|billions|millions|thousands/i,word=>word[0]===word[0].toUpperCase()?scale[0].toUpperCase()+scale.slice(1):scale);
}

/** Compact readings only; source tables and numeric exports keep their own contracts. */
export function formatDisplayValue(s,value,{currencyUnit,change=false}={}){
  if(!s||!finite(value))return '—';
  let format=s.format;
  if(change&&format==='percent')format=isYield(s)?'basisPoints':'percentagePoints';
  const scale=currencyScale(s);
  let magnitude=Math.abs(value),unit='',prefix='',number;
  if(scale!==null){
    unit=currencyUnit??displayCurrencyUnit([{...s,observations:[{value}]}]);
    if(!Object.hasOwn(currencyUnits,unit))throw new RangeError(`Unknown display currency unit: ${unit}`);
    magnitude=magnitude*(scale/currencyUnits[unit]);
    prefix='$';number=money.format(magnitude);
  }else if(format==='basisPoints'){
    magnitude=Math.round(magnitude);number=integer.format(magnitude);unit=' bp';
  }else{
    number=significant.format(magnitude);
    unit={percent:'%',percentagePoints:' pp',thousands:'k',millions:'M'}[format]??'';
  }
  const sign=magnitude===0?'':value<0?'−':change?'+':'';
  return `${sign}${prefix}${number}${unit}`;
}

/** Changes retain the immediately preceding observation and original measurement basis. */
export function formatDisplayChange(s,{currencyUnit}={}){
  const rows=s?.observations;
  if(!rows||rows.length<2||!finite(rows.at(-1).value)||!finite(rows.at(-2).value))return '—';
  const difference=(rows.at(-1).value-rows.at(-2).value)*(s.format==='percent'&&isYield(s)?100:1);
  const value=Number(difference.toPrecision(12));
  return formatDisplayValue(s,value,{currencyUnit:currencyUnit??displayCurrencyUnit([s]),change:true});
}
