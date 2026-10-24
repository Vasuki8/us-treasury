/** Review queue only. Discovery never changes approved scopes or retained facts. */
export function publicationUpkeep({archives={},approvedScopes={},discoveries={},checkedAt=null}={}){
 const families={};
 for(const [family,scope] of Object.entries(approvedScopes)){
  const rows=archives[family]?.releases??[],ids=new Set(rows.map(row=>row.id)),approved=new Set(scope.map(row=>row.id)),urls=new Set(scope.map(row=>row.sourceUrl)),dates=new Set(scope.map(row=>row.publicationDate)),approvedPeriods=new Set(scope.map(row=>row.period).filter(Boolean));
  const missingApprovedIds=scope.filter(row=>!ids.has(row.id)).map(row=>row.id),unexpectedIds=rows.filter(row=>!approved.has(row.id)).map(row=>row.id),duplicateIds=[...ids].filter(id=>rows.filter(row=>row.id===id).length>1);
  const discovery=discoveries[family]??{status:'unchecked',candidates:[],note:'Official candidate discovery was not run.'};
  const reviewQueue=(discovery.candidates??[]).filter(candidate=>candidate.matchBy==='referencePeriod'?!approvedPeriods.has(candidate.period):candidate.matchBy==='publicationDate'?!dates.has(candidate.publicationDate):!urls.has(candidate.sourceUrl)).map(candidate=>({...candidate,status:'review-required',reason:candidate.matchBy==='referencePeriod'?'A secondary source has CPI data for a reference month outside the retained archive; original publication evidence and values still require source review.':'Official source candidate is outside the reviewed archive scope; values and layout require review before admission.'}));
  const publicationDates=rows.map(row=>row.publicationDate).filter(Boolean).sort(),periods=rows.map(row=>row.period).filter(Boolean).sort();
  const status=unexpectedIds.length||duplicateIds.length?'invalid-archive':missingApprovedIds.length?'missing-approved':reviewQueue.length?'review-required':discovery.status==='error'?'discovery-unavailable':discovery.status!=='checked'?'discovery-unchecked':'approved-complete';
  families[family]={status,approvedCount:scope.length,retainedCount:rows.length,missingApprovedIds,unexpectedIds,duplicateIds,publicationStart:publicationDates[0]??null,publicationEnd:publicationDates.at(-1)??null,referenceStart:periods[0]??null,referenceEnd:periods.at(-1)??null,discovery,reviewQueue};
 }
 const statuses=Object.values(families).map(row=>row.status),status=['invalid-archive','missing-approved','review-required','discovery-unavailable','discovery-unchecked','approved-complete'].find(value=>statuses.includes(value))??'discovery-unchecked';
 return {version:1,checkedAt,status,families,interpretation:'Approved archive completeness and official candidate discovery are separate. A completed check is not verification of a new publication. Candidates require review; no unknown edition is automatically admitted.'};
}
