# Research dashboard source mapping

This is a working admission ledger, not a blanket license approval. Existing reviews in [data-sources.md](data-sources.md) and executable allowlists in `scripts/data-policy.mjs` remain authoritative. A candidate becomes admitted only after exact feed, fields, coverage, cadence, units, commercial display/export scope and validation are recorded and enforced.

| Milestone | Primary candidate | Required distinctions | Status |
| --- | --- | --- | --- |
| Fiscal pressure | Treasury Fiscal Data MTS table 9/table 2/explicit-million cross-check; Debt to the Penny | Monthly versus fiscal-year-to-date; net budget interest versus gross interest expense; public versus gross debt; financing/cash reconciliation | Admitted: [exact feeds, units, cadence, rights and limits](fiscal-source-review.md); executable scope in `scripts/research-policy.mjs` |
| Refinancing | Treasury Fiscal Data MSPD table 3 marketable detail and table 1 reconciliation | Outstanding principal, reopenings, TIPS inflation and redemption floor, FRN reset versus maturity; generated public identifiers | Admitted: [exact feeds, cadence, rights and assumptions](refinancing-source-review.md); source/series feed allowlist enforced |
| Yields | Treasury nominal and real par yield curves | Same observation day/tenor; methodology changes; inflation compensation is not pure expected inflation | Admitted separately under nominal 015-DO-020 and real 015-DO-036 CC0 records: [review](yields-source-review.md); exact feed types and observation input provenance enforced |
| Term premium | New York Fed ACM model | Model estimate, model-vintage and convention; no exact incompatible decomposition | Not admitted; permission review required |
| Auctions | Treasury Fiscal Data's TreasuryDirect auction results endpoint | Security type/term/reopening/CMB; competitive-award allocation denominators; pending result coverage | Admitted: [review](auctions-source-review.md); no raw third-party identifiers or when-issued quotes; tails unavailable |
| Ownership | Treasury TIC, Federal Reserve Z.1 and official Fed holdings | Custody country, reporting date, valuation, institutional sectors and transactions versus position changes | Admitted Z.1 and conditional SOMA reuse: [review](ownership-source-review.md). TIC country table rights remain unverified; no TIC observations admitted. |
| Macro drivers | BEA NIPA published contribution tables; BLS published CPI effects | Percentage-point growth contributions versus chained levels; official effects versus approximations | Not yet reviewed |
| Vintages | Captures from admitted collectors; official historical release files when available | Release versus retrieval date; first captured versus first released; benchmark revisions | Design pending; no invented history |
| Market functioning | New York Fed official dealer statistics and funding reference rates | Partial market coverage, instrument/tenor, reporting lags and permitted redistribution | Not yet admitted |

## Failure policy

Blocked or unapproved feeds do not produce substitute observations. Keep source-specific last-good capture times and visible cached/unavailable states. A rights decision for one dataset does not cover unrelated calendars, prose, logos or third-party market data. No new credentials, paid feeds or infrastructure are authorized by this ledger.
