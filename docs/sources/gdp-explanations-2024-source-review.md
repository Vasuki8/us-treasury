# BEA GDP explanations for the 2024 reference quarters

Reviewed October 22, 2026. `scripts/publication-explanation-scope-2024.mjs` contains eight reviewed definitions: the Second and Third estimates for each of 2024Q1–Q4. Each definition joins an existing immutable GDP publication identity; no numerical value, source cell, release date, stage or retrieval lineage in `src/publication-archive.js` is changed. This is an explanation selection, not a complete reconstruction of all revision causes for 2024.

## Exact official pages and coverage

| Reference quarter / stage | Official publication date | Same-quarter previous → current annualized real GDP growth | Exact reviewed source |
| --- | --- | --- | --- |
| 2024Q1 Second | 2024-05-30 | 1.6% → 1.3% | [Gross Domestic Product, First Quarter 2024 (Second Estimate) and Corporate Profits (Preliminary)](https://www.bea.gov/news/2024/gross-domestic-product-first-quarter-2024-second-estimate-and-corporate-profits) |
| 2024Q1 Third | 2024-06-27 | 1.3% → 1.4% | [Gross Domestic Product (Third Estimate), Corporate Profits (Revised Estimate), and GDP by Industry, First Quarter 2024](https://www.bea.gov/news/2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-industry) |
| 2024Q2 Second | 2024-08-29 | 2.8% → 3.0% | [Gross Domestic Product (Second Estimate), Corporate Profits (Preliminary Estimate), Second Quarter 2024](https://www.bea.gov/news/2024/gross-domestic-product-second-estimate-corporate-profits-preliminary-estimate-second) |
| 2024Q2 Third | 2024-09-26 | 3.0% → 3.0% rounded | [Gross Domestic Product (Third Estimate), Corporate Profits (Revised Estimate), and GDP by Industry, Second Quarter 2024 and Annual Update](https://www.bea.gov/news/2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-0) |
| 2024Q3 Second | 2024-11-27 | 2.8% → 2.8% rounded | [Gross Domestic Product, Third Quarter 2024 (Second Estimate) and Corporate Profits (Preliminary)](https://www.bea.gov/news/2024/gross-domestic-product-third-quarter-2024-second-estimate-and-corporate-profits) |
| 2024Q3 Third | 2024-12-19 | 2.8% → 3.1% | [Gross Domestic Product (Third Estimate), Corporate Profits (Revised Estimate), and GDP by Industry, Third Quarter 2024](https://www.bea.gov/news/2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-1) |
| 2024Q4 Second | 2025-02-27 | 2.3% → 2.3% rounded | [Gross Domestic Product, 4th Quarter and Year 2024 (Second Estimate)](https://www.bea.gov/news/2025/gross-domestic-product-4th-quarter-and-year-2024-second-estimate) |
| 2024Q4 Third | 2025-03-27 | 2.3% → 2.4% | [Gross Domestic Product, 4th Quarter and Year 2024 (Third Estimate), GDP by Industry, and Corporate Profits](https://www.bea.gov/news/2025/gross-domestic-product-4th-quarter-and-year-2024-third-estimate-gdp-industry-and) |

The full source URLs are explicit literals. In particular, the 2024Q4 releases are in BEA's 2025 news paths; neither reference-quarter years nor release-page slugs are inferred. The page's original title and dated release field are preserved in the manifest, including EST/EDT wording. The HTML title can differ from the title of a separately linked PDF; this admission uses the reviewed HTML title and HTML response only.

## What the sources actually explain

The first six entries use the dated release's **Updates to GDP** paragraph and, where necessary, its opening revision paragraph. These expressly describe revisions to earlier estimates for the **same quarter**. Separate paragraphs describing the components of economic growth or comparing economic growth with a different quarter are not evidence for a revision cause.

- **2024Q1 Second:** BEA primarily attributes the reduction to consumer spending. Its Updates paragraph also identifies lower private inventory investment and federal government spending, partly offset by higher state and local spending, fixed investment and exports; imports were revised upward.
- **2024Q1 Third:** lower imports and higher nonresidential fixed investment and government spending primarily explain the increase, partly offset by lower consumer spending. The Updates paragraph identifies additional higher exports, private inventory investment and residential fixed investment. Imports are subtracted in the calculation of GDP.
- **2024Q2 Second:** higher consumer spending primarily explains the increase. Lower fixed investment, exports, inventory investment and government spending partly offset it; imports were revised upward.
- **2024Q2 Third:** the published rounded GDP growth rate remains 3.0%, but the source documents higher private inventory investment and federal government spending offset by lower nonresidential fixed investment and exports. Consumer spending and residential fixed investment were also revised downward; imports were revised upward.
- **2024Q3 Second:** the published rounded rate remains 2.8%, while the source documents higher private inventory investment and nonresidential fixed investment alongside lower exports and consumer spending. Other specified components also changed, and imports were revised downward.
- **2024Q3 Third:** higher exports and consumer spending primarily explain the increase, partly offset by lower private inventory investment. Imports were revised upward.

The 2024Q4 releases contain inline **Technical Notes**, so the final two entries use the existing heading-bounded source contract. For Second, the technical note explicitly reports an upward GDP growth revision **of less than 0.1 percentage point**, despite both published rates rounding to 2.3%. It identifies higher government spending and exports, partly offset by lower consumer spending and investment, with lower imports. For Third, lower service imports, based primarily on updated International Transactions Accounts information, more than offset lower consumer spending. The consumption detail identifies nonprofit institutions, led by nonprofit hospitals, and partly offsetting higher goods spending.

All eight entries use `kind:'revision'` because the source documents revised estimates or revised components. Equal rounded rates do not become no-revision confirmations. The manifest does **not** invent unrounded GDP rates or a sub-0.1 revision magnitude for 2024Q2 Third or 2024Q3 Second; the sub-0.1 statement is retained only where BEA explicitly states it, for 2024Q4 Second. No exact numerical decomposition of the aggregate revision is calculated.

Although the 2024Q2 Third release also discusses an annual update, its selected explanation is grounded only in the specific current-quarter revision passages. Every new definition has `annualUpdate:null`. This expansion does not assign annual-update or benchmark causes to other quarters, admit new historical Revised rows, or propagate general update coverage as a quarter-specific explanation. Separate annual GDP growth figures for the full year 2024 are also excluded from the fourth-quarter explanations.

## Commercial reuse and attribution

BEA's [copyright FAQ 147](https://www.bea.gov/help/faq/147), rechecked for this review, puts its website information in the public domain unless otherwise stated and permits use or reproduction without specific permission. No contrary reuse notice was found in the eight reviewed BEA-authored release articles. This scoped basis supports commercial display and CSV redistribution of the selected factual paraphrases. It does not admit arbitrary BEA pages, images, logos, linked third-party datasets, or raw underlying BLS/private-company data merely mentioned in a BEA technical note.

The visible `summary` and `details` fields are Meridian's plain-text **paraphrases**, not verbatim quotations or newly inferred causes. The normal explanation metadata policy retains `textType:'paraphrase'`, FAQ 147, BEA attribution, the exact source title/link, and the source section. [BEA's citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea) recommend direct citations and the estimate vintage and prohibit suggesting BEA endorsement. Numerical-workbook provenance and explanation-page provenance remain distinct in pinned evidence and scoped exports.

## Source structure and validation contract

The exported `publicationExplanationScope2024` is a definitions array compatible with the explanation policy: `publicationId`, `kind`, `previousValue`, `annualUpdate`, `sourceUrl`, `sourceTitle`, `releaseDateText`, `sectionHeading`, `sourceSection`, `summary`, `details`, `sourcePassages` and `sectionPassages`. The main policy joins period, stage, date and native current value from the already reviewed numerical scope. Every previous value was independently checked against the immediately preceding retained estimate for that same reference quarter.

For 2024Q1–Q3, `sectionHeading:null` requires every `sectionPassages` item to occur **together in one unique visible paragraph inside the exact reviewed release article**. Each definition supplies one complete normalized Updates paragraph, not disconnected fragments gathered from the whole page or footer. Q1 Second has no actual Updates heading, while the other five have an h3; the shared unique-paragraph contract works for all six without broadening admission. Normalization preserves the existing text extractor's spaces around inline links, including `Technical Note .`. Opening `sourcePassages` separately verify the original growth rate, predecessor rate and the source's primary revision description.

For 2024Q4, `sectionHeading:'Technical Notes'` retains the existing heading-bounded contract. Required passages lie inside that section and support all included source-data details. The exact article URL/path, unique release title, release-date field and inactive/comment exclusions remain mandatory. Missing, duplicated, split, commented or otherwise unreviewed evidence must fail admission; a generic hostname approval cannot substitute another page.

## Actual read-only research receipts and timing

Eight credential-free official GETs returned HTTP 200, with downloaded HTML and actual receipts saved only in ignored `test-results/earlier-bea-2024`. A read-only probe checked each exact URL, title and date, every required source passage, the single-paragraph or bounded-section contract, and SHA256 equality with the downloaded bytes. These are research receipts, not fabricated historical captures or a substitute for the integration's actual append capture.

| Research file | Bytes | Actual UTC retrieval on 2026-10-22 | SHA256 of downloaded HTML |
| --- | ---: | --- | --- |
| q1-second.html | 61,046 | 19:58:46.385Z | c093754791c59dd108d0065804de0f3510ada35e9378258363a8ce5840ddfcd1 |
| q1-third.html | 63,296 | 19:58:46.493Z | b3fbdc8312091079f153d0708da9a5e790296dec6bed70eb8cd7a413ca31ed5a |
| q2-second.html | 61,060 | 19:58:46.674Z | 379e68d37bcc94804f63f3f61500ecbd42bff6962b71f11806c77099461c85ee |
| q2-third.html | 70,811 | 19:58:46.763Z | 33a032a3e2746a65806b067ddec865a75d32d4a45a43da8de955319b80db811b |
| q3-second.html | 63,994 | 19:58:46.840Z | 5ca795bf7da565ad545722d2803630cf58e528ca33c02d5cab6148bc3f80649a |
| q3-third.html | 65,848 | 19:58:46.919Z | 85206bba9b590c5f93e18908e2560e32592c978d2a82f67de62c6805173d7da3 |
| q4-second.html | 48,479 | 19:58:47.001Z | 32339f0997f4df9e5c4a8a4ff4bdf66c0a017b64a92959da1a0111c44fc4cde5 |
| q4-third.html | 50,048 | 19:58:47.075Z | 53b2edda97655fe25aa7332856dc9de46ed1994d3d10c9126b97503d2ef12cb3 |

The historical publication dates remain day precision; `publishedAt` remains null. An embargo time or HTTP Last-Modified value is not proof of the actual historical server-publication instant. An October 2026 download is evidence retrieved in October 2026, not a Meridian retrieval in 2024/2025; its hash does not prove the same HTML bytes were served then. Retained explanations and existing numerical records must be appended/preserved independently, with no replacement of their earlier provenance.

## Checks and limits

Independent scope tests verify all eight exact IDs and URLs, release dates, native current and same-quarter previous values, the three equal-rounded-rate cases, no inferred annual context, complete unique-paragraph contracts for the first six entries, inline technical-note contracts for the final two, and plain visible paraphrases. A separate actual-source probe verified all eight downloaded pages and receipts. Root integration owns collector/parser regression tests, complete admission, append capture, original-prefix immutability, build/browser checks and publication.

No paid feed, credential, dependency or new infrastructure is needed. These definitions do not provide explanations for 2024 Advance estimates, later revisions to the 2024 quarters, all annual-update effects, or other BEA measures such as GDI, corporate profits and GDP by industry. Missing explanations remain unknown. The original Graphite interface and canonical numerical archive are outside this source-review change.
