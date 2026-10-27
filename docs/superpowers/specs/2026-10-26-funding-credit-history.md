# Longer funding and credit histories

The user selected longer funding and credit histories, retaining the current UI and colors. Baseline is `ff22954`, with 213 immutable captures and a healthy deployed release. Economist/investor and official-source feasibility reviews are retained under `tmp/funding-credit-history/`.

## Data scope

- Separate daily funding history from the dealer SBN2024 structural regime. SOFR begins April 2, 2018; modern transaction-based median EFFR begins March 1, 2016. The same-date median spread begins April 2, 2018. Do not splice modeled SOFR proxies or earlier mean-based EFFR. Preserve missing same-date inputs and all native dates, medians, volumes and published percentiles.
- SOFR percentile `NA` values on May 31, 2019 and August 5, 2021 remain null with the source survey-contingency footnote. Retain the published median and volume. Preserve EFFR `r` revision flags, source footnote identifiers, reduced-volume notes and their exact official meanings. No missing percentile endpoints are inferred.
- Retain H.8 loans/deposits from January 1990 (first actual date January 3), SLOOS standards from native canonical April 1990 and demand from October 1991, and bank card/mortgage delinquency from March 1991. The exact approved XML series and native dates remain authoritative. Existing overlaps must match; no stock difference is called a lending flow or break-adjusted growth rate.
- Keep H.4.1's December 18, 2002 inception, current-method DSR's March 2005 inception, dealer SBN2024 from July 2024 and ON RRP's existing reviewed 2024 coverage. Earlier RRP window changes require a separate precise classification review; do not loosen operation filters to admit tests. Full H.8 from 1973 was measured but exceeds the working Credit All package limit; the coherent 1990 cycle window adds useful history while preserving that feature.

## Compatibility and exports

No layout, navigation, CSS, colors, dependencies, original publication timestamps, old captures or old package bytes change. All new backfills have genuine new retrieval clocks. Existing conditional New York Fed reuse notices and Board attribution stay intact. Request, XML, 12 MiB package and 8 MiB stored-attachment caps remain unchanged.

Credit default/All and useful individual/custom comparison packages must remain valid. Funding data and ordinary full-retained CSV downloads must remain complete. The measured expanded source is 2.17 MB; default/All packages with that complete source and primary CSV fit at 3.79/9.71 MB. Only the duplicate 20.27 MB specialist attachment exceeds storage limits. New market snapshots therefore use a narrowly versioned generated full-retained CSV profile: retain the complete frozen module source, omit duplicated CSV content, and generate the specialist download deterministically from canonical frozen inputs. Legacy version-1 packages retain their original stored attachment and exact bytes. No selected window or All history is trimmed. Bound generated CSV work separately at 32 MiB; this is an on-demand output guard, not an increase to stored package/attachment limits. Unknown profile versions, conflicting stored/generated copies and unsafe or unbounded generation must fail explicitly. Keep the existing download action and UI styling; the saved scope text must clearly identify the generated full-retained CSV.

## Acceptance

September 17, 2019 must independently reconcile SOFR 5.25%, EFFR 2.30%, and spread 295 basis points. Missing bands remain visible gaps. Old numerical overlaps and 213 immutable artifacts remain exact. Coverage inventory and individual histories reach each intended first native date. Default/All/custom frozen views preserve exact retained inputs, source receipts and stable round trips; unsupported oversized requests fail explicitly, without raising caps or dropping data.
