const eastern = new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});

/** Source timestamps must identify UTC explicitly, rather than depend on the host's timezone. */
export function easternFields(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(iso)) throw new Error('Invalid explicit UTC calendar instant');
  const instant=new Date(iso);
  const canonical=iso.includes('.')?iso:iso.replace('Z','.000Z');
  if (!Number.isFinite(instant.getTime()) || instant.toISOString()!==canonical) throw new Error('Invalid UTC calendar date or instant');
  const parts=Object.fromEntries(eastern.formatToParts(instant).map(part=>[part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}

/** Resolve an Eastern wall-clock time using the runtime's IANA timezone rules. */
export function easternInstant(date,time) {
  if (typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time!=='string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid Eastern calendar date or time');
  const wall=new Date(`${date}T${time}:00.000Z`);
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0,16)!==`${date}T${time}`) throw new Error('Invalid Eastern calendar date');
  // Modern US Eastern clocks have UTC-04:00 or UTC-05:00 offsets. Verify the
  // result against IANA rules, including transition gaps and repeated hours.
  const candidates=[4,5].map(offset=>new Date(wall.getTime()+offset*3600000).toISOString()).filter(iso=>{
    const fields=easternFields(iso);return fields.date===date && fields.time===time;
  });
  if (candidates.length!==1) throw new Error(candidates.length?'Ambiguous Eastern calendar time':'Nonexistent Eastern calendar time');
  return candidates[0];
}

const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…'};

/** Extract source text only. This does not parse or execute HTML or load resources. */
export function decodeHtmlText(html) {
  return String(html)
    .replace(/<!--[^]*?-->/g,' ')
    .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(original,key)=>{
      if (!key.startsWith('#')) return entities[key.toLowerCase()]??original;
      const code=key[1].toLowerCase()==='x'?Number.parseInt(key.slice(2),16):Number(key.slice(1));
      return Number.isInteger(code) && code>0 && code<=0x10ffff && !(code>=0xd800 && code<=0xdfff)?String.fromCodePoint(code):original;
    })
    .replace(/\s+/g,' ').trim();
}
