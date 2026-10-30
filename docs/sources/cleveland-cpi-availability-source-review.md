# Cleveland Fed CPI availability source review

Reviewed October 24, 2026. Scope: operational detection of the latest completed CPI reference month, using the Cleveland Fed's explicitly linked headline/core downloads. This is a secondary availability check, not a numerical-data admission, original-release archive or publication-time verifier.

## Reviewed source and use

The [Cleveland Fed Median CPI page](https://www.clevelandfed.org/indicators-and-data/median-cpi) links these files under Data Downloads:

| Purpose | Fixed URL | Exact header |
| --- | --- | --- |
| Headline CPI-U availability | https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/cpi.csv?sc_lang=en | date,cpi_index,ann_monthly_chg |
| Core CPI availability | https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/core.csv?sc_lang=en | date,core_index,ann_monthly_chg |

Ordinary requests using the existing honest project identity returned HTTP 200 on October 24 at 11:37 UTC. Headline: 15,352 bytes; SHA-256 `7a0704b49a9f30d9a4db6b2ee554bf1ceba2c363ed944eddde2aadbd1e671fa2`. Core: 15,353 bytes; SHA-256 `9ff6dbb025f21e235cbdd7b9a16e59664dd08209e8118095db5ff8311265a4c3`. Both contained 717 reference rows, 716 usable index observations, and latest September 2026. A real integrated check at `2026-10-24T11:48:29.530Z` accepted both sources and reported all approved GDP/claims/CPI facts retained.

The indexes are rounded and the change column is annualized. Neither column supplies the exact published BLS Table A percentage strings. The collector validates positive numeric indexes solely to establish observation existence, then discards numerical values. Reports retain dates/counts/availability, real HTTP response hashes and retrieval receipts, not CPI rates or index histories.

The latest reference row must be usable in each file; both latest months must align and must not trail the retained CPI archive's latest reference month. Missing, suppressed, stale, partial, malformed or misaligned inputs cannot silently fall back to an older common month. Reject current/future numeric reference months using the Eastern calendar: actual CPI for an unfinished month cannot yet exist. An unchanged positive index still counts as available. Blank monthly-change fields do not invalidate an existing index.

October 2025 is missing in the observed headline/core files. The bank's broader median/trimmed-mean material explicitly warns about interpolation. The checker excludes October 2025 even if a later file supplies it numerically. November 2025 indexes exist while their annualized monthly changes are blank; this is allowed. A new October 2026 index also remains eligible without an October 2025 annual comparator. No missing months or comparison rates are manufactured.

## Attribution and reuse

The source landing page specifically licenses its work under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Its [general terms](https://www.clevelandfed.org/privacy) preserve rights expressly granted elsewhere on the site. The license permits commercial sharing/adaptation with attribution, license link, changes notice and applicable ShareAlike conditions. Reports retain the bank name, original BLS credit, source links, license and a notice that only reference-month availability metadata was derived. Derived Cleveland availability metadata is shared under that license; this does not relicense unrelated site code or other source datasets.

The scope ingests no Cleveland median/trimmed-mean measures, nowcasts, charts, imagery, logos or proprietary Haver Analytics products. The exact downloaded headline/core CSVs contain no Haver attribution or proprietary notice. Only date-availability facts derived from the linked CPI observations are emitted. Preserve the existing BLS derived-analysis notice as well. The bank and BLS do not endorse this project.

## What the automatic check establishes

A healthy result means the secondary publisher has usable headline/core observations for the stated reference month. The source can update after BLS; no fixed update SLA is claimed. Observation dates and actual request times are separate from publication dates. Every candidate carries `matchBy: referencePeriod`, the source month, `publicationDate: null`, and `evidenceType: secondary-data-availability`, pointing to the Cleveland landing page. It never invents a dated BLS URL.

An already-retained month does not create a new review item. A new month enters the source-review queue. The original 54 BLS publication facts, precise source strings, units, notices and receipts remain unchanged. This source does not automatically append publication facts or replace the current BLS indicator catalog.

## Request and reporting behavior

Only the two fixed public CSVs are requested; no BLS HTML/RSS request, API key, account registration, contact request or proxy is needed. Each request requires exact HTTP 200 without redirects, a 2 MiB cap, 12-second complete-request deadline, UTF8/CSV/schema validation and honest project identity. Temporary errors have at most two attempts per source with bounded delay. Denials/schema failures are not retried; rate limits and fresh Retry-After instructions are respected across the shared host. Unread rejected bodies are canceled.

The maintenance summary shows the latest aligned month, source scope, accepted receipts/failure codes and reuse notices. Source failure fails the independent maintenance job; it cannot block unrelated statistical data deployment. A successful secondary check does not conceal that original BLS website discovery is unavailable—it replaces that operational check with a differently labelled capability.
