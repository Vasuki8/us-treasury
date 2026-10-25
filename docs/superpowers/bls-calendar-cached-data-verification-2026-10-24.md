# BLS calendar replacement and independent updates — verification

The user selected **Update healthy sources; clearly retain cached BLS data** after research found no verified current replacement for the complete statistical family. The chosen production change replaces calendar delivery with the New York Fed; it does not pretend to replace unavailable BLS statistics.

## Source investigation

- New York Fed identified-client collection and admission passed: eight actual Employment Situation/CPI/JOLTS facts from October–December2026, explicit Eastern clocks, null reference periods, real receipts and complete redistribution notices.
- The official BLS bulk files contain all20 exact raw IDs, but the required identified client was denied403 locally and in [hosted probe40146129094](https://github.com/Vasuki8/us-treasury/actions/runs/40146129094). The inactive candidate implementation is removed from the final patch; no identity rotation or denial retry occurred.
- DBnomics observations checked were stale relative to retained BLS data. FRED service authorization for this cached/exported application remained unclear. No keys, signups, messages or unreviewed numerical substitutes were introduced.
- A single raw request to the calendar's actually linked January2027 page returned302 to `/errors/404`. The collector recognizes this exact route as unpublished **future** coverage only, without following/reading it; current-month and other redirects still fail. Already captured future coverage cannot silently shrink.

## Real refresh rehearsal

`node scripts/refresh-data.mjs --allow-cached-bls` completed successfully locally at `2026-10-25T00:30:52.409Z` (October24Eastern):

- All22 other statistical collectors and all7 calendar/timing collectors refreshed successfully.
- BLS API returned the exact recognized unredirected503. All31 BLS outputs retained their previous observations, footnotes, calculation inputs and receipts unchanged, with original capture `2026-10-24T00:05:02.137Z` and status `error`/cached.
- The original97 immutable captures remain an exact archive prefix. Exactly22 new healthy-source captures were added; **zero new BLS captures** were created.
- A subsequent calendar-only capture at `2026-10-25T00:41:40.704Z` preserved the independent cached-BLS marker and original BLS attempt/retrieval clocks. New York Fed calendar retrieval is `2026-10-25T00:41:43.757Z`, with current verified coverage through December31.
- Actual workflow planning then returned no pending daily sources, with an explicit reason distinguishing the approved503 attempt from the unchanged BLS capture. Bounded recovery subsequently targets BLS only; other release collectors remain independent.

## Regression and review

- Focused calendar/policy/public-and-frozen integration checks pass, including publisher identity, exact rights notices, unknown periods, time-zone conversion, rollover, future missing-page handling, real rendered Calendar/Overview/Labor and portable frozen JSON.
- Focused cached-statistics/planner checks pass for the complete old capture, exact typed failure, malformed/partial/future/unreviewed data rejection, source success clearing, independent retained markers and recovery attempt timestamps.
- Independent review identified unknown-publisher admission and retry-marker preservation gaps. Both have red/green regressions and were fixed. A further regression prevents a New York Fed capture from qualifying for the old BLS annual-calendar403 exception.
- The first integrated run found8 fixture assumptions tied to an always-healthy BLS source and the latest capture always being the original GDP-contribution backfill. These were corrected to verify the approved cached/error state, an explicit legacy calendar fixture and the immutable original backfill rather than weakening observation/provenance/history checks. The relevant model/page/history subset passed100tests afterward.

## UI verification

Local browser verification at1280px and390px confirmed the existing light layout, the New York Fed calendar label, unknown reference period and unchanged original BLS retrieval notice. Document widths were1265/375px respectively, with no horizontal page overflow or browser warnings/errors. `styles.css`, theme assets and navigation layout have no changes; only factual source labels/notices were added inside existing disclosures.

## Hosted candidate verification

Candidate `b1d37f1a0d85a2120bb41bdb74520c03d7703c8c` passed the full suite independently on Node 22 and Node 24 in [run 40148154193](https://github.com/Vasuki8/us-treasury/actions/runs/40148154193): **1,561 tests passed, zero failed** in each matrix job. Both static builds and smoke checks passed for all 163 assets, including source-history bundles. Publication-evidence upkeep also passed.

The separate read-only source-health diagnostic deliberately remains failed for the unavailable BLS statistical API. Artifact `official-source-health` (12581410277), checked at `2026-10-25T00:49:03.826Z`, confirms admission passed and **29 of 30 collectors succeeded**. Only `data:bls` returned HTTP 503; its original retrieval timestamp remained `2026-10-24T00:05:02.137Z`. The New York Fed calendar succeeded with eight events and coverage from October 1 through December 31, 2026. This independent diagnostic does not gate deployment or mislabel BLS statistics healthy.

Live-publication results follow after deployment.
