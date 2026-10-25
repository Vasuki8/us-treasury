# BLS cloud alerts implementation plan

Goal: move backup failure alerts and the annual renewal reminder to GitHub so they work with Codex and the computer off. Preserve current website UI, colors, data and collector behavior.

Design: retain the read-only Monday 09:17 Toronto registered check. A separate main-only GitHub workflow runs after that check and daily at 09:43 Toronto. It reads trusted check results and maintains issues assigned to Vasuki8, using the repository token with Actions read / Issues write permissions and no BLS key. GitHub notification settings control inbox/email/mobile delivery. No added service, dependency or paid account.

- [x] Add tests for healthy silence, failed-check deduplication/recovery/recurrence, missed weekly schedules after 24-hour grace, trusted-run filtering, reminder date boundaries/overdue catch-up, explicit renewal confirmation and API error privacy.
- [x] Add the small dependency-free maintenance script and public date configuration. Confirmed registration is 2026-10-25; first scheduled check is 2026-10-26; reminder begins 2027-09-25, 30 days before 2027-10-25. API success or issue closure never establishes renewal.
- [x] Add the cloud completion/daily/manual workflow with least permissions and serialization. Do not execute triggering branch code or artifacts. Include an explicitly labeled manual notification test, without manufacturing a BLS failure or premature renewal reminder.
- [ ] Run targeted tests, independent review and a real hosted notification test plus registered-check completion trigger. Verify issue assignment and deduplication; future dates are tested with a controlled clock, not claimed observed live.
- [ ] Publish the backend changes, document notification settings and renewal-date upkeep, then pause the two replaced local automations using the app tool after cloud verification.

Limits: GitHub schedules are best effort; a GitHub outage or disabling all repository Actions also prevents this monitor. Public-repository schedules can disable after 60 days of inactivity. Website refreshes currently provide ongoing activity, but no absolute delivery guarantee is implied.
