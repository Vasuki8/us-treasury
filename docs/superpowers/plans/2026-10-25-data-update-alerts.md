# Data-source and automatic-update GitHub alerts

Goal: extend existing cloud GitHub notifications to all 30 statistical/calendar inputs and automatic update failures, preserving UI/colors and data policies.

Reuse assigned issues and mentioned transitions. Keep source collection, planning/refresh/testing/deployment, independent publication upkeep and daily freshness as separate evidence. Skipped/no-op runs cannot recover failed stages; targeted refreshes recover only attempted sources.

- [x] Emit collection-only status after attempted collectors finish and before strict rejection. Keep known IDs/statuses, normalized dates, cache flags and bounded HTTP codes; no raw errors, URLs, responses, keys or observations.
- [x] Retain safe reports from manual checks and automatic refreshes. Extend the existing cloud completion/daily workflow; read trusted main metadata and bounded JSON artifacts as data only.
- [x] Test partial-source recovery, cached BLS, skipped/no-op runs, failed deployment, deduplication, interrupted notifications, trusted runs and privacy. Keep BLS renewal behavior working.
- [ ] Independently review, publish, verify hosted source checks/completion handling/assigned test notification, and compare live assets. Future failures/schedules are tested, not fabricated live.

No extra service, dependency or credential. Notifier permissions remain contents/read, Actions/read and issues/write, with no source keys or publishing access. GitHub delivery settings and platform availability still apply.

Implementation: collection callback writes a whitelisted manifest before strict rejection. Existing workflow jobs retain separate `official-refresh-status` and `official-source-check-status` artifacts. The cloud workflow runs both existing BLS maintenance and the new update monitor as independent always-run steps. Shared assigned-issue/transition code preserves existing BLS issue markers and renewal dates. Recent trusted run metadata plus the actual completion-triggered run admit older retries; bounded ZIP/JSON reading never extracts executable code. Source recovery uses actual attempts; stage recovery uses actual completed jobs; evidence watermarks prevent old results from reversing newer status.

Review regressions cover first failures without retained data, actual retry/deployment completion times, stale/deployment recovery, direct triggering-run precedence and silent evidence updates. Full-suite verification found that an intentionally retained collector response could be rejected by the report builder; the reporter now records `unverified` without imposing a new publication gate. Strict `ok` still requires an actual fresh valid capture. The unchanged legacy-calendar publishing assertions pass, with added report-state assertions. Full-suite and hosted verification follow before completion.
