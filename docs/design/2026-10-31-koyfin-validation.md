# Koyfin design validation

The chosen layout is implemented in the native Meridian app. Both themes and all existing destinations remain available.

## Changes

- Grouped topic sidebar, compact research navigation and consistent panel spacing across the site.
- Four Overview headline cards followed by linked trend, inflation, macro monitor and upcoming-release panels.
- Separate catalog preview, with comparison selection and saved research left intact.
- Indicator history and observations alongside reading/source context; consistent Labor and Calendar panels.
- Softer neutral surfaces, system typography, tabular readings and short transitions that respect reduced motion.
- Valid empty calendar dates remain selected; unknown event identities and impossible dates remain rejected.

## Evidence

- Full suite: `npm test` — 2,352 passed, zero failures, zero skips.
- Build: `npm run build` — passed.
- Strict build verification: `STRICT_ASSET_SIZE=1 node scripts/check-build.mjs` — passed, 225 assets.
- Build hashes match the changed working-source modules and stylesheet.
- Browser matrix: 26 destinations × 4 widths (320, 390, 1024, 1440) × 2 themes = 208 passed.
- No document overflow, oversized panels, missing visible charts or browser errors in that matrix.
- Preview selection, unchanged comparison membership, full-history links, mobile preview return and More navigation passed.
- 200% CSS zoom reflow passed on Overview, Indicator, Calendar and Explore; native browser/OS zoom was not audited.
- Reduced motion suppresses the preview transition. Existing contrast tests pass for both themes and essential chart marks.
- One independent review identified currency scale and filtered-opener focus issues; both were reproduced and fixed.

## Review files

- `output/koyfin-sitewide-2026-10-31/design-review.html` switches between the first five pages, themes and phone/desktop screenshots.
- `verification.json` records the complete browser matrix, interaction checks and zoom measurements.
- `verify.cjs` is the repeatable browser harness; it serves actual app assets through the native server handler without network access.
- The build's unchanged immutable snapshot projection supplies browser test data. No sample values replace official captures.

## Decisions and limits

- A dedicated local branch reuses the clean primary checkout; unrelated managed worktrees and existing artifacts were preserved.
- Small previews show up to 12 retained observations. Full history and date-window research remain in the established detail workflow.
- Visual changes use browser and contrast checks; new state/focus and date-filter behavior has regression coverage.
- The Today correction changes only view filtering. It does not create a release or relax source/publication admission.
- Browser security blocked automatically opening the local review file. The HTML and screenshots remain available for manual review.
- Nothing was pushed, merged or deployed. No data, source allowlist, stored-history format or scheduled workflow was changed.
