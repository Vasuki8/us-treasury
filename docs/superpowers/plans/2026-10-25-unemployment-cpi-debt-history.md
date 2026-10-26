# Unemployment, CPI and federal debt history

**Goal:** Extend existing official unemployment, CPI and federal debt histories without changing the UI, colors, providers or credentials.

**Approach:** Gross debt starts April 1993; preserve actual missing/sparse early composition. Bootstrap the five existing unemployment/CPI native series through bounded registered BLS requests, using a year of overlapping context and checking raw overlap before stitching. Daily updates retain older verified history and use the first requested year as calculation context, replacing subsequent years. An exceptional historical mismatch triggers a new registered backfill. Keep the current fresh-window registered health checker unchanged.

**Constraints:** Preserve original archives, actual retrieval receipts, unknown publication dates, native units, sparse/null observations and strict momentum admission. No fabricated pre-1948 monthly unemployment, interpolation, annual-to-monthly conversion, reannualization or mixed-input-vintage calculation. Existing UI and saved-analysis size limits stay unchanged.

- [x] Verify historical availability, registered API limits and the sparse early debt breakdown against official sources.
- [x] Extend both gross/public debt collectors together; reject incomplete single-page captures and preserve the existing accounting quarantine.
- [x] Add tested BLS bootstrap/retention collector for unemployment and four existing CPI indexes, including the existing CPI growth/momentum outputs. Preserve both current v1 and registered fallback routes and their private-key checks.
- [x] Wire the collector into automatic refresh; document methods, exact starts, source receipt selection and failure behavior.
- [ ] Capture debt locally and run the registered bootstrap through the existing trusted GitHub refresh step. Verify actual native starts, chunk seams, route transitions, archive prefix, unchanged measurement scope and no history shrinkage.
- [ ] Verify full tests, exports, saved research, build and live assets; obtain independent economic and engineering review; deploy through the existing main/Pages workflow.

**Practical bounds:** The registered BLS secret stays in GitHub's trusted collection step. An initial historical capture uses approximately six overlapping registered requests; regular updates keep the existing one fresh-family request (plus its existing backup if needed). Debt currently has 8,419 records below the reviewed 10,000-row cap; future oversize or incomplete responses fail visibly rather than publish a partial history.
