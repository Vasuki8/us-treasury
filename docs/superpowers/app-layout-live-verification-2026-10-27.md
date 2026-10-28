# Remaining app page layouts — live verification

Merged and published on 27 October 2026 local time (28 October UTC).

## Release identity
- Reviewed implementation: 95281f0e3853435ca759f1f1d1189a2612338151, codex/app-page-layouts.
- Main merge: ae403d6636eb5a84ae75bff916b922b73a0835f0. Its tree exactly matches the reviewed branch; protected snapshot/model/router/controller/export/package files are unchanged from its first parent.
- GitHub Actions [run 126](https://github.com/Vasuki8/us-treasury/actions/runs/40615647767), workflow_dispatch on the exact merge head, completed successfully.
- Manual refresh_data=false and check_sources=false. Refresh jobs skipped; read-only publication upkeep succeeded. No feeds or numerical snapshot were refreshed.
- GitHub Pages job 122582570769 succeeded at 2026-10-28T01:49:27Z. [Live app](https://vasuki8.github.io/us-treasury/).

## CI and exact public artifact
- Node 22.23.3: 1,919 tests passed, zero failed/skipped/cancelled; 930.7 seconds.
- Node 24.22.1: 1,919 tests passed, zero failed/skipped/cancelled; 510.8 seconds.
- Both production builds and 163-asset smoke checks passed.
- Published Node 24 artifact: meridian-static-node-24, ID 12785556277, 8,162,374 bytes. Archive SHA-256 768e8584d4890024a865ffef35fc592c2daf07f1446d6ab454c12191a15ea1b4 was verified against GitHub metadata before extraction.
- Public assets/a53fb556e9852f30. verifyLiveBuild compared the deployed index and all 163 referenced assets, including lazy histories, byte-for-byte with the extracted Linux CI artifact. All boundaries, redirects and MIME checks passed; exit 0.
- No competing deployment was observed. Remote main matched the merge head before the documentation record was added. Cloudflare deployment was skipped, preserving the existing host.

## Live page coverage
430 live observations covered all 43 route variants at 320/390/736/1024/1440 pixels in Light and Graphite. Comfortable density was used at 320px and Compact at the other widths. Coverage includes all 18 page types (the 17 updated types and protected Fiscal reference), four External sections, Indicator tabs, Explore modes, Calendar scopes, all Research views, GDP matrix and all seven publication measurements.

Every observation used the new asset directory. There were no missing headings, page/main overflow, clipped headline values, duplicate IDs or unresolved archive-loading states. Critical External and Captured-history fixes were rechecked on the public site. At 320px, timestamps retain nowrap and complete words, with a 145px timestamp column and local table scrolling inside the page. Three live screenshots received an independent visual recheck with no remaining material findings in the shown areas.

## Live interaction checks
- Historical curve date selection and ArrowLeft update exact tenor readouts; the actual CSV download retains both selected dates and input provenance.
- Mobile Save exposes Save view, Freeze result and Saved research within 320px (left 8px, right 296.7px).
- Refinancing horizon/shock controls retain explicit modeled results and URL state.
- External Summary orders native accounting, focused history and ratio context. Detail navigation and contextual return preserve its open evidence section; its original disclosure state was restored afterward.
- Native comparison keyboard controls update both exact-date readouts with separate native units.
- Browser warning/error logs were empty after these checks. Public saved research records were not created or modified.

The live snapshot assembly time remained 2026-10-27T17:57:53.837Z, matching the pre-release observation. Original Light/Compact settings and selected comparison measurements were restored. The public Rates and curves page was left open at the browser's default viewport.

## Evidence and limits
CI metadata, authenticated ZIP, extracted artifact, byte-check log, live matrix, interactions, screenshots and independent visual addendum are retained in output/app-layout-deployment. Screenshots also reside in the chat's app-layout-live visualization directory.

Viewport and keyboard checks are not physical-device, touch-gesture, screen-reader or measured-contrast testing. The scope and source limitations of the original datasets remain intact.
