# Daily official data refresh verification — October 21, 2026

## Scope and behavior

The existing GitHub Actions workflow now schedules one full refresh at 23:37 UTC daily, after Treasury's usual 18:00 Eastern yield availability window in both daylight and standard time. A boolean `refresh_data` manual input defaults to false. Scheduled runs and manual `main` runs with that input enabled fetch the five statistical collectors and six separate release-calendar/timing collectors. Routine push/PR verification remains offline. Existing commercial-reuse allowlists and attribution checks remain unchanged.

The main-only refresh job uses the user-approved `--allow-cached-bls-calendar` policy. Every selected source must succeed except an actual HTTP 403 from an exact current/next-year official BLS annual-calendar URL, without a redirect. This exception requires a nonempty, valid prior BLS capture and revalidates its source policy and dated records. The retained events, provenance and retrieval time stay unchanged; BLS remains in error/cached state and the aggregate calendar remains partial. The attempt time and structured HTTP failure are recorded, and Actions receives a warning and summary. A later successful capture clears the failure and cached policy list automatically.

Missing or invalid prior BLS data, other BLS errors and any other attempted source failure reject the candidate before writing. `--require-all` remains independently available and rejects the identical BLS 403 candidate. The flags are mutually exclusive. The default local partial-refresh behavior remains available. Uncaptured next-year coverage limitations remain visible and do not generate dates.

The candidate passes Node 24 tests, build and local HTTP smoke checks before a helper stages only `src/official-snapshot.js`. The helper validates the starting HEAD, clean index, absence of unrelated tracked edits and current remote main, then creates a bot commit and performs a normal push. A competing push fails safely. It emits a commit SHA only after publication succeeds. No-change runs emit the validated existing SHA without an empty commit.

Both Node 22/24 verification jobs and hosting configuration use that exact emitted SHA. Deployment uses the same-run verified artifact: bot pushes with `GITHUB_TOKEN` do not trigger another push workflow. Only the refresh job receives repository `contents: write`. Cloudflare activation remains deferred; the existing selected-host switch and Pages fallback are preserved.

## Local evidence

- `npm run data:refresh -- --require-all` succeeded against every live official source at approximately 22:48 UTC. All five statistical sources and all six calendar/timing sources reported successful captures. The result contains 218 dated calendar entries plus separate ongoing Treasury yield timing.
- After approval of the cached-BLS policy, `npm run data:refresh -- --allow-cached-bls-calendar` succeeded against the live official sources at approximately **23:14 UTC**. All five statistical sources and the other five calendar/timing sources refreshed. BLS returned 403 and retained its **22:48:25.560 UTC** capture, including all original records and provenance. The calendar still contains 218 dated entries plus separate ongoing yield timing.
- Final `npm test`: **257 passed, 0 failed**, including nine real-Git publisher tests and real strict/default/cached-policy CLI integration tests in disposable workspace directories.
- Real-Git tests cover snapshot-only publication, ignored untracked files, unchanged snapshots, unrelated and pre-staged edits, invalid/mismatched starting SHAs, stale remote rejection, a competing push injected between the remote check and push, and success/failure CLI outputs.
- Real strict CLI execution with mocked HTTP 503 responses exited unsuccessfully and preserved the snapshot byte for byte without creating a temporary replacement. Default local mode still saved retained-source status. The uncaptured BLS next-year case succeeded with its explicit warning; loss of previously captured coverage was rejected.
- The real cached-policy CLI with a mocked BLS 403 published other successful captures, retained the exact BLS capture, and emitted its warning and summary. The identical candidate in strict mode, another failed source, and conflicting flags all failed without replacing any snapshot bytes. Unit tests also reject forged error strings, non-403 statuses, redirects, wrong source paths, missing/empty/invalid/unreviewed/future prior captures, and cached BLS statistical observations.
- `npm run build` passed commercial-data policy validation.
- `node scripts/check-build.mjs` passed the local HTTP check for 12 assets.
- Official actionlint **1.7.12**, downloaded with its archive SHA256 verified against the official release checksums, accepted `.github/workflows/ci.yml` without diagnostics.
- `git diff --check` passed.
- Independent review identified implicit skipped-ancestor handling in deployment guards. Both host guards now explicitly require `!cancelled()` and successful verification; actionlint was rerun successfully after that correction. No other actionable findings were reported.
- Independent review of the cached-policy implementation found no actionable issues and passed 103 focused HTTP/calendar/refresh/model/UI tests. Existing calendar UI explicitly labels retained entries `CACHED SCHEDULE` and shows the original capture time, failed attempt and source error.

## Remote acceptance checks

The ordinary [main push run 39689336879](https://github.com/Vasuki8/us-treasury/actions/runs/39689336879) passed both Node verification jobs and deployed GitHub Pages with refresh skipped, confirming the dependency guards.

The initial strict [full-refresh dispatch 39689430763](https://github.com/Vasuki8/us-treasury/actions/runs/39689430763) reached every collector but rejected the candidate because the BLS annual calendar returned HTTP 403. All other attempted collectors completed successfully. Snapshot commit and deployment were skipped, preserving the prior published snapshot. A second [identified-bot strict run 39690206281](https://github.com/Vasuki8/us-treasury/actions/runs/39690206281) confirmed the same source restriction. This motivated the explicitly approved cached-BLS publication policy.

Investigation found that the original BLS calendar requests used Node's generic identification and fetched both annual pages concurrently. [BLS's automated retrieval policy](https://www.bls.gov/bls/blsterms.htm) reserves blocking of unidentified owners and excessive activity. The collector now identifies the bot with the repository's enabled issue tracker for owner contact, waits one second between annual requests and stops immediately on a current-year denial. Three regression tests cover identification, asynchronous spacing and early exit. A local identified request still returned 403; the correction does not establish restored source access. No alternate host, proxy or generated schedule was introduced.

After pushing the cached-policy change, dispatch a full refresh to exercise the remote snapshot push, verification of its emitted commit and same-run deployment. Pull that generated snapshot commit and compare the deployed assets with its build. This remote acceptance step is not claimed by the local evidence above.

The daily cron's future execution time remains best effort under GitHub's scheduler. Public repositories can disable scheduled workflows after 60 days without activity. See the linked official GitHub documentation in the README.
