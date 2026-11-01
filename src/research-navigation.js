import {escapeHtml as esc} from './ui.js';

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
export const researchPages=[...economy,...fed,...treasury,['vintages','Retrieval history','#/vintages']];
export const isResearchPage=page=>researchPages.some(([id])=>id===page);

const iconPaths={activity:'m3 16 5-5 4 3 8-9M16 5h4v4',macro:'M12 3v9h9M9 3.5a9 9 0 1 0 11.5 11.5',
 prices:'M4 7h16v12H4zM8 3v4m8-4v4M8 12h8m-8 3h5',labor:'M4 7h16v14H4zM8 7V3h8v4M8 11v6m4-6v6m4-6v6',
 housing:'m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7',external:'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
 credit:'m3 8 9-5 9 5H3zM5 11v7m7-7v7m7-7v7M3 21h18',policy:'M12 3v18M4 7h16M4 7 1 14h6L4 7zm16 0-3 7h6l-3-7M8 21h8',
 yields:'m3 18 5-9 5 5 7-10M3 21h18',market:'M4 5h4v14H4zM10 10h4v9h-4zM16 3h4v16h-4zM2 22h20',
 fiscal:'M3 5h18v14H3zM15 9h6v6h-6zM7 9h4',refinancing:'M4 7a9 9 0 1 1-1 9M4 3v4h4M12 7v6l4 2',
 auctions:'m6 3 9 9-4 4-9-9 4-4zm6 10 8 8M13 3l8 8M3 21h9',ownership:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18'};
const navIcon=key=>`<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[key]??iconPaths.activity}"/></svg>`;

export function workspaceNavigation(){
 return [['economy','Economy',economy],['fed','Fed & rates',fed],['treasury','Treasury & funding',treasury]].map(([id,label,links])=>
  `<details class="workspace-nav-group" data-workspace-family="${id}"><summary data-nav-group="${id}">${esc(label)}</summary>`
  +links.map(([page,title,href,detail])=>`<a href="${esc(href)}" data-nav="${page}"`
   +`${page==='macroCoverage'?` data-nav-family="${detail}"`:''}>${navIcon(detail??page)}${esc(title)}</a>`).join('')+'</details>').join('');
}

export function navigationFamily(input={}) {
 const state=typeof input==='string'?{page:input}:input;
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
