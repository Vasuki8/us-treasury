import {escapeHtml as esc} from './ui.js';
export const researchPages=[['fiscal','Fiscal pressure'],['refinancing','Refinancing'],['yields','Yield explanations'],['auctions','Auction demand'],['ownership','Debt ownership'],['macro','Macro drivers']];
export const isResearchPage=page=>researchPages.some(([id])=>id===page);
export function researchNavigation(page){return isResearchPage(page)?`<nav class="research-navigation" aria-label="Research modules">${researchPages.map(([id,title])=>`<a class="action" href="#/${id}" data-nav="${id}"${id===page?' aria-current="page"':''}>${esc(title)}</a>`).join('')}</nav>`:'';}
