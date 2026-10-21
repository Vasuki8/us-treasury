import { snapshot } from './official-snapshot.js';
import { registry } from './registry.js';

const publicationNote='The source feed does not provide historical publication timestamps. Retrieval time is shown separately; it is not a release date.';
export const series=Object.fromEntries(Object.entries(registry).map(([id,metadata])=>{
  const source=snapshot.sources[metadata.agency],official=source?.series?.[id];
  const dataStatus=!official?'unavailable':source.status==='ok'?'official':'cached';
  return [id,{...metadata,source:{...metadata.source,seriesIds:official?.sourceIds||[]},observations:official?.observations||[],revisions:[],dataStatus,fetchedAt:source?.fetchedAt||null,lastAttemptAt:source?.lastAttemptAt||null,error:source?.error||(!official?'This official source is not connected.':null),calculation:official?.calculation||'',sourceUrl:official?.sourceUrl||metadata.source.url,publicationNote}];
}));
export const yieldCurve=snapshot.sources.treasury?.yieldCurve||[];
export const releases=snapshot.releases||[];
export const dataStatus={...snapshot,curveDate:snapshot.sources.treasury?.curveDate||null,previousCurveDate:snapshot.sources.treasury?.previousCurveDate||null};
