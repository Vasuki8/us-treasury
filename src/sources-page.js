import {dataStatus} from './data.js';
import {heading,sourceNotice,escapeHtml as esc} from './ui.js';

/** All original credits remain available together, with their source wording intact. */
export function sourcesPage(snapshot=dataStatus){
 return heading('Sources & terms','Source credits, reuse notices and official terms for retained data.')
  +`<section class="panel sources-terms"><div class="panel-body">${sourceNotice(snapshot.sources,
   {calendarSources:snapshot.calendar?.sources??{},includeAll:true})}</div></section>`
  +`<details class="supporting-details"><summary>About this data</summary><p>Snapshot assembled `
  +`${esc(snapshot.generatedAt??'Not recorded')}. Source retrievals are separate from observation periods and publication dates.</p></details>`;
}
