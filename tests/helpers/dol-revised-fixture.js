const xml='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const index='https://oui.doleta.gov/unemploy/archive.asp';
const pdfs=['100826','101526','102226','100126','092426'].map(day=>`https://oui.doleta.gov/press/2026/${day}.pdf`);
const receipts=[xml,index,...pdfs].map((url,i)=>({url,sha256:String(i+1).repeat(64),retrievedAt:`2026-10-26T12:00:0${i}.000Z`,lastModified:null}));
const tuple=receipt=>({sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt});
const xmlRow=(date,sourceValue)=>({date,value:sourceValue===''?null:Number(sourceValue.replaceAll(',',''))/1000,publishedAt:null,sourceValue,...tuple(receipts[0])});
function prior(date,sourceValue,publicationDate,receipt,previouslyPublishedSourceValue){
 return {date,value:Number(sourceValue.replaceAll(',',''))/1000,publishedAt:null,sourceValue,...tuple(receipt),publicationDate,publicationDatePrecision:'day',releaseStage:sourceValue===previouslyPublishedSourceValue?'prior-week-unrevised':'prior-week-revised',previouslyPublishedSourceValue,footnotes:['Explicit prior-week comparison; exact publication instant is unknown.']};
}

/** Synthetic receipts/counts exercise admission and replay, not source verification. */
export function dolRevisedFixture(){
 const claimsOverlap=prior('2026-09-26','199,000','2026-10-08',receipts[2],'197,000');
 const continuedOverlap=prior('2026-09-26','1,714,000','2026-10-15',receipts[3],'1,716,000');
 const series=(id,rows,overlap)=>({sourceUrl:xml,sourceIds:[id==='claims'?'InitialClaims/SA':'ContinuedClaims/SA'],sourceUrls:[...new Set([xml,...rows.map(row=>row.sourceUrl),overlap.sourceUrl])],inputProvenanceScope:'observation-source-urls',licenseUrl:'https://www.dol.gov/general/aboutdol/copyright',attribution:'Source: U.S. Department of Labor, Employment and Training Administration.',sourceTitle:'Unemployment Insurance Weekly Claims Data',observationType:'official',dataStatus:'official',frequency:'Weekly',adjustment:'Seasonally adjusted',unit:id==='claims'?'Thousands of claims':'Thousands of continued claims',observations:rows,latestObservationDate:rows.at(-1).date});
 return {id:'dol',fetchedAt:receipts.at(-1).retrievedAt,provenance:structuredClone(receipts),latestObservationDate:'2026-10-10',revisedHistoryProfile:{version:1,xmlThrough:{claims:'2026-09-26',continuedClaims:'2026-09-26'},latestReleaseDate:'2026-10-22',overlaps:{claims:claimsOverlap,continuedClaims:continuedOverlap}},series:{
  claims:series('claims',[xmlRow('2026-09-12','198,000'),xmlRow('2026-09-19',''),xmlRow('2026-09-26','199000'),prior('2026-10-03','198,000','2026-10-15',receipts[3],'197,000'),prior('2026-10-10','200,000','2026-10-22',receipts[4],'199,000')],claimsOverlap),
  continuedClaims:series('continuedClaims',[xmlRow('2026-09-12','1,712,000'),xmlRow('2026-09-26','1,714,000'),prior('2026-10-03','1,703,000','2026-10-22',receipts[4],'1,710,000')],continuedOverlap),
 }};
}
