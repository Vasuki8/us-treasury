# Meridian fiscal and macro research roadmap

Requested October 21, 2026. This work extends **Vasuki8/us-treasury (Meridian)** only. Economy Pulse, the mutual-fund project and the untracked `exports/` directory are outside scope.

## Architecture and delivery

Keep the native ES-module application, Graphite shell, static snapshot delivery, exact-byte asset versioning and existing Actions deployment. Extend the canonical registry and dataset-specific admission policy before admitting observations. Reuse charts, detail pages, comparison, CSV metadata and source freshness. Put domain calculations and source adapters in focused modules rather than rewriting the application.

Work in the existing local checkout. Each milestone gets deterministic source/formula tests, a rights-gated build, desktop/mobile and keyboard checks, a reviewed commit, and a delivery record. Push using the repository's existing deployment conventions; verify Actions and representative live pages before calling a release live. Independent work continues when one source is blocked. No paid services, credentials or infrastructure changes without approval. The BLS calendar remains visibly cached under its existing exception.

## Milestones and acceptance

- [x] **1 — Fiscal pressure.** Monthly receipts/outlays, net budget interest, primary deficit, exact trailing 12-month sums and interest/revenue ratio; contributors to year-over-year changes. Distinguish gross/public debt and net/gross interest. Explain deficit versus borrowing, cash balance and other financing. Reject incomplete fiscal windows and double-counted subtotal rows.
- [x] **2 — Refinancing.** MSPD outstanding marketable debt at an explicit month-end, maturities within 3/12/24 calendar months, bill share and face-value weighted remaining maturity. Instrument-aware higher/lower rate scenarios distinguish maturity, FRN reset and TIPS inflation effects. State all rollover/issuance assumptions; reconcile included principal to official totals.
- [x] **3 — Yields.** Historical Treasury par curves, 2s10s/3m10y, same-date nominal/real matched tenors and inflation compensation with methodology caveats. A term-premium model remains explicitly deferred pending dataset-specific admission.
- [x] **4 — Auctions.** Official issue sizes, bid-to-cover and bidder allocations compared within comparable security types and original/reopening terms. Indirect bidders are not synonymous with foreign investors. Tails remain unavailable without an approved synchronized when-issued quote.
- [x] **5 — Ownership.** Treasury TIC, Federal Reserve and Z.1 sector positions with separate dates, valuations and definitions. Custody-location caveat; holdings changes are not transaction flows. Do not combine incompatible aggregates.
- [ ] **6 — Macro contributions.** Published BEA real-growth contributions and official BLS category effects where available. No summing chained-dollar levels; no approximate weights represented as exact official effects.
- [ ] **7 — Vintages.** Immutable captures going forward, observed first-captured/latest comparisons and as-known retrieval cutoffs. Historical first-release values only when verified vintages exist. Release and retrieval clocks remain separate; distinguish ordinary revisions and benchmarks.
- [ ] **8 — Market functioning.** Approved official dealer positions, financing, settlement fails and funding-rate context. Show coverage and market/instrument boundaries; no definitive liquidity/default-risk score.

## Shared acceptance checks

Every module answers what changed, what contributed, why it matters and limitations. Label official observations, arithmetic calculations and assumptions/scenarios separately. Show units, period, release date if supplied (otherwise unknown), retrieval, source links, coverage and methodology. Missing observations remain missing. CSV exports carry these distinctions and provenance.

Tests cover source schema and units/signs, exact month/fiscal alignment, incomplete windows, duplicates, revisions, instrument handling, scenario assumptions and CSV escaping. UI checks cover 1440/1024/736/390/320-pixel layouts, keyboard operation, source errors/unavailable states, filters and existing routes. New datasets must participate in daily refresh/freshness without weakening the cached-BLS exception.

## Status

Milestone 1 released as `1810ba6`: 11 new fiscal/public-debt indicators, Fiscal pressure route, monthly/TTM accounting, named category changes and financing CSV. Baseline plus fiscal checks passed (346 local tests, including the independently tested ZIP extension for a later milestone); local build and HTTP smoke check passed. Browser checks at 1440/1024/736/390/320 px found no page overflow; keyboard chart readout, downloaded financing CSV and console checks passed. [Actions succeeded](https://github.com/Vasuki8/us-treasury/actions/runs/39712752481); all 18 live assets matched the exact LF committed build and the representative live Fiscal pressure page displayed the expected metrics. Evidence and limits: [fiscal-source-review.md](fiscal-source-review.md).

Source candidates and admission status are recorded in [research-dashboard-sources.md](research-dashboard-sources.md). Parallel source adapters for later milestones are not complete product modules until shared integration, UI/export acceptance and deployment checks pass. No new data is admitted by this plan alone.

Milestone 2 local acceptance: MSPD profile reconciled across 463 securities as of September 30, 2026; 36 monthly principal observations. Scenario inputs and both rate directions are explicit. Raw CUSIPs remain parser-internal; published identifiers are generated by Meridian. Desktop/mobile widths 1440/1024/736/390/320 passed without overflow, keyboard scenario changes retained focus and URL state, and a scenario CSV was saved and inspected. Independent financial review found no blocker under disclosed assumptions; an FRN-maturity-inside-reset-lag boundary check was added. Deployment verification is pending.

Milestone 2 released as `4592e15`: 365 local baseline/refinancing tests passed (including the later ZIP helper test). [Actions succeeded](https://github.com/Vasuki8/us-treasury/actions/runs/39714480076), all 20 live assets matched the exact committed build, and the representative live Refinancing page displayed its September 30 profile and modeled scenarios.

Milestone 3 local acceptance: five calendar years / 1,200 dated nominal and real curves, exact selected-date overlays and same-date/tenor spreads. Added regression checks for nominal/real response substitution, unavailable selected-date controls and CSV per-input year/kind/provenance. Source-type mismatch fails closed. All five responsive widths and keyboard overlay readout passed; source release timestamps remain unknown. Term-premium integration remains explicitly deferred. Deployment verification is pending.

Milestone 3 verification before push: 382 baseline/yield tests passed locally (including the later ZIP helper regression), the production build and 22-asset imported-graph HTTP smoke check passed. Overlay CSV tests parse units, missing cells, separate feed kinds and calculated compensation; captured input provenance accompanies the selected curve export.

Milestone 3 released as `bd2ba82`: [Actions succeeded](https://github.com/Vasuki8/us-treasury/actions/runs/39715555572), all 22 live assets matched the committed build, and the representative live page displayed historical overlays and matched spreads with 14 source freshness entries.

Milestone 4 local acceptance: 902 auction rows / 898 reported results / 4 pending at capture; official rates retain three decimals, impossible partial allocations withhold shares, benchmarks use prior matching instrument/term/reopening/CMB class, and indirect bidders are not labeled foreign. Monthly points and generic CSVs retain partial/count metadata. Five responsive widths passed; FRN preview showed 0.040% discount margin. No when-issued quote is admitted, so tails remain unavailable. Source and benchmark CSV tests include captured query/hash metadata. Deployment verification pending.

Milestone 4 released as `f0c86b9`: 405 local tests passed, production smoke covered 25 imported assets. [Actions succeeded](https://github.com/Vasuki8/us-treasury/actions/runs/39716322817); exact live assets matched and the live Auction demand route displayed partial coverage.

Milestone 5 local acceptance: 36 Z.1 quarter ends / 25 nonoverlapping sectors and 104 actual SOMA dates. Sector assets plus published valuation discrepancy reconcile to liabilities; SOMA adjusted par remains separate. Five responsive widths, keyboard chart readout, CSV dispatch and console checks passed. Baseline plus new checks passed except a catalog expectation that was updated for additional quarterly series; final regression and deployment verification follow. TIC country figures remain unconnected pending rights review.
