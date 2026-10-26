# DOL confirmed prior-week PDF supplement

Reviewed October 26, 2026. The goal is to advance the existing revised initial/continued-claims histories when the official national XML table trails the weekly publication. The current UI, colors, source identifiers and separate advance series are preserved.

## Source and rights

The existing [ETA national historical XML](https://oui.doleta.gov/unemploy/claims.asp) remains the base, using `InitialClaims/SA` and `ContinuedClaims/SA`. Its October 26 response contains 3,117 observations per measure, January 7, 1967–September 26, 2026. Every returned eligible row, raw count and internal missing value is retained.

The supplement uses the [official annual weekly-release archive](https://oui.doleta.gov/unemploy/archive.asp), POSTing `report=press&year=<year>&submit=Submit`, and follows its actual `https://oui.doleta.gov/press/YYYY/MMDDYY.pdf` links. The calendar table is validated; URLs are never generated from a presumed Thursday schedule. Only the current and previous annual indexes are in scope. Dated releases are agency-authored statistical publications covered by the existing [DOL public-domain reuse review](dol-claims-history-source-review.md#exact-source-and-commercial-reuse) and [advance-PDF source admission](dol-advance-claims-source-review.md). No vendor, API key, paid feed, logo or third-party copyrighted material is added.

[DOL's technical notes](https://www.dol.gov/ui/data.pdf) distinguish advance ETA 538 readings from the following week's ETA 539 revised readings. The existing bounded PDF parser requires explicit revised/unrevised prose corroborated by the seasonally adjusted table. Unknown revision status, unadjusted values and current advances cannot enter these revised histories.

The following dated documents establish the admitted October bridge:

| Official release | SHA256 | Relevant confirmed prior |
| --- | --- | --- |
| [October 8](https://oui.doleta.gov/press/2026/100826.pdf) | `8c7f16d98620ec0c61ae851f4acc53881606bdd2026f2d00d3a1972d9c8e091d` | Initial September 26: 199,000, matching XML |
| [October 15](https://oui.doleta.gov/press/2026/101526.pdf) | `336003478153e4a3c6e13ce179230fd555905aeef3e0f0569d833fa29c7e4d6f` | Initial October 3: 198,000; continued September 26: 1,714,000, matching XML |
| [October 22](https://oui.doleta.gov/press/2026/102226.pdf) | `6bc739a9ccf4035720b6f09b6108c9800bb3d35bedb358938eaefa009ab974f8` | Initial October 10: 200,000; continued October 3: 1,703,000 |

Initial October 17: 194,000 and continued October 10: 1,728,000 are current advances. They remain in their existing separate series and are excluded here.

## Collector and admission

`collectDolWithRevisions` reuses the strict XML collector, shared bounded retries and existing PDF parser. Each run retrieves fresh XML and archive indexes, then at most eight new PDFs, each bounded to 4 MiB with the existing worker limits. Official requests reject redirects. Current XML can supersede previously supplemented weeks; a complete XML catch-up returns the original XML source shape.

A supplement requires a matching usable XML/PDF overlap for each measure and an unbroken seven-day tail. Comma formatting can differ, but numeric counts and normalized raw integers must agree. Initial and continued targets remain independent. The scan retains publication-notice context across the older XML endpoint rather than stopping at the first matching count. Unknown methodological notices fail the existing parser; an applied annual seasonal update cannot be bridged until both XML endpoints reach that release. The known applied-update barriers are enforced even when their documents fall outside the newest scan.

Previously admitted PDF rows and context receipts remain usable at their original retrieval times. New downloads replace the same URL's receipt and row evidence together. This lets routine updates advance beyond an eight-week XML lag without repeatedly downloading all intervening releases. Obsolete PDF context is pruned when XML catches up. A separate 10,000-PDF ceiling matches the existing observation bound. Missing weeks, archive regression, altered roles, ambiguous notices, inconsistent overlap, source shrinkage or exhausted request limits reject the candidate and preserve the prior published capture.

The exact version-1 `revisedHistoryProfile` records each XML endpoint, latest confirmed release and per-measure overlap. Every row carries its actual source URL, SHA256 and retrieval timestamp. XML rows retain their original fields and values; PDF priors also retain the day-precision release, explicit role, previously published raw count and footnotes. Exact publication instants stay null. Each series' supporting URL set is scoped to its own rows and overlap; archive-index and unused notice-context receipts cannot leak into per-row CSV provenance.

The source's `fetchedAt` is the maximum actual successful receipt clock. Retained evidence is not relabeled as newly retrieved. Admission checks exact metadata, source identifiers, count scaling, dates, roles, receipt clocks and the continuous tail. Removing profile flags cannot grant unprofiled data access to dated-PDF or per-row source permissions. Legacy captures keep their original schema and identity.

## Research alternatives

The historical HTML and spreadsheet outputs reproduced the same September 26 limit. The state raw-data file is not a national seasonally adjusted substitute. FRED's ICSA/CCSA include current advance tails; its applicable service/API storage and archive terms also require permission incompatible with the existing persisted public export workflow. Atlanta UCM and transformed activity measures have different measurement scope. None is admitted. The official dated-PDF route needs no new account and preserves the existing source's meaning.

## Acceptance evidence

The first strict production capture was retrieved through `node scripts/refresh-data.mjs --sources=dol --require-all`, ending at `2026-10-26T15:51:00.960Z`. It appends one genuine capture to the 179-capture baseline. The resulting histories contain 3,119 initial weeks through October 10 and 3,118 continued weeks through October 3, with the counts above. Original XML history and all earlier capture identities remain intact.

The final strict continuation capture ended at `2026-10-26T16:05:22.327Z`, appending the second genuine DOL capture for a total of 181. It reused the retained September 24 notice-context receipt at its original clock while freshly retrieving October context. Independent acceptance against `f26c6cb147d5d44db163bf8c73bf4dd0c4eeff39` verified all 179 baseline descriptors, compressed Git blob bytes, decoded capture objects and every capture replay checkpoint exactly. All other statistical source objects, calendars and release schedules remain exact. All 3,117 old XML rows per series preserve their original fields, raw strings and numeric values. Re-recording the current source at the same retrieval creates no immutable-capture collision.

The actual two-measure All CSV contains 6,237 rows and measures 8,046,879 bytes; the final portable package measures 11,668,455 bytes and round-trips exact JSON and CSV within the unchanged 12 MiB limit. Every exported row resolves to exactly one actual XML/PDF receipt, with original raw count and retrieval time; exact publication instants remain blank. The 37 revised-collector, admission and integration tests pass, and the broader 71-test focused group includes legacy XML/advance behavior. Independent collector and whole-change reviews found no remaining material issue. The local build and complete 163-asset HTTP smoke check pass.

The first local full run completed 1,758 tests: 1,754 passed and four failed because they hardcoded the earlier live count, coverage prose or absence of a publication note. These expectations now verify exact retained replay rows, actual CSV receipts and the entire visible coverage note; legacy fallback uses an independent XML fixture. All 85 focused tests covering the corrected cases and new functionality pass. Independent review confirmed the assertions were preserved or strengthened. The unrelated BLS-failure CLI fixture also preserves retained DOL PDF clocks, preventing a future failure once the tail exceeds eight PDFs. An inline nine-old-PDF admission probe failed before that fixture correction and passed afterward; the existing cached-BLS publication test then passed with exact PDF receipt/row/overlap assertions in 64.2 seconds. No source validation, timeout or package limit was weakened. Final full verification on both supported cloud runtimes and deployment evidence follows.
