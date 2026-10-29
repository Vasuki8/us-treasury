// Authoring command only: node tests/fixtures/ui-snapshot/generate.mjs. Tests never regenerate this pinned capture.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeStoredSnapshot,encodeStoredSnapshot} from '../../../scripts/snapshot-storage.mjs';
import {assertCommercialData} from '../../../scripts/data-policy.mjs';
import {BLS_LABOR_HISTORY_STARTS} from '../../../scripts/bls-history-policy.mjs';
import {registry} from '../../../src/registry.js';
import {addMomentumSeries} from '../../../src/momentum.js';
import {deriveFiscalSeries} from '../../../src/fiscal.js';
import {aggregateAuctionOfferings} from '../../../src/auctions.js';
import {SOMA_2014_GAP_DATES} from '../../../src/ownership.js';
import {H15_3M_GAP_DATES} from '../../../src/yields.js';
import {recordVintages} from '../../../src/vintages.js';

const rootBytes=await readFile(new URL('../../../src/official-snapshot.json.gz',import.meta.url));
const snapshot=decodeStoredSnapshot(rootBytes);
const sourceBytes=Buffer.byteLength(JSON.stringify(snapshot));
const caps={Monthly:24,Quarterly:16,Weekly:104,Daily:64};
const fundingAnchor=date=>['2016-03-01','2018-04-02'].includes(date);
const curveAnchor=date=>date<='2003-01-06'||date>='2008-10-31'&&date<='2008-12-31'||['2021-12-03','2021-12-06'].includes(date);
const bounded=(rows,count,anchor=()=>false)=>rows.filter((row,index)=>index>=rows.length-count||anchor(row.date));
for(const [sourceId,source] of Object.entries(snapshot.sources)){
  for(const [id,item] of Object.entries(source.series??{})){
    const anchor=date=>sourceId==='bls'&&date===BLS_LABOR_HISTORY_STARTS[id]
      ||sourceId==='ownership'&&id==='somaTreasuryHoldings'&&SOMA_2014_GAP_DATES.includes(date)
      ||sourceId==='marketFunctioning'&&['sofr','effr','sofrEffrSpread'].includes(id)&&fundingAnchor(date)
      ||['treasury','yields'].includes(sourceId)&&curveAnchor(date);
    item.observations=bounded(item.observations,caps[registry[id]?.frequency]??24,anchor);
  }
}
for(const id of ['bls','bea'])snapshot.sources[id]=addMomentumSeries(snapshot.sources[id]);
const fiscal=snapshot.sources.fiscal;
fiscal.monthly=bounded(fiscal.monthly,24);
fiscal.fiscal.debtBreakdown=bounded(fiscal.fiscal.debtBreakdown,64);
for(const [id,item] of Object.entries(deriveFiscalSeries(fiscal)))fiscal.series[id]={...fiscal.series[id],...item};
snapshot.sources.yields.curveHistory=bounded(snapshot.sources.yields.curveHistory,64,curveAnchor);
const ownership=snapshot.sources.ownership;
ownership.z1.history=bounded(ownership.z1.history,16);
ownership.soma.history=bounded(ownership.soma.history,104,date=>SOMA_2014_GAP_DATES.includes(date));
const market=snapshot.sources.marketFunctioning;
market.dealerHistory=bounded(market.dealerHistory,104);
for(const id of ['sofr','effr'])market.fundingRates[id]=bounded(market.fundingRates[id],64,fundingAnchor);
snapshot.sources.macroContributions.quarterly=bounded(snapshot.sources.macroContributions.quarterly,16);
const auctions=snapshot.sources.auctions;
auctions.auctions=auctions.auctions.filter(row=>row.auctionDate>='2024-10-01');
// The actual response receipts bind the original query dates. Missing prefix months stay explicit in this bounded fixture.
auctions.series.auctionOfferingMonthly.observations=aggregateAuctionOfferings(auctions.auctions,{
  startDate:auctions.coverageStart,endDate:auctions.coverageEnd,
});
delete snapshot.vintageArchive;
delete snapshot.historyArchive;
const checkedAt=[snapshot.generatedAt,snapshot.checkedAt,...Object.values(snapshot.sources).map(source=>source.fetchedAt)].sort().at(-1);
snapshot.vintages=recordVintages(null,{},snapshot.sources,{checkedAt,seriesMetadata:registry});
snapshot.testFixture='phase-3-ui';
assertCommercialData(snapshot);
const bytes=encodeStoredSnapshot(snapshot);
const manifest={version:1,sourceSha256:createHash('sha256').update(rootBytes).digest('hex'),sourceBytes,
  sha256:createHash('sha256').update(bytes).digest('hex'),compressedBytes:bytes.length,
  jsonBytes:Buffer.byteLength(JSON.stringify(snapshot)),sourceCount:Object.keys(snapshot.sources).length,
  seriesCount:Object.keys(registry).length,captureCount:snapshot.vintages.captures.length,caps};
await writeFile(new URL('./snapshot.json.gz',import.meta.url),bytes);
await writeFile(new URL('./manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
