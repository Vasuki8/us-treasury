# Treasury auction history expansion

Delivery date: October 27, 2026. Baseline: `dcc9b9c94bf5838c276619a88fd64ab24cd27c97`. The current UI and colors are retained.

## Coverage and interpretation

The official Treasury auction collector now retains auction dates from **April 7, 2008** through the Eastern capture day. The admitted October 27 capture contains **6,274 auction records and 223 monthly offering observations**, compared with 903 records and 25 months previously. This adds 5,371 auctions and 198 monthly observations.

April 7 is Treasury's documented introduction of NTAAPS. Earlier records lack several fields required for consistent comparisons. April 2008 is explicitly partial: 18 result auctions and $315 billion of gross face offerings. May is the first full month. The current month is partial, and five announced auctions remain awaiting source results. Passing an auction date does not establish that results are available.

Peer comparisons preserve instrument, original term, reopening, cash-management, bill remaining-term and strictly earlier-date matching. They also stay on the same side of June 1, 2009, when bidder-reporting rules changed. Actual usable sample sizes remain visible. One January 26, 2009 bill has bidder amounts $10 million below competitive awards; the reported amounts are retained and the unreconciled shares remain withheld. Indirect bidders are not labeled foreign investors.

The source's record date equals issue date in this capture. It is retained separately and is never treated as a publication timestamp. All 6,274 historical `publishedAt` values remain null. Monthly offerings measure gross face issuance activity, including rollovers, rather than net borrowing or debt outstanding. The full source and official interpretation references are documented in [the source contract](sources/auctions-source-review.md).

## Access and exports

The existing 60-row auction table gains compact Newest, Newer, Older and Oldest controls. The selected auction determines its page through the existing URL state, including old bookmarks. Paging puts keyboard focus and the viewport at the history table. Instrument filters and complete CSV exports remain independent of the visible page.

Each new row identifies its actual response page before sorting. The full source retains every page receipt, while each CSV row carries its own page's receipt. New frozen results retain the complete auction source and regenerate specialist CSV attachments deterministically. Existing saved files retain their stored attachments and exact original export bytes.

Full-history portable results exceed the unchanged 3 MiB durable browser-library limit, so the existing interface marks them session-only. Complete JSON and CSV downloads remain available. The 12 MiB portable JSON, 8 MiB stored-attachment and 32 MiB generated-output limits are unchanged. No new provider, key or dependency was added.

## Capture and preservation

- Capture: `2026-10-27T17:57:53.745Z`; recorded: `2026-10-27T17:57:53.837Z`.
- Four official pages contain 2,000 / 2,000 / 2,000 / 274 rows. Total raw response size: 4,508,464 bytes; largest response: 1,442,681 bytes. Existing pagination and response limits remain unchanged.
- Snapshot SHA-256: `07de0a38a332494f1ae616c8246748506f8f75f7cd375abeb02615735429c17a`.
- Exactly one new immutable capture: `history/f9b9ad66d856a58dfc66a9acbec16c19d2fb6109550f0e33e545da224ac19c3a.json.gz`.
- All 217 previous capture descriptors, compressed bytes and decoded captures are exact. All 22 other source objects, calendars, releases and publication policy are unchanged.
- All 136,480 existing registered observations across 136 series, all 903 overlapping auction facts and all 25 overlapping monthly observations are preserved.
- Replay before the new capture is exact. Registered monthly observations and captured source metadata replay as before; supplementary full auction rows are current/frozen context, not historical publication vintages.

The normal local snapshot replacement encountered a Windows file-sharing lock. The validated replacement was saved through a new file, backed up, copied exactly into the existing destination and independently checked. Production snapshot-writing behavior was not changed. Failed attempts did not modify the old snapshot or its immutable archive.

## Verification

- Independent economist/source review and complete implementation review found no actionable issues. All 6,274 raw row/page memberships and peer reporting-era boundaries were checked.
- Full local suite before the final paging-focus adjustment: **1,886 passed, zero failed**. The final adjustment then passed **25 focused tests**, including execution of the actual application action; its regression failed before the fix.
- Final production build and smoke verification passed for **163 assets**.
- Desktop and 390-pixel mobile browser checks covered oldest/newest paging, deep historical selection, table focus/scroll, frozen-result creation and session-only storage messaging. No document horizontal overflow was observed.
- A real downloaded Bill CSV contains 4,514 rows and exactly matches the generated frozen source. Its SHA-256, excluding the UTF-8 BOM, is `67fb1262e630f56cf94ac99443972f1f1b86d6e734f503912d0983ee9ca32ea0`.
- The full-source generated CSV contains all 6,274 records and is 14,953,180 bytes. Every row's response receipt was checked. Four genuine legacy packages preserve exact JSON, main CSV and specialist-attachment bytes.
- A final-capture repeat verified default, All, Bill and historical frozen results through JSON import and exact regenerated attachments. Representative portable default/All packages measure 6,545,065 / 7,769,213 bytes, with the full 6,430,263-byte source retained; all four cases report session-only storage explicitly.

## Cloud release

Implementation commit: `b880a276d364881203fa9bc51fa3a9fd757e9ee3`. [Release workflow 40573137031](https://github.com/Vasuki8/us-treasury/actions/runs/40573137031) checks that exact commit with data refresh disabled, all-source checks enabled and both supported Node versions.

The all-source check passed for all **23 statistics collectors and seven calendar collectors**. This includes the expanded auction query and both Census feeds. Publication-evidence upkeep also passed. These checks do not replace the admitted snapshot or manufacture new publication evidence.

Both Node 22 and Node 24 completed **1,887 tests with zero failures**, built successfully and passed the **163-asset** smoke check. GitHub Pages deployment succeeded. The subsequent public-site check matched all 163 assets exactly to the local tested build. The live deep link selected the April 7, 2008 bill on page 105 of 105; Newest returned to page 1, preserving all 6,274 matching records. The browser reported no console warnings or errors in this check.

[Alert follow-up 40575377844](https://github.com/Vasuki8/us-treasury/actions/runs/40575377844) succeeded, verified 30 sources and daily update health, created zero new alerts and updated seven existing incident records. There were no open repository issues after the follow-up. Registered BLS backup health and the existing annual renewal schedule also remained healthy.

The implementation is published at [Auction demand](https://vasuki8.github.io/us-treasury/#/auctions). The final evidence documentation is a separate commit with no application or data changes.
