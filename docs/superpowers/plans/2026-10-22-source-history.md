# Source-specific revision history implementation plan

**Goal:** History views fetch only source archives needed for the selected registered series, retaining every immutable capture, replay value, timestamp, source notice and CSV value.

**Scope:** Extend the existing storage projection and lazy loader. Keep Graphite, canonical current data, the ordered storage index, immutable capture files, source admissions and deployment conventions. No new sources, dependencies, credentials or infrastructure. The user's continued-development and test/push instructions authorize this milestone without another design approval cycle. Keep unrelated exports/ untouched.

## Design and contracts

- Canonical `src/history/` and `src/official-snapshot.js` stay unchanged. Only public derived bundles change.
- Public `historyArchive` becomes version 2: `{version:2,captureCount,latestCaptureAt,sources:{[sourceId]:{captureCount,latestCaptureAt,seriesIds,compressed,fallback}}}`. Resource descriptors retain `{url,sha256,bytes}` and `./history-<sha>.json[.gz]` naming. `seriesIds` includes every historical series key and removed-series tombstone, so series moved between sources load all relevant sources.
- Each public source bundle contains `{version:1,sourceId,captureIndexes,captures}`. `captures` retains exact original objects in source order; `captureIndexes` retains their positions in the canonical global capture array. These positions are inside lazy bundles rather than the initial module. Validate source identity, counts, timestamps, historical series mapping, index range/uniqueness, hashes and bounded bytes before replay. Merge selected sources in original global order; never expose an incomplete group as ready.
- Keep the global latest capture as the default UTC cutoff across source changes, preserving existing displayed/export cutoff behavior. Explicit user cutoffs and route state remain authoritative.
- Loader interface: `getState(seriesId='gdp')`, `load(seriesId='gdp',{retry=false})`, `revisions(seriesId)`. A ready state includes the selected merged v1 history, `sourceIds` and global `latestCaptureAt`. Cache/in-flight/error/retry are independent per source; share source requests across series. A series with no retained source mapping has a verified empty history without fetching unrelated archives.
- Controller exports `historySeriesId(route)` to select default GDP for vintages or the indicator series. Track pending work per selected series; switching series may start a different request immediately. Completion only repaints the currently selected series, including two series sharing an in-flight source. App retry and CSV use controller context rather than global loader state.
- History page labels selected-source scope. Initial controls and CSV use the global cutoff. Do not imply the selected bundle contains all source provenance. Ordinary routes still request no history.

## Tasks

- [x] Projection and integrity: regression-first per-source assets, complete historical mapping and exact merge order; audit original captures, all boundary cutoffs, revision histories and CSVs. Preserve strict full historical admission before projection.
- [x] Loader: regression-first source isolation, shared requests, concurrent source changes, historical multiple-source series, mismatch/corruption and explicit independent retry; preserve bounded gzip/JSON fallback and integrity checks.
- [x] Controller/UI: source-aware loading/export/retry, same-source and different-source route races, focus and cutoff preservation; adapted existing page tests and explicit scope text.
- [x] Integration: dev/static/live asset verification follows every source variant; measure selected source payloads, prove canonical bytes unchanged. Full tests/build, desktop/mobile/keyboard and CSV/error checks, independent review.
- [ ] Delivery: explicit commit/push to us-treasury main; verify Actions, exact live assets and representative live history views before claiming live.

## Acceptance evidence

Record implementation results after testing. Previous milestone baseline: 25 captures, 12 historical source groups, 48 registered series, 114,047-byte combined gzip archive. No source rights or data coverage change is involved.

Local acceptance: 586/586 full-suite tests passed, and build smoke followed 59 assets including 24 source bundle variants. Audit confirmed exact merge of all 25 captures, 50 global and 600 source cutoff replays, 48 revision histories and 260 source CSV comparisons. Original full-snapshot baseline also matched all captures, 50 cutoffs, 48 revisions and 48 CSVs. All 26 canonical files matched committed bytes exactly; the root SHA256 remained `87c88e9b24a3146f265eedac02e66dde4449893f8dc8c15fcdc0c64986da91a8`.

Browser QA observed zero archive requests on Overview. Selecting GDP fetched only BEA (2,088 gzip bytes); a deliberate BLS 503 disabled that selection's export while BEA remained ready. Keyboard retry restored cutoff focus; CPI reused the successful BLS bundle (3,785 bytes) without another request. Exactly three source requests occurred: BEA once, BLS failure plus retry. Downloaded source-only CPI CSV matched the complete canonical archive export at the global cutoff. Desktop 1440 and mobile 390 viewports had no page overflow. Independent review found no actionable issue and separately checked all 48 registry selections, with 12 total source fetches and matching histories/revisions/CSV.

Current module 3,238,735 bytes, 6,088 above the previous descriptor. All source gzip bundles total 114,839 bytes versus 114,047 combined; requesting one source saves transfer while requesting every source has slight compression overhead. A whole source is still fetched on first use. Delivery status and exact live verification are reported in the task after publication.
