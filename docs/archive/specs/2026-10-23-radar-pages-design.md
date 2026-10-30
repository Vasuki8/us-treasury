# Radar design across the five primary pages

The user explicitly approved the implemented Labor Radar design and requested applying it to Overview, Indicator Detail, Calendar and Explore Data, with economist/investor agents guiding information placement. This extends the approved visual system and existing hosting; it is not a new design-direction approval exercise.

## Approach

Reuse the Labor warm-paper/plum Light palette and aubergine/acid Graphite palette, subtle theme toggle, compact application navigation, typography, understated dividers, restrained section numbering and responsive controls. Each page gets its own arrangement, rather than identical panel stacks. Keep native browser ES modules and GitHub Pages. A CSS-only recoloring would not improve information placement; replacing the application would risk mature research features. Dedicated focused page renderers using existing data/model/actions provide the smallest maintainable implementation. Extract shared calendar presentation helpers once for Indicator/Calendar.

## Placement approved through domain consultation

Economist and investor agents reviewed the current source and directly agreed the Overview order. UI implementers must consult them directly before finalizing their layouts and ask about any remaining placement uncertainty.

- Overview: all six topic cards and all 12 existing readings first; captured What changed and Next catalysts together; compact Following exceptions, with quiet empty state; inflation/labor momentum; activity/income; source-health disclosure. Preserve current claims and policy context. The page is an economic map, without invented aggregate scores or directional investment signals.
- Indicator Detail: bounded return navigation, title/source, latest native reading with unit/reference period/status, concise definition, Follow/Compare/CSV; focused exact-window history with transform controls; data/methodology/retrieval tabs; related indicators and full source evidence. Label latest summary as independent of the selected history window and transformation. Keep verified GDP/claims publication evidence and revised-history/latest-release pairing visible where relevant. This is a focused research desk, with supporting metadata beside or beneath the chart and longer text progressively disclosed.
- Calendar: filters and scope first; chronological day-grouped schedule and selected-event preview together; mobile selected preview reachable near the schedule and compact enough not to bury rows. Keep selected reference period, scheduled Eastern time, agency and schedule basis/status explicit. Source health, interpretation and ongoing Treasury yield timing remain available as secondary disclosures. A scheduled or past time is never evidence of publication; do not add forecasts, consensus, surprise or impact scores.
- Explore: Catalog emphasizes search, topic/frequency filters, result count, comparable native value plus explicit unit/reference period, selection and detail links. Comparison emphasizes selected series, mode/window controls, charts and exact-window export; starter questions are secondary. Preserve four-series selection limit, remove/edit, native/indexed/difference behavior, eligibility errors, exact linked cursor, missing dates and all return routes. Count windows remain per-series observation counts; calendar windows use existing shared resolution. Do not silently normalize units or frequencies.

## Binding requirements

- Preserve all current data, observations, source footnotes, evidence links and research actions. No data refresh, new data sources, forecasts or invented measurements.
- Latest readings, observation periods, publication dates and retrieval timestamps remain distinct. Measurement kind and cached freshness are separate. Missing observations remain gaps.
- Preserve routes, all detail tabs, filters, topic/frequency options, Follow, comparison, date/transform controls, CSV, Save view, Freeze result, source health and bounded workspace return context.
- Keep both existing themes and density preferences. Use the Radar palette for the five primary routes; retain other specialist workspaces and the existing compact shared navigation.
- Support 320, 390, 736, 1024 and wide desktop widths in both themes without page-level horizontal overflow. Tables may scroll inside their own container. Keep native dates readable, reference periods visible, touch targets and keyboard controls usable.
- Reuse production data, controls and persistence; no mock snapshots, prototype storage, viewport switches or new framework/dependencies.
- Publish through the existing verified GitHub Pages process and verify the public assets against the tested build.

## Acceptance

Meaningful renderer tests cover preserved information/actions, ordering, explicit native units and latest-versus-window semantics, calendar selected/no-match states, comparison modes/empty/error states and bounded return links. Existing suites verify contracts and research scopes. Review diffs, run full tests/build/smoke, inspect both themes and desktop/mobile, exercise representative workflows, obtain economist/investor acceptance and independent code review before publication. Browser viewport checks do not claim physical-device testing.
