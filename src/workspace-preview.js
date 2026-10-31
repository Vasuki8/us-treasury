import {getSeries,latest,periodLabel} from './model.js';
import {formatDisplayValue,displayUnitLabel,displayCurrencyUnit} from './display-format.js';
import {escapeHtml as esc,chart,panel,seriesStatus} from './ui.js';
import {indicatorHref} from './workspace-context.js';
import {humanTimestamp} from './ui-time.js';

/** A small, explicit snapshot preview, independent of comparison and history-window state. */
export function seriesPreview(id,state,{title='Series preview',controls='',definition=true,summary=true}={}){
 const current=getSeries(id);if(!current)return '';
 const observation=latest(current);
 const options={currencyUnit:displayCurrencyUnit([current])};
 const reading=`<div class="workspace-preview-reading"><a href="${esc(indicatorHref(id,state))}">${esc(current.name)}</a>`
  +`<strong>${esc(formatDisplayValue(current,observation?.value,options))}</strong>`
  +`<span>${esc(displayUnitLabel(current,options))} · ${esc(observation?periodLabel(current,observation.date):'Unavailable')}</span></div>`;
 const basis=`<p class="panel-note">${esc(current.frequency)} · ${esc(current.adjustment)} · ${esc(seriesStatus(current))}</p>`;
 const critical=['dol','dolAdvance'].includes(current.agency)||observation?.partial||observation?.suppressed
  ||/partial|suppressed|not (?:directly )?comparable/i.test(current.coverageNote??'');
 const warning=current.coverageNote&&(definition||critical)?`<p class="panel-note">${esc(current.coverageNote)}</p>`:'';
 const error=current.error?`<p class="panel-note amber" role="status">${esc(current.error)}</p>`:'';
 const caption=`<p class="panel-note preview-caption">${esc(current.name)} · ${esc(displayUnitLabel(current,options))} · ${esc(observation?periodLabel(current,observation.date):'Unavailable')}</p>`;
 const body=controls+(summary?reading:caption)+basis+error+chart([id],{range:12,height:215,kind:['gdp','payroll'].includes(id)?'bar':'line'})
  +`<p class="panel-note preview-window">Up to 12 retained observations · native units · no interpolation</p>`
  +(definition?`<div class="preview-definition"><p>${esc(current.definition)}</p>${warning}`
    +`<p class="muted">${esc(current.source.name)} · Retrieved ${esc(humanTimestamp(current.fetchedAt)||'Unavailable')}</p></div>`:warning);
 const action=`<a class="action" href="${esc(indicatorHref(id,state))}">Open full history</a>`;
 return panel('',title,body,action,'','workspace-preview');
}
