// Exact official scope and reuse: docs/sources/inflation-desks-source-review.md.
export const BEA_MONTHLY_URL='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
export const BEA_SERIES_URL='https://apps.bea.gov/national/Release/TXT/SeriesRegister.txt';
export const BEA_TABLES_URL='https://apps.bea.gov/national/Release/TXT/TablesRegister.txt';
export const BEA_INFLATION_LICENSE='https://www.bea.gov/help/faq/147';
export const CLEVELAND_MEDIAN_URL='https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/mcpi_revised.csv?sc_lang=en';
export const CLEVELAND_TRIMMED_URL='https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/trim_revised.csv?sc_lang=en';
export const CLEVELAND_LICENSE='https://creativecommons.org/licenses/by-sa/4.0/';
export const CLEVELAND_METHOD_URL='https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/median-cpi/methodological-approach-interpolating-missing-october-2025-cpi-data.pdf';
export const INFLATION_DESK_LIMIT=120;
export const INFLATION_INPUT_LIMIT=132;
export const CLEVELAND_IMPUTED_DATES=Object.freeze(['2025-10-01','2025-11-01']);
export const inflationTableTitles={
 T20804:'Table 2.8.4. Price Indexes for Personal Consumption Expenditures by Major Type of Product, Monthly',
 T20805:'Table 2.8.5. Personal Consumption Expenditures by Major Type of Product, Monthly',
 T20807:'Table 2.8.7. Percent Change From Preceding Period in Prices for Personal Consumption Expenditures by Major Type of Product, Monthly',
 U90100:'Table 9.1U. Reconciliation of Percent Change in the CPI with Percent Change in the PCE Price Index',
};
const native={},bea={},cleveland={};
function input(code,label,metric,calculation,scale,table,line){native[code]={label,metric,calculation,scale,table,line,title:inflationTableTitles[table]};}
function output(id,code,name,mode,extra={}){bea[id]={id,code,codes:[code],name,mode,...extra};}
const categories=[
 ['Goods','DGDSRG','DGDSRGM','DGDSRC','Goods',2],
 ['Services','DSERRG','DSERRGM','DSERRC','Services',13],
 ['Food','DFXARG','DFXARGM','DFXARC','Food and beverages purchased for off-premises consumption',9],
 ['Energy','DNRGRG','DNRGRGM','DNRGRC','Energy goods and services',27],
 ['MarketCore','DPCXRG','DPCXRGM',null,'Market-based PCE excluding food and energy',31],
 ['ServicesExEnergyHousing','IA001260','PP001260','LA001260','PCE services excluding energy and housing',28],
];
input('DPCERC','Personal consumption expenditures','Current Dollars','Level',-6,'T20805',1);
for(const [key,index,monthly,dollars,label,line]of categories){
 input(index,label,'Fisher Price Index','Level',0,'T20804',line);
 input(monthly,label,'Fisher Price Index','Percent change',0,'T20807',line);
 output('pce'+key+'PriceIndex',index,label+' · price index','native',{unit:'Index, 2017=100',format:'index',precision:3});
 output('pce'+key+'Monthly',monthly,label+' · monthly inflation','native',{unit:'Percent month over month',precision:1});
 output('pce'+key+'Annual',index,label+' · annual inflation','annual',{unit:'Percent year over year',precision:2});
 if(dollars){input(dollars,label,'Current Dollars','Level',-6,'T20805',line);output('pce'+key+'Weight',dollars,label+' · expenditure share','share',{codes:[dollars,'DPCERC'],denominator:'DPCERC',unit:'Percent of current-dollar PCE',precision:2});}
}
for(const [id,code,label,line,sign]of [
 ['cpiPcePublishedPce','QPCERV','PCE Chain-type price index (percent change)',1,0],
 ['cpiPceFormulaEffect','W902RV','Less: Formula effect (percentage points)',2,-1],
 ['cpiPceWeightEffect','W913RV','Less: Weight effect (percentage points)',13,-1],
 ['cpiPceScopePceEffect','W921RV','Less: Scope effect - PCE price index items out-of-scope of the CPI (percentage points)',21,-1],
 ['cpiPceScopeCpiEffect','W927RV','Plus: Scope effect - CPI items out-of-scope of the PCE price index (percentage points)',28,1],
 ['cpiPceOtherEffect','W931RV','Less: Other effects (percentage points)',32,-1],
 ['cpiPcePublishedCpi','SRSA0V','Equals: CPI (percent change)',39,0],
]){
 input(code,label,sign?'Price Contributions':'Ratio','Level',0,'U90100',line);
 output(id,code,label,'native',{unit:sign?'Percentage points':'Percent month over month',precision:sign?2:1,reconciliationSign:sign,table:'U90100'});
}
const clevelandNative={};
for(const [key,prefix,title,url]of [['Median','mcpi','Median CPI',CLEVELAND_MEDIAN_URL],['Trimmed','trim','16% Trimmed-Mean CPI',CLEVELAND_TRIMMED_URL]]){
 const monthly=prefix+'_monthly_chg',annualized=prefix+'_ann_monthly_chg';
 clevelandNative[monthly]={url,kind:'monthly-fraction'};clevelandNative[annualized]={url,kind:'annualized-percent'};
 for(const [suffix,code,mode,unit]of [['Monthly',monthly,'fraction','Percent month over month'],['Annualized',annualized,'native','Percent annualized monthly rate'],['Annual',monthly,'compound','Percent trailing 12 months']]){
  const id='cleveland'+key+'Cpi'+suffix;cleveland[id]={id,code,codes:[code],name:title+' · '+(suffix==='Annual'?'trailing 12 months':suffix==='Annualized'?'annualized monthly rate':'monthly rate'),mode,unit,precision:2,url,title};
 }
}
export const inflationDeskDefinitions={
 inflationBea:{id:'inflationBea',title:'BEA PCE detail and CPI–PCE reconciliation',feeds:[BEA_MONTHLY_URL,BEA_SERIES_URL,BEA_TABLES_URL],licenseUrl:BEA_INFLATION_LICENSE,native,series:bea,coverageNote:'Latest 120 available monthly observations per measurement, with 12 additional native inputs for exact annual comparisons. Published BEA monthly SA price rates and 9.1U percentage-point effects are not annualized. Expenditure shares approximate relative importance; they are not fixed Fisher weights. Missing months remain missing.',warnings:['The CPI–PCE reconciliation is monthly seasonally adjusted arithmetic, not a decomposition of year-over-year inflation.','Current revised source history is not a history of first releases; source reference dates do not establish publication times.']},
 inflationCleveland:{id:'inflationCleveland',title:'Median CPI and 16% Trimmed-Mean CPI',feeds:[CLEVELAND_MEDIAN_URL,CLEVELAND_TRIMMED_URL],licenseUrl:CLEVELAND_LICENSE,native:clevelandNative,series:cleveland,coverageNote:'Cleveland Fed statistical inflation estimates from its own two revised CSVs only. Monthly fractions are scaled by 100; published annualized one-month rates remain separate from calculated compounded 12-month growth. October and November 2025 are imputed; any annual window including either month is flagged. No Haver CPI or core CPI columns are used.',warnings:['October and November 2025 one-month rates were imputed by the Cleveland Fed from the September-to-November change; they are not observed one-month readings.','Annual growth is a Meridian calculation compounding 12 exact published monthly fractions; affected windows retain imputation flags.']},
};
const beaSource={name:'U.S. Bureau of Economic Analysis',url:'https://www.bea.gov/'},clevelandSource={name:'Federal Reserve Bank of Cleveland',url:'https://www.clevelandfed.org/indicators-and-data/median-cpi'};
export const inflationDeskRegistry=Object.fromEntries(Object.entries(inflationDeskDefinitions).flatMap(([agency,d])=>Object.entries(d.series).map(([id,s])=>[id,{
 id,code:s.code,name:s.name,short:s.name,topic:'Inflation',agency,frequency:'Monthly',dateConvention:'month-start',format:s.format??(s.unit==='Percentage points'?'percentagePoints':'percent'),unit:s.unit,precision:s.precision,adjustment:'Seasonally adjusted',observationType:['annual','share','compound'].includes(s.mode)?'calculated':'official',source:agency==='inflationBea'?beaSource:clevelandSource,
 comparisonClass:s.unit.startsWith('Index')?'level':s.unit==='Percentage points'?'contribution':s.mode==='share'?'rate':'growth',
 definition:agency==='inflationCleveland'?d.coverageNote:s.mode==='share'?'100 × current-dollar category PCE / total current-dollar PCE on the exact same month, both SAAR. An expenditure share approximates relative importance and is not a fixed Fisher price-index weight.':s.mode==='annual'?'100 × published SA price index / exact year-ago index − 100; Meridian calculation, with no adjacent-month substitution.':s.table==='U90100'?'Published BEA Table 9.1U monthly seasonally adjusted rate or percentage-point effect. CPI = PCE − formula − weight − PCE-scope + CPI-scope − other, subject to published rounding; not a year-over-year decomposition.':'Published BEA NIPA monthly seasonally adjusted price index (2017=100) or monthly percent change. Food excludes restaurant meals; energy includes energy goods and utility services. Services excluding energy and housing is a separately published index, not a subtraction of chained indexes.',
}])));
