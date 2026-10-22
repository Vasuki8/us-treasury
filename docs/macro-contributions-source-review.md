# Macro contribution source review

Reviewed 21 October 2026 for Meridian. This milestone admits published national GDP growth contributions from BEA and explicitly reports unavailable BLS CPI category effects. It does not admit chained-dollar component summation, approximated CPI effects, commercial mirrors, credentials or new infrastructure.

## Rights and exact feeds

[BEA's copyright FAQ](https://www.bea.gov/help/faq/147) states that its website information is public domain unless otherwise indicated and can be used or reproduced without specific permission. No contrary notice appears on the reviewed federal NIPA statistical bulk files. This extends the repository's existing BEA NIPA admission to the specific series listed below, allowing commercial display, calculation and CSV redistribution. Attribute `U.S. Bureau of Economic Analysis` and retain original source/retrieval metadata. [BEA citation guidance](https://www.bea.gov/help/guidelines-for-citing-bea) asks for direct links, cautions against suggesting endorsement and distinguishes estimate vintages from access dates. Protected imagery, BEA logos and external content are excluded.

Runtime feed: [`https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`](https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt). This is the existing approved keyless quarterly flat file, CSV despite its `.txt` suffix. The collector reuses `parseBea` and `requestText`; exact bytes receive SHA256/retrieval provenance. Redirects, missing series, duplicate periods, invalid numbers and contribution decompositions exceeding published rounding are rejected. No BEA API key is needed.

Primary mapping evidence was fetched directly with HTTP 200 from [SeriesRegister.txt](https://apps.bea.gov/national/Release/TXT/SeriesRegister.txt) and [TablesRegister.txt](https://apps.bea.gov/national/Release/TXT/TablesRegister.txt). The table register maps `T10102` to **Table 1.1.2. Contributions to Percent Change in Real Gross Domestic Product**. These registers support this review; they are not additional runtime series feeds.

| Registry ID | BEA series | NIPA 1.1.2 line | Measurement |
| --- | --- | --- | --- |
| `gdpTotalContribution` | `A191RL` | 1 | Published real GDP percent change from preceding quarter, annual rate |
| `gdpConsumptionContribution` | `DPCERY` | 2 | Personal consumption expenditures contribution |
| `gdpInvestmentContribution` | `A006RY` | 7 | Gross private domestic investment contribution, including inventories |
| `gdpExportsContribution` | `A020RY` | 16 | Exports contribution |
| `gdpImportsContribution` | `A021RY` | 19 | Imports contribution with BEA's existing sign |
| `gdpGovernmentContribution` | `A822RY` | 22 | Government consumption expenditures and gross investment contribution |

`A002RY` is **not** the current personal-consumption contribution code: it was absent from the reviewed register and quarterly file. The current official register supplies `DPCERY`.

## Units, coverage and timing

Total growth is **percent**, quarter over quarter at an annual rate. Components are **percentage points** of that same annualized real GDP growth. Quarterly data are seasonally adjusted. They are not year-over-year rates, dollar levels, percentage shares of GDP, or raw quarterly growth multiplied by four. Imports have already been assigned the contribution sign; do not negate them a second time.

The reviewed bulk has all six quarterly series from 1947 Q2 through 2026 Q2. Meridian retains the most recent 36 observations per series; actual review coverage is 2017 Q3–2026 Q2. Observation dates are quarter starts, for example `2026-04-01` identifies 2026 Q2. The feed contains `SeriesCode,Period,Value`, without individual release timestamps or first-release vintages. `publishedAt` remains null and retrieval time is shown separately. GDP estimates are published quarterly, subsequently updated in advance/second/third estimate rounds and broader annual/comprehensive updates; this latest bulk capture can revise older quarters. A later retrieved value is not proof of a first-reported historical value. Preserve immutable snapshots going forward for an as-known-on-date view.

Review sample for 2026 Q2: GDP growth `2.2%`; consumption `2.51`, investment `0.82`, government `-0.01`, exports `0.56`, imports `-1.66` percentage points. Components sum to `2.22`, with `-0.02` percentage-point residual against the rounded headline. The source feed was retrieved successfully with SHA256 `7a577c587cecc4b9e07b2edae2684ed565e7aef477a563c2a03d076f55d848b8` during live adapter verification.

## Calculation and interpretation rules

The app sums **published contributions**, never chained-dollar components. [BEA's NIPA methods handbook, chapter 4](https://www.bea.gov/resources/methodologies/nipa-handbook/pdf/chapter-04.pdf) explains chain-type measures and contributions to percent change. GDP is rounded to one decimal while these five contributions are rounded to two: the maximum independent rounding allowance is `0.05 + 5 × 0.005 = 0.075` percentage point. The app retains and displays the actual reconciliation residual rather than forcing components to equal the headline.

Missing or malformed components are not zeros. A missing component prevents an exact contribution sum; a malformed value or a complete decomposition outside the rounding allowance fails validation. The latest incomplete quarter stays visibly incomplete rather than silently selecting an older complete quarter. Changes between contributions use an exact consecutive previous quarter, not the previous nonmissing observation. The total-growth comparison and each contribution change remain separate measures.

These are accounting contributions to the release. A positive or negative contribution identifies which measured components added to or subtracted from recorded GDP growth; it does not establish an economic cause. Investment includes inventories, and imports are a subtraction in expenditure accounting; their published contribution signs must be interpreted in that accounting context.

## BLS CPI category effects: access limitation

[BLS's official effects explanation](https://www.bls.gov/cpi/factsheets/contributions-effects.htm) distinguishes published effects from relative importance. Exact one-month effects appear in [CPI release table 6](https://www.bls.gov/news.release/cpi.t06.htm) and 12-month effects in [table 7](https://www.bls.gov/news.release/cpi.t07.htm). One-month effects can be seasonally adjusted; 12-month effects are unadjusted. These periods and bases cannot be mixed or double counted across overlapping categories.

[BLS's public-domain policy](https://www.bls.gov/opub/copyright-information.htm) permits use of agency-published statistical material with BLS credit, excluding protected photographs/illustrations and its emblem. Rights are adequate for factual statistical effects, but both exact official table URLs returned **HTTP 403** on the access review, using the repository's honest refresh agent identity and one request per table spaced by one second. No alternate host, mirror, query parameter or identity was used to bypass the restriction.

No CPI category effects observations are admitted. The snapshot contains a dated `unavailable` explanation and source links, without fabricated zeros. It does not derive approximate effects by multiplying current relative-importance weights and category inflation rates. The blocked feeds are not repeatedly retried by this collector. Once official access is restored, implement a separately tested and policy-admitted table parser, preserving category hierarchy, reference month, adjustment basis, exact effect field, source provenance and applicable BLS disclaimer conditions. The existing BLS calendar remains cached under its separate policy.

## Stable data contract

Source ID: `macroContributions`. The six registry series above use the exact corresponding BEA code as their sole `sourceIds` entry and the quarterly bulk as `sourceUrl`. `quarterly` contains aligned `{date,total,consumption,investment,government,exports,imports,reconciliationResidual,complete}`. `coverageStart`, `coverageEnd` and `coverageNote` describe retained observations and limitations. `cpiCategoryEffects` is a factual access-review status with `observations: []`; it is not an official economic series or a fresh daily BLS capture. The shared registry/freshness/export integration must preserve that distinction.
