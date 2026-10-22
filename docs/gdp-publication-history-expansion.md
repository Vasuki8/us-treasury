# GDP publication-history expansion

User request: expand the three-estimate 2026Q1 sample with commercially reusable official GDP publication history, preserve Graphite, test locally and push through the existing deployment.

## Source mapping and implementation

Use BEA's exact September 2026 GDP/GDI vintage-history workbook, directly linked by its September 30 GDP release. The inspected source contains 1,076 real-GDP records over 98 quarters, 2002Q1–2026Q2, with publication dates from April 26, 2002 through September 30, 2026. BEA's copyright FAQ 147 permits use/reproduction of its information unless otherwise stated; retain BEA attribution, workbook/source identifiers and actual retrieval provenance. The separate detailed source review and executable exact-row admission remain authoritative.

1. Expand the reviewed source manifest/parser and independent admission to exact quarter, stage, date and worksheet-cell identities. Keep raw historical stage names and source annotations. Rows explicitly saying GDP was not open for revision/not revised are confirmations, not new numeric GDP revisions. Missing routine stages remain absent. Later revisions are not automatically classified as annual or benchmark changes.
2. Append only missing admitted facts under the existing exclusive file lock and atomic writer. Preserve the original three June-workbook records, their IDs, values, source cells, rights, hashes and retrieval times exactly. No overwrites or fabricated historical retrievals. Repeated complete captures make no request or write.
3. Add a Graphite quarter selector with date cutoff, source-context labels, per-quarter revisions, CSV and frozen-package actions. Filter by quarter before computing latest/changes. Date-only evidence does not establish intraday publication availability. Existing frozen packages remain independent of the expanded archive.
4. Load this larger publication archive only on demand in its research view, with loading/error/retry states. Existing ordinary-page loading and source-partitioned retrieval histories remain separate.

## Acceptance checks

Verify original-record equality and existing frozen JSON/CSV reconstruction; exact workbook parsing, complete requested batches, atomic conflicts/failures, source dates and rights; historical stage exceptions and GDP confirmations; same-day multi-quarter cutoffs and before-first unavailable coverage; quarter-aware URLs/pins/exports; lazy loading/retry; desktop/mobile/keyboard states; full tests, production smoke, successful Actions and representative public pages. Existing statistical captures, BLS access exception, hosting conventions and user exports/output/tmp folders remain unchanged.

This source is a historical publication table retrieved now, not a complete intraday real-time database or a reconstruction from today's NIPA series. Coverage outside the admitted workbook and automatically scheduled future publication-archive expansion remain separate work.

## Local results

The real append CLI retrieved the official September workbook at **2026-10-22T17:45:17.148Z**, SHA-256 `49ef37def79cf5990992f57f1cc819e50fa5b0f8d0e2f5df824f0f19d5d38bf8`, and appended **1,073** records to the original three. The resulting data-only module is 1,803,544 bytes, below its 4 MiB input/output limit. A complete rerun preserved its bytes without refetching. Build requires all 1,076 admitted IDs; corrections to reviewed numeric tokens, dates, stages or cells fail explicitly.

Preservation audit: the three original objects, including field order, hashes, cells and retrieval provenance, remain exact. Original 2026Q1 scoped CSVs match the previous implementation byte-for-byte at four cutoffs through June 25. A package produced with the pre-expansion publication-pin code imports/re-exports byte-exact and retains its 2.0% estimate and original attachment. The actual previously saved browser package also reopens at 2.0%. All 34 statistical retrieval captures and the current official snapshot are unchanged.

All **780 tests** pass, including source/ZIP/XML validation, joint value/token tampering, complete/missing-ID batches, locks/atomic failure handling, old-package compatibility, same-day multi-quarter cutoffs, GDP confirmations, annual-update context, publication-specific pin metadata, source dates, lazy-load/retry/navigation, scoped CSV actions and frozen pin reconstruction. Focused independent reviews covered the collector, append writer and UI integration.

Actual local browser checks: 98 selectable quarters; 2026Q1 shows 2.1% through June 25 and 2.5% after September 30; before-first-quarter cutoff shows unavailable and disables pinning; 2018Q4 retains only Initial/Third at its March 2019 cutoff; a 2002Q1 Advance pin freezes 5.8%. Keyboard quarter selection retains focus and browser Back restores the prior quarter. No console errors were observed. Graphite layouts at 320, 390, 736, 1024 and 1440 pixels have no page-level horizontal overflow; phone quarter/date controls are 44 pixels high and wide tables scroll within their own wrapper. Screenshots and audit/test logs are retained under ignored `test-results/`.

Production build, asset smoke and deployment verification are performed after these local checks; a live claim requires successful Actions plus exact public-asset and representative-page verification.
