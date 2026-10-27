# Fiscal pressure reviewed-layout verification — 27 October 2026

Implemented the accepted design in the native app on codex/fiscal-pressure-layout. No feeds, data, calculation models, CSV contracts, package schemas or source rights changed.

## Delivered
- Five TTM readings share a native metric group, with units and calculated status; daily public debt has its own date and stock context.
- Source/basis qualifications replace the misleading opening What changed label. Critical seasonality, coverage, deficit-sign and interest definitions remain visible.
- Existing three-series chart and same-month year-over-year contributors lead the four compact nominal-GDP ratios.
- Full ratio formulas, exact input periods and independent retrievals remain in the stable fiscal:gdp-evidence disclosure. Existing monthly and methods disclosure identities remain unchanged.
- Native shared shell, theme/density controls, comparison, detail-return context, Save/Freeze and exports remain connected.

## Tests and build
- Focused baseline: 39 passed.
- New rendered-output tests observed failing before implementation; focused implementation suite: 44 passed.
- Complete suite: node --test --test-concurrency=2 tests/*.test.js — 1,892 passed, zero failed/skipped/cancelled; 991.9 seconds.
- The initial npm test invocation was interrupted because unrestricted parallel history checks were competing for memory. The same complete suite passed with two workers; no tests were excluded or weakened.
- Production build succeeded. node scripts/check-build.mjs passed all 163 assets, including lazy history bundles.

## Independent review and fix
One material finding: fiscal contributor notes and mobile GDP basis inherited the global table nowrap rule. Reproduced before fixing: at 320px, tables were 337.5px and 430.4px within 287px containers. Added fiscal-scoped wrapping for row headings/notes; numeric cells retain nowrap. Built-browser checks then showed both tables fitting at 320/390/736/1024/1440px in Light and Graphite, with no page overflow.
No other material implementation findings. Calculation/CSV/source/package modules were independently reviewed as unchanged.

## Actual-app browser checks
- Five TTM readings, separate dated stock, four ratios and native chart fit at all five widths in both themes.
- Monthly, GDP and debt-method evidence expanded at 320px in Comfortable density: no page overflow; five monthly rows retained; no duplicate IDs; no browser warnings/errors observed.
- New GDP disclosure stays open after indicator-detail navigation and contextual return to Fiscal.
- Chart ArrowLeft changes exact readout from September to August 2026 for all three series.
- Compare trends opens native-unit comparison with receipts, outlays and net interest.
- Actual fiscal, financing and GDP-ratio CSV downloads succeeded with their distinct schemas and provenance.
- Save view succeeded. Freeze result retained the existing four monthly primary measurements: receipts, outlays, net budget interest and primary deficit. The package used the existing session-only fallback, with an explicit durable-download message; persistence behavior was not altered.

## Boundaries
Browser viewport checks are not physical-device or assistive-technology testing. No deployment, push or merge was requested. Implementation and the attached worktree remain available for review. Screenshots and detailed browser observations are in the chat's fiscal-implementation visualization directory; command logs are in output/fiscal-layout-implementation.
