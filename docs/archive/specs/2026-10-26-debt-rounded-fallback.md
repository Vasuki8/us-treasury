# Official rounded debt fallback

The user approved the official rounded fallback on October 26, 2026, retaining the current UI and colors. Source evidence: `docs/debt-2025-08-04-source-review.md`.

Use only August 4, 2025 Daily Treasury Statement (DTS), page 3, Table IIIC closing balances: public 29,523,300, intragovernmental 7,314,865, gross 36,838,165, each USD millions. Reporting resolution is USD 1,000,000; these are not penny amounts. Preserve the original contradictory Debt-to-the-Penny strings and signed USD -10,000,000,000 residual. Both the fiscal composition and main gross-debt history must use this coherent row. Never infer corrected cents from the primary components.

Only the reviewed primary triple and PDF SHA-256 may activate this exception. A reconciled primary record takes precedence. Missing, redirected, oversized or changed PDF evidence fails safely through existing retry/cache handling; no unreviewed exception may enter. Unknown historical publication time remains null. Retrievals are actual clocks and immutable prior captures remain unchanged. Scheduled commit `bba94c8` arrived during development: its 211 published captures (the original 188 plus 23 scheduled captures) are the final integration baseline. Recapture the affected sources against that baseline; do not splice deltas built against older source state.

Observation metadata must carry the original million-valued string, unit, precision, source field, source URL/hash/retrieval, raw primary triple/residual and a readable note. Source receipts and supplemental URL must survive normalization, CSV, comparison, frozen context and portable-package round trips. Existing admission checks and size limits remain strict. No layout, navigation, CSS, colors or new dependency.
