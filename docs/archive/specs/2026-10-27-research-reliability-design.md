# Research reliability and focused economic capabilities

The October 27 request is the implementation specification. Work is local on `codex/research-reliability`; no merge, push, deployment, account creation, or paid data. The existing Light/Graphite design and official snapshot remain the foundation. The old fiscal single-month year-over-year identity is valid and must stay intact.

## Decisions

- Use native IndexedDB for independently validated frozen packages and saved views. Retain legacy localStorage bytes as recovery evidence and commit migration only after validation and transaction completion. A failed package write cannot contaminate unrelated view writes. Preserve portable JSON and explicit per-record durability.
- Keep named watchlist/settings files separate from evidence packages. Freeze selection is explicit and bounded to four series; complete ordered membership is contextual metadata, never a claim of frozen observations.
- Keep exact-date comparisons as default. Opt-in quarter comparison uses only explicitly declared quarter-start/quarter-end reference conventions, keeps original dates and receipts, and rejects survey-round remapping or ambiguous periods.
- Retain existing framework-free modules, native controls, CSS tokens, provenance validation, and dependency footprint. No account layer, service, narrative generator, portfolio lab, or broad sector explorer.
- New statistical coverage requires exact feed/identifier admission, source-specific rights review, authentic receipts, units/period/revision/missing-value tests and exported qualifications. Unsupported source-dependent features stay out of the UI and receive an evidence-backed dependency record.

## Stages and boundaries

1. Reliability: durable storage, page-aware view descriptions, named watchlists/settings portability, freeze preview, complete frozen tables, explicit quarter alignment, truthful release/catalyst labels, search, chart evidence and quantitative maturity spacing.
2. Interpretation: auction states, freshness clocks, Overview density/selection, refinancing ladder and labels, selected-date curve workflows, verified Treasury events and references, coherent placement of specialist evidence.
3. Economic research: payroll publication evidence and uncertainty, official real earnings/diffusion, verified inflation composition, conditional PCE base arithmetic, lightweight saved research questions and transparent change/condition checks.
4. Source-dependent gaps: investigate expectations, financial conditions and market pricing under the same dataset admission rules. Implement only evidence that can be obtained and redistributed accurately.

## Verification

Reproduce before changing; record already-correct behavior. Focused regression tests precede nontrivial implementation. Verify migration failures, reload persistence, independent writes, package checksums/round trips, watchlist order restoration, original quarter dates, all rows/exports, math identities, and controls. Run the complete suite and production build; inspect local desktop/mobile pages in both themes, keyboard readouts, long histories and failure states. Independent engineering and economic reviewers gate completion.
