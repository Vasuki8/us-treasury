# Research reliability local verification — October 28, 2026

This records the original local-only acceptance. The subsequent authorized merge, deployment and live verification are recorded in the [release record](research-reliability-release-2026-10-28.md).

Implemented in the isolated worktree on `codex/research-reliability`, based on `d363bde6b4a2f28ecd9c555c3580b51122c8750e`. No commit, push, merge or deployment was performed. The original checkout has only its preexisting untracked `exports/`, `output/` and `tmp/` directories. Public-origin research storage and the deployed site were not modified.

Open the production build at **http://127.0.0.1:4192/#/overview**. The preview is running with `node server.mjs --dist --port 4192`. To restart it, run that command from this worktree after `npm run build`.

## Requirement outcomes

The [numbered checklist](../research-reliability-checklist.md) records Implemented, Already correct or Blocked for every requested capability. The implementation includes durable independent research records, recoverable legacy migration, named ordered watchlists and portable settings, explicit freeze selection, complete frozen-table navigation, declared-quarter baseline alignment, chart evidence, corrected auction/calendar/freshness interpretation, compact economic layouts, official real earnings and hiring diffusion, published PCE contributions, conditional PCE arithmetic and saved research questions.

Three source dependencies remain:

- **Payroll publication evidence:** both the current Employment Situation route and the exact October 2 archive returned HTTP 403 through normal acquisition. Current API history cannot establish the same-release original estimates or prior-two-month revisions. A readable research-tool extract is not treated as captured publisher bytes. See [source acquisition evidence](../sources/labor-inflation-evidence-source-review.md).
- **Consensus expectations:** an admitted timestamped provider with appropriate capture, storage and redistribution permissions is required.
- **Market-implied policy path:** an accessible permitted contract/pricing source and downstream rights are required. Official projections and observed overnight rates are not substitutes. Both dependencies are detailed in [the source record](../expectations-policy-path-dependencies.md).

No unsupported panels, fabricated receipts or paid accounts were added. Treasury announced-event coverage is explicitly limited to the retained events through November 3, 2026 and uses a separate narrow refresh command; its wider filter bound does not claim complete future coverage.

## Automated verification

| Check | Result / retained evidence |
| --- | --- |
| Complete regression suite, `node --test --test-concurrency=2 tests/*.test.js` | **1,992 passed, 0 failed, 0 skipped**, exit 0; `output/research-reliability/verified-tests.log`. |
| Final source-error and freshness/UI follow-up | **74 passed, 0 failed**, exit 0; `freshness-compact-green.log`. Includes the later source-error regression and two new compact-freshness regressions, which were added after the complete-suite glob started. These focused results are not represented as another complete-suite run. |
| Final production build | `npm run build` exit 0 after the final UI and checksum-wrapping fixes. |
| Final built-asset smoke check | `node scripts/check-build.mjs`: **180 assets passed**, including source-history bundles. |
| Source preservation | All **23 preexisting source objects**, the preexisting release list and calendar remain identical to baseline. The **218 original capture descriptors** are an unchanged prefix of the 220 current captures. Only the two admitted economic-evidence families were added; `preserved-snapshot-proof.json`. |
| Protected fiscal accounting | No diff in `src/fiscal.js`, `src/fiscal-page.js` or `src/fiscal-gdp-view.js`. The valid single-month year-over-year / consecutive-TTM identity is unchanged. |

The storage suite uses a transaction-level IndexedDB double to exercise denied/blocked opening, request success followed by abort, quota isolation, migration retry, invalid-record preservation, tombstones and concurrent-record conflicts. Native browser checks below independently exercise actual durable storage and reloads. No regression was weakened to suppress a failure; the final compact-freshness regressions were observed failing before correction.

## Native browser verification

All interactions used the browser UI on local origins. Persistence was established by saving and reloading, rather than writing browser storage from a test script.

- Saved the **3,856,868-byte Funding package**, the default Auction package and a subsequent small Treasury-yield view. All reopened after reload with Saved status. The oversized package did not block the unrelated view.
- Created a view and GDP package using the previous release on the migration origin, then opened the upgraded app on the same origin. Both migrated and remained Saved. The before/after exported package JSON was byte-identical, SHA-256 `62a8dc42fdc274e95aff860b3cc672697bc931371f8e7edbade78c5d021a4e16`.
- Created a named watchlist, added and reordered measurements, switched lists, reloaded and restored it. Separate settings export/import preserved the records. A six-member list frozen with two explicit histories retained both selected histories, all six ordered contextual members and the four omitted IDs. A fifth primary-history selection was rejected with the four-history limit explained.
- Opened every page of a 250-row frozen yield table through its oldest observations. Tables were latest-first; the source/chart histories and full exports remained chronological and complete.
- Reproduced exact-date baseline failure for quarter-start/quarter-end measurements, enabled declared-quarter alignment, and checked successful baseline selection with original source dates retained. Exact-date mode remains available.
- Saved a research question with supporting/contradicting measures, review date/event, threshold condition and frozen baseline. Its return card separated observation changes from condition crossings without generating an investment narrative.
- Applied 0.25% monthly PCE inflation, six months and a 2.1% annual target. The URL, six modeled rows, keyboard readout, CSV and frozen view agreed. Blank input preserved the previous applied path and displayed an error. Frozen controls were read-only. The downloaded CSV was independently checked against exact-index compounding and the geometric target solution; `applied-pce-browser-csv-proof.json`.
- Keyboard arrows inspected exact chart values, including the conditional path's original year-ago index/date. New histories, evidence disclosures, empty search/watchlist states and invalid scenario routes were included in responsive checks.
- The 1D, 1W, 1M and YTD curve buttons selected retained dates and consistent nominal/real/compensation comparison dates; `curve-date-controls.json`.

Native receipts are in `output/research-reliability/`, including `funding-browser-proof.json` and `browser-migration-watchlist-proof.json`. Browser failure paths use the deterministic transaction tests described above; actual disk exhaustion or browser eviction was not induced.

## Layout and review loop

The **final production build** passed **304 responsive checks**: 38 route variants × Light/Graphite × widths 320, 390, 768 and 1440. Checks covered primary headings, document/main horizontal overflow, headline-value clipping, duplicate IDs and chart configuration failures. Archive-loading routes were allowed to finish. The final browser console had no warnings or errors.

An additional **16 expanded-disclosure checks** covered Prices, Labor, advanced external calculations and saved research in both themes at 320/390 pixels. This found a source-checksum wrapping issue; the full hash now wraps without changing its value. Wide evidence tables retain their own horizontal scroll containers. Screenshot review also prompted the final compact-freshness correction: routine overdue job names are inside one disclosure, the overdue count remains visible, and affected failures retain their escaped error messages even when overdue.

Another **12 mobile Save-form checks** covered indicator, curves and Prices controls in both themes at 320/390 pixels, with no overflow, duplicate IDs or clipped headline values. The frozen conditional package also reopened in a new tab with its applied assumptions and exact readout intact. The delivered preview uses the normal 1280 × 720 viewport in Light/Compact; temporary viewport overrides and duplicate test tabs were removed.

Independent engineering and economic reviewers identified issues, reviewed their corrections and passed their respective gates. Engineering additionally rechecked the final freshness correction with 11 passing tests. A separate final visual reviewer inspected these four actual screenshots and found no material clipping, overlap or theme regression:

- `desktop-light-overview.jpg`
- `desktop-graphite-refinancing.jpg`
- `mobile-light-labor.jpg`
- `mobile-graphite-pce.jpg`

Screenshots and structured browser matrices are saved in `C:/Users/Vasuki/.codex/visualizations/2026/10/27/01a17e6e-469f-71d3-a3ab-068d9d53ea79/research-reliability/`. Engineering, economic and visual review records are in `output/research-reliability/`. Screenshot review covers the captured states; it does not claim a complete assistive-technology audit.

## Remaining practical limits

Research remains local to the browser origin/profile; portable frozen JSON and settings exports are the recovery path. Browser clearing/eviction and device loss can remove local storage. Calendar times remain unknown where the source provides only a date. New economic histories are bounded to their admitted retained windows, with missing inputs kept unavailable. The conditional inflation calculator supports a constant monthly assumption; an editable month-by-month path was optional and was not added.

The local implementation and verification are complete for independent, supportable work. The source-dependent items above remain blocked and are not claimed as implemented. Publishing this branch requires separate authorization.
