# Daily official data refresh verification — October 21, 2026

## Scope and behavior

The existing GitHub Actions workflow now schedules one full refresh at 23:37 UTC daily, after Treasury's usual 18:00 Eastern yield availability window in both daylight and standard time. A boolean `refresh_data` manual input defaults to false. Scheduled runs and manual `main` runs with that input enabled fetch the five statistical collectors and six separate release-calendar/timing collectors. Routine push/PR verification remains offline. Existing commercial-reuse allowlists and attribution checks remain unchanged.

The main-only refresh job uses `--require-all`: each attempted source must succeed before the CLI replaces the snapshot. An unavailable BLS next-year schedule that has never been captured remains a visible coverage warning; failure to retrieve previously captured coverage rejects publication. Default local partial-refresh behavior remains available without the strict flag.

The candidate passes Node 24 tests, build and local HTTP smoke checks before a helper stages only `src/official-snapshot.js`. The helper validates the starting HEAD, clean index, absence of unrelated tracked edits and current remote main, then creates a bot commit and performs a normal push. A competing push fails safely. It emits a commit SHA only after publication succeeds. No-change runs emit the validated existing SHA without an empty commit.

Both Node 22/24 verification jobs and hosting configuration use that exact emitted SHA. Deployment uses the same-run verified artifact: bot pushes with `GITHUB_TOKEN` do not trigger another push workflow. Only the refresh job receives repository `contents: write`. Cloudflare activation remains deferred; the existing selected-host switch and Pages fallback are preserved.

## Local evidence

- `npm run data:refresh -- --require-all` succeeded against every live official source at approximately 22:48 UTC. All five statistical sources and all six calendar/timing sources reported successful captures. The result contains 218 dated calendar entries plus separate ongoing Treasury yield timing.
- `npm test`: initially **241 passed, 0 failed**; after adding BLS bot-identification and request-pacing coverage, **244 passed, 0 failed**. This includes nine real-Git publisher tests and strict/default CLI integration tests in disposable workspace directories.
- Real-Git tests cover snapshot-only publication, ignored untracked files, unchanged snapshots, unrelated and pre-staged edits, invalid/mismatched starting SHAs, stale remote rejection, a competing push injected between the remote check and push, and success/failure CLI outputs.
- Real strict CLI execution with mocked HTTP 503 responses exited unsuccessfully and preserved the snapshot byte for byte without creating a temporary replacement. Default local mode still saved retained-source status. The uncaptured BLS next-year case succeeded with its explicit warning; loss of previously captured coverage was rejected.
- `npm run build` passed commercial-data policy validation.
- `node scripts/check-build.mjs` passed the local HTTP check for 12 assets.
- Official actionlint **1.7.12**, downloaded with its archive SHA256 verified against the official release checksums, accepted `.github/workflows/ci.yml` without diagnostics.
- `git diff --check` passed.
- Independent review identified implicit skipped-ancestor handling in deployment guards. Both host guards now explicitly require `!cancelled()` and successful verification; actionlint was rerun successfully after that correction. No other actionable findings were reported.

## Remote acceptance checks

The ordinary [main push run 39689336879](https://github.com/Vasuki8/us-treasury/actions/runs/39689336879) passed both Node verification jobs and deployed GitHub Pages with refresh skipped, confirming the dependency guards.

The first [full-refresh dispatch 39689430763](https://github.com/Vasuki8/us-treasury/actions/runs/39689430763) reached every collector but rejected the candidate because the BLS annual calendar returned HTTP 403. All other attempted collectors completed successfully. Snapshot commit and deployment were skipped, preserving the prior published snapshot. Remote end-to-end refresh publication is therefore not yet established.

Investigation found that the original BLS calendar requests used Node's generic identification and fetched both annual pages concurrently. [BLS's automated retrieval policy](https://www.bls.gov/bls/blsterms.htm) reserves blocking of unidentified owners and excessive activity. The collector now identifies the bot with the repository's enabled issue tracker for owner contact, waits one second between annual requests and stops immediately on a current-year denial. Three regression tests cover identification, asynchronous spacing and early exit. A local identified request still returned 403; the correction does not establish restored source access. No alternate host, proxy or generated schedule was introduced.

Once source access or an explicitly chosen cached-source policy allows publication, exercise the remote snapshot push, verification of its emitted commit and same-run deployment. Pull that generated snapshot commit and compare the deployed assets with its build.

The daily cron's future execution time remains best effort under GitHub's scheduler. Public repositories can disable scheduled workflows after 60 days without activity. See the linked official GitHub documentation in the README.
