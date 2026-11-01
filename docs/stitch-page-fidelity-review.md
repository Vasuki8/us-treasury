# Stitch page fidelity and public-data coverage

Reference: Meridian Macro Research Workspace, Stitch project `7931842367557945060`. The review covers its 24 browser compositions and two CSV specifications. Calendar and Explore keep their previously accepted references. This work does not publish or deploy the site.

## Page and export mapping

| Reference | Implemented route / export | Actual content |
| --- | --- | --- |
| Overview | `/overview` | Three reading guides, four headline cards, combined GDP/PCE charts, release agenda, diagnostics, four monitors and provenance. |
| Labor market | `/economy/labor` | Separate guide/headline strips, payroll/unemployment/earnings charts, weekly claims and detailed labor readings. |
| Payrolls | `/series/payroll` | Four statistics, monthly bars and three-month mean, sector/industry analysis, ten-period ledger and source dock. |
| Unemployment | `/series/unrate` | U-3/U-6, CPS spectrum and demographic evidence; household and establishment concepts remain distinct. |
| Hourly earnings | `/series/wages` | CES cohorts, real versus nominal earnings and exact growth periods. |
| Employment Cost Index | `/series/eciCompensationQuarterly` | Quarterly SA and annual NSA compensation/wage/benefit comparisons. |
| Productivity | `/series/laborProductivity` | Output/hours/productivity identity, quarterly and annual published measures. |
| Unit labor costs | `/series/unitLaborCosts` | Hourly compensation/productivity/cost identity and native published rates. |
| CPI | `/series/cpi` | Same-horizon headline/core overlay, category heatmap, dated weights and published effects. |
| PCE | `/series/pce` | Headline/core, published category inflation, reconciliation and published services measure. |
| Auctions | `/auctions` | Native auction results, demand/allocation charts and tables; no invented when-issued quote or auction tail. |
| Ownership | `/ownership` | TIC custodial-residence holdings, official/private split, Z.1/SOMA context and distinct exports. |
| Treasury liquidity | `/market/liquidity` | Dealer transactions/fails and official repo context; licensed depth/quote panels retain explicit coverage states. |
| Refunding / TBAC | `/treasury/refunding` | Treasury borrowing/policy guidance, TBAC recommendations, dated auction and tentative buyback schedules. |
| Money markets | `/market/money` | SOFR/TGCR/BGCR/OBFR, published distributions, repo operations, OFR and monthly tri-party context. |
| Primary dealers | `/market/dealers` | Native positions, exact-week changes, descriptive retained-history ranks and fails. |
| Debt ceiling | `/treasury/debt-ceiling` | DTS legal-limit components/headroom and TGA; gross debt is a separate quantity. |
| FOMC | `/rates/fomc` | Actual date-only meeting calendar, anonymous SEP dots and published projection medians. |
| QT | `/rates/qt` | H.4.1 stocks and observed stock changes, with runoff versus valuation/other changes distinguished. |
| TIPS | `/rates/tips` | Matched nominal/real curves, compensation, auction results and DKW staff-model components. |
| CPI–PCE wedge | `/inflation/wedge` | BEA's signed monthly reconciliation and Cleveland median/trimmed measures. |
| FX base | `/market/fx-basis` | Official dated spot/policy anchors and explicitly assumed flat-policy, zero-basis reference calculation. |
| FX Fed cut | `/market/fx-basis?scenario=fed-cut` | Same layout with editable policy shock; zero is a valid explicit assumption. |
| FX divergence | `/market/fx-basis?scenario=policy-divergence` | Independent domestic/foreign shocks, horizon, matrix preview and source boundaries. |
| Multi-pair CSV | FX desk → Multi-pair matrix CSV | Nineteen pair/tenor rows; missing foreign policy/market quotes remain empty. |
| Sensitivity CSV | FX desk → Sensitivity matrix CSV | Two-way policy sensitivity and reference-forward formulas; unavailable basis/draw matrices stay empty. |

Every indicator family preserves chart controls, legends, endpoint values, keyboard inspection, related measurements, history and source/export actions. Desktop sidebar and mobile More contain each new desk. Existing fiscal, refinancing, curves, market, credit, research, release and source tools remain reachable.

## Data additions and preservation

Nineteen additive families supply BLS CES/CPS/ECI/PRS detail; CPI component tables; DTS; TIC; refunding/TBAC; Fed balance sheet and SEP; New York Fed dealer/rate/repo/tri-party data; OFR aggregates; DKW staff estimates; Fed/ECB exchange rates and ECB policy; BEA PCE/reconciliation; and Cleveland inflation measures. The registry contains 477 measurements, 43 measurement source channels and 29 page types. Refresh targets increase from 32 to 51 only for expanded snapshots.

The additive snapshot comparison against `d3418a1e320af0e4b6ad093fb7789c541c7ae24f` preserves all 25 original data sources and all seven calendar sources exactly, including their actual capture timestamps. All 343 original immutable capture descriptors remain unchanged. Nineteen new baselines bring the archive to 362 captures. No pre-existing history or full DKW observations were discarded to meet a size limit.

Detailed native definitions, reuse terms, collection boundaries and rejection cases are documented under [sources](sources/). Cleveland attribution and its CC BY-SA 4.0 terms accompany the displayed inputs. Published monthly imputations and their affected annual windows are visible. BLS/CPI batch receipt selection uses native series identities and input/baseline years, not a shared API URL alone.

## Deliberate public-data differences

The design geometry, panel roles and navigation follow Stitch. Actual values, dates and chart paths come from retained official inputs. Public-only scope cannot supply executable market depth, current FX basis/OIS/futures probabilities, when-issued auction tails or a calibrated facility take-up model. Those reference slots show a precise coverage state. No mock value or sample path is represented as an observation.

SEP dots are anonymous projections, DKW is a staff-model estimate, TBAC recommendations are not Treasury decisions, TIC residence is not ultimate ownership, and FX outputs are user assumptions. Retrieval timestamps do not establish publication time. Archived forecasts and original payroll vintages are not claimed where they have not been retained.

Frozen research captures all supporting inputs independently of the primary comparison selection. Import validation checks new families and the scoped legacy dependencies consumed by each new desk. It checks metadata, receipts and internal calculation identities; an unsigned user-supplied package is not an independent authentication of an agency's original response bytes.

## Delivery and validation

The existing repository budget applies to the complete synthetic PR merge as well as individual commits. The code/fixtures and full captured data therefore use two stacked PRs. The code PR targets main; the data PR initially targets the code branch. Retarget/rebase the data PR after the code PR merges so the existing main-only GitHub Actions policy can run on it. Neither PR is merged or deployed by this task. The 8 MiB commit/merge delta and 20 MiB per-asset safeguards are unchanged.

Validation evidence and screenshots are retained locally under `output/stitch-page-audit-2026-11-01/`; raw probe output is excluded from Git. The final PR descriptions record the full-suite, static-build, strict HTTP/asset checks, independent review and responsive browser results.

Verified locally: full suite 2,581 passing tests, plus the final 14 focused app/navigation/credit checks; production build and strict HTTP smoke pass (308 assets). Startup data remains 255,556 gzip bytes against the 300,000-byte cap. Browser matrix: 192 reference-route/theme/width combinations at 1280, 801, 390 and 320 pixels, with no document overflow, missing visible chart SVG, duplicate IDs, empty links or nonfinite/loading text. Seven preserved legacy routes also pass. Actual chart range/keyboard, mobile More/Escape, FX zero-shock/horizon, CSV download and saved-snapshot reopen actions were exercised. Full visual comparisons remain limited by intentionally different real values and public-only coverage.
