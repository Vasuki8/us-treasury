# Quarter-specific GDP explanations from the 2023–2025 updates

Reviewed October 22, 2026. These three additions fill meaningful explanation gaps for first quarters already represented in the numerical publication archive. Each dated BEA release explicitly identifies the contributors to that quarter's revised GDP growth. They are not inferred from differences between reported values, a generic Revised label, or general annual/comprehensive coverage.

`scripts/publication-explanation-scope-updates.mjs` exports `publicationExplanationScopeUpdates`. Integration appends these three explanations separately from the 30 retained explanations and the 1,076 immutable numerical publication facts. Existing words, values, source cells, hashes and retrieval timestamps must remain unchanged.

## Exact reviewed releases and quarter-specific evidence

| Existing numerical identity | Source-reported previous → revised GDP growth | Explanation kind | Exact dated official release |
| --- | --- | --- | --- |
| bea-gdp-2023q1-revised-2023-09-28 | 2.0% → 2.2% | comprehensive-update | [Gross Domestic Product (Third Estimate), Corporate Profits (Revised Estimate), Second Quarter 2023 and Comprehensive Update](https://www.bea.gov/news/2023/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-second-quarter), September 28, 2023 |
| bea-gdp-2024q1-revised-2024-09-26 | 1.4% → 1.6% | annual-update | [Gross Domestic Product (Third Estimate), Corporate Profits (Revised Estimate), and GDP by Industry, Second Quarter 2024 and Annual Update](https://www.bea.gov/news/2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-0), September 26, 2024 |
| bea-gdp-2025q1-revised-2025-09-25 | −0.5% → −0.6% | annual-update | [Gross Domestic Product, 2nd Quarter 2025 (Third Estimate), GDP by Industry, Corporate Profits (Revised), and Annual Update](https://www.bea.gov/news/2025/gross-domestic-product-2nd-quarter-2025-third-estimate-gdp-industry-corporate-profits), September 25, 2025 |

All rates are the original real GDP percent changes from the preceding quarter, seasonally adjusted at annual rates. They are native published rates; no additional annualization, interpolation or component decomposition is applied. Each previous value is for the **same reference quarter**, and matches both the release's previous/revised table and the immediately preceding retained numerical estimate.

The three pages were already reviewed as sources for their respective **second-quarter Third** estimates. These additions use distinct **first-quarter update** evidence on those pages. Sharing a source URL or release date does not permit using the second-quarter narrative to explain the first quarter.

- **2023Q1:** the uniquely identified “Updates for the First Quarter of 2023” paragraph reports a 0.2 percentage point upward revision. Higher nonresidential fixed investment was partly offset by lower consumer spending.
- **2024Q1:** the actual heading “Updates for the First Quarter of 2024” contains a paragraph reporting a 0.2 percentage point upward revision. Higher consumer spending was partly offset by lower private inventory investment and residential fixed investment.
- **2025Q1:** the uniquely identified “Updates for the First Quarter of 2025” paragraph reports a 0.1 percentage point downward revision. Lower investment, government spending and exports were partly offset by higher consumer spending; imports were revised upward. The GDP growth rate remains negative and the contraction becomes larger. The nearby first-quarter GDI discussion about corporate profits and wage/salary information is **not** retained as a GDP cause.

## Comprehensive and annual classifications

The 2023 release expressly presents a **comprehensive update** of the National Economic Accounts. Its general discussion distinguishes current-dollar GDP revisions from 2013Q1–2023Q1 and income revisions from 1979Q1–2023Q1, and changes the reference year from 2012 to 2017. Those are measure-specific coverage/methodology statements, not a single real-GDP-growth coverage window and not proof that rebasing itself caused the first-quarter growth revision. The new entry therefore uses `kind:'comprehensive-update'` and only the explicit first-quarter contributor paragraph.

The 2024 and 2025 releases expressly identify **annual updates**, so their new entries use `kind:'annual-update'`. Their general annual windows do not supply the quarter-specific causes. All three entries deliberately have `annualUpdate:null`: the explicit update kind and specific first-quarter evidence are sufficient, and no general coverage object is propagated to other observations.

The numerical archive's original source stage remains **Revised** for all three entries. Explanation kinds describe the documented update process; they do not rename that original stage, imply that a Third estimate is permanently final, or convert a publication date into a retrieval date. Other historical Revised rows without separately reviewed quarter-specific explanations remain unknown.

## Source contracts and integrity

Each definition contains the full explicit source URL, original HTML title, exact dated release field, publication identity, series/period/stage/date, native current and previous strings, update kind, plain-text summary/details, and supporting passages. The main admission policy verifies identity fields against the existing immutable numerical scope and retains normal rights/attribution/provenance metadata.

The 2023 and 2025 first-quarter labels are bold paragraph text rather than h2/h3 headings. Their `sectionHeading:null` contract supplies **one complete exact normalized paragraph**, which must occur once inside the reviewed release article. It cannot be assembled from split paragraphs, comments, inactive elements or a footer. The 2024 first-quarter section has an h3, so its exact heading bounds the required paragraph using the existing heading mode.

Additional source passages independently confirm the comprehensive/annual classification, the first-quarter label and the original previous/current GDP table pair. This guards against accidental reuse of a same-date second-quarter explanation. The supporting paragraphs and table fragments are source-validation material; visible summaries and details are clearly attributed **Meridian paraphrases**, not verbatim quotations or newly inferred causal analysis.

## Commercial reuse and actual research provenance

BEA's [copyright FAQ 147](https://www.bea.gov/help/faq/147) was retrieved and rechecked. Unless otherwise stated, BEA website information is public domain and may be used or reproduced without specific permission. No contrary reuse notice was found in these three BEA-authored release articles. Commercial display and export of the selected factual paraphrases fit that scoped basis. Retain BEA attribution, the paraphrase label, source title/link, release date, FAQ link and independent source-page retrieval evidence. This does not admit unrelated logos/images, third-party source datasets mentioned in the releases, or arbitrary BEA URLs. [BEA's citation guidance](https://www.bea.gov/help/guidelines-for-citing-bea) recommends direct citations and identifying the estimate vintage and prohibits implying endorsement.

Credential-free official GETs returned the reviewed HTML. Research bytes and real receipts are confined to ignored `test-results/gdp-update-research`; they were not substituted into the canonical archive. The actual missing-only append capture fetched the three pages independently at 20:26:12.982–20:26:13.132 UTC on October 22, 2026. Their byte hashes matched the research receipts below. All earlier 30 explanation records and the 1,076 numerical facts were preserved.

| Research file | Bytes | Actual UTC retrieval on 2026-10-22 | SHA256 |
| --- | ---: | --- | --- |
| 2023q1-comprehensive.html | 70,319 | 20:19:33.360Z | ed5744766d7861755ab9f18422251636576bd0cdc0a376117ec53c6cec475c26 |
| 2024q1-annual.html | 70,811 | 20:19:33.701Z | 33a032a3e2746a65806b067ddec865a75d32d4a45a43da8de955319b80db811b |
| 2025q1-annual.html | 57,172 | 20:19:33.801Z | 32d2bac47b93154b223e217c81b47cfad4a7df2dc6a1900a095b91474b8f3b0b |
| copyright-faq-147.html | 37,065 | 20:19:33.966Z | 23118389b7d672fef50aa5caeb20e55f97a595c8b5604a2f8829d05bb0b9abf5 |

Publication dates remain day precision and `publishedAt:null`. The embargo's scheduled 8:30 a.m. time does not establish the actual historical server-publication instant. HTTP Last-Modified, current download time and historical release date have separate meanings. Retrieving a 2023 release in October 2026 is not a Meridian capture in 2023, and the current response hash does not prove identical HTML bytes were served then.

## Verification and useful limit

Regression-first independent tests verify all three exact numerical joins, same-quarter predecessors and source table strings; the existing approved release-page association; comprehensive versus annual kinds; no propagated annual context; unique complete-paragraph versus heading contracts; all specified contributor offsets; and the negative 2025 revision direction. A separate read-only probe checked every source passage, exact title/date, unique paragraph or bounded heading, and actual byte hash against all three fresh receipts.

Integrated local verification passed 838 tests and the built application's 91-asset HTTP check. The 30-record prefix digest and numerical/statistical baseline comparisons were unchanged. Browser checks confirmed the three real update views, the pre-release cutoff, keyboard activation of source details, Graphite styling and no page overflow at widths 320, 390, 736, 1024 and 1440 pixels. Companion CSV and pinned JSON tests cover source tokens, type, date/provenance distinctions and frozen imports. Independent review found no code or source correctness findings.

This is a deliberately small expansion that supplies new explanatory value for quarters already in use. Routine Second/Third estimate backfills before 2023 remain possible follow-up research, but are optional rather than necessary to explain these three gaps. Older update causes, all annual/comprehensive effects, GDI and other measures need their own evidence. No paid feed, credential, dependency or new infrastructure is needed, and no existing canonical data or user export folder is a write target of this source-review work.
