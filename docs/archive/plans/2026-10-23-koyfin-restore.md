# Koyfin layout restoration

> **For agentic workers:** Execute the presentation restoration in the current isolated checkout, with independent layout review and final browser verification.

**Goal:** Restore the compact Koyfin-inspired UI on Overview, Labor, Indicator, Calendar and Explore while retaining the current Light and Graphite colors.

**Architecture:** Keep current renderers, routing, data and research interactions. Replace the Radar presentation rules in `styles.css` with compact panel arrangements based on the retained Koyfin reference and pre-Radar base styles. The current cream/plum and aubergine/lime tokens remain byte-for-byte unchanged.

**Tech Stack:** Native ES modules, CSS, SVG charts, Node test runner, GitHub Pages.

**Spec:** User request: “revert back to koyfin inspired UI but keep current color theme”; reference `artifact-template-koyfin-graphite/references/design-system.md` and retained screenshots.

## Constraints and review focus

- Keep all 12 Overview readings and all 23 Labor measurements, exact history windows, CSV, source status, claims release distinctions and bounded workspace returns.
- Preserve existing calendar preview navigation, catalog selection, comparison and all missing/suppressed data semantics.
- Use compact bordered panels, approximately 20px page titles, mono numbers, 8–12px gaps and local table scrolling.
- At 320px, 390px, 736px and desktop widths: no page overflow or clipped chart/date labels; mobile inputs remain 16px and controls touch sized.
- The Comfortable preference must still visibly increase table row spacing. Both current palettes and theme persistence must work.

## Task 1: Restore presentation

- [x] Replace the Radar CSS tail in place, reusing base Koyfin components. Independently prepare Labor styles; integrate once to avoid overlapping stylesheet edits.
- [x] Inspect the five layouts in both themes and narrow/desktop widths; check empty states, long metadata, custom date controls and comparison mode.
- [x] Run existing page/workspace/action regression tests. This reversible CSS change does not need implementation-mirroring style tests.

## Task 2: Verify and publish

- [x] Obtain a fresh review of the final diff and address material findings.
- [x] Run the full existing suite, build and build smoke checks.
- [x] Publish through the existing GitHub Pages workflow and verify the live assets and visible layouts.

## Evidence

- Independent source review found no actionable regressions. Both page-level palette declarations are byte-for-byte unchanged. All source renderers and data are untouched.
- Browser matrix: six views (five pages plus comparison) at 1280, 1024, 736, 390 and 320px in Light and Graphite: 60 cases, no page overflow, clipped chart labels or date-input overflow. Desktop and mobile screenshots inspected; no captured browser warnings/errors.
- Mobile Calendar event selection focuses the named preview, positioned approximately 12px from the viewport top. Catalog search returns seven unemployment matches and fits at390px.
- Compact/Comfortable row height: Labor53.85/61.85px, Calendar51.73/57.73px, catalog100.13/108.13px. Visible spacing preference preserved.
- Static build and smoke checks pass:149 assets, including all source history bundles.
- Full existing suite passes:1,348 tests, zero failures/cancellations/skips (190243.6449ms, Node bounded concurrency2).
- Additional Comfortable checks:12 views at736/390/320px with no overflow or clipped chart/date controls. Save menu fits at320px (left8/right296.67).
- Published runtime commit:`833c89ddd02ba9933a3c1867266ecb1e8fe47428`. GitHub Actions run[40033264476](https://github.com/Vasuki8/us-treasury/actions/runs/40033264476) passed Node22, Node24 and GitHub Pages deployment; source refresh was not due and was skipped.
- `scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` passed:all149 live assets match the tested build byte for byte.
- Public browser check:all five pages in both themes at390/1280px (20 views), no page overflow or captured console warnings/errors. Returned to Overview and restored the initial Light preference.
