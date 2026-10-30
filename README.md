# Meridian

A compact US macroeconomic and Treasury research workspace with Light and Graphite themes.
Explore official observations, compare histories, follow indicators and save reproducible research snapshots.

[Open Meridian](https://vasuki8.github.io/us-treasury/#/overview)

The browser reads retained official captures. It does not stream live market quotes or call agency APIs.
Observation periods, scheduled releases, confirmed publication dates and retrieval times remain distinct.
Missing observations stay missing; a successful retrieval does not prove a new publication.

## Project counts

[Generated registry counts](docs/registry-counts.md) report measurements, source IDs and page types.
The counts come from the measurement and routing registries, including unavailable measurements.
Source IDs identify collector scopes, not distinct publishing institutions; an indicator route counts as one page type.

```powershell
node scripts/update-registry-counts.mjs
node scripts/update-registry-counts.mjs --check
```

Run the generator after changing a registry. Check mode reports stale or missing output without rewriting it.

## Run locally

Requires Node.js 22.2 or newer and npm. Install the locked PDF collector dependency; the browser uses native JavaScript modules.

```powershell
npm ci --ignore-scripts
npm start
```

Open [the local app](http://127.0.0.1:4173/). To choose another port:

```powershell
npm start -- --port 4174
```

## Test and build

```powershell
npm test
npm run build
node scripts/check-build.mjs
node server.mjs --dist --port 4174
```

The build creates `dist/` with individually content-hashed assets and on-demand source/history bundles.
Hash routes work on ordinary static hosts without rewrite rules. The local server binds to loopback and serves app assets only.

UI tests use a pinned small fixture through the test script's module loader. A dedicated retained-snapshot suite checks the full archive.
Characterization tests protect observation values, provenance, CSV bytes and portable research packages.
CI tests Node 22 and 24, and also runs the suite on two logical CPUs with a 2,048 MiB old-space cap and a ten-minute deadline.
To apply the inherited memory cap locally in PowerShell:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=2048'
npm test
Remove-Item Env:NODE_OPTIONS
```

Documentation checks:

```powershell
node scripts/update-registry-counts.mjs --check
node scripts/check-doc-links.mjs
```

The link check covers tracked Markdown, including local files, images and heading anchors.
Server tests require access to local loopback connections.

## Refresh data

```powershell
npm run data:refresh
npm run data:refresh -- --sources=treasury
node scripts/check-refresh-due.mjs
```

Refresh commands collect and validate official data, append immutable captures and atomically replace the compressed current snapshot.
A failed source retains its last verified readings and original retrieval time with a visible cached/error state; other sources can succeed.
Use `--require-all` to require every selected source to succeed before replacement.
The production workflow applies its separately reviewed `--allow-cached-bls` retention policy.
Do not hand-edit snapshot values or immutable captures.

Primary feeds are keyless. The optional registered BLS backup reads `BLS_API_KEY` only in the Node collector.
Keep the key in the private environment or repository secret, outside source files and browser code.
See the [BLS source review](docs/sources/bls-registered-backup-source-review.md),
[release operations](docs/release-journey.md) and [data reuse policy](docs/data-sources.md) for scope and failure behavior.

## Deploy

[The Actions workflow](.github/workflows/ci.yml) verifies the selected commit and deploys its tested `dist/` artifact from `main`.
Pull requests run verification without deployment. Both Node verification jobs and the constrained test job gate deployment.
`DEPLOY_TARGET=cloudflare` selects Workers Static Assets; otherwise the workflow uses GitHub Pages.
[Cloudflare setup and verification](docs/cloudflare-deployment.md) describe the account configuration and exact-asset checks.

The workflow's daily refresh and supported post-release checks are best effort; a schedule is not evidence that a run completed.
A manual `main` run with `refresh_data` enabled requests collection before verification and publication.
With it disabled, the workflow uses the committed snapshot. Inspect the actual Actions results before claiming a refresh or deployment succeeded.
A local build or successful PR check does not publish the website.

For a content rollback, revert the unwanted commit, run verification and submit the revert through the normal review/deployment path.
Preserve immutable captures and original retrieval evidence.

## Architecture map

| Area | Responsibility |
| --- | --- |
| [Measurement registry](src/registry.js) and family registries | Measurement identities, units, source scopes and calculation metadata |
| [Page registry](src/page-registry.js) and [router](src/router.js) | Registered paths and validated hash-route state |
| [App](src/app.js), [pages](src/pages.js), page modules and [styles](styles.css) | Navigation, rendering, charts and Light/Graphite layouts |
| [Current snapshot](src/official-snapshot.json.gz) and [Node adapter](src/official-snapshot.js) | Compressed canonical current data and the retained-storage index |
| [Immutable history](src/history/) and [storage helpers](scripts/snapshot-storage.mjs) | Content-addressed captures and browser data projections |
| [Source controller](src/source-controller.js), source/history loaders | Complete history on demand, cached requests, loading/error/retry states |
| Publication archives and [publication controller](src/publication-controller.js) | Separately reviewed release evidence, independent of current revised histories |
| [Research packages](src/research-packages.js) and [library](src/research-library.js) | Recorded inputs, methods, source evidence and browser-local research storage |
| [Refresh command](scripts/refresh-data.mjs), collectors and policy modules | Collection, admission, provenance and failure retention |
| [Build](scripts/build.mjs) and [smoke check](scripts/check-build.mjs) | Static asset packaging, size budgets and local HTTP verification |

The eager browser projection contains current readings and short windows. Longer histories load when the selected analysis or export needs them.
Newly captured historical observations retain their actual acquisition clocks; they are not reconstructed first-release vintages.

## Data policy and source evidence

[Commercial data reuse policy](docs/data-sources.md) defines the admitted scope.
The [source review index](docs/sources/README.md) links the canonical dataset reviews;
the [research source ledger](docs/research-dashboard-sources.md) maps admissions to collectors and measurements.
Keep official attribution, rights notices, precision, missingness and provenance in displays, CSV and saved packages.
Review new datasets or expanded use before connecting them; New York Fed permissions are conditional, not a blanket public-domain claim.

## Documentation

- [Source reviews](docs/sources/README.md): commercial-use evidence, measurement definitions and source limitations.
- [Archived plans, designs and verification records](docs/archive/): historical decisions and acceptance evidence.
- [Retained-history and replay contract](docs/vintages-design.md).
- [Research storage](docs/research-storage.md) and [portable settings](docs/research-settings.md).
- [Release operations and limitations](docs/release-journey.md).
- [Review screenshots](docs/reviews/phase-5/index.md).

Archived records describe the implementation and source coverage at their recorded dates. Use the active policy and registries for current scope.
