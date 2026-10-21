# Meridian — Graphite US Macro Workspace

A working frontend foundation for the selected compact Graphite design. Includes Overview, Labor Market, Indicator Detail, Calendar, and Explore Data.

Uses official Treasury, BLS, BEA, DOL ETA and Census observations captured by the data refresh command. The app serves a committed snapshot, with observation periods, source identifiers and actual retrieval times. It does not stream live market quotes.

## Commercial data reuse

The site is intended for advertising revenue. Only datasets reviewed for commercial display, derived use and downloadable redistribution may be connected. The current twelve indicators and Treasury yield curve qualify under their published policies; see the [dataset rights review](docs/data-sources.md) for official evidence, scope and conditions.

The app credits the agencies and Census's originating program, shows the required BLS disclaimer and retrieval date, and includes the disclaimer in exported BLS rows. Build and refresh commands reject data outside the reviewed dataset, identifier and feed scope in `scripts/data-policy.mjs`. Recheck terms when adding or changing a source. Claims coverage limitations accompany the displayed data and CSV exports.

## Run locally

Requires Node.js 22.2 or newer for the built-in ZIP checksum support. No dependency installation is needed.

```powershell
npm start
```

Open [the local app](http://127.0.0.1:4173). Change the port with `npm start -- --port 4174`.

```powershell
npm test
npm run build
node server.mjs --dist --port 4174
```

The build writes a self-contained static app to `dist/`. Hash routes support ordinary static hosting without rewrite rules. The preview server binds only to this computer's loopback interface. It intentionally serves only app assets, not the original design files or project internals.

## Refresh official data

```powershell
npm run data:refresh
# Optional: refresh one agency without downloading the others
npm run data:refresh -- --sources=treasury
# Refresh the new feeds only
npm run data:refresh -- --sources=dol,census
# Refresh official release schedules without downloading indicator data
npm run data:refresh -- --sources=calendar
```

Refresh and then reload the browser. No API keys or dependency installation are needed. Refresh uses Node's server-side fetch; the browser does not contact agency APIs. BEA's two public bulk files total about 70 MB, so refreshing may take several seconds. BLS unauthenticated requests are rate-limited; all six BLS series are batched into one request.

The refresh command writes `src/official-snapshot.js` atomically and exits with an error if an agency fails. Other successful agencies still update. A failed agency retains its last successful values, original retrieval time and provenance; its cached status and refresh error are visible. A first failure leaves that agency unavailable. Do not hand-edit snapshot observations.

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
| Retail sales growth | Census MARTS `44X72 / SM / US / SA` | Exact month-over-month change in nominal sales levels |

Source documentation: [BLS API](https://www.bls.gov/developers/api_signature_v1.htm), [Treasury Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/), [Treasury yield data](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [BEA official flat files](https://apps.bea.gov/iTable/?reqid=19&step=4&isuri=1&1921=flatfiles&1903=3). BEA uses the keyless `NipaDataQ.txt` and `NipaDataM.txt` downloads; the exact series code is matched before values are accepted.

Historical publication timestamps are absent from these feeds and remain unknown. Source-file modification dates and retrieval times are never substituted for release dates. Source footnotes are retained. No historical initial estimates or revision ledger has yet been captured. CSV downloads include source URLs, identifiers, calculation inputs, retrieval timestamps and official/cached status; unknown publication dates are blank.

Claims use the keyless [ETA national historical XML export](https://oui.doleta.gov/unemploy/claims.asp). This table can trail the latest advance news release; its actual latest week-ending date and historical-feed warning remain visible. Blank trailing/future weeks are omitted, internal missing values remain missing, and report execution dates are not publication dates. Counts are divided by 1,000.

Retail uses the keyless [Census MARTS bulk ZIP](https://www.census.gov/econ_datasets/), with 36 retained monthly observations after calculating growth from exact calendar comparisons. Metadata selects U.S. total retail trade and food services, seasonally adjusted monthly sales in millions of dollars. The latest month is an advance estimate. Sales are not price-adjusted; revisions replace earlier levels. Published source precision and Census program credits are retained. The Census API requires a key, so this adapter uses the documented public bulk feed.

The calendar captures official BLS annual schedules, BEA's official iCalendar feed, Census's annual retail schedule, DOL's published weekly claims rule and holiday exceptions, and Treasury Fiscal Data's dated Debt to the Penny estimates. The current snapshot contains 218 schedule entries across five agencies, including 25 Census retail dates, 13 upcoming DOL dates and 50 Treasury estimates. It defaults to the next 30 Eastern calendar days, with month/day, topic and watchlist filters. Shared Employment Situation releases match unemployment, payrolls, participation and wages without duplicating the release. EST/EDT follows `America/New_York` rules, and reference periods come from explicit agency text. Scheduled dates do not establish publication or results.

Calendar retrievals and their SHA256 provenance remain separate from indicator retrievals. A failed agency refresh retains its complete last-good schedule with the original retrieval time and a visible cached/error status. A successful refresh replaces that agency's records, removing withdrawn events; BEA UID sequences and cancellations are respected. If an already captured BLS next-year calendar fails, the entire previous BLS schedule is retained atomically. An unpublished next year remains an explicit coverage limitation. Calendar source URLs and program-to-indicator mappings have their own commercial-use allowlist.

Census entries come from displayed dates, times and reference months on its annual calendar. The connector follows the current-year archive link when the canonical page rolls forward and omits suspended/TBA rows even if obsolete hidden sort keys remain. Source credits identify the U.S. Census Bureau and originating Advance Monthly Retail Trade Survey program. Its factual calendar metadata has a separate commercial-use review; the statistical dataset's CC0 label is not transferred to the calendar.

DOL publishes a recurring Thursday 08:30 Eastern rule plus individually listed Wednesday holiday exceptions. The connector expands only the next 90 calendar days, applies the posted exceptions, drops elapsed dates and never backfills older schedules whose exceptions may have been removed. The UI distinguishes `AGENCY RULE` from `AGENCY EXCEPTION` and explains the basis in the preview, including the nominal Thursday. DOL's generic EST wording is normalized to Eastern daylight/standard time using `America/New_York`, consistent with its release embargo. Observation weeks remain unknown because this schedule does not supply them. Coverage stops at the posted exception-year horizon.

Treasury uses the official [Fiscal Data release calendar JSON](https://api.fiscaldata.treasury.gov/services/calendar/release), joined to [official dataset metadata](https://api.fiscaldata.treasury.gov/services/dtg/metadata/) for the exact Debt to the Penny identity (`015-BFS-2014Q3-065`). The source describes its dates and times as estimates, so rows and previews display `ESTIMATED`, including on narrow screens and when retained after a failed refresh. Source UTC dates/clocks and both response hashes remain available separately from Eastern display fields. Only explicitly listed dates are imported, currently through January 4, 2027. Observation periods remain unknown, and the source's `released` flag is not used as publication history. Factual calendar metadata has a separate commercial-use review with Treasury/Bureau of the Fiscal Service attribution.

Treasury par-yield publication timing is captured independently from its official [yield methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology): usually available by 6 p.m. Eastern each trading day, with possible delays. The calendar and yield detail show this as ongoing guidance with source credit, retrieval time and independent cached/unavailable status. Rates and yield-watchlist filters include the guidance; month/day filters do not turn it into a dated release. No trading days, holidays, early closes or future publication instants are generated, and the 3:30 p.m. input quotation time is not publication timing. The snapshot still contains 218 dated entries.

Yield timing has a separate factual-metadata commercial-use review; the statistical dataset's CC0 label is not transferred to methodology prose. Treasury auctions, release results, forecasts, impact ratings and revision ledgers are not ingested. All six schedule/timing captures across five agencies must succeed for an `ok` calendar status; a failed source remains visible as partial coverage while others can update. Refresh schedules and timing with `--sources=calendar`, or include them in the default full refresh, then commit and push through the existing tested deployment workflow.

## Working features

- Connected five-page navigation, deep links, browser back/forward, refresh, F1–F5 shortcuts, and Ctrl/Cmd+K search.
- Twelve official indicators, with definitions, source identifiers, units, adjustment, observation periods, retrieval times, source footnotes and coverage limitations.
- Indicator level/change controls, six/twelve-observation ranges, exact-value pointer and keyboard chart readouts, and data/methodology/revision tabs.
- Browser watchlists and appearance/density preferences. Saving falls back to session state with an explicit message if browser storage is unavailable.
- Official release calendar with upcoming and monthly windows, date/topic/watchlist filters, related indicators, verified source links, reference periods, EST/EDT times and cached-source status.
- Catalog name/code/agency search, aliases such as “jobs”, composed filters, and up to four comparison series.
- Native-unit comparison panels; optional indexing at an explicit shared nonzero baseline. No automatic frequency aggregation, interpolation, or filling.
- CSV downloads with displayed observations, units, source identifiers, calculation inputs, retrieval times, unknown publication dates and official/cached status.

## Source map

| File | Responsibility |
| --- | --- |
| `src/registry.js` | Canonical official series definitions, units and source mappings |
| `src/data.js`, `src/official-snapshot.js` | Hydrated official snapshots, availability and provenance |
| `scripts/refresh-data.mjs`, `scripts/sources/` | Official agency retrieval, parsing, transformations and last-good retention |
| `scripts/data-policy.mjs`, `docs/data-sources.md` | Reviewed commercial reuse scope, evidence and build/refresh validation |
| `src/model.js` | Search, formatting, transformations, comparison, CSV |
| `src/router.js` | Validated shareable hash routes |
| `src/storage.js` | Versioned browser preferences and failure handling |
| `src/ui.js`, `src/pages.js` | Shared markup and five page views |
| `src/charts.js` | Responsive accessible SVG charts and exact observation readouts |
| `src/app.js` | Navigation, user actions, focus, persistence, downloads |
| `styles.css` | Graphite/Paper/Midnight appearance and responsive density |

Original HTML/SVG/PDF design artifacts are preserved in the original local workspace and excluded from the application repository.

## Live site and automatic deployment

Selected production host: **Cloudflare Workers Static Assets**. The deployment workflow is prepared; account authorization and a verified Cloudflare publication are still required. See the [Cloudflare setup and migration guide](docs/cloudflare-deployment.md).

Current live migration fallback: [Meridian on GitHub Pages](https://vasuki8.github.io/us-treasury/).

Continue development locally, then commit and push to [Vasuki8/us-treasury](https://github.com/Vasuki8/us-treasury).

The **Test, build and deploy** GitHub Actions workflow runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It tests Node 22 and 24, builds the app with the commercial data policy check, checks the built entry point and imported modules over HTTP, and saves a static build artifact for each Node version. No dependencies need installing.

After both verification jobs pass, pushes to `main` and manual runs on `main` automatically deploy the verified Node 24 build to the selected host. Pull requests and manual runs on other branches run verification only. Only `dist/` is published. Main runs are serialized so a new push does not interrupt an active deployment.

Set repository variable `DEPLOY_TARGET=cloudflare` after configuring `CLOUDFLARE_ACCOUNT_ID` as a repository variable and `CLOUDFLARE_API_TOKEN` as an Actions secret. Cloudflare uses the `cloudflare-production` environment and publishes the same-run Node 24 artifact through Wrangler. A public HTTPS check compares the served assets with that artifact. Until Cloudflare is activated, the existing Pages deployment remains the fallback. The guide explains the scoped token and first-time Worker setup.

Relative assets and hash routes support both an origin root on Cloudflare and the existing `/us-treasury/` Pages prefix. The static Worker has no server script and does not enable SPA fallback for missing assets.

CI validates the committed snapshot and deterministic source-response fixtures. It does not call external agency feeds, avoiding rate limits and upstream outages during routine verification. Run the refresh command locally when updating data, then include the changed snapshot in the commit.

```powershell
npm test
npm run build
node scripts/check-build.mjs
git add .
git commit -m "Describe the change"
git push
```

Follow the [Actions workflow](https://github.com/Vasuki8/us-treasury/actions) after pushing. To redeploy the current `main`, select **Test, build and deploy → Run workflow → main**. To roll back content, revert the unwanted commit locally, test, and push the revert to `main`; the same checks and deployment run automatically.

The [commercial data reuse review](docs/data-sources.md) remains applicable on Cloudflare. Hosting setup does not configure Google advertising or establish AdSense eligibility.

## Verification

The Node tests cover official payload schemas, exact calendar comparisons, source identifiers, missing and duplicate observations, unit conversions, retrieval provenance, failed refresh retention, pp/bp changes, indexing, CSV escaping/metadata, filtering, page states, validated deep links, storage errors, and local HTTP asset boundaries. Browser QA covers all five pages, save/reload, keyboard charts, search, filters, comparison, CSV actions, back/forward, skip links, and narrow layouts.

In restricted environments the server test needs permission to connect to loopback; an `EACCES 127.0.0.1` failure indicates an environment restriction, not a failed assertion.

## Next development milestone

Capture historical publication snapshots and revisions, review additional agency calendar coverage, and evaluate a reliable advance-claims feed to supplement the historical table. Persistent multi-device workspaces, accounts, alerts, broader coverage, and advertising remain subsequent milestones.

Design and implementation scope are recorded in `docs/superpowers/`.
