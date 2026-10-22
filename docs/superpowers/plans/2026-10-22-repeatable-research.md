# Repeatable Research Implementation Plan

> **For agentic workers:** Implement independent core/source tasks with focused subagents; root integrates Graphite UI and reviews their interfaces. User requested implementation, local tests and push to the existing repository/deployment.

**Goal:** Deliver the website review's third milestone: a saved result remains interpretable after refresh and can be reconstructed without a mutable dashboard link.

**Architecture:** Reuse the registry, date/comparison/export models and immutable source archives. Add a local research library: named workspaces reopen current data; pinned portable packages freeze inputs, displayed observations, formulas, assumptions, provenance, rights and exact exports. Add a linked exact-date comparison cursor and an evidence-based capture-change feed. Backfill selected already admitted feeds; admit a small genuine official publication-vintage dataset separately from retrieval history.

**Tech stack:** Existing native JavaScript/Node static application, local browser storage, browser SHA256 and downloadable JSON/CSV. No new dependency, account, paid service, infrastructure, external notifications or hosting changes.

**Spec:** User-supplied website review PDF, third milestone and acceptance task 8 on page 9. Graphite remains the default. Earlier source/advertising rights, exact dates, missingness and immutable-history requirements persist.

## Design and decisions

- Named workspaces store a validated route/configuration and a user label. They explicitly reopen the latest snapshot, rather than promising frozen values.
- Pinned packages are versioned, UUID-identified, checksummed, self-contained records. They include selected full retained measurements, exact displayed panels/window/baselines, per-series metadata/rights/provenance, creation and source retrieval dates, and the exact CSV. Relevant specialist inputs, assumptions and exports are frozen when pinning a specialist result. JSON download/import makes the record independent of browser storage and future mutable links.
- A checksum detects content changes; it does not authenticate a provider or imported file. Imports stay read-only, never change the live catalog or execute/fetch file content, validate bounds/types, recompute displayed/export data and reject unsafe CSV. Unknown/removed IDs in a valid saved package remain readable using frozen metadata. Storage failure retains session state and an explicit download option; no silent overwrite or pruning.
- Comparison cursors synchronize one exact UTC reference date across panels. A panel with no observation on that date shows unavailable, not a nearest observation or interpolated number. Pointer and keyboard interactions use the same coordinator; curve maturity axes remain independent.
- Change notifications stay inside this browser. They distinguish newly captured periods, revisions, metadata/coverage changes and failed collectors, and link to retrieval evidence. Capture confirmations are not new economic releases. First visits establish a baseline; unknown historical release times stay unknown. No system-notification permission, email or subscription service is added.
- Longer backfills use existing approved feeds and units, with genuine current retrieval times; exact scope will be recorded after source inspection. BLS remains limited by unregistered API rules. Immutable previous captures are preserved.
- Official publication vintages require an agency-authored dated release/archive workbook. A selected GDP example can be admitted only with exact endpoint, units, release-date evidence, rights and parser validation. Publication-date views are separate from Meridian's Captured by replay. Supplemental/calendar replay remains unavailable unless its original evidence is actually retained; packages can freeze the current chosen context without claiming historical server state.

## Source mapping

| Work | Primary source / policy | Gate |
| --- | --- | --- |
| Longer GDP/PCE/spending/income coverage | Existing BEA NipaDataQ.txt / NipaDataM.txt and dataset admission | Same official IDs and transformations; preserve exact missing baselines and separate reference/retrieval dates. |
| Longer activity/housing coverage | Existing Board G.17 and Census RESCONST files | Same units, index base, adjustment and attribution; expand explicit retained cutoff only. |
| Longer claims coverage | Existing DOL ETA national historical XML | Deferred: retain current 52-week scope. BEA/G.17/housing provide the selected longer backfills in this milestone; no DOL request expansion. |
| Selected publication vintages | Candidate BEA GDP/GDI vintage-history workbook linked from official GDP releases | Exact dated workbook, original/revised concepts, published release dates and public-domain review; separate immutable factual archive and build admission. No current-table reconstruction of first reports. |
| Workspaces/packages/change feed | Existing admitted snapshots and source-partitioned immutable archives | No new third-party source or implied agency release verification. |

## Tasks and ownership

- [x] **Core library and packages** — new `src/research-workspaces.js`, `research-packages.js`, `research-library.js`; minimally inject a catalog into model comparison/export. Subagent owns pure interfaces and regression-first tests for immutability, missingness, metadata changes, corrupt/malicious imports, formula-safe CSV, bounds, duplicates, quota and session fallback.
- [x] **Official publication sample and backfills** — source subagent researches exact official evidence and then owns focused collector/policy/tests/docs. Root coordinates actual capture and admission, preserving all existing history bytes. Backfill old values are newly captured, not historically available to Meridian.
- [x] **Linked cursor and capture-change model** — root adds pure helpers/tests, connects charts with exact-date synchronization and accessible keyboard readouts; adds per-browser seen checkpoints and a factual change feed using selected source archives.
- [x] **Graphite library UI and application integration** — root adds a research-library route, labeled save/pin/import/download/open controls and read-only frozen viewer. Reuse panels/tables/date controls and preserve existing routes/exports. Show loading, empty, corrupted-file and storage states; distinguish editable/latest workspaces from immutable/frozen packages.
- [ ] **Acceptance and delivery** — verify frozen package equality after simulated refresh; source rights and publication dates; archive baseline equality; formulas/CSV/missing dates/scenarios; desktop/mobile/keyboard/errors; full tests and production smoke. Push only intended code/docs/new captures, verify Actions and exact live assets/pages. Leave pre-existing exports/, output/ and tmp/ untouched.

## Review focus

- A package must not read current observations, methods or module assumptions after it is pinned.
- A shared cursor must not silently select neighboring dates across frequencies.
- Change confirmations, historical backfills and actual value revisions have distinct meanings.
- Official release history must not be inferred from today's revised table or current schedule.
- Local storage and imported JSON are untrusted/bounded; quota failure cannot discard a user's existing records.

## Rulings and evidence

Ruling: implement browser-local notifications and portable local files within the existing static app. This meets the repeatable-research workflow without adding infrastructure or requesting new credentials. Notifications require returning/reloading the site; they are not a background delivery service.

Ruling: retain the existing checkout and main-branch delivery convention authorized throughout this project. Only unrelated untracked user folders are present; no destructive cleanup, new worktree or scope-expanding infrastructure is needed.

Local acceptance completed: 760 tests, production build/85-asset smoke, immutable 31-capture baseline audit, actual portable JSON/CSV round-trips, desktop/mobile and keyboard checks. Independent review found and regression-tested historical metadata precedence, frozen-chart transforms/evidence labels, file-input focus, large-package limits and stale-tab persistence. Detailed scope and evidence are recorded in [milestone acceptance](../../website-review-milestone-3.md). Delivery verification remains the final step after the authorized push; no live claim is based on local tests.
