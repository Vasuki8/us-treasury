# Longer official weekly claims history

Expand the existing national seasonally adjusted initial and continued claims feed. Preserve the Graphite design, shared date ranges, safe comparisons, CSV exports, frozen packages and every immutable retrieval snapshot. No new source service, credential or dependency is needed.

## Source mapping

Review DOL ETA's existing national XML POST at `https://oui.doleta.gov/unemploy/wkclaims/report.asp`, fields `level=us`, `strtdate`, `enddate`, `filetype=xml`, `submit=Submit`. The official dataset catalog documents history back to 1967; verify the form, actual response and first usable date for each `InitialClaims/SA` and `ContinuedClaims/SA` series before capture. Recheck the DOL public-domain policy for commercial display/export of this agency-authored statistical compilation. Do not treat catalog public access or `rights:TRUE` alone as a reuse license.

## Bounded implementation

1. Request the verified full history from the fixed official start year, retain every returned past observation rather than the latest 52, and keep strict response/schema bounds. Each series independently trims missing edges and excludes future dates; missing internal observations stay missing.
2. Show actual first/latest dates and limitations in existing provenance/coverage fields. Preserve raw count strings and the count/1,000 scaling. The historical export may lag advance releases and includes revisions/seasonal-method changes. Earlier reference weeks are first captured now, never backdated publication vintages.
3. Test decades of data, independent endpoints, cutoff/week-ending alignment, missing data, current-year requests, raw values and existing failure behavior. Test shared All/5Y/custom windows, safe comparisons, CSV, frozen packages and as-known-before/after behavior.
4. Refresh DOL alone through `--sources=dol --require-all`, preserving unrelated source/calendar state and all immutable archive bytes. Audit the actual coverage and source receipt.
5. Run the full suite and built HTTP check, verify desktop/mobile Graphite charts and keyboard controls, independently review, then commit/push using existing main/Actions conventions. Verify deployment assets and representative live pages.

If the official endpoint is unavailable or reuse scope cannot be verified, preserve existing observations and report the limitation; do not substitute an unofficial series or fabricated historical data.
