# Treasury auction demand source review and contract

Reviewed 2026-10-21. This is a standalone collector/model milestone; shared admission policy, registry, Graphite views, exports and deployment are integrated separately.

## Admitted facts and source

The official [Treasury Securities Auctions Data](https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/) endpoint is:

`https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query`

It returned HTTP 200. [Fiscal Data's License and Authorization](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization), independently read from the live official site, expressly permits commercial copying, adaptation and redistribution. Scope here is agency auction amounts, dates, instrument classifications, rates and bidder-category facts. Credit U.S. Department of the Treasury, Bureau of the Fiscal Service, without endorsement. Page narratives, imagery, logos and third-party identifier databases are excluded. The dictionary attributes CUSIPs to a third-party service bureau; this collector neither requests nor retains those identifiers because they are unnecessary for the module.

The captured columns are record_date, security_type, security_term, original_security_term, auction_date, issue_date, maturity_date, announcemt_date, bid_to_cover_ratio, cash_management_bill_cmb, reopening, floating_rate, inflation_index_security, offering_amt, comp_accepted, primary_dealer_accepted, direct_bidder_accepted, indirect_bidder_accepted, total_accepted, soma_accepted, high_yield, high_discnt_rate, high_discnt_margin and xml_filenm_comp_results.

TreasuryDirect's [Auction Query](https://www.treasurydirect.gov/auctions/auction-query/) documents TIPS history since 1997, other security types since July 27, 1998, and additional fields from April 2008. This module deliberately loads only the preceding 24 complete calendar months and current month. Updates occur as auctions are announced and results become available; scheduled dates passing do not establish results. The live sample contained 902 records, 898 with reported bid-to-cover and four awaiting results. Latest reported results in that capture were October 15, 2026, despite later auction dates appearing as announcements. This lag remains visible.

The dictionary describes record_date as publication date, but sampled records set it to issue_date, including dates after retrieval. It is retained only as `sourceRecordDate`, never promoted to a release timestamp. Announcement, auction, issue and maturity dates remain distinct. `publishedAt` stays null. Observation cutoffs use the Eastern calendar day; they are not historical as-known vintages.

## Metrics and interpretation

Treasury's [February 17, 2026 result](https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026/R_20260217_4.pdf) separately reports competitive awards, noncompetitive awards, the auction subtotal and SOMA. Its published bid-to-cover excludes SOMA add-ons. We retain the official ratio rather than recomputing it from a potentially different denominator. Dealer/direct/indirect shares are calculated as the category's accepted amount divided by **comp_accepted**, not by total_accepted or offering_amt. Missing inputs stay null. A complete category total must reconcile to competitive awards within one dollar; otherwise shares are withheld and explicitly unreconciled. Partial categories remain partial, never zero-filled.

The [Treasury auction FAQ](https://www.treasurydirect.gov/help-center/faqs/auction-faqs/) defines dealer and direct bids as proprietary submissions and indirect bids as customers using intermediaries. Direct and indirect categories both include domestic and foreign participants. **Indirect bidders are not a foreign-investor series.**

Bills, nominal notes, nominal bonds, FRNs and TIPS remain separate. FRNs and TIPS are identified from their explicit flags, even when raw security_type is Note or Bond. Bill high discount rates, nominal/TIPS high yields and FRN high discount margins are distinct fields; no average merges them.

Benchmarks select only earlier auction dates, matching instrument, original term, reopening status and cash-management status. Bills additionally match the auctioned remaining term. A regular auction never compares with a cash-management bill. Unknown class inputs yield no benchmark. The default is the 12 most recent matching prior records; sample sizes accompany each metric's usable observations. This comparison is descriptive and is not a causal explanation of demand or a forecast.

`auctionOfferingMonthly` sums offering_amt / 1e9 by auction_date month for rows with a reported bid_to_cover_ratio. Source IDs are exactly `['offering_amt','auction_date','bid_to_cover_ratio']`; units are USD billions. This is gross face offering activity including rollovers, not debt outstanding, accepted awards, cash proceeds or net borrowing. Pending records are excluded and counted. Missing amounts/months stay null; current months and periods with pending/missing records are marked partial. Partial totals must not be presented as comparable completed months without qualification.

No reliable licensed, timestamp-matched when-issued quote has been admitted. Auction tails are not calculated.

## Integration contract

- Collector: `collectAuctions({fetchImpl,now})`, source ID `auctions`, nonempty series `auctionOfferingMonthly`, normalized `auctions`, `coverageStart`, `coverageEnd`, `lastResultsDate`, `pendingCount`, provenance and warnings.
- Each record: stable internal `id`, four agency dates plus `sourceRecordDate`, null `publishedAt`, instrument/term/originalTerm, reopening/cash-management flags, `status` (`results` or `announced`), raw numeric amounts and rate fields, calculated `allocations`, official `resultUrl` if supplied, canonical API `sourceUrl`. Exact query URLs and response hashes remain in source provenance.
- `auctionAllocations(record)`: denominator, dealer/direct/indirect shares and `complete`, `partial`, `unreconciled` or `unavailable` status.
- `benchmarkAuction(source,id,{limit:12})`: selected record, prior peer records, sampleSize and medians/differences for bid-to-cover, offering amount and allocation shares. Each metric has its own usable sampleSize.
- `aggregateAuctionOfferings(records,{startDate,endDate})`: monthly observations with auctionCount, pendingCount, partial and null publishedAt.

Pagination uses only constructed official URLs, ignores response-supplied next links, caps pages/bytes, checks stable page totals and rejects duplicate identities and incomplete counts. Nine focused tests cover denominators, missing inputs, reconciliation, matching, future/same-day exclusion, month/UTC rollover alignment, unknown instrument/number/date schemas and upstream/pagination failures. A live read-only collector and 12-peer benchmark succeeded; UI/CSV/deployment acceptance remains separate.
