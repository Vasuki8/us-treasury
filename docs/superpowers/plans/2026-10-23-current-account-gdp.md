# Current-account-to-GDP implementation plan

> **For agentic workers:** Use test-first implementation and independent review for the calculation, display/export and frozen-input boundaries.

**Goal:** Add an attributed calculated current-account-to-GDP ratio to Trade & current account, with correct quarterly/annualized conversion and immutable frozen evidence.

**Architecture:** Reuse the admitted ITA Table 1.1 current-account balance and BEA NIPA Table 1.1.5 current-dollar GDP (`A191RC`). Add a compact calculated current/prior-quarter context panel and matching CSV, following the existing fiscal/GDP context pattern. This is a calculation over the two existing sources, with their independent refresh outcomes, rather than another collector or an independently released official series. Existing registry histories and snapshots remain exact.

**Tech stack:** Existing buildless browser modules, Graphite panel/table/button helpers, CSV utilities and portable research packages; no dependencies, credentials or infrastructure.

**Spec:** The user requests this ratio using official BEA inputs, correctly handling quarterly and annualized units, preserving Graphite, testing locally and pushing to `Vasuki8/us-treasury`.

## Requirements and source mapping

- Numerator: signed ITA Table 1.1 line 30, all countries, seasonally adjusted actual quarterly USD billions; reviewed source ID `ITA:T1.1:line30:World:SA:Q`.
- Denominator: same-quarter nominal/current-dollar GDP, NIPA Table 1.1.5 line 1, `A191RC`, USD billions at SAAR. Divide by four to obtain the quarterly flow.
- Formula: `100 × currentAccountQuarter / (nominalGdpSAAR / 4)`. A deficit remains negative. Changes between ratios are percentage points, not percentage growth.
- Anchor the current/prior context to the latest retained ITA quarter, including missing values; use the exact preceding quarter. Missing, nonpositive GDP or incompatible inputs remain unavailable, with no nearby-quarter or real-GDP substitution.
- Label the result Meridian calculated from official observations. Latest revised ITA and NIPA inputs can have different retrieval/publication vintages. Do not imply BEA released this exact calculation or reconstruct historical publication vintages.
- Show both input values, units, periods, source IDs, rights attribution, release knowledge and retrieval evidence. GDP publication timing remains unknown unless supported; the ITA table release date does not date the GDP input.
- Preserve existing snapshots, source-split immutable archive and old frozen packages. New frozen results retain the exact two-quarter GDP denominator alongside the existing ITA inputs and an original ratio CSV.
- Keep the existing Graphite design and independent freshness states; use existing panel/table/CSV components.

## Tasks

### 1. Reviewed formula and pure calculation

Files: new `docs/current-account-gdp-source-review.md`, `src/current-account-gdp.js`, `tests/current-account-gdp.test.js`.

- [x] Verify exact official annualization/rights references and existing source coverage.
- [x] Write and observe failing tests for the factor of four, signed/zero/null inputs, exact quarters, duplicates, wrong nominal/real/annualized units, revisions and no mutation.
- [x] Implement `currentAccountGdpContext(sources)` returning current/prior points, percentage-point change, formula and limitations; pass focused tests.

### 2. Product and frozen evidence

Files: new `src/current-account-gdp-view.js`, view/integration tests; modify macro coverage page, app actions, research context/view and package validation.

- [x] Add a calculated latest-quarter context panel, explicit denominator conversion, source states and two-quarter CSV with both inputs and evidence.
- [x] Capture the exact nominal GDP denominator in new frozen packages, replay from frozen inputs only, retain the original CSV, and validate malformed imports without changing old pins.
- [x] Test exports, missing/error/cached states, independent revisions, frozen reconstruction and old-package compatibility.

### 3. Acceptance and delivery

- [x] Verify existing snapshots, archive files and publication modules remain unchanged.
- [x] Run the full local suite and production checks; inspect Graphite desktop/mobile, keyboard actions and representative export/frozen flows.
- [ ] Push the tested change, verify Actions, compare deployed assets with a clean build and inspect representative live pages before claiming live.

## Local acceptance evidence

- The retained 2026Q2 inputs are current account −$246.023 billion per quarter and nominal GDP $32,563.030 billion SAAR. Dividing GDP by four gives $8,140.7575 billion per quarter; the ratio is −3.022114342553503%. Prior quarter −2.6652689060465033%; change −0.35684543650699974 percentage points. Display rounds to −3.02%, −2.67% and −0.36 percentage points; CSV retains full calculated values and native input strings.
- Test-first red/green checks cover factor four, exact-quarter/latest-null anchoring, signs/zero/nonpositive values, metadata incompatibility, duplicates/malformed calendars, separate revisions, no mutation, CSV precision/escaping/evidence, unavailable exports, safe frozen import and legacy-package compatibility. Independent calculation/source and frozen-integration reviews completed; frozen wording was corrected to identify recorded inputs.
- Node 24 complete local suite: 1,072/1,072 pass. Node 22 focused ratio, view, package and existing-current-account integration checks: 34/34 pass. Production build/HTTP smoke check: 130 assets pass.
- Graphite desktop 1440px, phone 390px and narrow 320px inspected. One main heading, no page-wide overflow; wide tables retain local scrolling. Keyboard CSV export and saved frozen replay work; frozen replay omits the live export action. Browser error log empty.
- Git comparison confirms `src/official-snapshot.js`, all 73 capture files and all three publication/explanation modules remain unchanged. All 23 existing source snapshots are retained. No additional collector, registry measurement, source refresh, credentials, dependencies or infrastructure were needed. Existing daily refreshes update the two inputs independently; calculation uses those retained inputs on display.

## Limits

The panel covers the latest retained ITA quarter and its exact predecessor, separate from the focused history window. It is a Meridian calculation of revised inputs, with potentially different source vintages, rather than the exact value in a historical BEA release. Unknown GDP publication dates remain unknown. Historical first-release ratio vintages are not reconstructed.
