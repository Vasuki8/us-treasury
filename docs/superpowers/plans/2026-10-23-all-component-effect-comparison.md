# All-component effect comparison implementation plan

> **For agentic workers:** Use subagent-driven-development to implement the tasks below with independent review.

**Goal:** Compare goods, services, primary income and secondary income balance/GDP effects across quarterly and trailing-four-quarter changes.

**Architecture:** Reuse the existing guarded symmetric-two-order model and 24-series component catalog. Add four component rows with quarterly/T4Q columns, two effect lines per chart, a common signed percentage-point scale across all eight charts, and one exact-date cursor. Reconstruct frozen views from the six existing retained input histories; reuse the existing all-component effect CSV without adding attachments.

**Tech stack:** Existing buildless JavaScript, SVG charts, Graphite CSS and Node test runner.

**Spec:** User request in this chat; existing methodology and permissions in `docs/current-account-gdp-source-review.md`.

## Constraints and source mapping

- Preserve existing selected-component/total views, shared date controls, exports, deployment conventions and immutable archives.
- BEA ITA Table 1.1 lines 32–35 are quarterly seasonally adjusted signed balances, not annualized; existing conversion to USD billions remains unchanged.
- BEA NIPA Table 1.1.5 A191RC is nominal GDP SAAR; divide by four once before quarterly/T4Q calculations.
- Existing approved endpoints: `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv` and `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`. No new data admission or refresh.
- BEA public-domain reuse and citation guidance rechecked: https://www.bea.gov/help/faq/147 and https://www.bea.gov/help/guidelines-for-citing-bea. Calculations must be identified as Meridian accounting conventions, not official BEA contributions or causal effects.
- Only finite selected-window effect values determine the common scale; include zero. Missing inputs stay gaps with explicit reasons. Never replace the latest endpoint with an older complete one.
- New optional frozen context: `currentAccountGdpAllComponentEffects`, exact keys `version:1`, `method:'symmetric-two-order-v1'`, `range`, `inputContext:'currentAccountGdpBreakdown'`. Legacy pins acquire no new panel. Original five CSV attachments remain byte-identical and storage caps unchanged.

## Review focus

Common scales must not clip data or include unrelated/full-history values. Both horizons must refer to identical selected endpoints. A missing component must not hide valid peers. Invalid frozen methods/ranges/references fail validation. Mobile stacking must retain component/horizon identity and keyboard chart access.

## Tasks

- [x] Add failing chart tests, then opt-in `data-y-domain` support in `src/charts.js`. Validate a finite ordered pair enclosing every finite plotted value, share padding including the zero boundary, preserve default behavior, and show an explicit configuration error for invalid/clipping bounds.
- [x] Add `src/current-account-gdp-all-component-effects-view.js` and tests: common selected-window bounds across all eight charts; four labeled component rows with two horizon charts; same-endpoint effect/combined readings; missing/error/empty states; evidence and limitations. Reuse component catalog and all-component CSV bytes.
- [x] Integrate live and frozen views/actions in the existing macro page, app, research context/page and strict package validator. Test independent optional context, legacy behavior, no live-source fallback, attachment equality and unchanged durable storage limit.
- [x] Add responsive Graphite layout; validate 1024/736/390/320px layouts, exact-date keyboard linkage, chart loading/error states, range filtering and CSV exports. Browser evidence and limitations are recorded below.
- [x] Run focused tests, full bounded-concurrency suite, production build/smoke checks and independent review. Fix findings, commit and push to `Vasuki8/us-treasury`.
- [x] Verify Actions deployment, clean-build live asset equality and representative live page. Record measured results and remaining limitations here.

## Local verification

- `node --test --test-concurrency=4 tests/*.test.js`: **1,320/1,320 pass**, no skips (130 seconds). Log: ignored `test-results/all-component-effects-all-tests.log`.
- Node 22.23.3: `--test tests/current-account-gdp*.test.js tests/charts-y-domain.test.js`: **266/266 pass**, no skips. Includes formulas, calendar/lookback, missing data, revision/frozen isolation, exports and strict package contracts.
- `npm run build` and `node scripts/check-build.mjs`: pass, **144 assets** including source-history bundles.
- Independent read-only review: no actionable findings; 23 focused tests plus real panel markup → renderer/catalog checks across all/1y/count/custom windows, complete/missing Goods (eight combinations). Equal scales, finite SVGs and exact Home/End cursor alignment verified.
- Browser local full external route: eight comparison charts render with official captured-input evidence labels. Actual panel previews at outer widths 1024/736/390/320px report viewport/document widths 1009/1009, 721/721, 375/375 and 305/305px (scrollbars account for 15px). All report eight rendered charts and identical axes; 1024 has two columns, others stack. Direct panel at 1265px also reports two columns and no overflow.
- Browser keyboard: Tab reaches the first chart, Home synchronizes all eight readouts to 2025Q2 and End to 2026Q2. Focused chart announces exact signed effects and captured BEA evidence.
- Browser screenshot capture timed out, including after reconnecting the same browser; no pixel-level screenshot proof is claimed. CSV content and live/frozen action branches are tested; a browser-downloaded file was not independently inspected. Narrow checks are real panel previews, not full-device emulation. Browser console capture was unavailable through the same transport, so no broad console-error claim is made.
- All-history frozen comparison package measured **3,088,520 bytes**, within the unchanged 3,145,728-byte durable limit; five original attachment contents remain equal. No snapshot or publication archive files changed.
- Existing default contribution and all-component effect CSVs rechecked byte-for-byte against `ef013d8` for all-history, one-year, one-observation and custom windows. All four selected-component CSVs also match their exact both-horizon calculations and unique supporting inputs.

## Deployment verification

- Runtime commit **d2dfe53d43b23b3780b34cd39af686792705d011** pushed to `Vasuki8/us-treasury` main.
- [GitHub Actions run 39997760955](https://github.com/Vasuki8/us-treasury/actions/runs/39997760955) succeeded: Node 22 and Node 24 tests/build/smoke jobs and GitHub Pages deployment. No official-source refresh was required; Cloudflare remains deferred under the existing deployment settings.
- Built the exact runtime commit in the existing clean verification clone. `node scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` confirmed all **144 deployed assets** equal that clean build.
- Fresh live browser check at `https://vasuki8.github.io/us-treasury/?_verify=d2dfe53#/economy?family=external&window=1y` showed the comparison heading/action, shared-scale explanation and all eight rendered chart accessibility groups with captured-BEA evidence labels. Existing total and selected-component views remain present.
- Browser manual download attempt failed before command dispatch; it does not establish a downloaded-file check. Screenshot and console-capture limitations above remain. No broader visual or full-device QA claim is made.
