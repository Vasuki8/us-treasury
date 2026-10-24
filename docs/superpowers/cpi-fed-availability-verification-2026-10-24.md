# Alternate CPI automatic-check verification

User-approved change: use another reliable CPI source without waiting for BLS website access, preserving current UI and colors. Implementation commit `216627d` on `codex/cpi-fed-availability`, based on live-main `63afd90`. The earlier BLS-only investigation remains separately preserved.

## Source and method

The selected source is the Cleveland Fed's explicitly linked headline/core CPI CSVs. Only aligned usable index-observation existence for the latest completed Eastern reference month is checked. The rounded indexes and annualized monthly changes are discarded. Source/CC BY-SA notices, actual response hashes, retrieval times and narrow availability metadata remain in operational reports. See [source review](../cleveland-cpi-availability-source-review.md).

Actual local identified requests accepted both files on October 24. The integrated check at `2026-10-24T11:48:29.530Z` returned HTTP200 for both and aligned September2026, with all54 original CPI facts retained and no review candidates. Each file has717 reference rows/716 usable observations; October2025 is excluded. No blocked BLS HTML/RSS endpoint is requested by the automatic CPI path.

New source months queue for review through `matchBy: referencePeriod`, with `publicationDate: null` and a Cleveland source URL. Existing periods do not create duplicate release candidates. No original BLS numerical publication record, current indicator history or immutable snapshot capture is changed. The source can lag BLS; original publication dates/instants are not independently verified by this check.

## Automated verification

- Full local suite: **1,501 passed, zero failed**,187 seconds.
- Final focused source/model/report/workflow integration: **32 passed**. Independent review repeated32 focused checks with no remaining material findings.
- Red/green coverage includes reference-period matching, rights-notice preservation, actual request-path integration, completed-month and Eastern boundary guards, dropped empty CSV records, latest-row missingness, unequal source periods, stale observations, exact schemas, no serialized numerical values, bounded bodies/deadlines/retries, fresh Retry-After and rate-limit deferral.
- Real source CSVs replayed offline with the same aligned reference month and availability counts. Synthetic integration requests reject any attempt to contact a BLS host.
- Build/smoke: **163 assets verified**, asset version `b3aca80e706a77f5`. The only changed browser-copied module is the operational `publication-upkeep.js` model; all visual shell/page/chart/style files are unchanged.
- Both the original54-fact CPI archive and all existing GDP/claims archives, snapshots and source-history files have no diff.

## Hosted and live acceptance

- [Branch run40091894564](https://github.com/Vasuki8/us-treasury/actions/runs/40091894564) confirmed actual hosted access at `2026-10-24T11:56:39.779Z`. The upkeep job succeeded, and downloaded artifact12559600898 shows `cleveland-fed-cpi`, `checked`, latest reference month `2026-09-01`,54 retained CPI facts and no new review items.
- Both fixed CSV requests returned HTTP200 on their first attempt. Actual hosted receipts: headline `2026-10-24T11:56:40.386Z`, core `2026-10-24T11:56:41.499Z`. Their body hashes match the reviewed local source captures listed in the source review. No BLS HTML/RSS request was needed.
- Hosted Node22 and Node24 regression/build/smoke jobs passed. Both deployment targets were correctly skipped for the branch. This establishes access from the same hosted environment used by the production upkeep job.
- Main-hosted acceptance, deployment and exact live assets are recorded after completion.
