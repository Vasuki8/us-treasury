# Meridian — Graphite US Macro Workspace

A compact Graphite US fiscal and macro research dashboard. The original Overview, Labor Market, Indicator Detail, Calendar and Explore Data views remain available alongside eight research views.

Uses official Treasury, BLS, BEA, DOL ETA, Census, Federal Reserve Board and reviewed New York Fed observations captured by the data refresh command. The app serves a committed snapshot, with observation periods, source identifiers and actual retrieval times. It does not stream live market quotes.

## Commercial data reuse

The site is intended for advertising revenue. Only datasets reviewed for commercial display, derived use and downloadable redistribution may be connected. The 48 registered indicators use dataset-specific admissions. See the [original dataset rights review](docs/data-sources.md) and [research source ledger](docs/research-dashboard-sources.md) for exact feeds, evidence and limitations. New York Fed data use conditional business redistribution, with titles, copyright, reference-rate disclaimers and downstream terms retained; they are not described as public domain.

The app credits the agencies and Census's originating program, shows the required BLS disclaimer and retrieval date, and includes the disclaimer in exported BLS rows. Build and refresh commands reject data outside the reviewed dataset, identifier and feed scope in `scripts/data-policy.mjs`. Recheck terms when adding or changing a source. Claims coverage limitations accompany the displayed data and CSV exports. Research additions have separate scoped reviews in the [research source ledger](docs/research-dashboard-sources.md).

## Research modules

- [Fiscal pressure](https://vasuki8.github.io/us-treasury/#/fiscal): MTS receipts, outlays, net budget interest, primary deficit, TTM metrics, contributor and financing reconciliations.
- [Refinancing](https://vasuki8.github.io/us-treasury/#/refinancing): observed MSPD maturities and instrument-aware hypothetical rate sensitivities.
- [Yields](https://vasuki8.github.io/us-treasury/#/yields): dated curve overlays, slope spreads and matched nominal/real inflation compensation.
- [Auctions](https://vasuki8.github.io/us-treasury/#/auctions): observed demand, competitive allocations and comparable prior auctions.
- [Ownership](https://vasuki8.github.io/us-treasury/#/ownership): Z.1 sectors and separately valued SOMA holdings.
- [Macro drivers](https://vasuki8.github.io/us-treasury/#/macro): published BEA GDP contributions; CPI effects remain unavailable after official BLS HTTP 403.
- [Revision history](https://vasuki8.github.io/us-treasury/#/vintages): immutable registered-series captures, observed changes and UTC as-known retrieval cutoffs.
- [Market functioning](https://vasuki8.github.io/us-treasury/#/market): dealer positions/financing/fails and SOFR/EFFR context; partial indicators, no composite score.

All modules distinguish observations, calculations and assumptions. Source/retrieval dates, methodology, limitations and downloadable metadata accompany results. The [implementation record](docs/research-dashboard-plan.md) tracks tests and deployments. TIC country tables and ACM term premium remain unadmitted pending further rights/schema review; auction tails have no approved matched when-issued source. First-reported historical vintages are not invented. As-known replay currently covers registered series rather than supplementary profiles or calendars. Cloudflare activation remains deferred; the existing Pages deployment is preserved.

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

The build writes a self-contained static app to `dist/`. Its stylesheet, icon and complete native-module graph live under a content-versioned asset directory, so a changed snapshot gets new asset URLs instead of reusing a cached module. Hash routes support ordinary static hosting without rewrite rules. The preview server binds only to this computer's loopback interface. It intentionally serves only app assets, not the original design files or project internals.

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

Refresh and then reload the browser. No API keys or dependency installation are needed. Refresh uses Node's server-side fetch; the browser does not contact agency APIs. BEA's two public bulk files total about 70 MB, so refreshing may take several seconds. BLS unauthenticated requests are rate-limited; all six BLS series are batched into one request.

The refresh command writes `src/official-snapshot.js` atomically and exits with an error if an agency fails. Other successful agencies still update. A failed agency retains its last successful values, original retrieval time and provenance; its cached status and refresh error are visible. A first failure leaves that agency unavailable. Do not hand-edit snapshot observations.

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
| Retail sales growth | Census MARTS `44X72 / SM / US / SA` | Exact month-over-month change in nominal sales levels |

Source documentation: [BLS API](https://www.bls.gov/developers/api_signature_v1.htm), [Treasury Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/), [Treasury yield data](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [BEA official flat files](https://apps.bea.gov/iTable/?reqid=19&step=4&isuri=1&1921=flatfiles&1903=3). BEA uses the keyless `NipaDataQ.txt` and `NipaDataM.txt` downloads; the exact series code is matched before values are accepted.

Historical publication timestamps are absent from these feeds and remain unknown. Source-file modification dates and retrieval times are never substituted for release dates. Source footnotes are retained. No historical initial estimates or revision ledger has yet been captured. CSV downloads include source URLs, identifiers, calculation inputs, retrieval timestamps and official/cached status; unknown publication dates are blank.

Claims use the keyless [ETA national historical XML export](https://oui.doleta.gov/unemploy/claims.asp). This table can trail the latest advance news release; its actual latest week-ending date and historical-feed warning remain visible. Blank trailing/future weeks are omitted, internal missing values remain missing, and report execution dates are not publication dates. Counts are divided by 1,000.

Retail uses the keyless [Census MARTS bulk ZIP](https://www.census.gov/econ_datasets/), with 36 retained monthly observations after calculating growth from exact calendar comparisons. Metadata selects U.S. total retail trade and food services, seasonally adjusted monthly sales in millions of dollars. The latest month is an advance estimate. Sales are not price-adjusted; revisions replace earlier levels. Published source precision and Census program credits are retained. The Census API requires a key, so this adapter uses the documented public bulk feed.

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

- Global data freshness banner with the latest successful source retrieval, latest recorded attempt, named stale/cached/unavailable feeds, and expandable capture details for all 18 data/calendar/timing capture outcomes. Times display Eastern daylight/standard time; snapshot assembly and observation periods do not stand in for refresh timestamps.
- Connected original navigation and compact research navigation, deep links, browser back/forward, refresh, F1–F5 shortcuts, and Ctrl/Cmd+K search.
- 48 registered indicators, with definitions, source identifiers, units, adjustment, observation periods, retrieval times, source footnotes and coverage limitations.
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
| `src/freshness.js` | Recorded retrieval/attempt summary, daily refresh deadlines and independent stale/cached states |
| `src/freshness-controller.js` | Minute/resume freshness checks that preserve disclosure and keyboard focus |
| `scripts/refresh-data.mjs`, `scripts/sources/` | Official agency retrieval, parsing, transformations and last-good retention |
| `scripts/publish-snapshot.mjs` | Snapshot-only bot commits, expected-commit checks and normal pushes |
| `scripts/check-refresh-due.mjs` | Daily capture completion guard for scheduled, backup and main-push refreshes |
| `scripts/check-bls-calendar-access.mjs` | Manual, metadata-only checks of documented official BLS calendar access |
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

The **Test, build and deploy** GitHub Actions workflow runs on pushes to `main`, pull requests targeting `main`, manual dispatch, and a daily schedule at **23:37 UTC** (7:37 p.m. EDT / 6:37 p.m. EST). Backup checks run at **00:17 and 01:17 UTC**, using the same daily target. It tests Node 22 and 24, builds the app with the commercial data policy check, checks the built entry point and imported modules over HTTP, and saves a static build artifact for each Node version. No dependencies need installing.

After both verification jobs pass, pushes to `main`, manual runs on `main`, and daily runs automatically deploy the verified Node 24 build to the selected host. Pull requests and manual runs on other branches run verification only. Only `dist/` is published. Main runs are serialized so a new push does not interrupt an active deployment.

Set repository variable `DEPLOY_TARGET=cloudflare` after configuring `CLOUDFLARE_ACCOUNT_ID` as a repository variable and `CLOUDFLARE_API_TOKEN` as an Actions secret. Cloudflare uses the `cloudflare-production` environment and publishes the same-run Node 24 artifact through Wrangler. A public HTTPS check compares the served assets with that artifact. Until Cloudflare is activated, the existing Pages deployment remains the fallback. The guide explains the scoped token and first-time Worker setup.

Relative assets and hash routes support both an origin root on Cloudflare and the existing `/us-treasury/` Pages prefix. The static Worker has no server script and does not enable SPA fallback for missing assets.

Scheduled and main-push runs first check whether all 18 daily capture outcomes have completed since the most recent 23:37 UTC start. A missing, failed, invalid, future or older successful capture requests a full refresh. The sole exception is a verified BLS calendar HTTP 403 retained under the approved publication policy, with a new attempt in that daily window; the guard reuses the existing cached-BLS validator. That outcome counts as an attempted daily refresh while its actual old capture stays visibly cached and stale. Attempts and assembly times cannot substitute for the other 17 successful captures.

When due, the run attempts all five statistical collectors and all six calendar/timing collectors with `--allow-cached-bls-calendar`. Normal `main` pushes can therefore recover a missed scheduled run or a refresh rejected after a competing push. Once completed, backup scheduled checks stop after the guard, avoiding agency requests, duplicate builds and deployments. Main pushes with a completed daily capture and pull requests verify the committed snapshot using deterministic source-response fixtures. Manual `main` runs with **refresh_data** enabled force a full refresh even if the daily target is complete; leaving it disabled preserves redeploy-only behavior. Guard or collection failures block publication and deployment.

These use the existing commercially reviewed official sources and require no agency API keys. BLS calendar access currently returns HTTP 403; its last verified calendar remains visibly cached while the other ten collectors update. This exception does not apply to BLS statistical observations.

The refresh job tests, builds and smoke-checks the candidate before committing only `src/official-snapshot.js` with the job's `GITHUB_TOKEN`. It checks that remote `main` still matches the starting commit, refuses unrelated tracked or staged changes, and uses a normal push so competing changes cannot be overwritten. Source failures outside the approved BLS calendar exception, validation errors and push conflicts stop the run and leave the previous live deployment in place. Subsequent Node 22/24 verification and deployment check out the exact emitted snapshot commit. Refresh and deployment share one workflow because [pushes using `GITHUB_TOKEN` do not trigger another push workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

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

Capture historical publication snapshots and revisions, review additional agency calendar coverage, and evaluate a reliable advance-claims feed to supplement the historical table. Persistent multi-device workspaces, accounts, alerts, broader coverage, and advertising remain subsequent milestones.

Design and implementation scope are recorded in `docs/superpowers/`.
