# Economic depth and coherent history admission

Reviewed 22 October 2026 local time / 23 October UTC. Scope is statistical values in existing admitted BEA NIPA, BLS API, Census MARTS and Treasury Fiscal Data/par-curve source families. No third-party quotations, market expectations, credentials, paid service, narrative republication or new infrastructure is introduced.

## BEA: exact series and commercial scope

The [BEA public-domain FAQ](https://www.bea.gov/help/faq/147) permits use/reproduction unless an item says otherwise. The reviewed [quarterly NIPA file](https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt) and [monthly NIPA file](https://apps.bea.gov/national/Release/TXT/NipaDataM.txt) carry statistical observations without a contrary restriction. Retain BEA credit and exact identifiers under the [citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea). This supports this scoped commercial display/calculation/export admission; it does not license unrelated third-party content or BEA branding.

The current [Series Register](https://apps.bea.gov/national/Release/TXT/SeriesRegister.txt), downloaded and hashed at 2026-10-23 02:22:58 UTC, verifies every code/table below. The [GDP definitions and conventions](https://www.bea.gov/news/gdp-release-additional-information) establish nominal/real meanings, private final demand, GDI, personal saving and the annual-rate convention. The collector retains the native source value, converts only dollar scale, and never adds chained-dollar components.

| Output | Exact code | Table / measurement |
| --- | --- | --- |
| `nominalGdp` | A191RC | 1.1.5 line 1, current-dollar GDP |
| `privateDomesticDemand` | LB000003 | 1.4.6 line 8, real final sales to private domestic purchasers |
| `privateDomesticDemandGrowth` | PB000003 | 1.4.1 line 8, published real private final demand growth |
| `nominalGdi` | A261RC | 1.10 line 1, current-dollar GDI |
| `realGdiGrowth` | A261RL | 1.7.1 line 11, published real GDI growth |
| `nonresidentialInvestmentGrowth` | A008RL | 1.1.1 line 9, private nonresidential fixed investment |
| `residentialInvestmentGrowth` | A011RL | 1.1.1 line 13, private residential fixed investment |
| `structuresInvestmentGrowth` | A009RL | 1.1.1 line 10, nonresidential structures |
| `equipmentInvestmentGrowth` | Y033RL | 1.1.1 line 11, nonresidential equipment |
| `intellectualPropertyInvestmentGrowth` | Y001RL | 1.1.1 line 12, intellectual property products |
| `nominalExports` | B020RC | 1.1.5 line 16, goods/services exports |
| `nominalImports` | B021RC | 1.1.5 line 19, goods/services imports |
| `nominalTradeBalance` | A019RC | 1.1.5 line 15, published goods/services external balance |
| `savingRate` | A072RC | Monthly 2.6 line 35, personal saving / disposable personal income, percent |

All entries except saving use the quarterly file. Dollar levels are **source millions / 1000 = billions at seasonally adjusted annual rates**; private final demand uses chained 2017 dollars, all other dollar additions use current dollars. Quarterly real growth is BEA's published annualized percent change, used directly without another annualization. Private final demand is consumption plus private fixed investment and excludes inventories, government and net exports. GDI and GDP use independent source data and can differ. Saving rate is neither household wealth nor a debt-stress measurement. National-accounts trade excludes income/transfers and is **not the balance-of-payments current account**.

The live capture at 02:34:28 UTC passed commercial admission: nominal GDP/GDI, real private final demand and nominal trade levels have 318 quarters from 1947Q1–2026Q2; published growth series have 317 quarters from 1947Q2; saving has 812 months from January 1959–August 2026. These are current revised histories, newly captured now. First-release knowledge is not reconstructed. GDP/investment/trade update with quarterly national accounts; saving updates monthly with Personal Income and Outlays. Preliminary GDI availability can lag GDP, so each source series keeps its own last available period.

## BLS: exact identity, units and source periods

The [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm) places agency-published statistical material in the public domain. The [API terms](https://www.bls.gov/developers/termsOfService.htm) require attribution, access date and the existing BLS disclaimer; keep those in display and export and do not use BLS logos or imply endorsement. This scoped public-domain statistical addition uses the same unregistered JSON POST at `https://api.bls.gov/publicAPI/v1/timeseries/data/`. With the existing inputs it requests **20 distinct series once for ten calendar years**, within the [unregistered limits](https://www.bls.gov/developers/api_faqs.htm) of 25 series/query, ten years/query and 25 queries/day. The API's absent catalog metadata is not an observation failure; required series must each contain validated data.

Exact identities were independently verified against the official [JOLTS series register](https://download.bls.gov/pub/time.series/jt/jt.series), [CPS register](https://download.bls.gov/pub/time.series/ln/ln.series), [ECI register](https://download.bls.gov/pub/time.series/ci/ci.series) and [productivity register](https://download.bls.gov/pub/time.series/pr/pr.series), captured at 02:24:33–34 UTC. These are identity evidence; observations come only from the approved API. The [productivity measure dictionary](https://download.bls.gov/pub/time.series/pr/pr.measure), [sector dictionary](https://download.bls.gov/pub/time.series/pr/pr.sector), [duration dictionary](https://download.bls.gov/pub/time.series/pr/pr.duration), and [ECI periodicity dictionary](https://download.bls.gov/pub/time.series/ci/ci.periodicity) disambiguate fields.

| Output | Exact input | Meaning / native unit |
| --- | --- | --- |
| `hiresRate` | JTS000000000000000HIR | SA total nonfarm hires during month / employment × 100 |
| `quitsRate` | JTS000000000000000QUR | SA total nonfarm quits during month / employment × 100 |
| `layoffsRate` | JTS000000000000000LDR | SA total nonfarm layoffs/discharges during month / employment × 100 |
| `primeAgeEmploymentPopulation` | LNS12300060 | SA employed population aged 25–54 / civilian noninstitutional population aged 25–54, percent |
| `primeAgeParticipation` | LNS11300060 | SA labor force aged 25–54 / same-age civilian noninstitutional population, percent |
| `eciCompensation` | CIS1010000000000I | SA civilian workers, all industries/occupations total compensation index, December 2005=100 |
| `eciCompensationQuarterly` | CIS1010000000000I | Calculated exact previous-quarter ECI percent change, **not annualized** |
| `laborProductivity` | PRS85006092 | Nonfarm business output/hour; published SA annualized previous-quarter percent change |
| `unitLaborCosts` | PRS85006112 | Nonfarm business hourly compensation relative to productivity; published SA annualized previous-quarter percent change |

The [JOLTS technical note](https://www.bls.gov/news.release/jolts.tn.htm) distinguishes month-long labor flows from last-business-day openings and identifies the different rate denominators. The flow rates are percentages and are never divided by 1000. The [ECI note](https://www.bls.gov/news.release/eci.tn.htm) describes composition control and civilian coverage, including benefit costs and excluding federal government workers; this differs from payroll average earnings. ECI change is calculated from the retained index and exact previous quarter, and can differ from an independently rounded published change. The [productivity technical note](https://www.bls.gov/news.release/prod2.tn.htm) describes nonfarm-business scope, annualized quarter changes, costs and revision dependence; these are not economy-wide output or wage-level measures.

Monthly inputs accept M01–M12 and exclude M13 annual averages. Quarterly inputs accept **Q01–Q04**, store quarter-start reference dates and exclude Q05 annual averages; they must not become March/June monthly measurements. All eight required inputs must exist. Duplicates, wrong frequency and malformed numbers reject the family; suppressed values remain null, and missing ECI baselines remain null. Actual API capture at 02:34:31 UTC retained 116 JOLTS months through August 2026, 117 prime-age months through September 2026, and 38 quarterly observations through 2026Q2, all starting in 2017. Monthly flows/CPS, quarterly ECI and preliminary/revised productivity have different publication cadences. API reference dates and retrieval times do not prove release instants; historical `publishedAt` remains null.

## Longer histories and source anomalies

Census already downloads the complete approved [MARTS ZIP](https://www.census.gov/econ_getzippedfile/?programCode=MARTS). Removing the 36-row retention slice preserves all 417 January 1992–September 2026 monthly observations in the verified capture. The exact previous-month calculation, advance-estimate footnote and README's Census/originating-program credit remain. No new Census endpoint or license scope is introduced; see the existing [data-source review](data-sources.md).

Gross and public debt use the same admitted [Debt to the Penny](https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/) fields and [Fiscal Data commercial copying/adaptation/redistribution terms](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization). Queries now request ten calendar years (`record_date >= current UTC year − 9, January 1` through the capture cutoff) with page size 10000; incomplete pagination fails. The verified captures contain 2,461 actual dates from 2017-01-03–2026-10-21. Missing days/weekends are not filled; newly retained history does not claim historical availability at the time.

Expanded debt composition exposes a **published source anomaly on 2025-08-04**: total debt `36828164797914.31` is USD 10 billion below public `29523300148538.85` plus intragovernmental `7314864649375.46`. The default parser remains strict. Explicit history collection quarantines any unreconciled composition row: public-debt observations and all validated breakdown amounts for that date are null, original source strings and signed reconciliation residual remain, and the source warning names the date/amount. It does not change values, substitute a nearby date, relax the USD 1 reconciliation tolerance or discard the rest of history. The latest observations are unaffected.

Main 10Y history reuses the already reviewed nominal Treasury curves through a pure helper. Each row identifies its annual nominal file, actual retrieval timestamp and response hash; admission checks those fields against retained provenance. Zero and missing yields survive. A source-level capture time reflects the newest added response, while debt keeps its independent earlier series retrieval clock. The verified capture now retains 1,201 dates, 2022-01-03–2026-10-22. The normal refresh workflow applies the helper before vintage recording whenever Treasury or curves are attempted: prior retained dates survive partial refreshes, and the newest actual retrieval wins on overlapping dates, including genuine null values. A cached/failed curve refresh cannot truncate earlier history or replace a newer Treasury observation. Invalid merge evidence fails closed to the previous Treasury source with an error. It never rewrites old retrieval captures. No new yield source is licensed; see [yield admission](yields-source-review.md).

## Fiscal denominator contract

`fiscalGdpContext(sources)` returns current-revised context with explicit numerator/denominator dates, units, formula and separate actual retrieval vintages:

- Gross and public debt / GDP use the latest GDP quarter, its last observed debt date within seven days of quarter end, and that same quarter's **nominal GDP SAAR**. Convert debt trillions to billions, then multiply the ratio by 100. An unavailable or quarantined terminal debt row is not replaced by an earlier value.
- Deficit and net budget interest / GDP use twelve exact monthly fiscal **actuals** ending in that quarter and four exact quarterly nominal GDP SAAR values divided by four. This creates matching trailing-year flows; SAAR quarters are not summed as actual quarterly spending. Deficit is outlays minus receipts, positive for deficit; net interest is the MTS budget function, not gross Treasury interest expense.
- Missing exact months/quarters, null values and nonpositive GDP denominators yield unavailable ratios. Real/chained GDP is never substituted. Missing interest does not suppress an otherwise complete deficit ratio.

The result is neither a forecast nor a reconstructed as-known GDP vintage. Fiscal monthly amounts remain as recorded in their original monthly statements and can omit later revisions, as their existing source notice states. The helper preserves that distinction and each source's retrieval time.

## Explicit remaining limits

The reviewed NIPA trade balance is not the full ITA current account. This milestone does not admit a separate ITA endpoint or silently substitute NIPA net lending. At that milestone current-account series remained unavailable. The subsequent [BEA ITA source admission](bea-current-account-source-review.md) adds a separate exact Table 1.1 feed with six nonannualized quarterly balances; it does not extend or relabel this NIPA admission. Saving is admitted, while debt-service/delinquency stress belongs to a separately reviewed Federal Reserve source program; saving must not be labeled a stress measure. No official CPI category effects are manufactured from weights times inflation.

Regression coverage checks published BEA rates versus dollar scaling, no chained sums, null historical publication dates, exact ECI quarter gaps, quarterly/monthly period separation, API limits, longer retail/debt retention, strict pagination, quarantined source evidence/warnings, source/feed/identifier admission, exact fiscal timing and annual-rate conversion, and main 10Y annual-source lineage. Immutable archives are not edited by this work.
