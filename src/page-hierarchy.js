import {escapeHtml as esc} from './ui.js';

/** Group native readings without changing their data or actions. */
export function readingGroup(label,body,note=''){
 return `<section class="reading-group" aria-label="${esc(label)}"><h2>${esc(label)}</h2>${body}${note?`<p class="reading-group-note">${esc(note)}</p>`:''}</section>`;
}

/** Keep native rendered research available below the primary working view. */
export function supportingDetails(key,label,body,{meta='',open=false,className=''}={}){
 return `<details class="supporting-details hierarchy-details${className?' '+esc(className):''}" data-page-disclosure="${esc(key)}"${open?' open':''}><summary><span>${esc(label)}</span>${meta?`<small>${esc(meta)}</small>`:''}</summary>${body}</details>`;
}

/** Opening a previously hidden chart needs its current layout and evidence catalog. */
export function watchDisclosureCharts(root,redraw){
 root.addEventListener('toggle',({target})=>{
  if(target?.tagName==='DETAILS'&&target.open&&target.querySelector('[data-chart]'))redraw(target);
 },true);
}
