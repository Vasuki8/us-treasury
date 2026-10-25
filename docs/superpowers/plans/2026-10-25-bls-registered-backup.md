# Registered BLS Backup Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans task by task, with independent final review.

**Goal:** Add one authenticated BLS v2 fallback after primary v1 HTTP 503, preserving current measurements and UI.

**Architecture:** Reuse existing parsers and immutable storage. Share only exact endpoint constants/matching across admission and collection. Add a read-only registered access check and trusted secret wiring.

**Tech Stack:** Existing Node 22/24 ESM, node:test, GitHub Actions; no new dependencies.

**Spec:** ../specs/2026-10-25-bls-registered-backup-design.md

## Constraints and review focus

- Key only in fixed v2 POST body; no redirects, arbitrary remote error text or credentials in outputs.
- Exact 503 trigger; one primary and at most one backup request; no denial/quota/schema fallback.
- All 20 native inputs and 31 outputs remain complete, with actual v2 provenance and unchanged units/calculations.
- Failed backup retains truthful primary failure and bounded safe diagnosis; prior v1/v2 captures remain admissible and immutable.
- Secret restricted to trusted main collection/check steps; direct check cannot publish or deploy.

## Tasks

1. **Exact endpoint admission** — `scripts/bls-api-policy.mjs`, existing data/economic-depth/macro-coverage policies, refresh cached-receipt guard, focused policy/cached tests. Write failing exact-v2 and forbidden-query/redirect tests; implement matching and run focused tests. Keep original failure allowlist restricted to v1 503.
2. **Collector fallback** — `scripts/sources/bls.mjs`, `tests/bls.test.js`. Add failing tests for conditional fallback, absent key, denied/invalid primary, partial backup, redirect rejection and secret-safe failures. Export registered-only collection for the diagnostic. Implement one bounded backup request and actual endpoint provenance; rerun tests.
3. **Secure activation and check** — `scripts/check-bls-registered-access.mjs`, focused tests, `.github/workflows/ci.yml`, setup/source documentation. Test missing-key/no-network, complete matching family, coverage regression, safe failure output and no snapshot writes. Wire manual read-only job and key only to trusted main collection/check steps.
4. **Integrate and verify** — independent patch review; focused and full tests, build/smoke. Run hosted registered check if key exists, without borrowing credentials. Publish verified implementation and confirm live UI/colors and assets. Record any remaining activation dependency honestly.

## Execution ledger

- Existing linked worktree reused; primary working files and user artifacts preserved.
- User asked to configure a free registered key in GitHub secret `BLS_API_KEY`; implementation can proceed independently of that external step.
- User confirmed the secret is configured. The credential is verified only through the main-branch read-only workflow; no key is requested in chat or read back from GitHub.
- Manual access verification uses a separate read-only workflow rather than an input to deployment CI, so requesting it cannot publish or redeploy.
- Review found that raw-series coverage alone could miss a derived-momentum regression. Fallback acceptance now validates transient final 31-output coverage inside the original failure handler, preserving the typed 503 on regression.
- Tasks 1–3 pass focused checks. Integrated local suite passes all 1,589 tests; build/smoke passes all 163 assets with unchanged UI/data asset version and no test credential in build files. Independent re-review cleared the coverage fix. Hosted key verification and deployment are next.
