# Labor Radar production design

The user approved the full Labor Radar desktop/mobile sample and explicitly requested implementation with economist/investor consultation on information placement. The UI implementer consulted both reviewers directly; both approved the hierarchy below. This records the already-approved experience and their refinements, without a new approval gate.

## Scope and approach

Implement the complete Labor page in the existing ES-module application and GitHub Pages hosting workflow. Reuse live repository data, transformations, dates, exports, watchlists, research workspaces, packages and evidence destinations. The approved sample is a visual reference, not production code or a source of embedded snapshots. Keep the shared application shell and existing Light/Graphite preference controls. Apply the Radar page palette, hierarchy and responsive styling to Labor.

An alternative CSS-only reskin would preserve the canonical Labor route's missing focused-history/export context. A standalone copy would duplicate data and sandbox saves. Integrating a focused renderer and the existing application state is the selected maintainable approach.

## Approved placement and domain verdict

1. Four headlines: monthly payroll gains, U-3 unemployment, participation, hourly earnings growth Y/Y.
2. Focused history with U-6 default, all 23 measures selectable, range controls, source coverage, concise what-changed and release radar.
3. Latest weekly initial/continued advance claims, same-release priors, own reference weeks, publication date precision and separate revised-history context.
4. Core payroll bar chart and unemployment line chart.
5. Complete expanded readings table, with group filters, name/source-code search, indicator details, follow and compare.
6. Definitions, methodology, source health and full evidence/research destinations.

Table order: Jobs & demand = payroll, payrollAverage3m, payrollLevel, weeklyHours, openings, hiresRate, quitsRate, layoffsRate. People = unrate, underemployment, participation, employmentPopulation, primeAgeParticipation, primeAgeEmploymentPopulation. Pay & costs = wages, eciCompensationQuarterly, eciCompensation, laborProductivity, unitLaborCosts. Claims = claimsAdvance, continuedClaimsAdvance, claims, continuedClaims.

Comparison presets: breadth = unrate,underemployment,participation; jobs momentum = payroll,payrollAverage3m,weeklyHours; turnover = hiresRate,quitsRate,layoffsRate. Existing Explore handles these in native separate panels with current date window and return context.

Mobile: 2x2 headlines, focused history/concise selected context, compact radar, weekly claims before lengthy research prose, core trends, complete table, evidence. Long interpretations and definitions are disclosures. Reading value, unit and reference period remain available in each mobile row.

## Binding requirements

- Preserve all 23 Labor measures and original observations; no data refresh, inferred observations, scores, surprise measures or forecasts.
- Retain exact dates, native units, source status, missing gaps and source footnotes. Measurement kind and cached freshness are separate.
- Payroll delta is change in monthly job gains; wage-growth delta is percentage points in annual growth. ECI q/q is not annualized; productivity and unit costs are annualized.
- Two-observation advance claims pairs remain separate from revised history. Never present them as long-history trend sparklines or splice them.
- Latest summaries remain latest and are labeled independently of a selected historical window. Empty/invalid windows show honest errors and do not export unrelated data.
- Retain pointer/keyboard chart values, year/count/custom UTC windows, matching CSV, Follow, comparison, source links, detail/methodology/retrieval history, Save view and Freeze result.
- Canonical /economy/labor and legacy /economy?family=labor preserve focused measure, windows, selected comparisons and bounded return context. Saved Labor views reopen the same configuration; frozen results scope to the focused measure and matching window with family summary context.
- Support 320, 390, 736, 1024 and wide desktop widths in both Light and Graphite, with no page-level horizontal overflow. Tables may contain their own horizontal scrolling where required. Touch targets and keyboard focus remain usable.
- Do not carry prototype-only persistence, host widgets, illustrative data, export preview or viewport toggles into production.
- Use the existing verified build/deployment workflow. Preserve other specialist workspaces.

## Acceptance

Domain reviewers validate placement and measurement labels against the implemented renderer. Automated checks cover all 23 rows/controls, mixed-frequency claims, empty/custom windows, routes, detail-return context, saved/frozen focus and exact CSV scope. Run full tests, build and build smoke checks. Inspect desktop/mobile and both themes in the browser, including filtering, selecting a measure, ranges, Follow, comparison, detail return and saved/frozen workflows. Review the final diff before integration.
