# Treasury auction history implementation plan

> Use subagent-driven development for independent collector and frozen-export work, with root integration and independent final review.

**Goal:** Extend usable, comparable auction history from 2008 while preserving UI/colors, immutable evidence and working exports.

**Architecture:** Fixed coherent source floor, actual page-index lineage, same-era matched peers, existing auctionId-driven table navigation and an explicit deterministic generated specialist-export profile. No new dependency or provider.

**Spec:** `docs/superpowers/specs/2026-10-27-auction-history.md`.

## Constraints and review focus

- Preserve 217 original captures, existing raw/numeric facts, units, null publication clocks and current UI/colors.
- Preserve 10,000 records/ten pages/6 MiB responses and existing package/storage/output limits.
- No pre-NTAAPS schema assumptions, cross-2009 bidder benchmarks, inferred missing data, CUSIPs or auction tails.
- Actual page indices must precede sorting and survive current-source/frozen-package storage; unsupported/dangling lineage fails explicitly. Registered monthly observations and source receipts replay as before; supplementary auction rows are current/frozen context, not historical publication vintages.
- Full frozen inputs and complete filtered CSVs remain independent of 60-row table pagination. Old saved files remain byte-identical.

## Tasks

- [x] Source probe and collector: four-page complete official audit, 2008-04-07 floor, original overlap, partial April, pending/unreconciled data, actual per-page indices, fail-closed cap/pagination tests. Owner auction_history_collector; files scripts/sources/auctions.mjs, tests/auctions-source.test.js, docs/auctions-source-review.md. Red observed; 17 focused tests passed. Final candidate/receipts under tmp/auction-history/source-capture.
- [x] Root model/access/admission: first write and observe failing regressions for June2009 peer eras, selected-record table paging/bookmarks, wrong/dangling receipt indices and wrong page URLs/date ranges. Implement only in src/auctions.js, upper auctionsPage, scripts/research-policy.mjs and focused tests. Existing app/router auctionId behavior should suffice.
- [x] Frozen compatibility: genuine four baseline fixtures, explicit auctionExports v1, bounded generated files and all input/selection/monthly reconciliation/legacy/brand/amplification guards. Owner auction_frozen_exports; files lower auctions CSV, research context/packages/page and tests. Exact old bytes, current filtered scope and full-source round trips required; session-only quota must preserve durable bytes.
- [x] Capture and acceptance: strict auctions-only refresh, archive prefix and other-source equality, current/normalized replay and exact index receipts, actual full-scale source/package/generated CSV measurements, selected 2008/2009/2020/current comparisons and independent economist/engineering verdicts.
- [x] Release: full local and Node22/24 suites, build/assets, browser desktop/mobile older-record access and saved downloads, existing GitHub all-source checks and deployment, final live asset match, update evidence and synchronize checkouts.

## Ledger

- Ruling: April7 starts the coherent current-system source; January-March's 57 missing-field records are excluded rather than labeling a wider schema as uniform. Existing April partial handling preserves the actual coverage.
- Ruling: one same-era peer set is simpler and safer than separate metric-specific populations; the cost is fewer amount/BTC peers near June2009, with visible actual sample sizes.
- Ruling: actual per-row receipt indices and generated specialist attachments keep complete history usable within existing caps; old saved results are unaffected. Full new portable snapshots remain session-only under the unchanged browser quota.

- Release evidence: implementation b880a276d364881203fa9bc51fa3a9fd757e9ee3; workflow 40573137031 passed 1,887 tests on Node22 and Node24, both builds/163-asset smoke checks and Pages deployment. Public asset match and earliest-record/newest-page navigation passed. Alert follow-up 40575377844 verified 30 sources, created zero alerts, updated seven existing records and left no open issues. See docs/auction-history-expansion.md.
