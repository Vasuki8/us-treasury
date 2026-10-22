# Balanced Macro Coverage Implementation Plan

> **For agentic workers:** Use focused subagents for independent source families and inline integration; verify each family before admission and publication.

**Goal:** Implement the website review's second milestone: usable prices, policy, spending/income, activity/housing and labor families in Meridian, preserving Graphite and the first milestone's research controls.

**Architecture:** Extend the existing official collectors and add three focused official-source collectors. Register reviewed measurements in a separate macro registry and reuse the existing snapshot, immutable archives, source admission, freshness, daily refresh, details, comparison and CSV layers. Add one compact family workspace with definitions and research questions, not a dashboard rewrite.

**Tech stack:** Existing native JavaScript modules, Node >=22.2, static HTML/CSS/SVG and GitHub Actions. No new dependency, paid service, credentials or hosting change.

**Spec:** Supplied website review, pages 5–6 and second milestone on pages 8–9. The PDF is evidence for the user's requested scope, not authority for other milestones or external actions. Named workspaces, pinned packages and historical-publication backtesting remain later work.

## Source mapping and review gates

| Family | Exact primary sources / proposed measurements | Integration gate |
| --- | --- | --- |
| Prices and labor | Existing BLS v1 POST; CPI headline/core NSA and SA indexes, exact annual NSA and monthly SA changes; payroll level, U-6, employment/population and weekly hours | Official IDs/units/adjustment, BLS public-domain and API conditions, <=25 unique series and <=10 calendar years per unregistered request. Preserve disclaimer/retrieval evidence. |
| Prices, spending and income | BEA NipaDataM.txt: DPCERG, DPCCRG, DPCERGM, DPCCRGM, DPCERX, DPCERAM, A067RX, A067RM; existing quarterly GDP unchanged | Official SeriesRegister/table metadata and current methodology; BEA public-domain policy. Published monthly rates preferred to recalculations from rounded dollar levels. Real dollar levels are SAAR, monthly percentage changes are not annualized. |
| Claims | Existing DOL ETA national weekly XML, ContinuedClaims/SA | Exact insured-unemployment definition, original week-ending dates and separate latest coverage; same federal statistical compilation and reviewed terms, new identifier admission. |
| Policy | New York Fed EFFR target lower/upper fields; Federal Reserve Board PRATES IORB | Exact fields, dates and feed scopes; conditional New York Fed commercial redistribution notices; Board IORB starts in 2021, with no IOER splice. |
| Activity | Board G.17 direct SA monthly industrial production and utilization files, total industry B50001 | Exact columns and index base, agency publication/revision conventions, Board public-domain policy; avoid retired/retiring DDP paths. |
| Housing | Census RESCONST bulk ZIP: total US SAAR starts, permits and completions | Exact category/data-type/geography/adjustment and units, CC0 catalog plus Census/originating-program attribution and bulk README. |

Candidate rows become admitted only after documented official endpoint, coverage, cadence, commercial display/export scope and deterministic parser checks. A blocked or unapproved source stays unavailable and independent families continue. Current BLS calendar remains cached under its existing exception; no fabricated schedules or observations.

## Decisions and review focus

- Preserve all prior immutable capture bytes and append genuine retrievals. Newly collected history was first captured now, not historically known by Meridian.
- Keep SA/NSA, price/quantity indexes, real/current dollars, annualized levels/rates and nonannualized monthly rates explicit. Exact month/year baselines; missing or zero denominators do not become adjacent-period growth or zeros.
- Native comparison remains default; classify each new displayed measurement for ratio-index eligibility. Percentage rates and growth remain ineligible.
- Each family exposes what changed, contextual measures, why it matters and limitations without claiming causal attribution. Use shared calendar windows and existing metadata-rich CSV.
- Reuse existing calendars for BLS/BEA/Census/DOL program families while preserving cached original event evidence. Only dated authoritative Census housing events may be added; official Board policy/G17 schedule links remain distinct from captured dated events.
- Freshness and daily guard must require every new collector even when its entire source object is missing. Routine deployments retain the approved cached-BLS-calendar exception only.

## Tasks

- [x] **BLS and DOL families:** verify rights/IDs, regression-first parser tests, implement source metadata and exact transformations. Owner: source subagent; root owns admission/registry.
- [x] **Policy, activity and housing:** verify exact feeds/terms/schema, fail-closed bounded collectors and tests. Owner: independent source subagent; root owns admission/registry.
- [x] **BEA family:** batch-parse selected monthly series, published rates and exact annual core inflation, documented units/cadence/coverage and tests. Owner: root.
- [x] **Admission and operations:** exact feed/identifier policies, registry, comparison classifications, calendar associations, freshness/daily refresh wiring and regression tests. Owner: root.
- [x] **Graphite family workspace:** one family route with shared date controls, focused history chart, full measurement list/details, comparisons, current/selected coverage and matching CSV; desktop/mobile/keyboard/error checks. Owner: root.
- [x] **Capture and review:** real source refreshes after admission, immutable-prefix audit, full tests/build/HTTP smoke, independent review and actual CSV equality. Verify any source limitations explicitly.
- [ ] **Delivery:** stage only intended code/docs/captures, push to us-treasury, verify Actions, exact live assets and representative new/existing pages before claiming live. Preserve user's untracked exports/, output/ and tmp/.

## Local acceptance evidence

22 October 2026: all 690 tests pass. The rights-gated production build and local HTTP smoke check pass for 75 assets, including all 15 source history bundles and fallbacks. Actual strict refresh succeeded for BLS, BEA, DOL, policy, activity and housing; calendar refresh added 27 explicitly dated housing entries and retained only the approved BLS 403 cache. Transient DOL/Census responses were rejected without overwriting good captures; unchanged requests subsequently succeeded. Policy parsing retains the source's lowercase revision flag and excludes XML comments, with malformed-comment regressions.

Archive audit: all 25 original captures remain exact; six new captures produce 31 total across 15 sources. The audit checks 62 global and 930 source boundary replays, all 77 revision histories and 440 selected-source CSV comparisons, plus original 48-series baseline revision/CSV equality. Housing-only originating-program metadata leaves older providers' normalization unchanged. Independent review reconciled 3,137 actual captured observations, with no remaining actionable finding.

Browser DOM/accessibility checks cover all five families, exact custom dates, native comparison defaults, nested comparison/detail return context, keyboard focus, housing-calendar related measures and unavailable values one millisecond before the first housing capture. A downloaded August real-spending CSV equals the model export byte-for-byte after BOM removal, including source/rights metadata. Rendered DOM widths show no page overflow at 1440, 1024, 736, 390 and 320 pixels; mobile selectors are 44 pixels high and Graphite remains selected. Browser screenshot capture repeatedly returned unavailable, so pixel-level visual inspection is not claimed. Error/invalid-window/loading and export paths have automated coverage. The daily guard reports no pending sources under the approved cached-BLS-calendar policy. Policy/G.17 dated events are not ingested. Later website-review milestones remain outside this delivery.
