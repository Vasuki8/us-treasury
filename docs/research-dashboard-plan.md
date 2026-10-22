# Meridian fiscal and macro research roadmap

Requested October 21, 2026. This work extends **Vasuki8/us-treasury (Meridian)** only. Economy Pulse, the mutual-fund project and the untracked `exports/` directory are outside scope.

## Architecture and delivery

Keep the native ES-module application, Graphite shell, static snapshot delivery, exact-byte asset versioning and existing Actions deployment. Extend the canonical registry and dataset-specific admission policy before admitting observations. Reuse charts, detail pages, comparison, CSV metadata and source freshness. Put domain calculations and source adapters in focused modules rather than rewriting the application.

Work in the existing local checkout. Each milestone gets deterministic source/formula tests, a rights-gated build, desktop/mobile and keyboard checks, a reviewed commit, and a delivery record. Push using the repository's existing deployment conventions; verify Actions and representative live pages before calling a release live. Independent work continues when one source is blocked. No paid services, credentials or infrastructure changes without approval. The BLS calendar remains visibly cached under its existing exception.

## Milestones and acceptance

- [ ] **1 — Fiscal pressure.** Monthly receipts/outlays, net budget interest, primary deficit, exact trailing 12-month sums and interest/revenue ratio; contributors to year-over-year changes. Distinguish gross/public debt and net/gross interest. Explain deficit versus borrowing, cash balance and other financing. Reject incomplete fiscal windows and double-counted subtotal rows.
- [ ] **2 — Refinancing.** MSPD outstanding marketable debt at an explicit month-end, maturities within 3/12/24 calendar months, bill share and face-value weighted remaining maturity. Instrument-aware higher/lower rate scenarios distinguish maturity, FRN reset and TIPS inflation effects. State all rollover/issuance assumptions; reconcile included principal to official totals.
- [ ] **3 — Yields.** Historical Treasury par curves, 2s10s/3m10y, same-date nominal/real matched tenors and inflation compensation with methodology caveats. A term-premium model is optional only after specific permission and methodological review.
- [ ] **4 — Auctions.** Official issue sizes, bid-to-cover and bidder allocations compared within comparable security types and original/reopening terms. Indirect bidders are not synonymous with foreign investors. Tails remain unavailable without an approved synchronized when-issued quote.
- [ ] **5 — Ownership.** Treasury TIC, Federal Reserve and Z.1 sector positions with separate dates, valuations and definitions. Custody-location caveat; holdings changes are not transaction flows. Do not combine incompatible aggregates.
- [ ] **6 — Macro contributions.** Published BEA real-growth contributions and official BLS category effects where available. No summing chained-dollar levels; no approximate weights represented as exact official effects.
- [ ] **7 — Vintages.** Immutable captures going forward, observed first-captured/latest comparisons and as-known retrieval cutoffs. Historical first-release values only when verified vintages exist. Release and retrieval clocks remain separate; distinguish ordinary revisions and benchmarks.
- [ ] **8 — Market functioning.** Approved official dealer positions, financing, settlement fails and funding-rate context. Show coverage and market/instrument boundaries; no definitive liquidity/default-risk score.

## Shared acceptance checks

Every module answers what changed, what contributed, why it matters and limitations. Label official observations, arithmetic calculations and assumptions/scenarios separately. Show units, period, release date if supplied (otherwise unknown), retrieval, source links, coverage and methodology. Missing observations remain missing. CSV exports carry these distinctions and provenance.

Tests cover source schema and units/signs, exact month/fiscal alignment, incomplete windows, duplicates, revisions, instrument handling, scenario assumptions and CSV escaping. UI checks cover 1440/1024/736/390/320-pixel layouts, keyboard operation, source errors/unavailable states, filters and existing routes. New datasets must participate in daily refresh/freshness without weakening the cached-BLS exception.

## Status

Repository inspection complete: 12 registered indicators, 11 existing freshness feeds, five routes, deterministic native Node tests and a strict commercial data allowlist. Source research is underway for milestones 1–3. Source candidates and admission status are recorded in [research-dashboard-sources.md](research-dashboard-sources.md). No new data is admitted by this plan alone.
