# Meridian — Graphite US Macro Workspace

A working frontend foundation for the selected compact Graphite design. Includes Overview, Labor Market, Indicator Detail, Calendar, and Explore Data.

Uses official Treasury, BLS and BEA observations captured by the data refresh command. The app serves a committed snapshot, with observation periods, source identifiers and actual retrieval times. It does not stream live market quotes.

## Commercial data reuse

The site is intended for advertising revenue. Only datasets reviewed for commercial display, derived use and downloadable redistribution may be connected. The current ten indicators and Treasury yield curve qualify under their published policies; see the [dataset rights review](docs/data-sources.md) for official evidence, scope and conditions.

The app credits the agencies, shows the required BLS disclaimer and retrieval date, and includes the disclaimer in exported BLS rows. Build and refresh commands reject data outside the reviewed dataset, identifier and feed scope in `scripts/data-policy.mjs`. Recheck terms before launch and when adding or changing a source. DOL/Census placeholders remain unavailable pending integration and rights review.

## Run locally

Requires Node.js 22 or newer. No dependency installation is needed.

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

Source documentation: [BLS API](https://www.bls.gov/developers/api_signature_v1.htm), [Treasury Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/), [Treasury yield data](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [BEA official flat files](https://apps.bea.gov/iTable/?reqid=19&step=4&isuri=1&1921=flatfiles&1903=3). BEA uses the keyless `NipaDataQ.txt` and `NipaDataM.txt` downloads; the exact series code is matched before values are accepted.

Historical publication timestamps are absent from these feeds and remain unknown. Source-file modification dates and retrieval times are never substituted for release dates. Source footnotes are retained. No historical initial estimates or revision ledger has yet been captured. CSV downloads include source URLs, identifiers, calculation inputs, retrieval timestamps and official/cached status; unknown publication dates are blank.

Claims and retail sales are DOL/Census measures outside this integration. Their former sample observations were removed; those series show unavailable. The calendar links to official BLS/BEA schedules and contains no invented dates, results, forecasts or revisions. The BLS calendar feed denied automated access in local verification, so schedule ingestion remains unavailable.

## Working features

- Connected five-page navigation, deep links, browser back/forward, refresh, F1–F5 shortcuts, and Ctrl/Cmd+K search.
- Ten official indicators and two explicitly unavailable DOL/Census measures, with definitions, source identifiers, units, adjustment, observation periods, retrieval times and source footnotes.
- Indicator level/change controls, six/twelve-observation ranges, exact-value pointer and keyboard chart readouts, and data/methodology/revision tabs.
- Browser watchlists and appearance/density preferences. Saving falls back to session state with an explicit message if browser storage is unavailable.
- Calendar navigation with official source schedule links and an honest empty state until a verified schedule feed is ingested.
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

## GitHub workflow

Continue development locally, then commit and push to [Vasuki8/us-treasury](https://github.com/Vasuki8/us-treasury).

The **Test and build** GitHub Actions workflow runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It tests Node 22 and 24, builds the app, checks that the built entry point and imported modules load over HTTP, and saves a static build artifact for each Node version. No dependencies need installing. This workflow does not deploy the site.

CI validates the committed snapshot and deterministic source-response fixtures. It does not call external agency feeds, avoiding rate limits and upstream outages during routine verification. Run the refresh command locally when updating data, then include the changed snapshot in the commit.

```powershell
npm test
npm run build
node scripts/check-build.mjs
git add .
git commit -m "Describe the change"
git push
```

## Verification

The Node tests cover official payload schemas, exact calendar comparisons, source identifiers, missing and duplicate observations, unit conversions, retrieval provenance, failed refresh retention, pp/bp changes, indexing, CSV escaping/metadata, filtering, page states, validated deep links, storage errors, and local HTTP asset boundaries. Browser QA covers all five pages, save/reload, keyboard charts, search, filters, comparison, CSV actions, back/forward, skip links, and narrow layouts.

In restricted environments the server test needs permission to connect to loopback; an `EACCES 127.0.0.1` failure indicates an environment restriction, not a failed assertion.

## Next development milestone

Capture historical publication snapshots and revisions, integrate verified agency schedules, and add DOL/Census observations. Persistent multi-device workspaces, accounts, alerts, broader coverage, and deployment remain subsequent milestones.

Design and implementation scope are recorded in `docs/superpowers/`.
