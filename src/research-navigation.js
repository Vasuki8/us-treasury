import {escapeHtml as esc} from './ui.js';
export const researchPages=[['macroCoverage','Economy','#/economy'],['fiscal','Fiscal pressure'],['refinancing','Refinancing'],['yields','Rates & curves'],['auctions','Auction demand'],['ownership','Debt ownership'],['macro','GDP contributions'],['vintages','Retrieval history'],['market','Market functioning'],['credit','Credit & banking']];
export const isResearchPage=page=>researchPages.some(([id])=>id===page);
export function researchNavigation(page){return isResearchPage(page)?`<nav class="research-navigation" aria-label="Research modules">${researchPages.map(([id,title,href])=>`<a class="action" href="${href??`#/${id}`}" data-nav="${id}"${id===page?' aria-current="page"':''}>${esc(title)}</a>`).join('')}</nav>`:'';}
