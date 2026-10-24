# Meridian — US Macro Workspace

A compact US fiscal and macro research dashboard with Light and Graphite themes. The original Overview, Labor Market, Indicator Detail, Calendar and Explore Data views remain available alongside nine specialist research views and a six-family Economy workspace.

The header's sun/moon button switches between Light and Graphite. Its accessible label describes the next action, and its touch target expands on mobile. New visitors start in Light; the choice is saved in the same browser alongside density and watchlist preferences. Switching preserves the current page, filters and unsaved inputs. Existing Graphite/Midnight preferences open Graphite, and Paper preferences open Light. With browser storage blocked, the button still works for the current session.

Navigation uses quiet text links and a thin active underline. Mobile keeps Overview, Labor, Calendar and Explore in one row; **More** provides Indicator detail, Watchlist, Saved research and every research module. The disclosure supports native keyboard navigation and closes on selection, Escape, outside interaction or a route change. F1–F5 shortcuts remain available. Research module links scroll horizontally on mobile, with the current module brought into view.

Uses official Treasury, BLS, BEA, DOL ETA, Census, Federal Reserve Board and reviewed New York Fed observations captured by the data refresh command. The app serves a committed snapshot, with observation periods, source identifiers and actual retrieval times. It does not stream live market quotes.

## Commercial data reuse

The site is intended for advertising revenue. Only datasets reviewed for commercial display, derived use and downloadable redistribution may be connected. The 136 registered measurements use dataset-specific admissions. See the [original dataset rights review](docs/data-sources.md) and [research source ledger](docs/research-dashboard-sources.md) for exact feeds, evidence and limitations. New York Fed data use conditional business redistribution, with titles, copyright, reference-rate disclaimers and downstream terms retained; they are not described as public domain.

The app credits the agencies and Census's originating program, shows the required BLS disclaimer and retrieval date, and includes the disclaimer in exported BLS rows. Build and refresh commands reject data outside the reviewed dataset, identifier and feed scope in `scripts/data-policy.mjs`. Recheck terms when adding or changing a source. Claims coverage limitations accompany the displayed data and CSV exports. Research additions have separate scoped reviews in the [research source ledger](docs/research-dashboard-sources.md).

## Balanced macro coverage

The [Macro coverage workspace](https://vasuki8.github.io/us-treasury/#/economy) connects Prices, Policy rates, Activity & income, Housing and Labor. It adds 31 measurements to the original catalog, including separate latest advance claims: core/monthly CPI and PCE, explicit price indexes, policy target bounds and IORB, real spending/income levels and published monthly growth, industrial production/utilization, housing permits/starts/completions, payroll levels, U-6, employment/population, private weekly hours and continued claims. Focused histories reuse shared date windows, native comparisons, details, watchlists and matching CSV exports. Family tables show latest retained reference periods separately from the selected chart window.

The Economy workspace includes a Trade & current account family: six BEA ITA Table 1.1 balances with complete available quarterly history from 1960Q1 through 2026Q2, exact prior-quarter accounting changes, focused history, comparisons and attributed CSV exports. These seasonally adjusted quarterly amounts are not annualized and remain distinct from NIPA trade at SAAR. The table release date identifies the revised dataset, not historical first releases. Frozen results retain the exact current/prior accounting inputs and original CSV. A calculated current/prior-quarter current-account-to-GDP panel uses `100 × quarterly current account / (same-quarter nominal GDP SAAR / 4)`, preserving negative deficits and percentage-point changes. Its CSV retains both original input strings, units and independent retrieval evidence; frozen results retain the exact GDP denominator. Missing quarters remain unavailable and old frozen packages do not acquire new inputs. See the [ratio source/methodology review](docs/current-account-gdp-source-review.md). A historical ratio chart shares the page’s year/all/custom/count windows, with keyboard values and a matching history CSV. Missing exact-quarter inputs remain gaps. New frozen results retain both relevant full input histories and the selected window; older pins stay unchanged. The separate `beaIta` collector participates in daily refreshes; source failures retain its last verified capture visibly cached. See the [scoped commercial-use/source review](docs/bea-current-account-source-review.md).

New captures preserve earlier immutable history. Newly retrieved historical observations were first captured now; they do not establish historical publication vintages. Data freshness requires 30 outcomes (23 data collectors and seven calendar/timing sources). Census housing events use published dates. The admitted FOMC calendar retains day precision and dated official document references; numeric projections are not ingested. G.17 schedules remain external links. The existing BLS calendar 403 exception remains visible. See the [source mapping](docs/research-dashboard-sources.md) and [milestone plan](docs/superpowers/plans/2026-10-22-balanced-macro-coverage.md).

## Research modules

The economist/investor review adds a six-topic Overview with explicit changes, factual evidence and selected next catalysts; one Labor destination with separate advance claims and revised history; exact GDP/claims release workspaces; contextual **Save view / Freeze result** actions; and Watchlist ordering, groups and update/event sorting. The [implementation and acceptance record](docs/economist-investor-review-implementation.md) maps the report to delivered features and concrete limitations.

New reviewed coverage includes nominal GDP and aligned fiscal ratios, private final demand/GDI, published fixed-investment/inventory and goods/services GDP contributions, exact 3/6-month price momentum and three-month payroll gains, labor flows/prime-age/compensation/productivity, saving/trade, H.8 bank balances, SLOOS, H.4.1, overnight reverse repo, household debt service and bank delinquency ratios. The [economic-depth review](docs/economic-depth-source-review.md), [credit review](docs/credit-policy-context-source-review.md), [household review](docs/household-credit-source-review.md) and [FOMC review](docs/fomc-calendar-source-review.md) define exact reuse and measurement scope. The compact Credit page, its CSV and its frozen supplementary inputs show three years per source group; full histories remain in indicator details.

Release-aware weekday checks supplement the daily refresh for supported 08:30 Eastern GDP/claims/CPI events. The best-effort current-data objective is within two hours of the expected schedule; GitHub scheduling is not guaranteed. Publication-archive verification remains a separate admission step, and a refreshed current feed never establishes a verified release result. [Release operations and limitations](docs/release-journey.md) distinguish these clocks and delivery measurements.

The first research delivery adds the following within the existing Light/Graphite UI:

- **CPI release evidence:** nine dated BLS releases for January–September 2026, retaining 36 published rates and 18 explicitly printed prior-month cells. Monthly headline/core rates are seasonally adjusted; twelve-month rates are unadjusted. The dated published percentages remain separate from current index-derived indicator histories. Calendar, indicator, Overview, release evidence and publication-history workflows link the four measurements. Day-precision publication dates are never promoted to exact publication instants. See the [CPI source review](docs/cpi-publication-source-review.md).
- **Coverage inventory:** Explore Data's third tab inventories all 136 registered measurements, including unavailable data. Shared search/topic/frequency filters, reference bounds, usable/retained counts, official/calculated classification, collection state, source evidence and separately loaded publication coverage support research selection. CSV exports metadata; frozen results preserve the selected inventory and its evidence.
- **Longer GDP contributions:** all ten reviewed series retain the official available numeric history, 317 quarters from 1947 Q2 through 2026 Q2. Earlier immutable retrieval captures remain unchanged; a historical reference date does not imply an earlier retrieval or first release.
- **GDP revision matrix:** Publication History offers a matrix alongside the single-quarter view. Explicit Advance, Second/Preliminary and Third/Final stages, exceptional stages, independent sample counts, signed/absolute revision statistics and publication-day cutoffs remain visible. Current archive coverage spans 98 quarters from 2002 Q1 through 2026 Q2. CSV and frozen results retain original evidence and the cutoff.
- **Funding distributions:** separate SOFR/EFFR panels show published daily p1–p99 and p25–p75 bands plus the volume-weighted median. These describe each effective day's transaction-rate distribution. Shared date windows also apply to the median-rate spread; the full-retained specialist CSV preserves original percentile fields and its original scope. Frozen results retain the captured source and window.

Large frozen results can exceed the existing browser research-storage limit. A visible session-only warning accompanies them; **Download JSON** provides durable portable storage within the package import limit. Older packages retain their original contents.

`node scripts/check-publication-upkeep.mjs` checks approved archive completeness without changing data; `--discover` also checks bounded official sources. CPI automatic checks use the Cleveland Fed's public headline/core downloads to detect usable new reference months, avoiding the blocked BLS website. This is secondary data availability, which can lag BLS; it does not establish original publication dates or replace archived BLS rates. [Exact source/CC BY-SA reuse review](docs/cleveland-cpi-availability-source-review.md). Scheduled/main Actions runs retain a JSON upkeep artifact and summary through an independent job, including source scope, actual receipts and license notices. New months/editions enter source review and are not automatically admitted. Source failure fails maintenance visibly without gating unrelated current-data publication. After source-scope review, the GDP, claims and CPI capture commands append only missing approved facts; complete reruns do not refetch existing evidence.

- [Fiscal pressure](https://vasuki8.github.io/us-treasury/#/fiscal): MTS receipts, outlays, net budget interest, primary deficit, TTM metrics, contributor and financing reconciliations.
- [Refinancing](https://vasuki8.github.io/us-treasury/#/refinancing): observed MSPD maturities and instrument-aware hypothetical rate sensitivities.
- [Rates & curves](https://vasuki8.github.io/us-treasury/#/yields): selected-date tenor changes, dated curve overlays, slope spreads and matched nominal/real inflation compensation.
- [Auctions](https://vasuki8.github.io/us-treasury/#/auctions): observed demand, competitive allocations and comparable prior auctions.
- [Ownership](https://vasuki8.github.io/us-treasury/#/ownership): Z.1 sectors and separately valued SOMA holdings.
- [GDP contributions](https://vasuki8.github.io/us-treasury/#/macro): published BEA GDP contributions; CPI effects remain unavailable after official BLS HTTP 403.
- [Credit & policy transmission](https://vasuki8.github.io/us-treasury/#/credit): bank credit, lending survey, Federal Reserve balance-sheet, reverse-repo and household/bank-loan context, each with its own reporting scope.
- [Captured by / revision history](https://vasuki8.github.io/us-treasury/#/vintages): immutable registered-series captures, observed changes and exact UTC retrieval cutoffs.
- [Market functioning](https://vasuki8.github.io/us-treasury/#/market): dealer positions/financing/fails and SOFR/EFFR context; partial indicators, no composite score.

All modules distinguish observations, calculations and assumptions. Source/retrieval dates, methodology, limitations and downloadable metadata accompany results. The [implementation record](docs/research-dashboard-plan.md) tracks tests and deployments. TIC country tables and ACM term premium remain unadmitted pending further rights/schema review; auction tails have no approved matched when-issued source. First-reported historical vintages are not invented. As-known replay currently covers registered series rather than supplementary profiles or calendars. Cloudflare activation remains deferred; the existing Pages deployment is preserved.

## Research windows, search and watchlist

Indicator details and comparisons offer **1Y, 3Y, 5Y, All history and exact inclusive UTC reference dates**. Presets end at the latest retained observation across the selected series. All history exposes retained coverage; it does not request additional agency history. Coverage summaries distinguish retained/displayed observations and retrieval timestamps. Legacy `range=6/12` links remain explicit observation-count windows. Charts, tables and CSV use the same window and preserve source frequency and missing values. Calendar comparison panels share date bounds while retaining separate native scales.

Search covers all 136 measurements, official IDs, agency/measurement metadata and calculation descriptions. Aliases expand results, and exact identifiers rank ahead of loose matches. Catalog, comparison and watchlist detail links retain date settings, selection and a safe return route; same-session returns restore list position. Related links follow each measure's subject and research module.

Native comparisons remain the default. Ratio indexing admits only classified positive levels/counts/amounts with an exact shared positive baseline. Rates, growth, contributions and balances instead use native values or **change from baseline**, with separate units and a shared finite reference date. No interpolation or frequency aggregation is performed. CSV includes the selected window, comparison formula, baseline and existing source/rights provenance.

**My watchlist** is available on desktop and mobile, with open/remove and add-to-comparison actions (up to four measures). It uses existing browser storage and explicitly reports session-only persistence when storage is unavailable. **Captured by** shows exact UTC retrieval cutoffs and each series' first retained capture; earlier data stays unavailable. Observation dates, retrieval times and unknown release dates remain distinct. See the [usable-research milestone plan](docs/superpowers/plans/2026-10-22-usable-research.md).

## Run locally

Requires Node.js 22.2 or newer for the built-in ZIP checksum support. Install the locked development-only PDF collector dependency before running tests or refreshing data. The browser app remains dependency-free.

```powershell
npm ci --ignore-scripts
npm start
```

Open [the local app](http://127.0.0.1:4173). Change the port with `npm start -- --port 4174`.

```powershell
npm test
npm run build
node server.mjs --dist --port 4174
```

The build writes a self-contained static app to `dist/`. Its stylesheet, icon, native modules and lazy history bundles live under a content-versioned asset directory, so a changed snapshot gets new asset URLs instead of reusing a cached module. Ordinary pages receive current observations only; Revision history and indicator Revisions load and verify only the source archives needed by the selected series. Sources share cached requests across their series and have independent error/retry states. Historical source mappings include moved and removed series; the default UTC cutoff stays global. Native gzip decompression has a plain JSON fallback for each source. Hash routes support ordinary static hosting without rewrite rules. The preview server binds only to this computer's loopback interface. It intentionally serves only app assets, not the original design files or project internals.

## Refresh official data

```powershell
npm run data:refresh
# Optional: refresh one agency without downloading the others
npm run data:refresh -- --sources=treasury
# Refresh selected research collectors only
npm run data:refresh -- --sources=fiscal,refinancing,yields,auctions,ownership,macroContributions,marketFunctioning
# Refresh official release schedules without downloading indicator data
npm run data:refresh -- --sources=calendar
# Require every attempted source to succeed before replacing the snapshot
npm run data:refresh -- --require-all
# Daily publication policy: permit only the verified cached BLS calendar on HTTP 403
npm run data:refresh -- --allow-cached-bls-calendar
# Read-only check: has the latest scheduled daily refresh completed?
node scripts/check-refresh-due.mjs
# Manual, read-only check of official BLS calendar document access
node scripts/check-bls-calendar-access.mjs
```

Refresh and then reload the browser. No API keys are needed. Install the pinned PDF text extractor once with `npm ci --ignore-scripts`; it runs only in the Node collector, never in the browser. Refresh uses Node's server-side fetch; the browser does not contact agency APIs. BEA's two public bulk files total about 70 MB, so refreshing may take several seconds. BLS unauthenticated requests are rate-limited; the reviewed BLS source IDs are batched into one unregistered request covering ten calendar years.

The refresh command writes new immutable, content-addressed gzip captures under `src/history/`, verifies retained files, then atomically replaces `src/official-snapshot.js` with current data and an ordered storage index. All original captures, confirmations, provenance and timestamps remain available; no history is pruned. Build, refresh and publication hydrate the archive before commercial-data admission. The command exits with an error if an agency fails. Other successful agencies still update. A failed agency retains its last successful values, original retrieval time and provenance; its cached status and refresh error are visible. A first failure leaves that agency unavailable. Do not hand-edit snapshot observations or archive files. See the [storage and replay contract](docs/vintages-design.md).

Use `--require-all` when every selected source must succeed before replacing the snapshot. The daily workflow uses the explicitly approved `--allow-cached-bls-calendar` policy instead: every other selected source must succeed, while an actual HTTP 403 from an exact official BLS annual calendar URL may retain a valid, nonempty prior calendar capture. The modes are mutually exclusive. The BLS source remains cached/error and the aggregate calendar remains partial; its events, provenance and retrieval time stay unchanged, and Actions records a warning and summary. A successful later BLS capture clears the error automatically. Missing or invalid prior coverage, redirects, different BLS errors, and other source failures reject the candidate before writing.

An unavailable BLS next-year schedule that has never been captured remains an explicit coverage limitation. Failure to retrieve a previously captured year rejects publication, except for the approved HTTP 403 retention policy above. The default local command retains its partial-update behavior for investigation.

| Indicator | Official source identifier | Calculation |
| --- | --- | --- |
| Unemployment | BLS `LNS14000000` | Published seasonally adjusted percent |
| Nonfarm payroll change | BLS `CES0000000001` | Current minus exact preceding month; thousands of jobs |
| CPI inflation | BLS `CUUR0000SA0` | Year-over-year change in the unadjusted CPI index |
| Labor participation | BLS `LNS11300000` | Published seasonally adjusted percent |
| Earnings growth | BLS `CES0500000003` | Exact year-over-year change in seasonally adjusted hourly earnings |
| Job openings | BLS `JTS000000000000000JOL` | Published thousands converted to millions |
| Real GDP growth | BEA `A191RL` | Published annualized quarter-over-quarter percent, used directly |
| PCE inflation | BEA `DPCERG` | Exact year-over-year change in the headline monthly price index |
| Federal debt | Treasury `tot_pub_debt_out_amt` | Official dollars divided by one trillion |
| 10-year yield / curve | Treasury daily par yield CSV | Published percent; daily changes in basis points |
| Initial claims | DOL ETA national XML `InitialClaims/SA` | Published counts / 1,000; week-ending dates; historical feed |
| Continued claims | DOL ETA national XML `ContinuedClaims/SA` | Regular UI continued weeks claimed / 1,000; independent week-ending coverage |
| Latest advance claims, initial and continued | DOL weekly release PDF; Meridian field mappings `InitialClaims/SA/Release`, `ContinuedClaims/SA/Release` | Counts / 1,000; current advance plus the prior revised/unrevised comparison from that same release, separate from historical XML |
| Retail sales growth | Census MARTS `44X72 / SM / US / SA` | Exact month-over-month change in nominal sales levels |

Source documentation: [BLS API](https://www.bls.gov/developers/api_signature_v1.htm), [Treasury Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/), [Treasury yield data](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [BEA official flat files](https://apps.bea.gov/iTable/?reqid=19&step=4&isuri=1&1921=flatfiles&1903=3). BEA uses the keyless `NipaDataQ.txt` and `NipaDataM.txt` downloads; the exact series code is matched before values are accepted.

Historical publication timestamps are absent from these feeds and remain unknown. Source-file modification dates and retrieval times are never substituted for release dates. Source footnotes are retained. Official GDP and DOL claims publication histories and immutable Meridian retrieval captures are available separately. Publication history contains only the specific reviewed releases retained in those archives; it does not establish unavailable vintages for other measures. CSV downloads include source URLs, identifiers, calculation inputs, retrieval timestamps and official/cached status; unknown publication dates are blank.

Initial and continued claims use the keyless [ETA national historical XML export](https://oui.doleta.gov/unemploy/claims.asp), requesting and retaining the full available history from 1967. The reviewed capture has 3,117 weeks per measure, January 7, 1967–September 26, 2026, available through All, 5Y and custom windows. This table can trail the latest advance news release; actual independent week-ending coverage and the historical-feed warning remain visible. Blank trailing/future weeks are omitted and internal missing values remain missing. Counts are divided by 1,000, with original strings retained. Report execution dates and retrievals are not publication dates. [Source admission and limits](docs/dol-claims-history-source-review.md) document commercial reuse, revised-history interpretation and genuine current retrieval provenance.

[Latest initial advance claims](https://vasuki8.github.io/us-treasury/#/series/claimsAdvance?window=all) and [continued advance claims](https://vasuki8.github.io/us-treasury/#/series/continuedClaimsAdvance?window=all) use a separately admitted DOL release PDF. Each view contains two observations: the current advance and its same-release prior-week comparison, with explicit revised/unrevised labels. Reciprocal links open the full revised history. Known release dates have day precision; announced embargo clocks and actual retrievals remain distinct. Daily refresh, cache/failure status, source archive loading, CSV and frozen packages work independently of the historical feed. See the [commercial source review and limits](docs/dol-advance-claims-source-review.md). This is the latest release context and capture history going forward, not reconstructed historical first-release vintages.

Retail uses the keyless [Census MARTS bulk ZIP](https://www.census.gov/econ_datasets/), with retained monthly levels from 1992 and growth calculated from exact calendar comparisons. Metadata selects U.S. total retail trade and food services, seasonally adjusted monthly sales in millions of dollars. The latest month is an advance estimate. Sales are not price-adjusted; revisions replace earlier levels. Published source precision and Census program credits are retained. The Census API requires a key, so this adapter uses the documented public bulk feed.

The calendar captures official BLS annual schedules, BEA's official iCalendar feed, Census's annual retail schedule, DOL's published weekly claims rule and holiday exceptions, and Treasury Fiscal Data's dated Debt to the Penny estimates. Entry counts and coverage horizons change as agencies update their schedules and DOL's upcoming window rolls forward. It defaults to the next 30 Eastern calendar days, with month/day, topic and watchlist filters. Shared Employment Situation releases match unemployment, payrolls, participation and wages without duplicating the release. EST/EDT follows `America/New_York` rules, and reference periods come from explicit agency text. Scheduled dates do not establish publication or results.

Calendar retrievals and their SHA256 provenance remain separate from indicator retrievals. A failed agency refresh retains its complete last-good schedule with the original retrieval time and a visible cached/error status. A successful refresh replaces that agency's records, removing withdrawn events; BEA UID sequences and cancellations are respected. If an already captured BLS next-year calendar fails, the entire previous BLS schedule is retained atomically. An unpublished next year remains an explicit coverage limitation. Calendar source URLs and program-to-indicator mappings have their own commercial-use allowlist.

BLS annual-calendar requests identify the refresh bot and link to the repository's enabled issue tracker for owner contact. They run sequentially with a one-second pause, following [BLS's automated retrieval policy](https://www.bls.gov/bls/blsterms.htm). A source access denial remains an error; it is never replaced by a generated schedule.

The manual **Diagnose official BLS calendar access** workflow checks the current annual page and BLS's documented iCalendar subscription from a GitHub runner without publishing data. See the [BLS access diagnostic and prepared recovery request](docs/bls-calendar-access.md). Commercial reuse rights and permission to access an endpoint remain separate; changing to a blocked official format does not restore access.

Census entries come from displayed dates, times and reference months on its annual calendar. The connector follows the current-year archive link when the canonical page rolls forward and omits suspended/TBA rows even if obsolete hidden sort keys remain. Source credits identify the U.S. Census Bureau and originating Advance Monthly Retail Trade Survey program. Its factual calendar metadata has a separate commercial-use review; the statistical dataset's CC0 label is not transferred to the calendar.

DOL publishes a recurring Thursday 08:30 Eastern rule plus individually listed Wednesday holiday exceptions. The connector expands only the next 90 calendar days, applies the posted exceptions, drops elapsed dates and never backfills older schedules whose exceptions may have been removed. The UI distinguishes `AGENCY RULE` from `AGENCY EXCEPTION` and explains the basis in the preview, including the nominal Thursday. DOL's generic EST wording is normalized to Eastern daylight/standard time using `America/New_York`, consistent with its release embargo. Observation weeks remain unknown because this schedule does not supply them. Coverage stops at the posted exception-year horizon.

Treasury uses the official [Fiscal Data release calendar JSON](https://api.fiscaldata.treasury.gov/services/calendar/release), joined to [official dataset metadata](https://api.fiscaldata.treasury.gov/services/dtg/metadata/) for the exact Debt to the Penny identity (`015-BFS-2014Q3-065`). The source describes its dates and times as estimates, so rows and previews display `ESTIMATED`, including on narrow screens and when retained after a failed refresh. Source UTC dates/clocks and both response hashes remain available separately from Eastern display fields. Only explicitly listed dates are imported, currently through January 4, 2027. Observation periods remain unknown, and the source's `released` flag is not used as publication history. Factual calendar metadata has a separate commercial-use review with Treasury/Bureau of the Fiscal Service attribution.

Treasury par-yield publication timing is captured independently from its official [yield methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology): usually available by 6 p.m. Eastern each trading day, with possible delays. The calendar and yield detail show this as ongoing guidance with source credit, retrieval time and independent cached/unavailable status. Rates and yield-watchlist filters include the guidance; month/day filters do not turn it into a dated release. No trading days, holidays, early closes or future publication instants are generated, and the 3:30 p.m. input quotation time is not publication timing.

Yield timing has a separate factual-metadata commercial-use review; the statistical dataset's CC0 label is not transferred to methodology prose. This calendar does not contain Treasury auction events, release results, forecasts, impact ratings or revision explanations. Auction observations and registered-series capture history have separate research views. All six schedule/timing captures across five agencies must succeed for an `ok` calendar status without coverage warnings. The approved BLS HTTP 403 exception permits automated publication with its verified calendar visibly cached; other selected sources must succeed. Refresh schedules and timing with `--sources=calendar`, or include them in the default full refresh.

## Working features

- Global data freshness banner with the latest successful source retrieval, latest recorded attempt, named stale/cached/unavailable feeds, and expandable capture details for all 22 data/calendar/timing capture outcomes. Times display Eastern daylight/standard time; snapshot assembly and observation periods do not stand in for refresh timestamps.
- Connected original navigation and compact research navigation, deep links, browser back/forward, refresh, F1–F5 shortcuts, and Ctrl/Cmd+K search.
- 79 registered indicators, with definitions, source identifiers, units, adjustment, observation periods, retrieval times, source footnotes and coverage limitations.
- Indicator level/change controls, six/twelve-observation ranges, exact-value pointer and keyboard chart readouts, and data/methodology/revision tabs.
- Browser watchlists and appearance/density preferences. Saving falls back to session state with an explicit message if browser storage is unavailable.
- Official release calendar with upcoming and monthly windows, date/topic/watchlist filters, related indicators, verified source links, reference periods, EST/EDT times and cached-source status.
- Catalog name/code/agency search, aliases such as “jobs”, composed filters, and up to four comparison series.
- Native-unit comparison panels; optional indexing at an explicit shared nonzero baseline. No automatic frequency aggregation, interpolation, or filling.
- CSV downloads with displayed observations, units, source identifiers, calculation inputs, retrieval times, unknown publication dates and official/cached status.

## Repeatable research

Website review milestone 3 adds [Saved research](https://vasuki8.github.io/us-treasury/#/research). Named workspaces save editable selections, windows and module assumptions and reopen the latest snapshot. **PIN RESULT** creates a separate read-only package containing up to four scoped measurements, their full retained inputs, exact displayed observations, calculation version, baselines, rights, provenance, assumptions and original CSV. Specialist inputs and exports are included where relevant. Download its JSON and import it in another browser to reconstruct the result without a mutable dashboard link. A SHA-256 checksum checks integrity; it does not authenticate imported source claims. The viewer does not fetch package URLs or replace frozen observations with current ones.

The browser library permits 50 workspaces and 20 packages within a 3 MiB storage budget. Portable packages have a 12 MiB whole-file limit; large valid packages and storage failures remain explicitly session-only. No records are silently pruned. An exclusive browser Web Lock serializes writes. A stale tab preserves newer stored records and warns before keeping its changes for the session. Browsers without Web Locks keep edits session-only. Download JSON before closing a session-only result. Libraries are local to the current browser/origin; there is no account sync or research API.

Native comparison panels link pointer and keyboard cursors to exact shared reference dates. Missing dates show unavailable rather than neighboring or interpolated observations. **Capture changes** lazily loads only the watchlist's source archives (or the current selection when the watchlist is empty), distinguishes backfills, newly captured periods, observed value changes, metadata changes and removals, and exports their evidence. Optional alerts appear when this browser returns or reloads; a newer capture does not establish a new economic release. No external/background notification service is configured.

Longer current revised history includes all observations available in the approved BEA quarterly/monthly files, with independent starts per measurement, industrial activity and Census housing from January 2000, and DOL national SA initial/continued claims from 1967. Earlier reference periods are first captured at their actual new retrieval time. All 35 captures preceding the advance-release addition are preserved; the separate advance baseline extends the archive to 36. Earlier as-known cutoffs and frozen packages retain their original coverage. BLS's existing keyless ten-year window and other source windows remain unchanged.

**Publication history** retains 1,076 official real-GDP publication facts across 98 quarters, **2002Q1–2026Q2**, from BEA's dated September 2026 GDP/GDI vintage workbook. Choose a reference quarter and publication-date cutoff before exporting or pinning. Historical Preliminary/Final/Initial/Updated labels remain intact; 141 explicit no-GDP-revision rows are confirmations. The documented 21-quarter 2026 annual-update batch is identified separately; other revision types and causes remain unknown. Original 2026Q1 June-workbook records and existing frozen packages are preserved. Publication dates have day precision; actual retrieval times stay separate and exact publication instants remain unknown. See the [official source/rights review](docs/publication-vintages-source-review.md) and [expansion acceptance evidence](docs/gdp-publication-history-expansion.md).

The same view offers [initial claims publication history](https://vasuki8.github.io/us-treasury/#/research?view=publications&publicationSeries=claimsAdvance) and [continued claims publication history](https://vasuki8.github.io/us-treasury/#/research?view=publications&publicationSeries=continuedClaimsAdvance), loaded separately from GDP. **192 official DOL releases supply 768 advance/prior facts:** 52 from January 5–December 28, 2023; 52 from January 4–December 26, 2024; 46 from January 2–December 31, 2025; 42 from January 8–October 22, 2026. Choose a measurement, reference week and publication-day cutoff; export the scope or pin its evidence. All 560 earlier records/receipts remain immutable. The 2023 hybrid-methodology notice preserves its pandemic non-revision exception; April 13 uses the verified official original PDF with an undated later prose-correction caveat. Applied updates and the 2024 factor-file correction retain distinct meanings; incompatible update differences are withheld. The October–November 2025 gap and two unknown-status priors remain explicit. Revised XML, latest context and genuine retrieval replay stay separate; missing original advances or historical instants are never invented. See the [2023 source/commercial-use review](docs/dol-publications-2023-source-review.md), [2024](docs/dol-publications-2024-source-review.md), [2025](docs/dol-publications-2025-source-review.md) and [original 2026 review](docs/dol-publication-history-source-review.md). The locked append-only capture command retrieves only missing approved IDs; completed reruns preserve every record without refetching. Future scope requires review; daily latest-context refresh continues independently.

The historical publication archive loads only when its view needs it, with explicit loading/error/retry states. It is independently validated during build and excluded from daily freshness. `node scripts/capture-publications.mjs` appends only missing admitted IDs under an exclusive file lock, preserving all retained records and retrieval evidence. Once complete it makes no request or write. Corrections, other measures and later workbook editions need a separate source/admission review; future archive expansion is not automatically scheduled.

## Source map

| File | Responsibility |
| --- | --- |
| `src/registry.js` | Canonical official series definitions, units and source mappings |
| `src/data.js`, `src/official-snapshot.js` | Hydrated official snapshots, availability and provenance |
| `src/freshness.js` | Recorded retrieval/attempt summary, daily refresh deadlines and independent stale/cached states |
| `src/freshness-controller.js` | Minute/resume freshness checks that preserve disclosure and keyboard focus |
| `scripts/refresh-data.mjs`, `scripts/sources/` | Official agency retrieval, parsing, transformations and last-good retention |
| `scripts/snapshot-storage.mjs`, `src/history/` | Verified immutable captures, compact current module and lazy bundle projection |
| `src/history-loader.js`, `src/history-controller.js` | On-demand verified history, retry, navigation and focus handling |
| `src/research-workspaces.js`, `src/research-packages.js`, `src/research-library.js` | Validated saved configurations, frozen portable evidence and bounded browser persistence |
| `src/research-context.js`, `src/research-page.js` | Scoped specialist pinning, frozen viewer and research library |
| `src/capture-changes.js`, `src/comparison-cursor.js` | Factual capture deltas, local checkpoints and exact shared cursor dates |
| `src/publication-archive.js`, `src/publication-history.js`, `scripts/publication-policy.mjs` | Selected immutable official GDP publication estimates and exact independent admission |
| `scripts/publish-snapshot.mjs` | Root and newly referenced capture commits, expected-commit checks and normal pushes |
| `scripts/check-refresh-due.mjs` | Daily capture completion guard for scheduled, backup and main-push refreshes |
| `scripts/check-bls-calendar-access.mjs` | Manual, metadata-only checks of documented official BLS calendar access |
| `scripts/data-policy.mjs`, `docs/data-sources.md` | Reviewed commercial reuse scope, evidence and build/refresh validation |
| `src/model.js` | Search, formatting, transformations, comparison, CSV |
| `src/router.js` | Validated shareable hash routes |
| `src/storage.js` | Versioned browser preferences and failure handling |
| `src/ui.js`, `src/pages.js` | Shared markup and five page views |
| `src/charts.js` | Responsive accessible SVG charts and exact observation readouts |
| `src/app.js` | Navigation, user actions, focus, persistence, downloads |
| `styles.css` | Light/Graphite appearance and responsive density |

Original HTML/SVG/PDF design artifacts are preserved in the original local workspace and excluded from the application repository.

## Live site and automatic deployment

Selected production host: **Cloudflare Workers Static Assets**. The deployment workflow is prepared; account authorization and a verified Cloudflare publication are still required. See the [Cloudflare setup and migration guide](docs/cloudflare-deployment.md).

Current live migration fallback: [Meridian on GitHub Pages](https://vasuki8.github.io/us-treasury/).

Continue development locally, then commit and push to [Vasuki8/us-treasury](https://github.com/Vasuki8/us-treasury).

The **Test, build and deploy** GitHub Actions workflow runs on pushes to `main`, pull requests targeting `main`, manual dispatch, and a daily schedule at **23:37 UTC** (7:37 p.m. EDT / 6:37 p.m. EST). Backup checks run at **00:17 and 01:17 UTC**, using the same daily target. It tests Node 22 and 24, builds the app with the commercial data policy check, checks the built entry point and imported modules over HTTP, and saves a static build artifact for each Node version. Both verification jobs and the refresh job install the locked development-only collector dependency with npm ci --ignore-scripts.

After both verification jobs pass, pushes to `main`, manual runs on `main`, and daily runs automatically deploy the verified Node 24 build to the selected host. Pull requests and manual runs on other branches run verification only. Only `dist/` is published. Main runs are serialized so a new push does not interrupt an active deployment.

Set repository variable `DEPLOY_TARGET=cloudflare` after configuring `CLOUDFLARE_ACCOUNT_ID` as a repository variable and `CLOUDFLARE_API_TOKEN` as an Actions secret. Cloudflare uses the `cloudflare-production` environment and publishes the same-run Node 24 artifact through Wrangler. A public HTTPS check compares the served assets with that artifact. Until Cloudflare is activated, the existing Pages deployment remains the fallback. The guide explains the scoped token and first-time Worker setup.

Relative assets and hash routes support both an origin root on Cloudflare and the existing `/us-treasury/` Pages prefix. The static Worker has no server script and does not enable SPA fallback for missing assets.

Scheduled and main-push runs first check whether all 30 daily capture outcomes have completed since the most recent 23:37 UTC start. A missing, failed, invalid, future or older successful capture requests a full refresh. The sole exception is a verified BLS calendar HTTP 403 retained under the approved publication policy, with a new attempt in that daily window; the guard reuses the existing cached-BLS validator. That outcome counts as an attempted daily refresh while its actual old capture stays visibly cached and stale. Attempts and assembly times cannot substitute for the other 29 successful captures.

When due, the run attempts all 23 statistical collectors and all seven calendar/timing collectors with `--allow-cached-bls-calendar`. Normal `main` pushes can therefore recover a missed scheduled run or a refresh rejected after a competing push. Once completed, backup scheduled checks stop after the guard, avoiding agency requests, duplicate builds and deployments. Main pushes with a completed daily capture and pull requests verify the committed snapshot using deterministic source-response fixtures. Manual `main` runs with **refresh_data** enabled force a full refresh even if the daily target is complete; leaving it disabled preserves redeploy-only behavior. Guard or collection failures block publication and deployment.

These use the existing commercially reviewed official sources and require no agency API keys. BLS calendar access currently returns HTTP 403; its last verified calendar remains visibly cached when the other 29 collectors update. This exception does not apply to BLS statistical observations.

For a source diagnostic without changing the snapshot, run `node scripts/refresh-data.mjs --check-only` (optionally `--sources=bls,dol`). This attempts the selected collectors, applies the existing admission checks, and writes only `source-health.json`: statuses, original capture receipts, warnings and latest reference-period coverage. A failed capture exits nonzero; the existing verified cached-BLS-calendar exception is reported explicitly. A successful fetch can still contain older observations, so this does not verify a new release. Never combine check mode with publication-mode flags.

The workflow's optional **check_sources** input runs that same diagnostic in a separate job with read-only repository permissions and no persisted Git credentials. Its `official-source-health` artifact is retained even when collection fails. This job does not publish data, commit, push or gate unrelated deployment. Leave **refresh_data** disabled and select a branch to inspect sources without a production deployment. The [October 24 source audit](docs/source-update-audit-2026-10-24.md) records source coverage, confirmed fixes and external access limitations.

The refresh job tests, builds and smoke-checks the candidate before committing `src/official-snapshot.js` and its exact newly referenced immutable captures together with the job's `GITHUB_TOKEN`. Unreferenced files are excluded. It checks that remote `main` still matches the starting commit, refuses unrelated tracked or staged changes and historical edits/deletions, verifies the archive prefix and bytes, and uses a normal push so competing changes cannot be overwritten. Source failures outside the approved BLS calendar exception, validation errors and push conflicts stop the run and leave the previous live deployment in place. Subsequent Node 22/24 verification and deployment check out the exact emitted snapshot commit. Refresh and deployment share one workflow because [pushes using `GITHUB_TOKEN` do not trigger another push workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

The cron is [GitHub's best-effort schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): runs can be delayed, and public repositories disable schedules after 60 days without repository activity. The refresh job needs repository `contents: write`; other verification jobs retain read-only repository access. No personal token or additional repository secret is needed for data refreshes.

The backup triggers and push catch-up reduce missed-run exposure; GitHub scheduling still has no delivery guarantee. Check Actions for an actual `schedule` run, not just successful push deployments. On October 22, investigation found an active workflow on default branch `main` but no scheduled runs recorded for the October 21 target; the last manual capture was at 23:18 UTC, before the 23:37 target. The resulting eleven stale warnings were correct. GitHub's API did not expose why that trigger was absent. The guard now records the expected run, decision and pending source names in the job log and Actions summary. Explicit manual **refresh_data** remains available for recovery if all scheduled attempts are missed.

The banner allows **60 minutes** after each 23:37 UTC run for collection, verification and deployment. At **00:37 UTC**, a source's displayed successful capture must be at or after that run's scheduled start; older captures are marked **stale**, including on weekends. Cached status describes a failed attempt and remains independent: a source can be both cached and stale, while missing/invalid capture times remain unavailable. Attempts, assembly times and observation dates never reset this warning. A regression test keeps the banner schedule aligned with the workflow cron.

Warnings describe the snapshot loaded in the tab, using the browser's clock; they do not establish whether an agency released new observations or whether a newer deployment already exists. The banner rechecks every minute and when a hidden/restored tab resumes, preserving expanded details and keyboard focus. **Reload snapshot** checks for a newer deployed entry page with a fresh query key, preserving the hash route, without requesting agency feeds. Its versioned module URLs load that build's captures. Reload after a successful deployment to see its updated captures.

Recovery was verified in [Actions run 39704047879](https://github.com/Vasuki8/us-treasury/actions/runs/39704047879). Its first collection rejected an unrecognized Census calendar response and correctly prevented publication; the unchanged collector succeeded on retry. The run tested all 312 tests and published ten new captures around October 22, 01:12 UTC, retaining only the verified BLS calendar after HTTP 403. The completed daily guard then reported no pending sources while the banner correctly retained that calendar's stale warning. This does not establish future scheduled-trigger delivery.

```powershell
npm test
npm run build
node scripts/check-build.mjs
git add .
git commit -m "Describe the change"
git push
```

Follow the [Actions workflow](https://github.com/Vasuki8/us-treasury/actions) after pushing. To refresh immediately, select **Test, build and deploy → Run workflow → main**, enable **refresh_data**, and run it. Leave that option disabled to redeploy the committed snapshot without fetching feeds. To roll back content, revert the unwanted commit locally, test, and push the revert to `main`; the same checks and deployment run automatically.

The [commercial data reuse review](docs/data-sources.md) remains applicable on Cloudflare. Hosting setup does not configure Google advertising or establish AdSense eligibility.

## Verification

The Node tests cover official payload schemas, exact calendar comparisons, source identifiers, missing and duplicate observations, unit conversions, retrieval provenance, failed refresh retention, pp/bp changes, indexing, CSV escaping/metadata, filtering, page states, validated deep links, storage errors, and local HTTP asset boundaries. Browser QA covers all five pages, save/reload, keyboard charts, search, filters, comparison, CSV actions, back/forward, skip links, and narrow layouts.

In restricted environments the server test needs permission to connect to loopback; an `EACCES 127.0.0.1` failure indicates an environment restriction, not a failed assertion.

## Next development milestone

The deeper research expansion is tracked in the [incremental roadmap](docs/research-dashboard-plan.md) and [source admission ledger](docs/research-dashboard-sources.md). The Fiscal pressure page adds monthly receipts, outlays, net budget interest, primary deficits, exact trailing-12-month trends, interest/revenue, category changes and a cash-financing bridge. It distinguishes gross/public debt and net/gross interest. Historical MTS values are as recorded in each monthly statement; later revisions may not be incorporated. Financing source residuals remain explicit. See the [fiscal source review](docs/fiscal-source-review.md).

Expand selected official publication-vintage coverage only after a separate source/date/measurement review. Historical supplemental-profile/calendar replay, longer Treasury backfills, a research API, multi-device accounts, external alerts and advertising remain subsequent work. The BLS calendar remains visibly cached pending the owner's access request.

Design and implementation scope are recorded in `docs/superpowers/`.

## BEA publication revision explanations

Publication history now includes a separately reviewed set of 33 BEA explanations from 29 dated releases, spanning selected 2023Q1–2026Q2 publications. The immutable original thirty are extended with the specific 2023Q1 comprehensive-update and 2024Q1/2025Q1 annual-update explanations. [Source admission and exact coverage](docs/publication-explanations-source-review.md) document commercial reuse, official endpoints, section evidence and exclusions. Summaries are attributed Meridian paraphrases. Update type and year remain distinct; general annual/comprehensive coverage does not establish a quarter-specific cause. Unreviewed publications stay explicit; rounded equal values do not imply no underlying revision. Further routine narrative backfill before 2023 is optional, rather than needed to fill these existing first-quarter gaps.

The explanation archive loads only on the publication-history view. Its loading failure leaves numerical history available, with an independent retry. The selected quarter and publication cutoff apply to the narrative CSV and new frozen packages. Existing numerical CSVs, all 1,076 numerical publication records and older pinned packages remain unchanged. New packages retain original explanation evidence, retrieval hashes and a separate CSV.

After reviewing a new source scope, use `node scripts/capture-publication-explanations.mjs` to append only missing approved explanations. A complete rerun does not refetch or rewrite earlier evidence. The production build admits the complete reviewed scope; this selected narrative archive is outside daily statistical freshness and is not an automatic news scraper.
