# Research dashboard source mapping

This is a working admission ledger, not a blanket license approval. Existing reviews in [data-sources.md](data-sources.md) and executable allowlists in `scripts/data-policy.mjs` remain authoritative. A candidate becomes admitted only after exact feed, fields, coverage, cadence, units, commercial display/export scope and validation are recorded and enforced.

| Milestone | Primary candidate | Required distinctions | Status |
| --- | --- | --- | --- |
| Fiscal pressure | Treasury Fiscal Data Monthly Treasury Statement; Debt to the Penny | Monthly versus fiscal-year-to-date; net budget interest versus gross interest expense; public versus gross debt; financing/cash reconciliation | Endpoint/schema review in progress |
| Refinancing | Treasury Fiscal Data Monthly Statement of the Public Debt | Outstanding security principal, maturity, issue/instrument type, TIPS inflation adjustments, FRN reset versus maturity | Endpoint/schema review in progress |
| Yields | Treasury nominal and real par yield curves | Same observation day/tenor; methodology changes; inflation compensation is not pure expected inflation | Endpoint/rights review in progress |
| Term premium | New York Fed ACM model | Model estimate, model-vintage and convention; no exact incompatible decomposition | Not admitted; permission review required |
| Auctions | TreasuryDirect official auction results | Security type/term/reopening; award allocation definitions | Not yet reviewed; when-issued quotes unavailable |
| Ownership | Treasury TIC, Federal Reserve Z.1 and official Fed holdings | Custody country, reporting date, valuation, institutional sectors and transactions versus position changes | Not yet reviewed |
| Macro drivers | BEA NIPA published contribution tables; BLS published CPI effects | Percentage-point growth contributions versus chained levels; official effects versus approximations | Not yet reviewed |
| Vintages | Captures from admitted collectors; official historical release files when available | Release versus retrieval date; first captured versus first released; benchmark revisions | Design pending; no invented history |
| Market functioning | New York Fed official dealer statistics and funding reference rates | Partial market coverage, instrument/tenor, reporting lags and permitted redistribution | Not yet admitted |

## Failure policy

Blocked or unapproved feeds do not produce substitute observations. Keep source-specific last-good capture times and visible cached/unavailable states. A rights decision for one dataset does not cover unrelated calendars, prose, logos or third-party market data. No new credentials, paid feeds or infrastructure are authorized by this ledger.
