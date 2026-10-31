import {series} from './data.js';
import {readingChanges} from './research-brief.js';
import {indicatorHref} from './workspace-context.js';
import {escapeHtml as esc} from './ui.js';

/** A short reading guide, independent of selected chart windows and publication archives. */
export function readingBrief(ids,state){
 const rows=readingChanges(series,ids);
 return '<section class="reading-brief" aria-label="What changed in the data">'
  +'<div class="brief-heading"><h2>What changed</h2><span>Retained observations · dates vary</span></div>'
  +`<div class="brief-takeaways">${rows.map(row=>'<article>'
   +`<a href="${esc(indicatorHref(row.id,state))}">${esc(row.title)}</a>`
   +`<p>${esc(row.comparison)}</p>`
   +(row.direction==='unavailable'?`<small>Latest reference: ${esc(row.period)}</small>`:'')
   +(row.cached?'<small class="amber">Cached reading</small>':'')
   +(row.warning?`<p class="amber" role="status">${esc(row.warning)}</p>`:'')
   +(row.coverageNote&&/partial|suppressed|not (?:directly )?comparable/i.test(row.coverageNote)?`<p class="amber">${esc(row.coverageNote)}</p>`:'')
   +'</article>').join('')}</div></section>`;
}
