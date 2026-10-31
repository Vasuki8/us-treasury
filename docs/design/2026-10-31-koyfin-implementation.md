# Koyfin workspace implementation

Goal: apply the chosen Koyfin layout to the working Meridian website, with refined light/dark themes and restrained motion.

Approved reference: output/layout-studies-2026-10-31/meridian-layout-comparison.html, Koyfin mode.
Architecture: retain native modules, official captures, source loading, routes, saved research and chart infrastructure.
No new dependencies, collection, merge or deployment. Work on codex/koyfin-sitewide-design from 3730111.

## Tasks

1. Add a persistent grouped sidebar using the existing destination registry; retain all mobile destinations and active state.
2. Compose Overview as four headline readings, linked recent-history panel, inflation chart, monitor and calendar.
   Keep policy bounds, funding readings, monthly payroll context and all evidence disclosures available.
3. Add a separate catalog preview that does not change comparison selections, filters or exports.
   Preview exactly the last 12 retained observations, clearly labeled; full-history research remains on the existing detail route.
4. Align Indicator, Calendar, Labor and specialist/research pages with the shared panel hierarchy.
   Keep dates, units, source status, limitations and research actions readable.
5. Refine theme tokens, responsive geometry and motion; use system fonts and tabular numerals without external font requests.
6. Run focused behavior/contrast tests, full tests, build checks and desktop/mobile browser verification.
   Review the whole change with one fresh reviewer, fix material findings, open a local preview.

## Verification and review focus

- Preview selection must not mutate comparison selection, saved research or data contracts.
- All destinations must be reachable on desktop and mobile; route activity and keyboard focus must survive navigation.
- No hidden source failures or ambiguous reference/retrieval clocks; no invented forecasts or data.
- Reduced motion, light/dark contrast, 320/390/1024/1440 widths and desktop zoom.
- Browser interaction checks for preview links, theme, mobile navigation, disclosures and panel sizing.
- Preserve historical fixtures, source allowlists, workflow safeguards and the 20 MiB asset limit.

## Execution ledger

- Inspected production page renderers, shell, source controller, chart helpers and presentation tests.
- Ruling: use the clean primary checkout on a dedicated branch; existing managed worktrees contain unrelated work.
- Ruling: recent previews use the existing retained snapshot with an explicit 12-observation window. Full history stays in the established source-loading flow.
- Ruling: styling changes are verified through contrast and browser checks; new interaction behavior gets targeted regression tests.
- Implemented the shared shell, Overview, catalog preview, Indicator context column, and both themes across all destinations.
- Ruling: fixed the existing Today filter bug exposed by the full suite. Valid dates with no scheduled events now remain selected;
  impossible dates still fall back safely. New empty-day regression failed before the fix and passes afterward.
- Review: one independent whole-change review found a currency scale mismatch and a mobile focus-return edge case.
- Fixed currency values and labels to share one scale; threshold-crossing regression failed before the fix and now passes.
- Ruling: treat the mobile focus finding as a functional keyboard issue, not optional polish. The real browser reproduced loss of
  focus when filtering removes the original Preview button; closing now focuses catalog search in that case.
- Review declined to judge responsive geometry, contrast and zoom from code alone; these are covered by our browser/contrast checks.
- Browser access to a separate localhost session was unavailable. QA uses the exact native server handler with offline route delivery;
  unchanged immutable snapshot data comes from the successfully validated build. No production networking settings were changed.
- Sidebar family transitions now close other topic groups; same-view refreshes preserve manual expansion. Regression verified red to green.
- Complete: 2,352 tests passed; 208 page/theme/viewport cases passed; keyboard, comparison independence and reduced motion passed.
- Complete: 200% CSS zoom reflow passed for Overview, Indicator, Calendar and Explore; this is not an OS/browser-native zoom audit.
- Complete: final build and strict asset graph/20 MiB checks passed (225 assets). Built hashes match every changed production module and stylesheet.
- No deferred review findings. Code and review gallery are local; nothing merged, pushed or deployed.
