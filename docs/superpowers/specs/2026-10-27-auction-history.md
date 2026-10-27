# Treasury auction history extension

User selected Treasury auction history after requesting broader historical coverage. Keep the current UI and colors. Baseline `dcc9b9c` has 217 immutable captures, 903 auction records and 25 monthly offering observations from October 2024.

## Data and comparability

Retain the exact approved Fiscal Data fields from **2008-04-07**, Treasury's documented NTAAPS introduction, through the actual Eastern capture day. The actual four-page audit admits 6,274 records and 223 monthly points; all 903 existing facts and 25 overlapping monthly observations match. April 2008 contains 18 auctions/$315 billion and remains partial; May is the first fully covered month. Preserve five pending records and the 2009-01-26 bill whose allocations fail reconciliation by $10 million. Do not infer missing amounts, foreign ownership, release clocks, tails or unavailable instruments.

Keep the existing instrument/original-term/reopening/CMB peer classes, including remaining term for bills, strictly earlier dates and per-metric usable sample sizes. Peers must remain on the same side of **2009-06-01**, when Treasury's guaranteed-bid reporting treatment changed. One common peer set conservatively restricts amounts and BTC as well as bidder shares, avoiding separate confusing benchmark populations. This is a comparability safeguard, not a claim of causal discontinuity.

Official evidence: https://home.treasury.gov/news/press-releases/hp944 ; https://www.treasurydirect.gov/files/laws-and-regulations/auction-regulations-uoc/e9-12787.pdf . Source review and raw-field audits are retained under `tmp/auction-history/`.

## Bounds, access and exports

Keep 2,000 rows/page, ten pages/10,000 records and 6 MiB per response. Preserve all original captures and other source families. The history table continues to render 60 rows at a time. Add compact Newest/Newer/Older/Oldest controls using existing buttons and auctionId URLs; derive the visible page from the selected record. No new theme, route parameter or application state is needed. Selecting a historical result, bookmarking it and freezing it must preserve that result and its exact peer set. CSV exports remain complete for the selected instrument filter, independently of the table page.

New sources explicitly use `inputProvenanceScope: auction-response-page-v1` and zero-based integer `sourceReceiptIndex` on each record, assigned from the actual API page before sorting. Every response receipt remains in the full source. New CSV rows resolve only their actual input-page receipt. Older sources without this opt-in keep their original all-receipt CSV behavior; a dangling index cannot imply a new method.

New frozen contexts explicitly record `auctionExports: {version:1, securityType, auctionId, csvMode:generated-full-retained-v1}`. Retain the complete source and monthly inputs, omit only duplicated specialist CSV strings, and generate both existing specialist downloads from frozen inputs with canonical receipt JSON. Keep 12 MiB portable JSON, 8 MiB stored attachments, 32 MiB bounded generated output and 3 MiB browser library limits. No truncation or cap increases. Full new snapshots exceed durable browser storage and must retain the existing session-only warning plus complete JSON/CSV downloads. Validate profile/selection/lineage, complete recomputed monthly inputs, conflicts, unknown versions, unsafe data and amplified output. Legacy packages retain exact original JSON/main CSV/stored attachment bytes.

Final actual candidate measures 6,430,178 source bytes, about 6.55/7.77 MB portable default/All packages, and 14,940,632 bytes for the complete generated auction CSV. Recheck after the final integration capture.
