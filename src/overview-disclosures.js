/** Session-only disclosure choices survive evidence loads and detail returns. */
export function createOverviewDisclosureMemory(){
 const states=new Map();
 const disclosures=container=>container.querySelectorAll('details[data-overview-disclosure]');
 return {
  capture(container){for(const node of disclosures(container))states.set(node.dataset.overviewDisclosure,Boolean(node.open));},
  restore(container){for(const node of disclosures(container))if(states.has(node.dataset.overviewDisclosure))node.open=states.get(node.dataset.overviewDisclosure);},
 };
}
