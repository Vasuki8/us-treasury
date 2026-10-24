# Overview hierarchy verification

User approved the Clearer hierarchy comparison and publication with the current Koyfin UI and Light/Graphite colors.

Implementation revision: `96adcd69092473bc71b8fc8f708f0e512e8b1d61`.
Build directory: `assets/91cfffe596d24984`.

## Implementation

- Eight primary reading homes across six topics, with explicit units and independent reference periods. Fed range requires finite, same-date bounds.
- Monthly headline/core PCE and three-month-average payroll use native charts.
- Desktop catalyst rail; mobile order is conditions, catalysts, momentum, supporting research.
- Activity/income, claims, policy effective rate, debt stock, publication evidence, personal research and source methods remain inspectable in disclosures.
- Publication/reference/retrieval clocks, claims estimate roles and schedule uncertainty remain separate.
- Native indicator and comparison navigation returns to Overview; disclosure state survives rerenders and return visits in the session.
- Frozen packages retain their compatible four primary measurement IDs plus full supplemental context, including 12 payroll-average chart observations and calculation/source metadata. The frozen viewer provides context rather than exact visual replay; complete chart inputs remain in JSON.

## Verification before publication

- Full regression: 1,397 tests passed; zero failed, skipped or cancelled.
- Production build and smoke check: all 152 assets passed, including lazy history bundles.
- Independent economist/investor review: no actionable findings.
- Independent integration review: 36 surrounding tests passed; no actionable findings after actual renderer comparison controls were connected.
- Independent final native renderer/CSS review: no actionable findings.
- Browser: desktop, 390px and 320px; Light/Graphite and Compact/Comfortable. Eight readings, catalyst date grouping, claims weeks/roles, archived periods, comparison/detail returns and disclosure retention inspected. Native chart labels fit at 320px; keyboard interaction changes readout; no horizontal page overflow or console warning/error observed. FREEZE RESULT created the expected compatible frozen package.

## Live acceptance

- Workflow [40047993675](https://github.com/Vasuki8/us-treasury/actions/runs/40047993675): refresh guard, Node22 verification, Node24 verification and GitHub Pages deployment succeeded. Refresh was not due; existing official snapshot was retained. Cloudflare deployment correctly skipped.
- Runtime revision: `96adcd69092473bc71b8fc8f708f0e512e8b1d61`; live asset directory `91cfffe596d24984`.
- `node scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` passed: all 152 live assets match the local verified build byte for byte. Checked at 2026-10-24 01:07 UTC.
- Live browser: native 8-reading/6-topic hierarchy, 4 catalysts, both rendered chart groups, reviewed archived periods, real comparison return and disclosure retention confirmed. Light desktop and Graphite mobile at 390px/320px fit without horizontal page overflow. No console warning/error observed. Theme restored to Light and temporary viewport reset.
- Live site: [Meridian Overview](https://vasuki8.github.io/us-treasury/#/overview).
- Existing untracked workspace artifacts and reused managed worktree retained; owned local preview server stopped.
