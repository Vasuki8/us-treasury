# Research review corrections

The user approved fixing the five reproduced review defects, the content corrections, and three information-layout recommendations. Deliver one new pull request; do not merge or deploy it.

## Scope

- A delayed saved-view save must retain its intended record without changing a subsequently activated view. Later updates must target the current view.
- Graphite accent text and essential funding chart strokes must meet contrast requirements against their actual backgrounds. Contrast tests must use the final CSS palette.
- Labor section navigation must focus its destination and leave headings clear of the fixed toolbar.
- Nonempty catalog searches must retain relevance ranking. Empty catalog browsing keeps topic grouping.
- Imported snapshot observation footnotes must be arrays of strings when supplied; malformed values must be rejected before storage.
- Correct earnings agreement, the inflation question's missing article, the stale Frozen Results name, the interest-burden heading, and the payroll overlay's irrelevant unemployment note.
- Combine repeated Overview and Labor headline readings with their interpretation. Retain value, native units, period, meaningful comparison, source links and visible missing/cached/preliminary warnings.
- Reduce Labor mobile setup: one source line, concise introduction, Follow directly available, secondary actions in an accessible native disclosure.
- Indicator detail begins with its selected reading and comparison, then history; related context moves below history, remaining compact on desktop.

## Approach

Reuse the existing vanilla JavaScript renderers, native details controls and CSS theme tokens. The accepted direction is a focused information-hierarchy correction to the current Stitch implementation. A new design system or routing/component rewrite would create unnecessary scope and regression risk. Context can require expansion; critical warnings and provenance remain available beside the readings.

## Constraints

- No new dependencies, collector changes, data refreshes, retained-data changes or weakened safeguards.
- Preserve chart combinations, legends, endpoint labels, ranges, keyboard inspection, CSV contents and research actions.
- Preserve both themes, density choices, internal return routes, source attribution and storage recovery.
- Validate desktop and mobile layouts in both themes before opening the PR.

## Verification

Behavioral regressions cover intervening saved-view activations, effective contrast tokens, keyboard section focus, ranked searches and malformed snapshot imports. Existing content assertions are updated to match intended structure without dropping data or safety checks. Run the full test suite, production build and strict smoke check; inspect the local site on desktop and mobile in both themes. Review the final diff independently, then push only the feature branch and open an unmerged PR.
