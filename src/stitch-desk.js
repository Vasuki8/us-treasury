import {escapeHtml as esc} from './ui.js';

/** Desk cards show only values resolved by their page's retained source. */
export function deskReadings(label,items){
 return `<section class="stitch-kpi-strip" aria-label="${esc(label)}">${items.map(item=>{
  const tag=item.seriesId?'a':'article',link=item.seriesId?` href="#/series/${encodeURIComponent(item.seriesId)}"`:'';
  return `<${tag} class="stitch-kpi metric"${link}><span class="metric-name">${esc(item.label)}</span>`
   +`<strong class="stitch-kpi-value">${esc(item.value)}</strong><span class="metric-change">${esc(item.change??'')}</span>`
   +`<span class="metric-period">${esc(item.basis)}</span>${item.seriesId?'<span class="metric-detail" aria-hidden="true">Details</span>':''}</${tag}>`;
 }).join('')}</section>`;
}

/** Evidence pillars keep coverage limits beside the chart and exact-value ledger. */
export function deskContext(label,items){
 return `<section class="stitch-context-grid" aria-label="${esc(label)}">${items.map((item,index)=>
  `<article class="stitch-context-card"><p class="eyebrow">${esc(item.kicker??`Evidence ${String(index+1).padStart(2,'0')}`)}</p>`
  +`<h3>${esc(item.title)}</h3>${item.value?`<strong>${esc(item.value)}</strong>`:''}<p>${esc(item.note)}</p></article>`
 ).join('')}</section>`;
}
