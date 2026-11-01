# Exact Stitch UI Implementation Plan

> **For agentic workers:** The user selected the existing Stitch screens as the design and explicitly chose exact design with real data. Implement on the existing PR #30 branch; do not merge or deploy.

**Goal:** Replace the remaining adapted UI with the actual Stitch screen composition, typography, navigation, labels and content slots, populated by retained real data.

**Architecture:** Rebuild page templates against the retained Stitch HTML and use one local visual layer with the same tokens and fonts. Keep existing models, routes, history, chart interactions, research persistence and collection safeguards. Match unsupported mock metrics with clearly labeled coverage states in their original structural slots.

**Tech Stack:** Existing native JavaScript/CSS/SVG and Node pipeline, locally hosted official Inter, JetBrains Mono and Material Symbols fonts. No new runtime package dependency.

**Reference:** https://stitch.withgoogle.com/projects/7931842367557945060 and output/stitch-latest. Calendar/Explore use their earlier explicit Stitch screens with the current shared visual system; the current project contains no replacement screen for those routes.

## Constraints and decisions

- User choice: exact design with real data, not mock figures or invented services.
- Keep all routes, native units, reference periods, exports, comparison/return state, frozen evidence, warnings and mobile accessibility.
- Keep source/history bytes, refresh workflows, registry and the strict 20 MiB per-asset limit unchanged.
- The new instruction overrides the former blanket 13px CSS minimum for metadata. Match the reference's 10/11/12px tags/metadata/tables while retaining 13/14px body copy and 44px phone touch targets.
- Source legal notices stay reachable in a compact disclosure; critical refresh/coverage warnings remain visible.
- Sidebar 210px, fixed utility header 44px, flat navigation families, Inter typography, JetBrains Mono figures and local Material Symbols icons.
- Do not promise exact values, cloud accounts, live feeds, authorized-only access, original payroll vintages, market consensus or API endpoints absent from the retained application.

## Tasks

- [x] Shared shell: self-host fonts with content hashes/CSP, same navigation labels/icons, toolbar controls, local research menu and compact collection status.
- [x] Overview: exact section order and card structure, full factual brief, four compact cards, two-thirds charts/one-third agenda, feed grid, cross-check cards, four monitor tiles and three-column provenance.
- [x] Labor/indicator: exact briefing/reading strips, chart-context proportions, catalog/query/methodology structures, correct real-data alternatives for unsupported slots.
- [x] Specialist desks: align auction, ownership, funding and yields structures to their corresponding Stitch screens; retain real source distinctions and coverage.
- [x] Calendar/Explore and remaining routes: carry the exact shared typography/panels/controls through existing retained page recipes, preserving all functionality.
- [x] Verify font delivery/admission, exact source data and actions, focused/full tests, production build/asset checks, desktop/mobile in both themes, then independent review.
- Delivery: update existing PR #30 and stop without merging or deploying.

## Review focus

- Do not let screenshot sample prose imply unsupported causal conclusions or publication verification.
- Every card's units/reference period/source status must remain correct as its value changes or disappears.
- Header status, density, search and navigation must fit laptops and phones without clipping or losing warnings.
- Font URLs must remain local and hashed after building, including the licenses; no runtime CDN requests.
- Local research actions and CSV exports must perform the actual action their label promises.

## Source mapping

- Overview 00fcb083b23a472f8c24f9612512908a; Labor 83ddaa8fedaa4fd891fd857b7bc6f312.
- Payroll 89877c4b90554b4081948d9b2825f8b5; CPI ff230763399d44d4a988b862fa0d8441; unemployment, AHE, ECI, productivity, ULC and PCE references retained by their screen IDs.
- Auctions 58206cb9cc0c4a568331d69874906d77; ownership 8ac57fc4a42842e1a227d877eb6ac47e; funding ce5485da441549be866d17656ae9f039; breakevens fa31920d2cb34054ae19570b28a8adf9.
- Earlier Calendar/Explore reference HTML retained as calendar-reference.html and explore-reference.html.

## Verification and review

- Final full suite: 2,421 tests passed, zero failures/skips. Subsequent Overview spacing checks: 26 passed; mobile/navigation controls: 25 passed. The final funding strip retains the original compact precision and exact CSV contract; its focused 32-test set passes.
- Source/history bytes, registry, collection workflows and strict 20 MiB asset limit are unchanged. Font files and their licenses use local content hashes; CSP remains self-only.
- Desktop/mobile screenshot inspection covers Overview, Labor, payroll detail, Calendar and Explore in Light/Graphite at 1280/390px. The final 40-case browser matrix covers all five at 320/390/801/1280px in both themes, with no body or toolbar overflow and no hidden source status. The 210px desktop rail, 44px toolbar and local table scrollers remain available; outer paint overflow is clipped at the document edge.
- Final production build and strict asset smoke check passed for 234 served assets, including all source history bundles and local fonts. Built JavaScript and font-rewritten CSS were compared to the final worktree.
- Fully loaded auction, ownership, funding and yield desks were inspected separately. Initial loading placeholders were excluded from the verified desk screenshots.
- Verified COMF/DENSE persistence, the local research menu, the real named Save form, and 32-source refresh details on phones. Narrow popovers use the actual viewport content width. Browser warning/error log was empty.
- Independent review found and resolved Calendar empty-day anchoring, mobile source-warning visibility, the missing Overview Save form, and omitted frozen diagnostic values. Sentinel/roundtrip tests retain inventories, weekly hours, TTM interest, private demand and exact core-PCE momentum inputs independently of chart controls. Freezing loads complete contribution evidence before capture.
- Real data intentionally replaces sample dates/figures and unsupported claims. Consensus, WI pricing, market-depth feeds, original payroll/PCE vintages, API/SDK access, cloud accounts and certification are explicitly unavailable where absent. Calendar/Explore follow their retained earlier references with the latest shared visual system.
- Screenshots and browser QA results are retained locally under output/stitch-exact-fidelity; reference downloads and logs remain outside the commit.
