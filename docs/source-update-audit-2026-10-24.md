# Automatic source and release-check audit — October 24, 2026

## Scope and method

Checked all 23 statistical collectors, the six remaining calendar/timing collectors, and GDP/claims publication discovery. BLS calendar access is an existing, separately verified HTTP403 limitation; its retained schedule is not a new successful capture. CPI availability continues through the separately reviewed Cleveland Fed source.

Actual collector requests used the existing reviewed official endpoints and parsers, followed by independent admission checks. Compared newest usable reference periods with the committed snapshot rather than treating HTTP200 as evidence of a new economic release. Local network diagnostics required permitted network execution; sandbox DNS failures were not classified as provider failures. No alternate datasets, new keys, commercial mirrors, archive changes or UI/style changes were introduced.

## Results from actual requests

| Registered source | Result / latest usable coverage |
| --- | --- |
| `treasury` | Passed; debt October 22, nominal curve October 23 |
| `fiscal` | Passed; monthly statement through September 2026; existing source reconciliation limitations preserved |
| `refinancing` | Passed; September 30 maturity profile |
| `yields` | Passed; October 23 nominal/real curve history |
| `auctions` | Passed; reviewed auction results and security identifiers parsed |
| `ownership` | Passed; Z.1 June 30 / SOMA October 21, with independent source dates |
| `marketFunctioning` | Passed; daily funding rates through October 22; weekly dealer data retain suppressed values as missing |
| `policyRates` | Passed; IORB source effective date advances through October 24 without inventing a new policy decision |
| `bankCredit` | Passed; H.8 October 14 |
| `lendingSurvey` | Passed; 2026 Q3 |
| `fedBalance` | Passed; October 21 |
| `onRrp` | Passed; October 23 |
| `householdDebt` | Passed; 2026 Q2 |
| `loanDelinquency` | Passed; 2026 Q2 |
| `bea` | Passed; GDP2026 Q2, monthly income/PCE through August 2026 |
| `beaIta` | Passed; international transactions 2026 Q2, release September 24, next posted release December 18 |
| `census` | Passed; advance retail sales September 2026 |
| `activity` | Passed; industrial production/capacity September 2026 |
| `housing` | Passed; new residential construction September 2026 |
| `macroContributions` | Passed; GDP contributions 2026 Q2 |
| `dolAdvance` | Passed; October 22 publication, initial week October 17 and continued week October 10 |
| `dol` | HTTP200, parser failure reproduced and repaired; revised weekly history remains through September 26, independently of newer advances |
| `bls` | Valid 20-series/10-year request returned HTTP503 twice; official response says the website is busy. Provider availability is unresolved by a parser change |
| `calendar:bea` | Passed; 70 mapped events, 30 upcoming, through December 2027 |
| `calendar:census` | Passed; 52 events from canonical 2027 calendar plus its linked 2026 archive; 28 upcoming |
| `calendar:dol` | Passed; 13 upcoming events through January 21, 2027, within the posted exception horizon |
| `calendar:fomc` | Passed; 22 date-only meeting events, 10 upcoming, through December 2027 |
| `calendar:treasury` | Passed; 47 agency-estimated debt dates through January 4, 2027 |
| `calendar:treasury-yield-timing` | Passed; recognized qualified 18:00 Eastern guidance, no invented dated release events |
| `calendar:bls` | Existing official HTTP403 exception; original verified schedule stays cached, with original provenance |
| GDP publication discovery | Passed; current official dated workbook `/2026-09/gdp-gdi-vintage-history.xlsx` |
| Claims publication discovery | Passed; current official PDF parses as October 22 release |

The 14 financial/credit collectors used 34 unique successful official requests with no redirects. Expected source lags are not access failures: New York Fed rates describe the preceding effective business day, and Debt to the Penny reports preceding-business-day debt. Dealer suppression stays missing. Source publication schedules: [NY Fed SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr/) and [Debt to the Penny](https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/).

## Confirmed fixes

### DOL empty seasonal-factor row

The national XML export includes a Friday April 3, 2026 row with seasonal factors 92.3/104.6 and nonbreaking-space entities in every claims, insured-unemployment-rate and covered-employment field. Previously the Saturday guard rejected the whole historical feed before reaching its missing-value handling. Exact official response SHA256: `36c76275cf8ef98f9996979ebe31cedc4913c138ad4f6e0626e6c46cf3fe6b25`.

The parser now validates the entire row, real calendar date, duplicate identity and source bounds before excluding a non-Saturday row containing positive numeric seasonal factors and no actual measurements. A dated exclusion warning is retained. Any nonempty actual count/rate/employment field, malformed factor/schema/entity or duplicate still fails. Nothing is moved to Saturday, converted to zero or inserted as an observation. Replaying the official response yields 3,117 observations per measure, January 7, 1967–September 26, 2026. Existing stale-history warnings remain; the newer advance PDF stays separate.

This is handling of missing metadata within the same reviewed [DOL national export](https://oui.doleta.gov/unemploy/claims.asp), with the original [reuse review](data-sources.md). It adds no measurement or endpoint.

### Claims schedule and retry interaction

A full calendar refresh at 08:45 Eastern previously removed that day's 08:30 DOL event. Release planning then saw no due event and skipped retries even when the newly downloaded PDF still contained last week's release. Current Eastern-day schedules now survive through that day, within the existing 90-day scope; earlier dates are not expanded. Thursday and the official Wednesday holiday exception preserve nominal event identities. UTC midnight does not cut the Eastern day short. A schedule still does not prove publication, and the existing three-hour retry window remains bounded.

### Read-only hosted diagnostic

`node scripts/refresh-data.mjs --check-only` runs the selected real collectors and admission gates without calling the snapshot writer. It writes only ignored `source-health.json`: source status/errors, original successful receipts, warnings, counts and latest/reference usable-period dates. It does not serialize duplicate observation arrays or relabel retained data as freshly captured. The verified BLS403 calendar exception is explicit; any other collector failure exits nonzero.

The optional manual workflow input `check_sources` runs the diagnostic on an isolated runner with read-only contents permissions and no persisted Git credentials. The artifact is retained on failure. This is independent of production refresh/deploy gates; it cannot commit or publish candidate data. Existing automatic daily/release refresh cadence and atomic failure behavior remain intact.

## Decisions and remaining provider limitations

- No shared HTTP retry change was justified by the BLS investigation: two unchanged requests approximately two minutes apart returned 503 without a redirect or Retry-After. This is not evidence that a retry restores access. Existing scheduled catch-up attempts remain; access denials are never retried or bypassed.
- BLS statistical availability is distinct from the cached BLS calendar and from Cleveland CPI availability. The calendar-only 403 exception is not widened to statistical 503 errors. A failed required statistical capture blocks production snapshot replacement; earlier live data and original timestamps stay intact.
- Successful history retrieval may still lag a release. DOL revised XML and advance PDFs, source reference periods, schedules and original publication evidence remain distinct.
- Official-source failures are retained as failures; neither this audit nor an HTTP200 guarantees future service availability or a release-time SLA.

## Verification

Red/green regressions cover the observed DOL row, excluded-row duplicate and observation bounds, non-Saturday real metrics, invalid factors/entities/schema, late full-refresh retries, Wednesday exceptions and Eastern midnight. CLI regressions verify byte-for-byte snapshot preservation for both failed checks and successful calendar checks with the narrow cached exception. Workflow eligibility tests require explicit manual selection and preserve deployment independence.

- Local integrated suite: **1,511 passed, zero failed**. The subsequently added admission-report regression passed independently after its expected red failure; the final hosted suite includes it as well.
- Independent focused review: **54 passed**, followed by a separate real-CLI reproduction confirming the admission failure now retains a failed report, exits nonzero and leaves snapshot bytes unchanged.
- The initial sandbox-only baseline failed on prohibited local loopback/Git-fixture access. The permitted integrated run passed; source/parser failures were not hidden or reclassified as passing.
- Source rights, archived publications, snapshot/history bytes, app markup, styles and colors have no changes in this patch.

Hosted outcomes will be added after the actual runner check.
