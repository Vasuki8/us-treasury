# BLS backup maintenance

User request: periodic registered-backup checks and advance annual-renewal reminders, with current UI/colors unchanged.

- Run the existing registered-only GitHub workflow each Monday at 09:17 America/Toronto. Retain manual dispatch, main-only secret use, read-only permission, safe 31-output report and no publication/deployment.
- Add a quiet weekly thread heartbeat on Monday at 11:00 America/Toronto to inspect the latest registered-check result, alert on failed or missing expected runs, and deduplicate unchanged incidents. Actual API validation runs in GitHub even if the desktop is off; chat follow-up requires the local app to run.
- Anchor the renewal reminder to the actual registration/last-renewal date, requested from the user. Configuration and successful retrieval dates are not expiry evidence. Request reminders 30 days before the annual anniversary; keep credential values out of all prompts and reports.
- Verify the workflow schedule/main/read-only guards with targeted tests, independently review the small patch, publish it without changing website assets, run the registered check once and verify automation creation/readback. The future cron firing is not represented as already observed.

Execution: observed the intended failing schedule assertion before adding the schedule. Existing native workflow/checker are reused; no new runtime or frontend code.
