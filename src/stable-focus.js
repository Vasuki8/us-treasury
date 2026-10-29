export const stableLinkIdentity=link=>{
 if(link?.tagName!=='A')return null;
 const href=link.getAttribute('href');if(!href)return null;
 const detail=link.closest?.('details[data-page-disclosure],details[data-overview-disclosure]');
 const disclosure=detail?(detail.dataset.pageDisclosure!==undefined?'page:'+detail.dataset.pageDisclosure:'overview:'+detail.dataset.overviewDisclosure):null;
 return{href,id:link.id??'',text:(link.textContent??'').replace(/\s+/g,' ').trim(),disclosure};
};

/** Resolve only one semantic opener; legacy href-only snapshots still require uniqueness. */
export function findStableLink(root,identity){
 if(!identity?.href)return null;
 const matches=[...root.querySelectorAll('A')].filter(link=>{
  const current=stableLinkIdentity(link);if(current?.href!==identity.href)return false;
  return identity.id?current.id===identity.id:!Object.hasOwn(identity,'text')||current.text===identity.text&&current.disclosure===(identity.disclosure??null);
 });
 return matches.length===1?matches[0]:null;
}

/** Capture only stable identities. An empty data marker is an action, not an identity. */
export function rememberStableFocus(root,{document=root.ownerDocument??globalThis.document}={}){
 const active=document.activeElement;if(!root.contains(active))return null;
 const detail=active.tagName==='SUMMARY'?active.parentElement:active.closest?.('details[data-page-disclosure],details[data-overview-disclosure]');
 const disclosure=Object.entries(detail?.dataset??{}).find(([key,value])=>['pageDisclosure','overviewDisclosure'].includes(key)&&value);
 return {disclosure,node:active,id:active.id,tag:active.tagName,data:Object.fromEntries(Object.entries(active.dataset??{}).filter(([,value])=>String(value).trim()!=='')),href:active.tagName==='A'?active.getAttribute('href'):null,...(active.tagName==='A'?{linkIdentity:stableLinkIdentity(active)}:{}),start:active.selectionStart,end:active.selectionEnd,value:active.value};
}

/** A repaint must never take focus from a control the reader has since chosen. */
export function restoreStableFocus(root,snapshot,{document=root.ownerDocument??globalThis.document,restoreValue=false}={}){
 if(!snapshot)return null;
 const active=document.activeElement;
 if(active&&active!==snapshot.node&&active!==document.body&&active!==document.documentElement)return null;
 let element=snapshot.id?document.getElementById(snapshot.id):null;
 let scope=root;
 if(snapshot.disclosure){const [key,value]=snapshot.disclosure;const matches=[...root.querySelectorAll('details[data-page-disclosure],details[data-overview-disclosure]')].filter(node=>node.dataset[key]===value);if(matches.length===1){scope=matches[0];if(!element&&snapshot.tag==='SUMMARY')element=scope.querySelector('summary');}}
 const candidates=()=>[...scope.querySelectorAll(snapshot.tag)];
 if(!element&&snapshot.href)element=findStableLink(scope,snapshot.linkIdentity??{href:snapshot.href});
 if(!element&&Object.keys(snapshot.data).length){const matches=candidates().filter(node=>Object.entries(snapshot.data).every(([key,value])=>node.dataset[key]===value));if(matches.length===1)element=matches[0];}
 if(!element)return null;
 if(restoreValue&&element.type!=='file'&&snapshot.value!==undefined&&element.id===snapshot.id)element.value=snapshot.value;
 element.focus({preventScroll:true});
 if(typeof snapshot.start==='number'&&typeof element.setSelectionRange==='function')try{element.setSelectionRange(snapshot.start,snapshot.end);}catch{/* Date controls do not expose a text selection. */}
 return element;
}
