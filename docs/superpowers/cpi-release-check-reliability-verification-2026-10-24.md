# CPI release-check reliability: verification and remaining access blocker

## Outcome

The maintenance code improvements are implemented and independently reviewed on branch `codex/cpi-release-check-reliability`, runtime-code commit `47ca827f15213fa63b56d60263d0231830944f52`. They are **not merged or deployed**, because the hosted check still receives HTTP403 from both fixed official CPI sources. Restored automatic source access has not been established.

The live site remains on the previously verified application assets `b56c1a3eb5476c93`. No `src/`, stylesheet, index, existing publication archive or current snapshot file changed in this fix. User constraint: preserve current UI/colors.

## Verified changes

- Official documented CPI Atom news-release feed as primary discovery, dated archive-index fallback, explicit rolling versus archive coverage and latest-reviewed-release overlap.
- Honest existing project request identity, correct Atom/RSS content negotiation, exact200/manual-redirect checks, strict XML/URL/entry/date validation,2MiB limits and12-second request/body deadlines.
- Bounded transient-only retries, source-denial/schema/redirect no-retry behavior, response cancellation, and respectful rate-limit/Retry-After deferral including numeric overflow.
- Structured accepted receipts and sanitized failed-attempt evidence. No numerical admission or invented publication timestamps.
- Maintenance failure is visible even when another family's review queue has higher aggregate status priority. Unrelated source checks and existing deployment gates remain independent.

## Automated and hosted evidence

- Full local suite: **1,499 passed, zero failed**,223 seconds. Final focused source/integration/report/workflow suite: **30 passed**. Red/green regressions cover the actual reported request/error path.
- Independent review found no remaining material correctness issue. Its source/report/workflow tests passed30/30, including namespace, receipt, retry, deadline and gate checks.
- Build/smoke succeeded and confirmed **163 unchanged website assets** under `b56c1a3eb5476c93`.
- [Hosted branch run40062327314](https://github.com/Vasuki8/us-treasury/actions/runs/40062327314): Node22 and Node24 verification/build/smoke passed. Refresh and both deployment targets were correctly skipped for the branch.
- The hosted upkeep job failed visibly. Its downloaded JSON artifact12547742955 shows `release-feed HTTP_403` and `archive-index HTTP_403`, one request per endpoint, no candidates, no accepted provenance and all54 approved CPI facts retained. Check started `2026-10-24T04:26:25.446Z`.
- Identified-client local checks at04:21 and04:24 UTC also returned403 on both endpoints. Earlier normal local requests had succeeded, demonstrating that a successful local fetch alone did not settle hosted access. Neither the precise BLS denial rule nor an approved alternative access configuration is established.

## Required next step

BLS must clarify or permit the checker access, or provide an approved equivalent discovery surface. The [prepared request](../cpi-source-access-request.md) contains exact URLs, request identity, cadence, limits and failure evidence. No external message has been sent; submission requires the owner's authorization and reply contact.

Keep the tested fix branch available for completion after source access is resolved. Do not relabel the current access denial as a successful automatic check, synthesize release identities from a calendar, or bypass the denial.
