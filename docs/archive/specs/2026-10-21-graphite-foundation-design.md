# Meridian Graphite development foundation

The user selected the Graphite layout from the five-page design study and requested development. The audience is balanced across economists, traders, and researchers. Preserve the compact Graphite interface, lavender and teal charts, visible navigation, function-key shortcuts, thin panel dividers, and restrained numerical colors shown in `theme-graphite-overview.png` in the earlier planning chat.

## First milestone

Deliver a local, runnable application with five connected pages: Overview, Labor Market, Indicator Detail, Calendar, and Explore Data. Keep original design artifacts untouched. Navigation must support deep links, refresh, browser back/forward, ordinary-language search, and keyboard use. Watchlists and appearance preferences persist in this browser, with an honest fallback when storage is unavailable.

Use native JavaScript modules, CSS, SVG, and Node.js 22 or newer. No runtime dependencies, account system, remote publication, or external data requests are required for this milestone. Source modules separate the fixture provider, calculations, routing, chart renderer, page renderers, and app controller. A static build can later be served by any host.

## Data and calculations

All observations, histories, yield curves, revisions, and release dates in this milestone are explicitly synthetic. Persistent sample-data labeling must remain visible on every page and in CSV exports. Dates follow each series' actual frequency; quarterly GDP must never be labeled as a monthly series. Store observation period separately from publication date. Forecast consensus and actuals are distinct nullable fields. Missing observations remain missing.

Provide twelve representative series covering growth, inflation, labor, Treasury rates, and federal debt. Store numeric observations and metadata together and derive latest/prior/change labels from those observations. Charts use discrete observation readouts rather than inventing interpolated values. Period changes preserve units; changes in percentage measures use percentage points. Comparison defaults to separate native-unit panels, with an explicit rebasing option only when a common nonzero baseline exists. Never silently aggregate or fill different frequencies.

## Page behavior

- Overview: six headline measures, inflation/labor trends, sample Treasury curve, macro table, release watch.
- Labor: six measures, payroll and unemployment charts, a labor table, and links to comparisons/releases.
- Indicator: range and level/change controls, exact-value chart readouts, metadata/source links, data/methodology/revision sections, save/compare/export.
- Calendar: sample week, topic/day/watchlist filters, selectable release details, distinct actual/prior/revised fields, missing consensus, follow-series control.
- Explore: text/topic/frequency filters, series selection, native-unit comparison panels or explicit index rebasing, downloadable selected data.

Responsive layouts stack panels and keep table scrolling inside its container. Semantic headings, labeled inputs, focus indicators, keyboard navigation, chart text alternatives, real source links, and empty states are required. Preserve existing resize-loop fix by using responsive SVG view boxes without a redraw observer.

## Verification and follow-up

Use Node's test runner for data contracts, real transformations, CSV escaping, filtering, route parsing, and persistence failures. Inspect browser navigation, controls, watchlist restoration, comparisons, desktop/mobile layout, and console errors with the available browser tools. Build a self-contained `dist/` output.

Official ingestion, revision storage, verified agency schedules, server persistence, accounts, broad source coverage, and deployment remain subsequent milestones. Do not imply that this frontend foundation is the complete macroeconomic data platform.
