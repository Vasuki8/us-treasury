/** Tables read newest first; charts and source arrays remain chronological. */
export function frozenObservationPages(observations,pageSize=50){
 if(!Number.isInteger(pageSize)||pageSize<1)throw new RangeError('Positive page size required');
 const rows=[...observations].reverse(),pages=[];
 for(let offset=0;offset<rows.length;offset+=pageSize)pages.push({start:offset+1,end:Math.min(rows.length,offset+pageSize),total:rows.length,rows:rows.slice(offset,offset+pageSize)});
 return pages;
}
