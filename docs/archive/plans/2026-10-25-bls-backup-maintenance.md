# BLS backup maintenance

User request: periodic registered-backup checks and advance annual-renewal reminders, with current UI/colors unchanged.

- Run the existing registered-only GitHub workflow each Monday at 09:17 America/Toronto. Retain manual dispatch, main-only secret use, read-only permission, safe 31-output report and no publication/deployment.
- Add a quiet weekly thread heartbeat on Monday at 11:00 America/Toronto to inspect the latest registered-check result, alert on failed or missing expected runs, and deduplicate unchanged incidents. Actual API validation runs in GitHub even if the desktop is off; chat follow-up requires the local app to run.
- Anchor the renewal reminder to the actual registration/last-renewal date, requested from the user. Configuration and successful retrieval dates are not expiry evidence. Request reminders 30 days before the annual anniversary; keep credential values out of all prompts and reports.
- Verify the workflow schedule/main/read-only guards with targeted tests, independently review the small patch, publish it without changing website assets, run the registered check once and verify automation creation/readback. The future cron firing is not represented as already observed.

Execution: observed the intended failing schedule assertion before adding the schedule. Existing native workflow/checker are reused; no new runtime or frontend code.

Completed verification: all 15 targeted workflow/checker tests passed. Independent review found no material issue. Published c9f3374 and manually exercised the same read-only job in run 40235963476: `passed: true`, all 31 outputs, retrieval `2026-10-25T21:32:31.345Z`, without modifying site data. The first actual weekly cron firing is expected October 26; it has not yet occurred.

App automations are active and their saved settings were read back: **BLS backup weekly health** reviews Monday at 11:00 Toronto and stays quiet on unchanged healthy results; **Renew BLS registration** first reminds September 25, 2027 at 09:00 Toronto. The user confirmed registration on October 25, 2026, so this is 30 days before the first annual anniversary. The weekly follow-up deduplicates incidents, flags missed checks, supplies a missed-reminder fallback within the renewal window, and updates the existing annual reminder when the user explicitly confirms a later renewal date. API success is never treated as renewal evidence. GitHub validation runs independently of desktop availability; local chat follow-ups/reminders require Codex to run. Current UI, colors, data, collector code and dependencies are unchanged.
