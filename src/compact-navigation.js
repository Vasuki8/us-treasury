import {isResearchPage} from './research-navigation.js';

export function mountCompactNavigation(nav, {document=globalThis.document, window=globalThis.window}={}) {
  const menu=nav.querySelector('#navigation-more');
  const trigger=menu.querySelector('summary');
  function close({restoreFocus=false}={}) {
    const wasOpen=menu.open;
    menu.open=false;
    if(restoreFocus&&wasOpen)trigger.focus();
  }
  nav.addEventListener('click',event=>{
    if(event.target.closest?.('a[href]'))close();
  });
  document.addEventListener('click',event=>{
    if(!nav.contains(event.target))close();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&menu.open){event.preventDefault();close({restoreFocus:true});}
  });
  nav.addEventListener('focusout',event=>{
    if(!nav.contains(event.relatedTarget))close();
  });
  window.addEventListener('hashchange',()=>close());
  return {close};
}

export function syncCompactNavigation(root, {page,seriesId}) {
  for(const link of root.querySelectorAll('[data-nav]')) {
    if(link.dataset.nav===page)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  for(const group of root.querySelectorAll('[data-nav-group]')) {
    group.dataset.active=String(group.dataset.navGroup==='research'&&isResearchPage(page));
  }
  const menu=root.querySelector('#navigation-more');
  menu.querySelector('summary').dataset.active=String([...menu.querySelectorAll('[data-nav]')].some(link=>link.dataset.nav===page));
  for(const id of ['indicator-nav','indicator-rail','indicator-mobile'])root.querySelector(`#${id}`).href=`#/series/${seriesId}`;
  for(const strip of root.querySelectorAll('.research-navigation')) {
    const active=strip.querySelector('[aria-current="page"]');
    if(!active||strip.scrollWidth<=strip.clientWidth)continue;
    const item=active.getBoundingClientRect(),bounds=strip.getBoundingClientRect();
    if(item.left<bounds.left||item.right>bounds.right)strip.scrollLeft+=item.left-bounds.left-8;
  }
}
