# Sitewide visual design release

The user approved the local overview redesign and explicitly requested applying it to every page and publishing to the existing live website on October 29, 2026. This authorization supersedes the publication limits in the earlier local usability plan.

## Implementation

Reuse the existing `.page-hierarchy` wrapper and shared components. Extend the approved slate/white and navy palettes, headline typography, joined readings, quiet chart headings and subtle actions across analysis and research pages. Keep native units, reference dates, source warnings, calculation labels, chart scales and evidence tables. Retain both themes and both density settings. Preserve saved research and existing context recovery.

## Verification and publication

1. Review the shared styles independently and correct responsive or keyboard regressions.
2. Run the full tests, production build and built HTTP smoke check. Update only assertions that describe superseded design choices.
3. Inspect all 26 destinations at phone, tablet and desktop widths in both themes and both densities. Exercise chart inspection, tabs, calendar preview and Save View on an isolated QA origin.
4. Preserve the latest main-branch data capture, commit only application sources, relevant tests and scoped documentation, and exclude local exports, output and temporary files.
5. Publish through the existing reviewed GitHub workflow, then verify its deployed artifact and live pages. Do not create a separate hosting project or change the deployment target.

Local logs, layout measurements and screenshots are retained under `output/sitewide-release-2026-10-29/`; those local artifacts are excluded from publication.
