// Reviewed dated BLS Table A cells. Unknown editions require a separate source review.
const editions=[
 ['2026-02-13','2026-01-01','USDL-26-0186','0.2','0.3','2.4','2.5','0.3','0.2'],
 ['2026-03-11','2026-02-01','USDL-26-0437','0.3','0.2','2.4','2.5','0.2','0.3'],
 ['2026-04-10','2026-03-01','USDL-26-0599','0.9','0.2','3.3','2.6','0.3','0.2'],
 ['2026-05-12','2026-04-01','USDL-26-0721','0.6','0.4','3.8','2.8','0.9','0.2'],
 ['2026-06-10','2026-05-01','USDL-26-0824','0.5','0.2','4.2','2.9','0.6','0.4'],
 ['2026-07-14','2026-06-01','USDL-26-1191','-0.4','0.0','3.5','2.6','0.5','0.2'],
 ['2026-08-12','2026-07-01','USDL-26-1378','0.1','0.2','3.4','2.5','-0.4','0.0'],
 ['2026-09-11','2026-08-01','USDL-26-1496','0.4','0.3','3.4','2.4','0.1','0.2'],
 ['2026-10-14','2026-09-01','USDL-26-1574','0.6','0.3','3.7','2.6','0.4','0.3'],
];
export const cpiPublicationReleases=Object.freeze(editions.map(([publicationDate,period,releaseNumber,...values])=>Object.freeze({publicationDate,period,releaseNumber,values:Object.freeze(values),sourceUrl:`https://www.bls.gov/news.release/archives/cpi_${publicationDate.slice(5,7)}${publicationDate.slice(8,10)}${publicationDate.slice(0,4)}.htm`})));
export const cpiPublicationScope=Object.freeze(cpiPublicationReleases.flatMap(release=>['cpiMonthly','cpiCoreMonthly','cpi','cpiCore','cpiMonthly','cpiCoreMonthly'].map((seriesId,index)=>{
 const prior=index>=4,monthly=seriesId.endsWith('Monthly'),period=prior?new Date(Date.UTC(Number(release.period.slice(0,4)),Number(release.period.slice(5,7))-2,1)).toISOString().slice(0,10):release.period;
 const releaseStage=prior?'prior-month':'published',rowId=seriesId.includes('Core')?'cpi_pressa.r.1.3':'cpi_pressa.r.1',columnId=monthly?`cpi_pressa.h.2.${prior?'7':'8'}`:'cpi_pressa.h.1.9';
 return Object.freeze({id:`bls-${seriesId}-${period}-${releaseStage}-${release.publicationDate}`,seriesId,period,releaseStage,publicationDate:release.publicationDate,referencePeriod:release.period,releaseNumber:release.releaseNumber,sourceUrl:release.sourceUrl,sourceValue:release.values[index],rowId,columnId,headers:`${rowId} ${monthly?'cpi_pressa.h.1.2 ':''}${columnId}`});
})));
