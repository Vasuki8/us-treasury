/** Resolve this stylesheet's min/max-width media blocks before inspecting viewport-specific declarations. */
export function viewportCss(css,width){
 const pattern=/@media\s*([^{}]+)\{/g;let out='',cursor=0,match;
 while((match=pattern.exec(css))){
  const start=pattern.lastIndex;let depth=1,end=start;
  while(end<css.length&&depth){if(css[end]==='{')depth++;else if(css[end]==='}')depth--;end++;}
  if(depth)throw Error('Unclosed stylesheet media block');
  out+=css.slice(cursor,match.index);
  const bounds=[...match[1].matchAll(/\((min|max)-width\s*:\s*(\d+)px\)/g)];
  if(bounds.every(([,kind,limit])=>kind==='min'?width>=Number(limit):width<=Number(limit)))out+=viewportCss(css.slice(start,end-1),width);
  cursor=end;pattern.lastIndex=end;
 }
 return out+css.slice(cursor);
}
