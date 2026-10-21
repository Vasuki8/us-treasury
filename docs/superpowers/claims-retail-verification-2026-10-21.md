# Claims and retail verification — 2026-10-21

The two previously unavailable indicators now use captured official responses. Cloudflare account activation remains deferred; the existing GitHub Pages workflow continues publishing main.

## Captured data

- DOL ETA national historical XML: 52 weekly observations, 2025-09-27 through 2026-09-19. Latest seasonally adjusted count `198,000` becomes `198` thousand claims. Retrieved `2026-10-21T18:49:22.883Z`; response SHA256 `515acceb7c3022f8fd010b4e2352f9011783ce3a78496df15657b21b9c627cdd`. The historical feed is 32 days behind the retrieval date and may trail the latest advance release. That limitation appears on the series, Labor page, overview/catalog badges, source status and CSV rows.
- Census MARTS bulk ZIP: 36 monthly growth observations, 2023-10 through 2026-09. September's original sales level `745021` and August's `739322` million dollars give `100 × (745021 / 739322 − 1) = 0.7708413925190838%`, displayed as `0.8%`. Retrieved `2026-10-21T18:49:22.716Z`; ZIP SHA256 `5a403391d7f15ca1a23080ba095ff5dba6a9220f23323704d7458178962c6589`. The latest estimate is labeled advance, nominal and subject to revision.

Historical publication timestamps remain null. File modification, report execution and retrieval dates remain separate. Other agencies retain their previously captured data and provenance.

## Verification evidence

- `npm run data:refresh -- --sources=dol,census`: both official feeds succeeded; commercial-use scope validation passed before snapshot replacement.
- `npm test`: 126 passed, zero failed, on local Node 24.20.0. Fixtures cover schema changes, missing periods/counts, duplicates, malformed data, ZIP bounds/CRC/output limits, response hashes, calculations, source policy, coverage labels and CSV inputs. Existing last-good refresh retention tests remain passing.
- `npm run build`: passed, including commercial data policy validation.
- `node scripts/check-build.mjs`: passed for all 12 static application assets.
- `git diff --check`: passed.
- Independent read-only review found no actionable correctness issue; 33 source/policy tests also passed independently.
- Browser QA at 1440px desktop and 390px mobile: overview, labor, claims detail, retail detail, catalog and comparison show the connected observations, week-ending dates, Census program credit and claims coverage. No page overflow or browser errors/warnings observed. Claims methodology and chart readouts preserve weekly meaning. Census source notes expand/collapse; the historical-claims coverage remains visible. CSV assertions preserve exact levels/baselines, Census credit and the claims coverage note.

The minimum Node version is 22.2 because native ZIP checksum validation uses `node:zlib` CRC32. GitHub Actions separately verifies current Node 22 and 24 after pushing. Deployment status is available in the repository's Actions history; do not infer a Cloudflare publication from these local checks.
