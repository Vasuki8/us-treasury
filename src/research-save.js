import {escapeHtml as esc} from './ui.js';

export function researchSaveScope(state={}){
 return JSON.stringify([state.page,state.page==='indicator'?state.seriesId:null,state.macroFamily,state.exploreMode,state.vintageSeries,state.eventId]);
}

/** Session drafts are separate from saved configurations and frozen evidence. */
export function createResearchSaveDrafts(){
 const drafts=new Map();
 const get=(scope,fallback={})=>{if(!drafts.has(scope))drafts.set(scope,{name:fallback.name??'',selected:[...(fallback.selected??[])],query:'',open:false,feedback:null,pending:false});return drafts.get(scope);};
 return {get,update(scope,patch){Object.assign(get(scope),patch);},reset(scope){drafts.delete(scope);},capture(root){
  const panel=root.querySelector('.context-save[data-save-scope]');if(!panel)return;
  const draft=get(panel.dataset.saveScope),name=panel.querySelector('#research-name'),query=panel.querySelector('[data-freeze-query]');
  if(name)draft.name=name.value;if(query)draft.query=query.value;draft.open=panel.open;
  if(panel.querySelector('.freeze-preview'))draft.selected=[...panel.querySelectorAll('[data-freeze-select]:checked')].map(node=>node.dataset.freezeSelect);
 }};
}
const matches=(item,id,query)=>[item.name,item.short,item.unit,item.source?.name,item.agency,id].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

export function renderResearchSave({scope,draft,candidates=[],catalog={},active=false,watchlist=false,pending=false,release=false}){
 const selected=draft.selected??[],query=draft.query??'',busy=pending||draft.pending;
 const outside=selected.filter(id=>!candidates.includes(id)),choices=[...new Set([...candidates,...outside])];
 const visible=choices.filter(id=>matches(catalog[id]??{},id,query));
 const rows=choices.map(id=>{
  const item=catalog[id]??{},search=[item.name,item.short,item.unit,item.source?.name,item.agency,id].join(' ').toLocaleLowerCase();
  return `<label class="freeze-option" data-freeze-candidate="${esc(id)}"${visible.includes(id)?'':' hidden'}`
   +` data-freeze-search-text="${esc(search)}"><input type="checkbox" data-freeze-select="${esc(id)}"`
   +`${selected.includes(id)?' checked':''}><span><strong>${esc(item.name??id)}</strong>`
   +`<small>${esc(item.unit??'Unit unavailable')} · ${esc(item.source?.name??item.agency??'Source in evidence')}`
   +` <code>${esc(id)}</code></small>`
   +(outside.includes(id)?'<small class="amber">Selected outside the current view — uncheck to resolve.</small>':'')+'</span></label>';
 }).join('');
 const feedback=draft.feedback?`<p class="research-action-feedback${draft.feedback.kind==='error'?' amber':''}"`
  +` role="${draft.feedback.kind==='error'?'alert':'status'}">${esc(draft.feedback.message)}</p>`:'';
 const preview=choices.length?'<fieldset class="freeze-preview"><legend>Save snapshot · '
  +`<span data-freeze-count>${selected.length} of 4 selected</span></legend>`
  +'<label class="freeze-search" for="freeze-search">Find measurements'
  +`<input id="freeze-search" type="search" data-freeze-query value="${esc(query)}" autocomplete="off"`
  +' placeholder="Name, unit or source"></label><p class="small muted" data-freeze-search-status>'
  +`${visible.length} of ${choices.length} shown · selections stay checked when hidden.</p>`
  +`<div class="research-save-options" tabindex="0" aria-label="Measurements available to save">${rows}</div>`
  +'<p class="small muted">Select one to four primary measurement histories. Supporting evidence keeps its existing package scope.'
  +(watchlist?' Complete ordered watchlist membership is retained as context; unchecked observations are not saved.':'')+'</p></fieldset>'
  :`<p class="small muted">${release?'Save snapshot preserves this verified release and its supporting evidence.'
   :'No measurement is selected in this view. Choose a measurement before saving a snapshot.'}</p>`;
 return `<details class="context-save" data-save-scope="${esc(scope)}"${draft.open?' open':''}>`
  +'<summary id="research-save-trigger">Save</summary><section class="research-savebar" aria-label="Save research">'
  +'<header class="research-save-heading"><h2>Save research</h2><button type="button" class="action" id="research-save-close"'
  +' data-close-research-save aria-label="Close Save panel">×</button></header>'
  +'<label class="research-name-field" for="research-name">Research name'
  +`<input id="research-name" value="${esc(draft.name)}" maxlength="80" autocomplete="off"></label>`
  +'<div class="research-save-primary"><div class="actions"><button type="button" class="action" id="research-save-view"'
  +` data-save-workspace${busy?' disabled':''}>${draft.pending==='save'?'Saving…':active?'Update saved view':'Save view'}</button>`
  +'<button type="button" class="action" id="research-freeze-result" data-pin-result'
  +`${busy||outside.length||!release&&!selected.length?' disabled':''}>`
  +`${pending||draft.pending==='freeze'?'Saving…':'Save snapshot'}</button></div>`
  +'<p class="small muted">Save view keeps a reusable configuration. Save snapshot preserves observations and supporting evidence.</p>'
  +feedback+(outside.length?'<p class="small amber" role="status">A selected measurement is outside the current view. '
   +'Uncheck it or return to its view before saving a snapshot. No selection has been removed.</p>':'')
  +`</div>${preview}<footer class="actions"><a class="action" href="#/research">Saved research</a>`
  +(active?'<button type="button" class="link-button" data-clear-workspace>New saved view</button>':'')+'</footer></section></details>';
}

export function filterFreezeCandidates(root,query){
 const normalized=query.trim().toLocaleLowerCase(),rows=[...root.querySelectorAll('[data-freeze-candidate]')];let shown=0;
 for(const row of rows){row.hidden=!row.dataset.freezeSearchText.includes(normalized);if(!row.hidden)shown++;}
 const status=root.querySelector('[data-freeze-search-status]');if(status)status.textContent=`${shown} of ${rows.length} shown · selections stay checked when hidden.`;
}

export function researchSavePosition({anchor,viewport,width=460}){
 const actualWidth=Math.min(width,Math.max(0,viewport.width-24)),below=anchor.bottom+8;
 const top=viewport.width>600&&viewport.height-12-below>=260?below:12;
 return {left:Math.max(12,Math.min(anchor.right-actualWidth,viewport.width-actualWidth-12)),top,width:actualWidth,maxHeight:Math.min(700,Math.max(0,viewport.height-top-12))};
}
export function positionResearchSave(root,viewport=window){
 const details=root.querySelector('.context-save[open]'),panel=details?.querySelector('.research-savebar'),summary=details?.querySelector('summary');if(!panel||!summary)return;
 const position=researchSavePosition({anchor:summary.getBoundingClientRect(),viewport:{width:viewport.innerWidth,height:viewport.innerHeight}});
 Object.assign(panel.style,{left:position.left+'px',top:position.top+'px',width:position.width+'px',maxHeight:position.maxHeight+'px'});
}

export function installResearchSaveDismissal(root,document,{capture=()=>{}}={}){
 const close=restore=>{const panel=root.querySelector('.context-save[open]');if(!panel?.open)return;panel.open=false;capture();if(restore)panel.querySelector('summary')?.focus({preventScroll:true});};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.querySelector('.context-save[open]')?.open){event.preventDefault();close(true);}});
 document.addEventListener('pointerdown',event=>{const panel=root.querySelector('.context-save[open]');if(panel?.open&&!panel.contains(event.target))close(false);});
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-close-research-save]'))close(true);});
}
