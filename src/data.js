import { snapshot } from './official-snapshot.js';
import { registry } from './registry.js';
import {economicEvidenceSources} from './economic-evidence-snapshot.js';
import {treasuryAuctionCalendarSnapshot} from './treasury-auction-calendar-snapshot.js';
import {treasuryAuctionEvents} from './treasury-auction-calendar.js';

const runtimeSources={...economicEvidenceSources,...snapshot.sources};

const publicationNote='The source feed does not provide historical publication timestamps. Retrieval time is shown separately; it is not a release date.';
function catalogEntry(id,metadata){
  const source=runtimeSources[metadata.agency],official=source?.series?.[id];
  const dataStatus=!official?'unavailable':source.status==='ok'?'official':'cached';
  const entry={
    ...metadata,observationType:metadata.observationType??official?.observationType??'official',
    source:{...metadata.source,seriesIds:official?.sourceIds||[]},observations:official?.observations||[],dataStatus,
    fetchedAt:official?.fetchedAt||source?.fetchedAt||null,lastAttemptAt:source?.lastAttemptAt||null,error:source?.error||(!official?'This official source is not connected.':null),
    measure:official?.measure??'',provenance:official?.provenance??source?.provenance??[],inputProvenanceScope:official?.inputProvenanceScope,calculation:official?.calculation||'',sourceUrl:official?.sourceUrl||metadata.source.url,sourceUrls:official?.sourceUrls??[],
    sourceNotice:official?.sourceNotice??official?.redistributionNotice??'',licenseUrl:official?.licenseUrl??official?.termsUrl??'',attribution:official?.attribution??'',sourceTitle:official?.sourceTitle??'',
    coverageNote:official?.coverageNote||source?.coverageNote||'',publicationNote:official?.publicationNote??publicationNote,
    ...(['yield','nominalYield2','nominalYield3m','spread2s10s','spread3m10y','realYield10','inflationComp10'].includes(id)
      ?{methodologyBreaks:runtimeSources.yields?.methodologyBreaks??[]}:{}),
  };
  if(official?.retainedCoverage)Object.defineProperty(entry,'retainedCoverage',{value:official.retainedCoverage});
  return entry;
}
export const series=Object.fromEntries(Object.entries(registry).map(([id,metadata])=>[id,catalogEntry(id,metadata)]));
export const yieldCurve=[...(snapshot.sources.treasury?.yieldCurve||[])];
export const releases=[...(snapshot.releases||[]),...treasuryAuctionEvents(treasuryAuctionCalendarSnapshot)];
export const dataStatus={...snapshot,sources:runtimeSources,calendar:{...snapshot.calendar,sources:{...snapshot.calendar?.sources,'treasury-auctions':treasuryAuctionCalendarSnapshot}},curveDate:snapshot.sources.treasury?.curveDate||null,previousCurveDate:snapshot.sources.treasury?.previousCurveDate||null};

/** Replace verified source inputs without changing the public catalog or source map identities. */
export function hydrateSource(sourceId,source){
  runtimeSources[sourceId]=source;
  for(const [id,metadata]of Object.entries(registry)){
    if(metadata.agency===sourceId||sourceId==='yields'&&id==='yield')series[id]=catalogEntry(id,metadata);
  }
  if(sourceId==='treasury'){
    yieldCurve.splice(0,yieldCurve.length,...(source.yieldCurve??[]));
    dataStatus.curveDate=source.curveDate??null;
    dataStatus.previousCurveDate=source.previousCurveDate??null;
  }
}
