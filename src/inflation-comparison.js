import {getSeries,latest,periodLabel} from './model.js';
import {indicatorHref} from './workspace-context.js';
import {table,escapeHtml as esc} from './ui.js';

const groups=[
  ['Headline PCE',['pceMonthly','pce','pceAnnualized3m','pceAnnualized6m']],
  ['Core PCE',['pceCoreMonthly','pceCore','pceCoreAnnualized3m','pceCoreAnnualized6m']],
  ['Headline CPI',['cpiMonthly','cpi','cpiAnnualized3m','cpiAnnualized6m']],
  ['Core CPI',['cpiCoreMonthly','cpiCore','cpiCoreAnnualized3m','cpiCoreAnnualized6m']],
];

/** Display precision only; each linked measure keeps its own retained values, dates and source precision. */
export function inflationHorizonTable(state={},{lookup=getSeries}={}){
  const failures=new Map();
  const rows=groups.map(([label,ids])=>{
    const measures=ids.map(id=>({id,current:lookup(id),row:latest(lookup(id))}));
    for(const {current} of measures)if(current?.error){if(!failures.has(current.error))failures.set(current.error,new Set());failures.get(current.error).add(label);}
    const dates=[...new Set(measures.map(item=>item.row?.date).filter(Boolean))];
    const reference=dates.length===1?periodLabel(measures.find(item=>item.row?.date)?.current,dates[0]):dates.length?'Different reference months':'Reference unavailable';
    return `<tr><th scope="row">${esc(label)}<span class="table-code muted">${esc(reference)}${measures.some(item=>item.current?.dataStatus==='cached')?' · CACHED':''}</span></th>${measures.map(({id,current,row})=>`<td class="num" data-inflation-reading="${id}"><a href="${esc(indicatorHref(id,state))}" title="${esc(`${current?.name??id} · ${row?.date??'unavailable'} · ${current?.unit??'Percent'} · ${current?.adjustment??'Adjustment unavailable'}`)}">${Number.isFinite(row?.value)?`${row.value.toFixed(1)}%`:'Unavailable'}</a>${dates.length>1&&row?.date?`<span class="table-code muted">${esc(periodLabel(current,row.date))}</span>`:''}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="inflation-horizon-comparison">${table(['INFLATION / REFERENCE','MONTHLY','YEAR OVER YEAR','3M ANNUALIZED','6M ANNUALIZED'],rows,'Headline and core PCE and CPI inflation across distinct horizons, percent')}${[...failures].map(([error,labels])=>`<p class="panel-note amber">${esc([...labels].join(' / '))}: ${esc(error)}</p>`).join('')}<p class="panel-note">Monthly rates are percent month over month, not annualized. Year-over-year is the annual headline / core comparison; 3M and 6M annualized rates describe shorter momentum. CPI annual inflation uses NSA indexes; monthly and annualized momentum use SA inputs. PCE has a different scope and weighting. Each cell links to its exact measure and retained precision.</p><p class="panel-note"><a href="https://www.federalreserve.gov/monetarypolicy/files/FOMC_LongerRunGoals.pdf" target="_blank" rel="noopener noreferrer">The Fed’s longer-run 2% inflation objective refers to the annual change in the headline PCE price index ↗</a>. Core PCE helps assess underlying inflation; it is not the stated target index.</p></div>`;
}
