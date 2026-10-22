# GDP revision explanations and appearance buttons

**Goal:** Add official BEA revision evidence beside the selected GDP publication history and replace the appearance switch with the supplied Light/Dark button design.

**Architecture:** Keep the 1,076 admitted publication facts unchanged. Store reviewed, dated BEA explanations separately, load them only with publication history, match by publication identity and reference quarter, and freeze relevant evidence and a separate CSV in new pinned packages. Existing publication CSVs and old packages remain compatible. Retain the existing Light/Graphite preferences and Graphite tokens.

**Sources:** BEA-authored dated GDP news releases and their technical notes; scoped commercial display/export under https://www.bea.gov/help/faq/147 with BEA attribution and citation guidance. Exact endpoints, date coverage, retrieved hashes and exclusions are documented in the source review before admission. No inferred explanations, paid sources, credentials or infrastructure.

## Acceptance and implementation

- [x] Review exact official releases and reuse terms. Capture bounded, immutable explanation records with explicit routine-revision versus annual-update scope, source sections and retrieval provenance. Test admission, mismatch, missing and duplicate evidence.
- [x] Add a lazy explanation loader; failures leave numerical history usable and expose an explicit retry. Test demand loading, caching and error recovery.
- [x] Render evidence beside publications with reference quarter, stage, release/retrieval dates, source attribution and limitations. Respect the selected publication cutoff; no later explanations leak into earlier views. Test exact joins and missing evidence.
- [x] Add a separately scoped explanation CSV and freeze the reviewed explanations and original CSV with new publication pins. Preserve the existing publication CSV and all old packages. Test exports, import/roundtrip, cutoff and mutation isolation.
- [x] Replace the checkbox with a native outlined sun/moon button labelled Light/Dark, retaining stored preferences, visible focus and mobile touch size. Test native activation, persistence and storage fallback.
- [x] Run the full suite, production build and HTTP asset checks. Exercise desktop/mobile, keyboard controls, both themes, missing/loading/error states, publication selection and frozen evidence locally. Verify all old publication records and statistical captures remain byte-equivalent as data.
- [ ] Review the final patch, push to the existing main/deployment convention, verify Actions and representative public pages before reporting live.

## Review focus

Revision contributors are not growth contributors. Annual-update context is not a quarter-specific attribution. Unchanged rounded growth can still have revised components. A publication date does not prove a publication instant; retrieval is a separate event. Explanations unavailable for older releases must never be fabricated. Existing cached BLS calendar behavior remains in place.

## Local verification, October 22, 2026

- Final complete suite: 809 tests passed, zero failures. Production build and local HTTP traversal: 90 assets, including lazy numerical/narrative modules and all source-history bundles.
- Actual collector captured ten explanations from nine exact BEA release pages at 19:00:11.734–19:00:11.781 UTC. Repeating the complete capture made no requests or file changes. Build requires complete source admission.
- Deep equality preserved all 1,076 publication records and the statistical snapshot. Thirteen historical quarter/cutoff pin contexts and numerical CSVs match the prior implementation exactly; thirteen old package roundtrips preserved original JSON.
- Browser checks: exact quarter/cutoff filtering, the rounded 1.5% revision, Q1 annual scope, 2002 missing explanation, readable frozen evidence and its original CSV actions; Light/Dark native Enter/Space, focus and persistence. No normal-page console warnings/errors.
- Active-tab widths 320/390/736/1024/1440 px: no document overflow; 50 px appearance button and 44 px phone quarter/date controls. Existing mobile watchlist remains accessible.
- An isolated local proxy returned one real HTTP503 for the explanation module: numerical history remained visible. Initial same-URL retry reproduced browser module-failure caching; explicit retries now use fresh attempt URLs, and the browser recovered without a reload. Loading/error/retry and unavailable data are also covered by unit/app tests.
- Two independent reviews found and verified the fix for malformed optional imported-package text. Source semantics, attribution, immutable capture and integration have no remaining reported findings.

Coverage remains ten selected explanations, not explanations for every publication since 2002. Further releases or corrected summaries require separate review and an immutable identity/version strategy. The committed deployment is checked separately after pushing before any live claim.
