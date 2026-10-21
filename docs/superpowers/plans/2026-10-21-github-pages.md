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
- [ ] Enable repository Pages in workflow mode, commit and push the concrete configuration.
- [ ] Verify the exact commit's Actions deployment, HTTPS public URL, all assets, deep links and browser rendering.

Configuration is checked through review and the real workflow run; no tests that merely restate YAML are added.

## Pre-publication evidence

All 86 local Node tests passed; production build and HTTP smoke check passed with 12 assets. An independent workflow review found no blockers. GitHub's Pages API created the site with HTTP 201 and a subsequent read confirmed `build_type: workflow`, `https_enforced: true`, and the intended public URL. The commit containing this configuration triggers the initial tested deployment; its result is visible in the repository's Actions and `github-pages` deployment history.
