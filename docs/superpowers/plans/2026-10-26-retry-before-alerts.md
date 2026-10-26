# Retry before alerting

Goal: automatically retry temporary source/update failures before sending GitHub failure alerts. Preserve current UI/colors, source definitions, credential boundaries and publication/retention policies.

Use original jobs, not cross-run reruns: old workflow reruns retain the original SHA and can conflict with newer publication/deployment. No new Actions write permission, scheduling service or state store.

- [x] Enable three total attempts for automatic source HTTP requests, with 5/30-second backoff and a 60-second total wait budget. Honor Retry-After without retrying early. Permanent authentication, schema, admission and coverage failures remain explicit. Manual collectors retain their current single-attempt default unless enabled.
- [x] Preserve immediate BLS v1 HTTP503 to registered-v2 routing. Retry only transient network/HTTP failures on the eligible endpoint, never credential/quota/data-validation rejection. Validate the registered receipt against the actual completion clock after a delayed request.
- [x] Retry safe update commands and deployment within their original jobs, with finite attempts and cancellation support. Retry only the exact verified snapshot commit push, recognizing lost acknowledgements and rejecting remote-main races; never replay whole publication or force push.
- [x] Delay new source/update/freshness alerts while a relevant trusted job is still active within its timeout. Keep annual renewal reminders independent. Final job/source outcomes still determine alerts, with existing deduplication/recovery rules.
- [ ] Test retry success/exhaustion/cooldown/permanent errors, cancellation, BLS route/privacy/clock, publication conflicts and active-job alert deferral. Independently review; run appropriate full/hosted checks and verify unchanged live UI assets.

Limits: bounded retries do not repair persistent invalid data/credentials or upstream outages. Final failures remain visible with original retained data/timestamps. GitHub platform scheduling/delivery limits still apply.

Review: three independent focused reviews covered source/BLS/clock policy, command/workflow/notification behavior and guarded publication. Preserved the original ten-minute allowance for each deployment attempt in a35-minute job; CI deferral is bounded to105 minutes and registered-check deferral to10 minutes. This fits the expanded same-run retry budget without prematurely cancelling a previously valid slow deployment. An unrelated queued run cannot silence the final completion-triggered alert. Both optional providers reuse their verified artifact; annual BLS renewal dates remain unchanged.

Focused verification:86 integrated tests pass, including8 new publication retry checks and20 pre-existing publisher/race/immutable-history/CLI tests verified separately. Full-suite, static build and hosted validation follow before completion. No site assets, observations or dependencies were changed.

Full local verification completed: **1,661 tests passed**, zero failures, followed by a successful static build and 163-asset HTTP smoke check. The final deployment timeout/notification bounds were also verified by the focused workflow/notifier tests and independent review. Source HTTP tests inject their wait/clock rather than sleeping; permanent errors, cooldown deferral, retry exhaustion and eventual success are all covered without hitting live providers. Hosted validation follows after publication.
