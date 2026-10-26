# Unemployment, CPI and federal debt historical coverage

Reviewed October 25–26, 2026 in Toronto. The user requested longer unemployment, CPI and federal debt histories while preserving the current UI and colors. This extends existing measurements and already admitted API endpoints; it introduces no new provider, credentials, indicator, dependency or publication-vintage claim.

## BLS scope and interpretation

| Measurement | Official native identifier | Reviewed history start | First possible calculated value |
| --- | --- | --- | --- |
| Monthly seasonally adjusted unemployment, age 16+ | LNS14000000 | January 1948 | Published percent |
| Headline CPI-U index, NSA | CUUR0000SA0 | January 1913 | Annual growth: January 1914 |
| Headline CPI-U index, SA | CUSR0000SA0 | January 1947 | Monthly growth: February 1947 |
| Core CPI-U index, NSA | CUUR0000SA0L1E | January 1957 | Annual growth: January 1958 |
| Core CPI-U index, SA | CUSR0000SA0L1E | January 1957 | Monthly growth: February 1957 |

The [official unemployment report](https://data.bls.gov/timeseries/LNS14000000?years_option=all_years) and [headline CPI report](https://data.bls.gov/timeseries/CUUR0000SA0?years_option=all_years) expose the long histories. The [CPI Handbook](https://www.bls.gov/opub/hom/cpi/archive/20201124/presentation.htm) and [core CPI history](https://www.bls.gov/opub/btn/archive/the-so-called-core-index-history-and-uses-of-the-index-for-all-items-less-food-and-energy.pdf) document the other starting years. Exact accepted native starts are checked during collection; a missing or different start fails admission rather than creating synthetic rows.

These are currently published retrospective histories. The [CPI program history](https://www.bls.gov/cpi/history.htm) explains that national publication began in 1921 with estimates back to 1913 and that CPI-U was introduced later. Core first appeared in 1977 with retrospective history. [Pre-1948 unemployment](https://www.bls.gov/cps/prev_yrs.htm) differs in coverage and frequency and is excluded. A long reference history does not establish original-release values or one unchanged century-long methodology. Publication timestamps stay unknown.

Thirteen existing unemployment/CPI outputs use these five native series, including the four existing three-/six-month annualized CPI momentum calculations. NSA annual rates, SA monthly rates and price-index levels remain separate. No M13 annual average is treated as December, no missing month is filled, and the first unavailable comparison endpoints stay null. The other 18 BLS outputs keep their current retained windows; the total remains 31.

## Bootstrap and routine update contract

The [registered API limits](https://www.bls.gov/developers/api_faqs.htm) permit 20 calendar years and 50 series per query, with 500 daily queries and annual key renewal. Initial history uses six overlapping logical windows: 1913–1932, 1932–1951, 1951–1970, 1970–1989, 1989–2008 and 2008–the current year. Within each window, native series are grouped by their actual starting year, making nine registered requests in the 2026 bootstrap. Thus unemployment starts in 1948, headline SA in 1947 and core in 1957 even when the logical context begins earlier. No unavailable pre-birth years are requested, and unexpected API notices remain rejected. Requests remain sequential with a one-second gap and the existing bounded transient-retry policy. [POST parameters](https://www.bls.gov/developers/api_signature_v2.htm) and exact v1/v2 endpoints are unchanged. The key stays in the body of private requests within GitHub's trusted collection step and is never committed or printed.

Each window derives its own rates before stitching. The shared year supplies exact comparison inputs; raw overlap must agree, and older results through that context year are retained to avoid introducing warm-up gaps. Routine collection keeps the existing fresh ten-calendar-year request, including its current primary-to-registered-backup behavior. The first response year is checked as context; subsequent years replace their prior rows, including genuine nulls. Older rows retain their actual receipts. The nine refreshed years cover the official normal five-year seasonal revision horizons for [CPI](https://www.bls.gov/cpi/seasonal-adjustment/home.htm) and [CPS](https://www.bls.gov/cps/seasonal-adjustment-methodology.htm).

A context mismatch triggers a complete registered backfill; without a usable key it fails visibly and preserves the previous history. Partial backfills, lost historical dates, latest usable regressions, unexpected messages, redirects and credential echoes fail atomically. A new versioned profile and exact row URL/hash/retrieval references enable strict admission without copying receipt objects into every row. Only referenced old receipts plus the fresh family receipt are retained. The unchanged momentum validator checks the exact retained values, metadata and formulas. The registered weekly health checker remains the existing single-request fresh-window check.

The registered key is needed to bootstrap or repair historical context, not for every healthy primary refresh. A missing key cannot silently shorten an already retained historical profile. Only the existing narrowly verified HTTP503 retention policy applies; a historical v2 outage can retain a previously admitted full profile, while first-bootstrap failure cannot be called a successful history expansion. Denials, invalid keys, semantic quota errors, schema changes and source-admission errors remain visible.

## Federal debt and sparse composition

Both gross and public-debt collection use the existing Fiscal Data Debt to the Penny endpoint from April 1, 1993. The accepted response contains 8,419 dated records through October 22, 2026. Gross starts at USD 4,225,873,987,843.44. Published public/intragovernmental composition first appears September 30, 1997, with sparse annual/monthly coverage before daily reporting began April 4, 2005. The 2,958 unpublished early compositions remain null, including documented paired-zero placeholders; no annual/monthly amount is copied across daily dates. All 46 isolated early published amounts remain visible as dots in the existing chart colors, with gaps preserved.

The existing August 4, 2025 accounting anomaly stays quarantined. Raw dollar strings, trillion conversions, current dates and unknown publication times remain unchanged. A complete single 10,000-row response, exact count/page metadata and no next page are required. A future oversized/incomplete response fails visibly. See [the debt source review](fiscal-source-review.md).

Debt series carry only their exact debt-response receipt and independent retrieval clock, while global receipts remain intact. Admission proves each new series receipt is an exact subset of captured source evidence on its own admitted feed. Replay and frozen packages preserve those subsets; old captures without them retain their previous meaning.

## Verification and practical limits

Tests cover bootstrap seams, current nulls, primary/backup transitions, year rollover, automatic repair, profile key order, missing keys, source identity, credential safety, momentum admission, sparse debt, independent receipt clocks, old CSV compatibility and original archive preservation. All/custom charts and CSV reuse the existing interface. Normal one-year debt packages round-trip at about 1.23 MB and 1.36 MB. Larger All-history packages continue to report the existing 12 MiB cap; every requested row is retained before rejection. No portable-size limit is raised and no older archive is rewritten.

Local verification passed 1,710 complete-suite tests, followed by 36 fresh archive/admission/registered-check regressions. Static build and HTTP smoke checks passed all 163 assets. Independent review confirmed the original 149 captures remain exact within the 153-capture local state, with normal debt packages round-tripping and sparse observations visible. An initial five-failure CLI run exposed outdated provider mocks; the fixture boundary was corrected without removing its publication assertions, then all ten CLI tests and the complete suite passed. Registered-check fixtures rebuild a genuine fresh-window shape so a longer previous state cannot masquerade as the single-request primitive.

## Verified official capture

The trusted [cloud refresh](https://github.com/Vasuki8/us-treasury/actions/runs/40270839985) captured BLS at `2026-10-26T04:47:39.751Z` and published the admitted snapshot as `555b475a6e1b8e2852c0044213d9976b4b3e23a2`. Its ten genuine BLS receipts comprise one current-family v1 response and nine registered historical v2 responses. No key was read or stored locally. All series end in September 2026:

| Native measurement | Dated monthly rows | Usable numeric rows | First reference month |
| --- | ---: | ---: | --- |
| Unemployment | 945 | 944 | January 1948 |
| Headline CPI index, NSA | 1,365 | 1,364 | January 1913 |
| Headline CPI index, SA | 957 | 956 | January 1947 |
| Core CPI index, NSA | 837 | 836 | January 1957 |
| Core CPI index, SA | 837 | 836 | January 1957 |

October 2025 remains source-missing in all five inputs. Annual, monthly and momentum calculations retain the resulting unavailable comparisons. There are no fabricated values for that month or for initial comparison periods. First usable annual headline/core rates are January 1914/January 1958; first usable monthly headline/core rates are February 1947/February 1957.

Independent verification recomputed every CPI rate/momentum and its baseline, with no errors across 888 seam-period checks. All 13 extended outputs preserve the complete monthly reference grid and every previously retained date. The other 18 BLS observation arrays, source identifiers, calculations and endpoint metadata are exact matches to the pre-cloud state.

The resulting archive has 156 captures. Both the original 149-capture prefix at `c002f57` and the 153-capture pre-cloud prefix at `4b4c761` remain identical, including hydrated objects and replay. Gross/public debt and debt breakdown retain all 2,462 original overlapping rows without property changes, adding 5,957 earlier dates. All 8,419 fiscal gross raw amounts match the standalone Treasury series; all 5,460 usable compositions reconcile within USD 1. The 2,958 documented historical gaps and the single existing accounting quarantine remain null.

Actual All-history charts and CSV retain every requested row for unemployment, headline/core CPI and debt. All 13 individual BLS All-history packages round-trip byte-for-byte, and a four-series full-history unemployment/headline CPI/core CPI/monthly CPI comparison does so at 8,865,271 bytes, below the existing 12 MiB cap. Early custom CPI/public-debt packages and normal one-year gross/public-debt packages also round-trip with identical CSV. All four actual published-CPI packages preserve their publication evidence without live API capture leakage. The fresh-window primitive reconstructed from actual source values passes the unchanged weekly registered checker for all 31 outputs with one receipt. All debt CSV can still be exported separately; larger portable packages continue to enforce the existing size cap without truncating history.

The refreshed-data job passed all 1,715 tests, build and the 163-asset HTTP smoke check before publication. The same snapshot then passed all 1,715 tests independently on Node 22 and Node 24, with both builds and 163-asset smoke checks succeeding. GitHub Pages deployed successfully at `2026-10-26T05:03:35Z`. A separate HTTPS check confirmed the [live application](https://vasuki8.github.io/us-treasury/) matches the exact local tested build across all 163 assets, including the source-history bundles. No stylesheet, theme token, layout or navigation file changed.

The existing cloud maintenance workflow reported recovery for refresh/publication and deployment; only the separate DOL source incident remained open at the final check. The scheduled follow-up refresh guard also completed successfully. Evidence-only documentation follows the verified data commit; it does not alter the deployed application.

The manual historical capture selected only BLS, Treasury and fiscal sources. Automatic/default all-source selection is unchanged. A separate DOL national feed returned HTML instead of its admitted XML and remains tracked by the existing [DOL failure alert](https://github.com/Vasuki8/us-treasury/issues/4); its older captured readings are preserved. This successful historical delivery does not establish DOL recovery.

Follow-up October 26: the [DOL service-error retry fix](dol-claims-history-source-review.md#october-26-2026-intermittent-database-failure) subsequently recovered the official feed. A complete trusted refresh captured all 30 statistical/calendar/timing outcomes, preserved every historical BLS row, passed 1,721 tests on both supported runtimes and deployed successfully. GitHub automatically reported DOL recovery; no source incidents remained open at that follow-up check. DOL's historical reference-week lag remains disclosed independently of successful retrieval.
