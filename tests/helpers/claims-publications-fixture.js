// Synthetic publication facts for frontend isolation; never production data.
const stages={advance:'Advance','prior-week-revised':'Revised prior','prior-week-unrevised':'Unrevised prior','prior-week-status-unknown':'Prior comparison (status unknown)'};
export function claimsFact({seriesId='claimsAdvance',period='2026-03-07',publicationDate='2026-03-12',releaseStage='advance',value=200,seasonalAdjustmentNote=null,seasonalAdjustmentKind=null}={}){
 const sourceUrl=`https://oui.doleta.gov/press/${publicationDate.slice(0,4)}/${publicationDate.slice(5,7)}${publicationDate.slice(8)}${publicationDate.slice(2,4)}.pdf`;
 return {id:`dol-${seriesId}-${period}-${publicationDate}-${releaseStage}`,seriesId,period,estimate:stages[releaseStage],releaseStage,publicationDate,publicationDatePrecision:'day',publishedAt:null,value,sourceValue:String(value*1000),previouslyPublishedSourceValue:['advance','prior-week-status-unknown'].includes(releaseStage)?null:String((value-(releaseStage==='prior-week-revised'?1:0))*1000),unit:seriesId==='claimsAdvance'?'Thousands of claims':'Thousands of continued claims',frequency:'Weekly',adjustment:'Seasonally adjusted',sourceUrl,releaseEvidenceUrl:sourceUrl,sourceTitle:'Unemployment Insurance Weekly Claims',licenseUrl:'https://www.dol.gov/general/aboutdol/copyright',attribution:'Source: U.S. Department of Labor, Employment and Training Administration.',calculation:'Published count / 1000; archived same-release fact, not the current revised history.',sourceIds:[seriesId==='claimsAdvance'?'InitialClaims/SA/Release':'ContinuedClaims/SA/Release'],footnotes:[`Synthetic ${releaseStage} evidence.`],provenance:[{url:sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T22:00:00.000Z',lastModified:null}],seasonalAdjustmentNote,seasonalAdjustmentKind};
}
export const claimsFixture=()=>({version:1,releases:[
 claimsFact({period:'2025-12-27',publicationDate:'2026-01-08',releaseStage:'prior-week-unrevised',value:208}),
 claimsFact(),
 claimsFact({publicationDate:'2026-03-19',releaseStage:'prior-week-revised',value:201,seasonalAdjustmentNote:'Source reports annual seasonal-factor updates; this notice does not identify the cause of every revision.',seasonalAdjustmentKind:'applied-update'}),
 claimsFact({period:'2026-03-14',publicationDate:'2026-03-19',value:202,seasonalAdjustmentNote:'Source reports annual seasonal-factor updates.',seasonalAdjustmentKind:'applied-update'}),
 claimsFact({seriesId:'continuedClaimsAdvance',publicationDate:'2026-03-19',value:1700}),
 claimsFact({seriesId:'continuedClaimsAdvance',publicationDate:'2026-03-26',releaseStage:'prior-week-unrevised',value:1700}),
 claimsFact({period:'2026-03-14',publicationDate:'2026-03-26',releaseStage:'prior-week-revised',value:203}),
]});
