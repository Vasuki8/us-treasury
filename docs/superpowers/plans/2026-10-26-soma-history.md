# SOMA Treasury history delivery plan

**Goal:** Extend the existing SOMA Treasury-only history with explicit missingness and unchanged UI/colors.

**Spec:** `docs/superpowers/specs/2026-10-26-soma-history.md`.

**Architecture:** Keep the existing official summary endpoint, numerical-feed observation receipts and immutable captures. Add nullable, qualified FRN handling in the ownership adapter; reuse existing nullable catalog, chart and export behavior. Scope only the supplementary frozen CSV while retaining complete inputs.

**Constraints:** No new dependency, provider, credential, layout, color, source splice, observed zero or invented date/publication time. Preserve Z.1, SOMA rights and all existing size/admission limits.

**Review focus:** Exact empty string versus invalid/missing FRN; January 31, 2014 boundary and post-issuance gaps; malformed old rows no longer hidden by truncation; full-source prior-week lookback before export slicing; old capture/package immutability and portable size.

- [x] Inspect official summary/schema, Treasury issuance evidence and existing source/CSV/pin paths; preserve genuine baseline exports and evaluate full-history package sizes.
- [x] Source TDD: replace the 104-row retention assertion with full native retention; cover pre-issuance null/qualified exclusion, post-issuance unavailable totals, numeric zero, invalid inputs, old-row validation, dates and observation receipts/footnotes. Implement only the adapter and metadata changes necessary.
- [x] Export/pin TDD: add optional positive `somaPeriods`, full-source lookback and explicit 104-week supplementary scope. Test complete inputs, full CSV, gaps, rights, old round trips and unchanged caps/page HTML.
- [ ] Independently review the implementation; run affected/full tests. Capture through strict ownership-only CLI, verify all official dates/components/calculations, Z.1/current overlap and complete original 183-capture prefix.
- [ ] Build and verify both supported runtimes, all source diagnostics and live assets/browser behavior. Record evidence, publish and synchronize primary checkout.
