# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Meridian at `https://vasuki8.github.io/us-treasury/` and automatically deploy verified pushes to `main` through GitHub Actions.

**Architecture:** Extend the existing Node 22/24 verification workflow. Upload the already-tested Node 24 `dist/` as the Pages artifact, then deploy in a dependent job after both verification jobs succeed. Enable repository Pages once with GitHub Actions as the publishing source.

**Tech Stack:** Native JavaScript modules, Node 22/24, GitHub Actions, GitHub Pages.

**Spec:** The user's request in this chat to make the website live on GitHub Pages with automatic GitHub Actions deployment; the current static application and commercial-data policy are retained.

## Global Constraints

- Continue development in the current local checkout and push to `Vasuki8/us-treasury`.
- Serve only the built app and commercially reviewed official snapshots.
- Retain relative asset paths and hash routes under `/us-treasury/`.
- Deploy only pushes/manual runs on `main`, after all verification succeeds.
- Keep deployment permissions in the deployment job; do not add long-lived repository secrets.
- Preserve unrelated local `exports/` files.

## Review Focus

- Pull requests and manual runs on other branches must not publish.
- Deployment must wait for both Node matrix checks and use their verified artifact.
- A newer push must not interrupt an in-progress Pages deployment.
- Assets and deep links must resolve below the repository URL prefix.
- Data rights checks, source notices and snapshot timestamps must survive publication.

## Task 1: Configure and verify automatic publication

**Files:** Modify `.github/workflows/ci.yml` and `README.md`; record verification in this document.

**Interfaces:** Existing `npm test`, `npm run build`, `node scripts/check-build.mjs`, and `dist/` output. Pages publishes the `github-pages` artifact and returns the public page URL.

- [x] Extend CI with a main-only Pages artifact upload and dependent deployment job using pinned official actions.
- [x] Update operating instructions, deployment URL, rollback procedure and relevant hosting restrictions.
- [x] Review workflow triggers, permissions, artifact and concurrency; run all local tests, build and HTTP smoke check.
- [x] Enable repository Pages in workflow mode, commit and push the concrete configuration.
- [x] Verify the exact commit's Actions deployment, HTTPS public URL, all assets, deep links and browser rendering.

Configuration is checked through review and the real workflow run; no tests that merely restate YAML are added.

## Pre-publication evidence

All 86 local Node tests passed; production build and HTTP smoke check passed with 12 assets. An independent workflow review found no blockers. GitHub's Pages API created the site with HTTP 201 and a subsequent read confirmed `build_type: workflow`, `https_enforced: true`, and the intended public URL. The commit containing this configuration triggers the initial tested deployment; its result is visible in the repository's Actions and `github-pages` deployment history.

## Publication verification

- Configuration commit: `8b0f652f0061dfb273a6322dac87d18ab0da15ac`.
- [Initial Actions deployment](https://github.com/Vasuki8/us-treasury/actions/runs/39646064438): Node 22, Node 24 and Pages deployment all succeeded.
- [Public HTTPS site](https://vasuki8.github.io/us-treasury/): HTTP 200. All 12 imported assets loaded below `/us-treasury/` and matched the exact committed bytes used by CI. Local build content also matched; one local file had a Windows CRLF that Git normalized to LF, so the byte-level comparison used the committed Git objects.
- `README.md` and `scripts/data-policy.mjs` return 404 from the site, confirming only the build artifact was published.
- Browser QA: all five pages at 1440 px and 390 px, no page overflow, rendered charts, source notices on every route, and indicator deep-link reload. No browser console warnings or errors.
- Saved local proof: `test-results/github-pages-live.png` (ignored verification output).

The subsequent documentation commit records these results and exercises the same automatic deployment path again without changing app assets.
