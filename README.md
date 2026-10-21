# Meridian — Graphite US Macro Workspace

A working frontend foundation for the selected compact Graphite design. Includes Overview, Labor Market, Indicator Detail, Calendar, and Explore Data.

**All observations, histories, revisions, yield curves, and release dates are synthetic. No live data feeds are connected.**

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

## Working features

- Connected five-page navigation, deep links, browser back/forward, refresh, F1–F5 shortcuts, and Ctrl/Cmd+K search.
- Twelve representative indicators with numeric observations, definitions, source context, frequency, adjustment, observation period, and publication date.
- Indicator level/change controls, six/twelve-observation ranges, exact-value pointer and keyboard chart readouts, and data/methodology/revision tabs.
- Browser watchlists and appearance/density preferences. Saving falls back to session state with an explicit message if browser storage is unavailable.
- Calendar day/topic/watchlist filters, release previews, separate actual/prior/revised values, and explicitly unavailable consensus.
- Catalog name/code/agency search, aliases such as “jobs”, composed filters, and up to four comparison series.
- Native-unit comparison panels; optional indexing at an explicit shared nonzero baseline. No automatic frequency aggregation, interpolation, or filling.
- CSV downloads with the displayed observations, units, source, publication dates, transformations, and synthetic-data status.

## Source map

| File | Responsibility |
| --- | --- |
| `src/data.js` | Synthetic provider boundary: series, publications, revisions, releases, curve |
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

```powershell
npm test
npm run build
node scripts/check-build.mjs
git add .
git commit -m "Describe the change"
git push
```

## Verification

The Node tests cover data contracts, real observation dates, missing data, pp/bp changes, indexing, CSV escaping/metadata, filtering, page states, validated deep links, storage errors, and local HTTP asset boundaries. Browser QA covers all five pages, save/reload, keyboard charts, search, filters, comparison, CSV actions, back/forward, skip links, and narrow layouts.

In restricted environments the server test needs permission to connect to loopback; an `EACCES 127.0.0.1` failure indicates an environment restriction, not a failed assertion.

## Next development milestone

Connect a small verified set of official Treasury/BLS/BEA observations through a server-side ingestion layer. Preserve raw responses, retrieval timestamps, publication snapshots, revisions, source definitions, and refresh failures. Replace sample releases with verified agency schedules. Persistent multi-device workspaces, accounts, alerts, broader coverage, and deployment follow after that data foundation.

Design and implementation scope are recorded in `docs/superpowers/`.
