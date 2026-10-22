# Snapshot loading implementation plan

> **For agentic workers:** Use coordinated independent tasks, regression-first implementation and one final independent review.

**Goal:** Reduce ordinary startup and archive growth without losing any immutable capture fact.

**Architecture:** Immutable per-capture gzip files plus one atomic current/index root; compact generated current module and versioned lazy history bundles. Keep replay and source admission semantics.

**Tech stack:** Existing Node 22.2+/24, native ES modules, static hosting, built-in zlib, fetch/Web Crypto and native decompression with JSON fallback. No packages.

**Spec:** [snapshot-loading-design](../specs/2026-10-22-snapshot-loading-design.md)

## Global constraints

- Preserve all 25 existing captures, ordering, timestamps, original terms/provenance and reference values; no pruning or recapturing history.
- Existing single-commit deployment, exact-byte verification and cached-BLS policy remain authoritative.
- Do not stage exports/ or introduce new services/credentials.

## Tasks

- [x] Storage helper and regression tests: loadSnapshotHistory(snapshot,{directory}), writeStoredSnapshot(fullSnapshot,{destination,previous}), snapshotModule(snapshot), browserSnapshotAssets(fullSnapshot). Root uses directory src/. Index property vintageArchive version1/captures; each entry path history/<sha256>.json.gz plus sha256/contentSha256/bytes/contentBytes/sourceId/capturedAt/recordedAt/baseline. Original inline history remains supported for migration. Public descriptor historyArchive has compressed and fallback {url,sha256,bytes}, captureCount/latestCaptureAt. Public bundle filenames history-<sha>.json[.gz] relative to src/ module.
- [x] Refresh/build/dev integration: hydrate before refresh/admission, write immutable files before root, project current module and lazy bundles, extend public allowlists and MIME types. Prove equality and no archived startup payload.
- [x] Publication: stage only snapshot root + newly referenced gzip files, reject any existing archive edits/deletions/index prefix changes or dangling/unadmitted content, keep Git race safeguards. Verify isolated local Git tests.
- [x] Browser loader/UI: one explicit lazy state machine, gzip/fallback integrity, per-selected-series memoization, loading/error/retry, focus/navigation races and disabled/caught CSV. Remove eager 48-series scans. Test with injected loaders and stable controls.
- [x] Migration/equivalence/performance: preserve baseline evidence under ignored test-results, migrate actual data through helper, compare captures/cutoffs/revisions/CSV, simulate unchanged append and measure artifact sizes.
- [ ] Full regression, local HTTP, desktop/mobile/keyboard and errors; independent final review. Commit/push explicit files, verify Actions/exact assets and representative live views. Record remaining limits.

## Review focus

1. Failed blob write must not change the root; corrupted prior files must stop build/publication.
2. Unchanged confirmations, removed metadata/coverage and nulls must remain exact across storage/replay.
3. Lazy resource failure must never look like a successful empty archive; retry/navigation must preserve focus/state.
4. New blobs cannot be omitted from a commit or permit unrelated files/old blob edits.
5. Both compressed and fallback assets must stay inside the same versioned subpath and pass exact-byte verification.

## Evidence

Baseline inspection and measurements recorded in the spec. Implementation/test results follow.

Local evidence: 551/551 full-suite tests passed, plus 15/15 focused storage/delivery checks after the final public-bundle size guard. Audit retained all 25 captures exactly, checked 50 boundary cutoffs, 48 revision histories and 48 CSV exports. Browser QA observed zero archive requests on Overview; deliberate 503 disabled export; keyboard retry restored the cutoff focus, enabled export and produced an exact CSV. Later history navigation reused the archive. Desktop/mobile checks had no page overflow. Current module 3,232,647 bytes versus 15,047,274; lazy gzip 114,047 bytes. An unchanged 12-source simulation added 7,874 compressed capture bytes without altering retained files. Production build smoke covers 37 assets and both archive variants. Independent review and delivery verification are recorded in the task report after publication.
