# Historical coverage implementation plan

> For agentic workers: use subagent-driven development for the independent source tasks and verification before completion.

**Goal:** Extend historical comparisons using existing admitted official sources, preserving the current UI and colors.

**Architecture:** Retain more observations in the current Treasury, G.17 and Census collectors. Publish through existing admission, provenance, immutable-history and build checks. No new provider, measurement, dependency or credentials.

**Spec:** User selected “Broader data and historical coverage” after requesting continued development.

**Constraints:** Preserve native units, missing values, exact-date calculations, unknown publication dates, actual retrieval receipts and all existing archives. These are revised published histories, not reconstructed first releases.

**Review focus:** Treasury historical headers and missing tenors; the 2008 real-curve and 2021 curve methodology changes; G.17 2017 index base; Census independent series starts and SAAR units; unchanged overlap data and honest vintage timestamps.

- [x] Treasury: extend paired nominal/real annual feeds from 2003, add historical methodology context, test historical dates/missing tenors/provenance and source failures. Files: scripts/sources/yields.mjs, src/yields.js, relevant yield tests and docs/yields-source-review.md.
- [x] Activity: retain official production history from 1919 and utilization from 1967, test early observations, missing values, cutoff and units. Files: scripts/sources/activity.mjs and tests/activity.test.js.
- [x] Housing: retain starts from 1959, permits from 1960 and completions from 1968, test independent starts, native precision, missing values and cutoff. Files: scripts/sources/housing.mjs and tests/housing.test.js.
- [x] Integration: update current coverage documentation and stale current calendar claims; capture only the three changed source families through the existing publisher; verify receipts, overlap, archive integrity and downstream coverage/export paths.
- [ ] Run full tests, build and HTTP smoke checks; obtain independent economist/investor and implementation review; publish using the established main/Pages workflow and verify live assets.

**Ruling:** Start Treasury in 2003, when both real and nominal feeds exist. Nominal-only 1990 coverage, debt backfill and longer BLS histories are later increments because they require different provenance, merge or paging treatment. Daily Treasury collection remains two requests at a time; annual response bounds and existing transient retries remain in force.

**Ruling after scale review:** Full-history Treasury CSVs repeated all annual receipts per row (~100 MB per series), and the yield-page frozen context exceeded the existing 12 MiB cap. New captures explicitly opt in to exact per-row receipt resolution while older packages preserve their original CSV behavior. Yield-page pins retain the requested analysis window and necessary calculation lookback, selected exact curves, current readings and actual receipts with an explicit scope. The website and immutable archives retain the complete expanded history. All-history pins keep all requested rows or fail clearly at the unchanged cap; they never silently truncate.
