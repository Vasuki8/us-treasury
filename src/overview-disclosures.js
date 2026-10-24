/** Session-only disclosure choices survive evidence loads and detail returns. */
export function createOverviewDisclosureMemory(){
 const states=new Map();
 const disclosures=container=>container.querySelectorAll('details[data-overview-disclosure],details[data-page-disclosure]');
 const key=node=>node.dataset.pageDisclosure!==undefined?`page:${node.dataset.pageDisclosure}`:`overview:${node.dataset.overviewDisclosure}`;
 return {
  capture(container){for(const node of disclosures(container))states.set(key(node),Boolean(node.open));},
  restore(container){for(const node of disclosures(container))if(states.has(key(node)))node.open=states.get(key(node));},
 };
}
