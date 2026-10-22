# Reviewed BEA GDP publication explanations

Reviewed October 22, 2026. This separate evidence archive provides **ten reviewed explanations for ten exact numerical publication identities** across nine dated BEA release pages. It does not change any of the 1,076 numerical records in `src/publication-archive.js`, assign causes from differences between GDP values, or claim that explanations are available for the entire historical archive.

## Official sources and commercial reuse

BEA's [copyright FAQ 147](https://www.bea.gov/help/faq/147) says its website information is in the public domain unless otherwise stated and may be used or reproduced without specific permission. The reviewed release text is BEA-authored statistical material; no contrary reuse notice was found. This supports commercial display and export of the limited factual paraphrases here. The archive preserves the exact source title/link, day-level release date, FAQ link, BEA attribution and actual download provenance. This admission does not extend to unrelated images, logos, linked third-party datasets, or arbitrary pages on the BEA hostname.

Each displayed summary and detail is **Meridian's plain-text paraphrase of the cited BEA release**, not a verbatim quotation or independent causal analysis. Every record has `textType:'paraphrase'` and attribution identifying both BEA and the paraphrase. [BEA's citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea) recommend identifying the estimate vintage and prohibit implying BEA endorsement. Pins and CSV exports should retain these fields, the original source URL/title, and both the numerical archive lineage and this explanation's independent retrieval lineage.

## Exact coverage

| Reference quarter / source stage | Publication date | Source-reported annualized growth | Reviewed explanation |
| --- | --- | --- | --- |
| 2026Q1 Advance | 2026-04-30 | 2.0% | First estimate; no prior same-quarter revision |
| 2026Q1 Second | 2026-05-28 | 2.0% → 1.6% | Lower investment and consumer spending |
| 2026Q1 Third | 2026-06-25 | 1.6% → 2.1% | Lower imports, partly offset by lower consumer spending |
| 2026Q2 Advance | 2026-07-30 | 1.5% | First estimate; no prior same-quarter revision |
| 2026Q2 Second | 2026-08-26 | 1.5% → 1.5% rounded | BEA explicitly reports a downward revision of less than 0.1 percentage point |
| 2026Q2 Third | 2026-09-30 | 1.5% → 2.2% | Higher investment, consumer spending and government spending |
| 2026Q1 Revised | 2026-09-30 | 2.1% → 2.5% | Annual update; quarter-specific higher services exports and consumer spending |
| 2025Q3 Updated | 2026-01-22 | 4.3% → 4.4% | Higher exports and investment, partly offset by lower consumer spending; imports also revised upward |
| 2025Q4 Second | 2026-03-13 | 1.4% → 0.7% | Lower exports, consumer spending, government spending and investment |
| 2025Q4 Third | 2026-04-09 | 0.7% → 0.5% | Lower investment, especially private inventory investment |

The exact source pages are:

- [2026Q1 Advance](https://www.bea.gov/news/2026/gdp-advance-estimate-1st-quarter-2026), opening estimate and Technical Notes.
- [2026Q1 Second](https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026), Technical Notes / Sources of change for real GDP. Revised Census inventory data primarily explain the investment change; services-survey health-care data and revised retail data explain the selected consumption changes.
- [2026Q1 Third](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-1st), Technical Notes / Sources of revisions to real GDP in the third estimate. The import changes primarily incorporated the annual update of BEA's **International Transactions Accounts**. This is distinct from the September annual update of the National Economic Accounts.
- [2026Q2 Advance](https://www.bea.gov/news/2026/gdp-advance-estimate-2nd-quarter-2026), opening estimate and Technical Notes.
- [2026Q2 Second](https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-2nd-quarter-2026), Technical Notes / Sources of revision to real GDP in the second estimate. The technical note explicitly identifies a revision even though the published one-decimal GDP rates are equal. It is classified as a revision, not a no-revision confirmation. The archive does not invent an unrounded GDP rate or a more precise numeric revision.
- [2026Q2 Third and 2026 annual update](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd), Technical Notes for 2026Q2 and the separately identified “Updates for the First Quarter of 2026” section for 2026Q1. Inventory investment, fixed investment, selected consumption estimates and defense seasonal factors underlie the second-quarter changes.
- [2025Q3 Updated](https://www.bea.gov/news/2026/gross-domestic-product-3rd-quarter-2025-updated-estimate-gdp-industry-and-corporate), Technical Notes / Sources of revisions to real GDP. This release replaced the scheduled Third estimate after the shutdown; the original Updated stage remains intact.
- [2025Q4 Second](https://www.bea.gov/news/2026/gdp-second-estimate-4th-quarter-and-year-2025), Technical Notes / Sources of change for real GDP. The selected causes are the expressly identified revisions, not a new estimate of shutdown effects or the release's separate October-price imputation discussion.
- [2025Q4 Third](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-4th), Technical Notes / Sources of revisions to real GDP in the third estimate. Updated Census inventory information is the identified leading investment cause.

All rates above are the original published percent changes from the preceding quarter, seasonally adjusted at annual rates. `sourceValue` and `previousValue` preserve the source-reported rounded strings; the prior value belongs to the same quarter and is independently checked against the retained numerical archive. A first-publication record has `previousValue:null`. No explanatory record is generated merely because the previous value is equal, different, positive or negative.

## Annual update scope and unknown explanations

The September release expressly says the 2026 National Economic Accounts annual update covered **2021Q1–2026Q1**, with 2017 remaining the reference year. A separate `annualUpdate` context states this general scope and explicitly warns that it is not a quarter-specific reason for every revised observation. That context is attached only to the reviewed September 2026Q2 Third and 2026Q1 Revised identities. The first-quarter explanation itself is supported by the release's specific first-quarter section.

The other twenty older-quarter Revised observations dated September 30 remain without a reviewed quarter-specific explanation here. Generic Revised labels, the common annual-update date, or GDP arithmetic cannot supply one. Likewise, the archive's explicit historical “GDP not open for revision” / “GDP not revised” confirmations remain numerical source annotations, not inferred causes. This initial explanation selection contains two first publications, seven source-documented revisions, and one quarter-specific annual-update explanation; it does not fabricate a no-revision explanation to populate every possible kind.

## Source validation and immutable capture

`scripts/publication-explanation-policy.mjs` defines the exact ten identities, native values, prior values, reviewed plain-text summaries/details, section names, dates, URLs, titles, rights and attribution. Admission rejects changes to any reviewed field, unknown or duplicate identities, unreviewed fields and invalid provenance. The `ids` option requires an exact batch; `complete:true` requires all ten records. Valid subsets and the initially empty archive support append-only capture.

`scripts/sources/publication-explanations.mjs` fetches only these nine exact official HTTPS pages, without credentials, redirects or URL substitutions. Responses are bounded to 2 MiB. It validates the unique article's exact source path, title and dated release field, plus the reviewed passages within the identified source section. It checks every reviewed explanation on a page before returning a requested subset; requesting only 2026Q2 Third cannot bypass the independently reviewed 2026Q1 section on that same page. Comments and inactive script/style/template/noscript content cannot satisfy evidence checks. The collector emits reviewed plain text; it never executes HTML, follows source links, loads images, or exports page markup.

The historical release date remains day precision and `publishedAt:null`. An embargo time, scheduled release time, HTTP Last-Modified field or current page-modification date is not evidence of the actual historical server-publication instant. Provenance contains the exact downloaded response URL, SHA256 of its bytes, actual current UTC retrieval time and optional HTTP Last-Modified metadata. These are separate from the numerical workbook's provenance. October retrieval of a January release page is not a Meridian capture in January, and the current HTML hash does not prove identical bytes existed on the historical release date.

`scripts/capture-publication-explanations.mjs` appends only missing reviewed identities. It takes an exclusive file lock before rereading the data-only JSON module, validates the exact new batch, retains all earlier explanation objects/order/provenance, validates the complete union, then replaces the bounded 512 KiB module atomically. A complete rerun neither refetches nor rewrites bytes. Failure leaves retained evidence untouched and cleans up only the exact temporary files created by that invocation. The numerical `publication-archive.js` is never a write target.

## Verification and limits

Regression-first tests cover exact joins to all ten actual numerical records and their same-quarter predecessors; the unchanged rounded 2026Q2 Second revision; separate annual scope; source/rights/prose/identity/provenance tampering; page and section drift; missing/duplicate evidence; inactive/commented passages; malformed comments; unsupported URLs and redirects; exact subset ordering; HTTP failures and response caps; append-only preservation; concurrent capture exclusion; no-refetch reruns; unsafe executable modules; file-size bounds and cleanup. A separate read-only probe parsed all nine downloaded official pages into all ten records using their real download receipts. Research files stay under ignored `test-results/publication-explanation-research`.

This is a small reviewed editorial evidence selection, not a general news scraper or a reconstruction of every GDP revision cause since 2002. Changed source passages, additional release pages, corrected explanatory text or more quarters require explicit source review and a new admitted identity/version strategy that preserves prior retained evidence. The current selection is insufficient to assign causes to unreviewed publication records; those should be shown as unknown/unavailable while the numerical history remains usable.
