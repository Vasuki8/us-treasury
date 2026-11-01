/** A failed first attempt contains no captured data and cannot masquerade as a successful source. */
export function isEmptyFailedSource(source,id){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),allowed=['id','series','fetchedAt','provenance','warnings','status','lastAttemptAt','error','failure'];
 return object(source)&&source.id===id&&['unavailable','error'].includes(source.status)&&source.fetchedAt===null&&object(source.series)&&!Object.keys(source.series).length&&Array.isArray(source.provenance)&&!source.provenance.length&&Array.isArray(source.warnings)&&!source.warnings.length&&typeof source.error==='string'&&Boolean(source.error.trim())&&typeof source.lastAttemptAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(source.lastAttemptAt)&&Number.isFinite(Date.parse(source.lastAttemptAt))&&Object.keys(source).every(k=>allowed.includes(k));
}
