import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCompactNavigation, syncCompactNavigation} from '../src/compact-navigation.js';

// A small DOM boundary keeps these tests independent of browser layout while
// exercising the controller's actual event listeners and route updates.
class EventSurface {
  listeners = new Map();
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener));
  }
  emit(type, values = {}) {
    const event = {
      target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...values,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
}

class Element extends EventSurface {
  constructor(tag, attributes = {}, children = []) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.children = children;
    for (const child of children) child.parentElement = this;
    this.dataset = new Proxy({}, {
      get: (_, property) => this.getAttribute('data-' + property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())) ?? undefined,
      set: (_, property, value) => {
        this.setAttribute('data-' + property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), value);
        return true;
      },
    });
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  get open() { return this.hasAttribute('open'); }
  set open(value) { if (value) this.setAttribute('open', ''); else this.removeAttribute('open'); }
  get href() { return this.getAttribute('href'); }
  set href(value) { this.setAttribute('href', value); }
  contains(node) {
    for (let current = node; current; current = current.parentElement) if (current === this) return true;
    return false;
  }
  matches(selector) {
    const tag = selector.match(/^[a-z]+/i)?.[0];
    if (tag && tag.toUpperCase() !== this.tagName) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && this.getAttribute('id') !== id) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
    if (classes.some(name => !(this.getAttribute('class') ?? '').split(' ').includes(name))) return false;
    for (const [, name, , value] of selector.matchAll(/\[([\w-]+)(?:=(['"]?)(.*?)\2)?\]/g)) {
      if (!this.hasAttribute(name) || value !== undefined && this.getAttribute(name) !== value) return false;
    }
    return true;
  }
  closest(selector) {
    for (let current = this; current; current = current.parentElement) if (current.matches(selector)) return current;
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector.split(',').some(part => child.matches(part.trim())) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focus() { this.ownerDocument.activeElement = this; this.focusCount = (this.focusCount ?? 0) + 1; }
}

function fixture() {
  const link = (page, id) => new Element('a', {'data-nav': page, href: '#/' + page, ...(id ? {id} : {})});
  const primary = link('overview');
  const icon = new Element('span');
  primary.children.push(icon); icon.parentElement = primary;
  const summary = new Element('summary');
  const indicator = link('indicator', 'indicator-mobile');
  const watchlist = link('watchlist');
  const saved = link('research');
  const fiscal = link('fiscal');
  const details = new Element('details', {id: 'navigation-more'}, [summary, indicator, watchlist, saved, fiscal]);
  const nav = new Element('nav', {class: 'functionbar'}, [primary, details]);
  const group = new Element('a', {'data-nav-group': 'research', href: '#/fiscal'});
  const indicatorNav = link('indicator', 'indicator-nav');
  const indicatorRail = link('indicator', 'indicator-rail');
  const outside = new Element('button');
  const root = new Element('div', {}, [nav, group, indicatorNav, indicatorRail, outside]);
  const document = new EventSurface();
  document.activeElement = outside;
  document.querySelector = selector => root.querySelector(selector);
  const attach = node => { node.ownerDocument = document; node.children.forEach(attach); };
  attach(root);
  const window = new EventSurface();
  const controller = mountCompactNavigation(nav, {document, window});
  return {root, nav, primary, icon, summary, indicator, watchlist, saved, fiscal, details, group, indicatorNav, indicatorRail, outside, document, window, controller};
}

test('navigation link activation closes More even when the route does not change', () => {
  const {nav, details, icon} = fixture();
  details.open = true;
  nav.emit('click', {target: icon});
  assert.equal(details.open, false);
});

test('outside clicks close More while interacting inside navigation keeps it open', () => {
  const {nav, details, summary, outside, document} = fixture();
  details.open = true;
  document.emit('click', {target: summary});
  assert.equal(details.open, true);
  document.emit('click', {target: nav});
  assert.equal(details.open, true);
  document.emit('click', {target: outside});
  assert.equal(details.open, false);
});

test('Escape closes an open disclosure and returns keyboard focus to its trigger', () => {
  const {details, summary, document} = fixture();
  details.open = true;
  const event = document.emit('keydown', {key: 'Escape'});
  assert.equal(details.open, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(document.activeElement, summary);
  const closedEvent = document.emit('keydown', {key: 'Escape'});
  assert.equal(closedEvent.defaultPrevented, false);
  assert.equal(summary.focusCount, 1);
});

test('focus moving outside navigation closes More without taking focus back', () => {
  const {nav, details, summary, outside, document} = fixture();
  details.open = true;
  nav.emit('focusout', {relatedTarget: summary});
  assert.equal(details.open, true);
  document.activeElement = outside;
  nav.emit('focusout', {relatedTarget: outside});
  assert.equal(details.open, false);
  assert.equal(document.activeElement, outside);
});

test('browser route changes close More without stealing focus', () => {
  const {details, window, document, outside} = fixture();
  details.open = true;
  window.emit('hashchange');
  assert.equal(details.open, false);
  assert.equal(document.activeElement, outside);
});

test('explicit close restores focus only when requested', () => {
  const {controller, details, document, summary, outside} = fixture();
  details.open = true;
  controller.close();
  assert.equal(details.open, false);
  assert.equal(document.activeElement, outside);
  details.open = true;
  controller.close({restoreFocus: true});
  assert.equal(details.open, false);
  assert.equal(document.activeElement, summary);
});

test('research category highlights without falsely marking Saved research as the current page', () => {
  const {root, fiscal, saved, group, summary, primary} = fixture();
  saved.setAttribute('aria-current', 'page');
  syncCompactNavigation(root, {page: 'fiscal', seriesId: 'cpi'});
  assert.equal(fiscal.getAttribute('aria-current'), 'page');
  assert.equal(saved.hasAttribute('aria-current'), false);
  assert.equal(primary.hasAttribute('aria-current'), false);
  assert.equal(group.dataset.active, 'true');
  assert.equal(group.hasAttribute('aria-current'), false);
  assert.equal(summary.dataset.active, 'true');
});

test('core navigation clears overflow highlights and all indicator links follow the selected series', () => {
  const {root, primary, fiscal, group, summary, indicatorNav, indicatorRail, indicator} = fixture();
  syncCompactNavigation(root, {page: 'fiscal', seriesId: 'cpi'});
  syncCompactNavigation(root, {page: 'overview', seriesId: 'debt'});
  assert.equal(primary.getAttribute('aria-current'), 'page');
  assert.equal(fiscal.hasAttribute('aria-current'), false);
  assert.equal(group.dataset.active, 'false');
  assert.equal(summary.dataset.active, 'false');
  for (const link of [indicatorNav, indicatorRail, indicator]) assert.equal(link.href, '#/series/debt');
});

test('Saved research and Indicator detail each activate their exact More destination', () => {
  const {root, saved, indicator, group, summary} = fixture();
  syncCompactNavigation(root, {page: 'research', seriesId: 'unrate'});
  assert.equal(saved.getAttribute('aria-current'), 'page');
  assert.equal(group.dataset.active, 'false');
  assert.equal(summary.dataset.active, 'true');
  syncCompactNavigation(root, {page: 'indicator', seriesId: 'unrate'});
  assert.equal(saved.hasAttribute('aria-current'), false);
  assert.equal(indicator.getAttribute('aria-current'), 'page');
  assert.equal(summary.dataset.active, 'true');
});

test('family navigation distinguishes policy from Economy and marks only the selected topic',()=>{
 const {root,nav,details}=fixture();
 const economy=new Element('a',{'data-nav-group':'economy',href:'#/economy'});
 const fed=new Element('a',{'data-nav-group':'fed',href:'#/economy?family=policy'});
 const policy=new Element('a',{'data-nav':'macroCoverage','data-nav-family':'policy'});
 const external=new Element('a',{'data-nav':'macroCoverage','data-nav-family':'external'});
 nav.children.push(economy,fed);details.children.push(policy,external);
 syncCompactNavigation(root,{page:'macroCoverage',macroFamily:'policy',seriesId:'effr'});
 assert.equal(economy.dataset.active,'false');assert.equal(fed.dataset.active,'true');
 assert.equal(policy.getAttribute('aria-current'),'page');assert.equal(external.hasAttribute('aria-current'),false);
 syncCompactNavigation(root,{page:'macroCoverage',macroFamily:'external',seriesId:'currentAccount'});
 assert.equal(economy.dataset.active,'true');assert.equal(fed.dataset.active,'false');
 assert.equal(policy.hasAttribute('aria-current'),false);assert.equal(external.getAttribute('aria-current'),'page');
});

test('navigation synchronization tolerates removed recent-indicator primary links',()=>{
 const {root}=fixture();
 root.children=root.children.filter(node=>!['indicator-nav','indicator-rail'].includes(node.getAttribute('id')));
 assert.doesNotThrow(()=>syncCompactNavigation(root,{page:'labor',seriesId:'unrate'}));
});
