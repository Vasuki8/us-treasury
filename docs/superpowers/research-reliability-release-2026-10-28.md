# Research reliability release — October 28, 2026

**Status: deployed and live-verified.** The user explicitly authorized merging the reviewed changes into main, deploying the updated app and verifying the live pages in both themes and on mobile. This supersedes the original local-only implementation boundary; it does not authorize new paid feeds or removal of source safeguards.

- Live app: https://vasuki8.github.io/us-treasury/
- Main release merge: `44e6de545bb98a941250597a2e745842fc836cc8`.
- Reviewed implementation: `b2148bd`; integrated candidate: `40ce27f`.
- [Successful test, build and deployment run 40636884602](https://github.com/Vasuki8/us-treasury/actions/runs/40636884602).
- GitHub Pages deployment succeeded at `2026-10-28T05:32:05Z` (October 28, 01:32 EDT). Cloudflare was not activated.
- Published build fingerprint: `3f737b3bc7dd21ac`.

## Preserved data and integration

The release incorporates the automatic main refresh at `ef76cafc2a4849ad8a44f40b604c69443b92e3b0`. Its **241 capture descriptors remain an unchanged prefix of the 243 current captures**. All 23 existing source objects, the calendar and release list remain identical to that newer main snapshot. Both reviewed supplemental source objects, descriptors and compressed capture bytes are preserved exactly.

The conflict was resolved with the existing archive-prefix checks, source admission and immutable snapshot writer. Independent release review passed. The main merge has the same tree as the fully tested integrated candidate. Local `output/`, `tmp/`, user exports and stored research were not included in the release or deleted. No fiscal accounting correction was made.

## Verification

| Gate | Result |
| --- | --- |
| Complete integrated-candidate suite | **1,995 passed, zero failed/skipped**, exit 0. |
| Focused checks on merged main | **30 passed, zero failed**, exit 0. |
| Production build and smoke check | Passed; **180 assets**. |
| GitHub Node 22 and Node 24 | Both full test, build, smoke and artifact jobs passed. |
| Existing refresh guard and publication upkeep | Passed; unnecessary full refresh was skipped. The 32 required outcomes remain enforced. |
| Public HTTPS build comparison | **All 180 assets matched byte-for-byte**, including source-history bundles. Local build inputs were matched to committed bytes before comparison. |
| Live responsive matrix | **304 passed**: 38 route variants × Light/Graphite × 320, 390, 768 and 1440 pixels. No document/main overflow, clipped headline values, duplicate IDs or chart configuration errors. |
| Expanded live mobile disclosures | **16 passed**, including nested Prices, Labor, external and research evidence at 320/390 pixels in both themes. |
| Live mobile Save forms | **12 passed**, without submitting synthetic production records. |
| Final browser console | No warnings or errors. |
| Independent live visual review | Passed for desktop Light Overview, desktop Graphite Refinancing, mobile Light Labor and mobile Graphite PCE. |

Native live checks also verified:

- Exact-date failure and opt-in declared-quarter success using nominal GDP and foreign Treasury holdings; the common quarter and both original baseline dates remain explicit.
- 1D/1W/1M/YTD curve shortcuts selecting retained dates, with exact keyboard maturity inspection and dated methodology context.
- Applied headline PCE assumptions of 0.25% monthly, six months and a 2.1% annual target. Six modeled rows, exact-index readouts and downloaded CSV agree. Blank input preserves the previously applied path and displays an error. Downloaded values passed independent compounding, exact-year denominator and geometric-target checks.
- Labor preliminary/uncertainty, real-earnings population/deflator and diffusion-breadth qualifications; nested PCE housing contributions; explicit auction coverage/missing-result states; date-only Treasury timing; Residential Construction naming.
- The public browser started with zero named workspaces, pinned packages and watchlist members; all remained zero with no errors. No synthetic public research records were created. Separately, the local 3,856,868-byte frozen Funding package reopened after integration and exported byte-identically to its original JSON. Earlier native migration and package round trips remain in the [local acceptance record](research-reliability-verification-2026-10-28.md).

The browser was restored to its normal 1280 × 720 viewport, Light theme and Compact density, with the live Overview retained. Screenshot review covers four captured states; the matrix and native controls provide the broader interaction evidence. This is not a complete assistive-technology audit.

## Source-dependent limitations retained

- **Payroll publication evidence remains blocked:** current and exactly dated BLS Employment Situation acquisition returned HTTP 403. Current revised API history does not establish originally reported same-release priors or their combined revisions.
- **Consensus expectations remain blocked:** an admitted timestamped provider and capture/storage/redistribution rights are required. Actual-versus-prior comparisons are not consensus surprises.
- **Market-implied policy pricing remains blocked:** a suitable accessible pricing feed and downstream rights are required. Official projections and observed policy rates are not market pricing.
- Treasury announced-event coverage remains limited to the actual retained events through November 3, 2026, with its separate narrow refresh command and no invented event clocks.

No unsupported panel, paid account or fabricated proxy was added. See the [requirement checklist](../research-reliability-checklist.md), [payroll/source acquisition record](../labor-inflation-evidence-source-review.md), [expectations/pricing dependencies](../expectations-policy-path-dependencies.md) and [Treasury schedule review](../treasury-calendar-source-review.md).

## Reproducible evidence

Local command logs and integration/CSV receipts are in `output/research-reliability-release/`. Live screenshots and structured browser checks are in `C:/Users/Vasuki/.codex/visualizations/2026/10/27/01a17e6e-469f-71d3-a3ab-068d9d53ea79/research-reliability-release/`. These local artifacts were retained outside the public source commit. The public CI run above records the independently executed verification and Pages deployment.
