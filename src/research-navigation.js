import {escapeHtml as esc} from './ui.js';
import {stitchDeskContracts} from './stitch-desk-contracts.js';

// One home per research question; secondary navigation contains only siblings.
const economy=[
 ['macroCoverage','Activity & income','#/economy?family=activity','activity'],
 ['macro','GDP contributions','#/macro'],
 ['macroCoverage','Inflation','#/economy?family=prices','prices'],
 ['labor','Labor market','#/economy/labor'],
 ['macroCoverage','Housing','#/economy?family=housing','housing'],
 ['macroCoverage','Trade & current account','#/economy?family=external','external'],
 ['credit','Credit & banking','#/credit'],
];
const fed=[['macroCoverage','Policy rates','#/economy?family=policy','policy'],['yields','Rates & curves','#/yields'],
 ['market','Funding & market functioning','#/market']];
const treasury=[['fiscal','Fiscal pressure','#/fiscal'],['refinancing','Refinancing exposure','#/refinancing'],
 ['auctions','Auction demand','#/auctions'],['ownership','Debt ownership','#/ownership']];
const evidence=[['research','Publication history','#/research?view=publications','publications'],
 ['vintages','Retrieval history','#/vintages'],['research','Capture changes','#/research?view=changes','changes'],
 ['sources','Sources & terms','#/sources']];
const research=[['watchlist','Watchlist','#/watchlist'],['research','Saved views','#/research','workspaces'],
 ['research','Saved snapshots','#/research?view=packages','packages']];
for(const[id,d]of Object.entries(stitchDeskContracts))({economy,fed,treasury}[d.family]).push([id,d.title,'#'+d.path]);
export const researchPages=[...economy,...fed,...treasury,['vintages','Retrieval history','#/vintages']];
export const isResearchPage=page=>researchPages.some(([id])=>id===page);

const icons={activity:'trending_up',macro:'pie_chart',prices:'price_change',labor:'badge',housing:'home',external:'swap_horiz',
 credit:'account_balance',policy:'balance',yields:'show_chart',market:'waterfall_chart',fiscal:'account_balance_wallet',
 refinancing:'update',auctions:'gavel',ownership:'public'};
const navIcon=key=>`<span class="material-symbols-outlined nav-icon" aria-hidden="true">${icons[key]??icons.activity}</span>`;
const workspaceTitles={activity:'Growth & Income',external:'Trade & Account',market:'Funding & Liquidity',refinancing:'Refinancing',dealers:'Primary Dealers',money:'Money Markets',liquidity:'Treasury Liquidity',fomc:'FOMC & Projections',qt:'Balance Sheet & QT',tips:'TIPS & Breakevens',fxBasis:'FX Funding',refunding:'Refunding & TBAC',debtCeiling:'Debt Ceiling & Cash',wedge:'CPI–PCE Wedge'};

export function workspaceNavigation(){
 return [['economy','Economy',economy],['fed','Fed & Rates',fed],['treasury','Treasury & Fiscal',treasury]].map(([id,label,links])=>
  `<section class="workspace-nav-group" data-workspace-family="${id}" aria-label="${esc(label)}"><h2 class="rail-title" data-nav-group="${id}">${esc(label)}</h2>`
  +links.map(([page,title,href,detail])=>`<a href="${esc(href)}" data-nav="${page}"`
   +`${page==='macroCoverage'?` data-nav-family="${detail}"`:''}>${navIcon(detail??page)}${esc(workspaceTitles[detail??page]??title.replace(/\b[a-z]/g,letter=>letter.toUpperCase()))}</a>`).join('')+'</section>').join('');
}

export function navigationFamily(input={}) {
 const state=typeof input==='string'?{page:input}:input;
 if(stitchDeskContracts[state.page])return stitchDeskContracts[state.page].family;
 if(state.page==='macroCoverage')return state.macroFamily==='policy'?'fed':'economy';
 if(['labor','macro','credit'].includes(state.page))return 'economy';
 if(['yields','market'].includes(state.page))return 'fed';
 if(treasury.some(([id])=>id===state.page))return 'treasury';
 if(['vintages','sources'].includes(state.page)||state.page==='research'&&['publications','changes'].includes(state.researchView))return 'evidence';
 if(['watchlist','research'].includes(state.page))return 'research';
 return null;
}

export function navigationLinkActive(link,state={}) {
 const page=state.page==='macroCoverage'&&state.macroFamily==='labor'?'labor':state.page;
 if(link.dataset.nav!==page)return false;
 const family=link.dataset.navFamily,view=link.dataset.navView;
 return (!family||family===(state.macroFamily??'activity'))&&(!view||view===(state.researchView??'workspaces'));
}

export function researchNavigation(input) {
 const state=typeof input==='string'?{page:input}:input??{},family=navigationFamily(state);
 const links=['evidence','research'].includes(family)?[...research,...evidence]:{economy,fed,treasury}[family];
 if(!links)return '';
 const label={economy:'Economy',fed:'Fed & rates',treasury:'Treasury & funding',evidence:'Research & evidence',research:'Research & evidence'}[family];
 return `<nav class="research-navigation" aria-label="${esc(label)} pages">${links.map(([id,title,href,detail])=>{
  const attrs={nav:id,...(id==='macroCoverage'?{navFamily:detail}:id==='research'?{navView:detail}:{})};
  return `<a class="action" href="${esc(href)}" data-nav="${id}"${attrs.navFamily?` data-nav-family="${attrs.navFamily}"`:''}${attrs.navView?` data-nav-view="${attrs.navView}"`:''}${navigationLinkActive({dataset:attrs},state)?' aria-current="page"':''}>${esc(title)}</a>`;
 }).join('')}</nav>`;
}
