# BLS inflation and labor family source review

Reviewed 2026-10-22. Scope: eleven additions to the existing six BLS outputs, using twelve distinct official series in one public, unregistered API request. No imagery, logos, proprietary material, credentials, or paid service is included.

## Reuse and delivery conditions

The [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm) places agency-published statistical material in the public domain and asks users to credit BLS. The [API terms](https://www.bls.gov/developers/termsOfService.htm) impose no end-use controls on downloaded data; they require the retrieval date and this disclaimer: “BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.” They prohibit misleading attribution and unauthorized BLS-logo use. These official conditions support the review judgment that the scoped statistics may be displayed and exported commercially with the existing attribution, retrieval metadata, disclaimer, and explicit calculation labels.

The exact approved statistical feed remains `https://api.bls.gov/publicAPI/v1/timeseries/data/`, with a JSON POST containing `seriesid`, `startyear`, and `endyear`. The [official API FAQ](https://www.bls.gov/developers/api_faqs.htm) identifies the unregistered limits as 25 queries daily, 25 series per query, and 10 years per query. This collector makes one request for the current UTC year and preceding nine calendar years, deduplicates the twelve input IDs, and retains at most 120 monthly observations per output. Actual coverage depends on returned observations. This is captured coverage, not a claim to provide each series' complete historical record.

## Exact additions and meanings

| Output ID | Official input | Displayed measure | Adjustment | Unit / base | Output type |
| --- | --- | --- | --- | --- | --- |
| `cpiIndex` | `CUUR0000SA0` | CPI-U all items, U.S. city average | NSA | Index, 1982-84=100 | Official level |
| `cpiCoreIndex` | `CUUR0000SA0L1E` | CPI-U all items less food and energy | NSA | Index, 1982-84=100 | Official level |
| `cpiSaIndex` | `CUSR0000SA0` | CPI-U all items, U.S. city average | SA | Index, 1982-84=100 | Official level |
| `cpiCoreSaIndex` | `CUSR0000SA0L1E` | CPI-U all items less food and energy | SA | Index, 1982-84=100 | Official level |
| `cpiCore` | `CUUR0000SA0L1E` | Core CPI change from the exact year-ago month | NSA | Percent year over year | Calculated |
| `cpiMonthly` | `CUSR0000SA0` | Headline CPI change from the exact preceding calendar month | SA | Percent month over month | Calculated |
| `cpiCoreMonthly` | `CUSR0000SA0L1E` | Core CPI change from the exact preceding calendar month | SA | Percent month over month | Calculated |
| `payrollLevel` | `CES0000000001` | Total nonfarm payroll employment; jobs, not unique people | SA | Thousands of jobs | Official level |
| `underemployment` | `LNS13327709` | U-6 labor underutilization rate | SA | Percent | Official rate |
| `employmentPopulation` | `LNS12300000` | Employed share of civilian noninstitutional population, age 16+ | SA | Percent | Official rate |
| `weeklyHours` | `CES0500000002` | Average weekly paid hours of all employees on private nonfarm payrolls | SA | Hours | Official level |

The original outputs and inputs remain: `unrate`/`LNS14000000`, `payroll`/`CES0000000001`, `cpi`/`CUUR0000SA0`, `participation`/`LNS11300000`, `wages`/`CES0500000003`, and `openings`/`JTS000000000000000JOL`. Their formulas, units, input provenance, and observation schema are retained. New capture windows can extend their observed history; prior immutable captures retain their original contents.

Identity evidence:

- The [official CPI ID guide](https://www.bls.gov/cpi/factsheets/cpi-series-ids.htm) identifies CPI-U, the SA/NSA marker, U.S. city average, and the all-items code. The [official core NSA series report](https://data.bls.gov/timeseries/CUUR0000SA0L1E) verifies its item and base; the [official CPI correction table](https://www.bls.gov/bls/errata/cpi-price-corrections-10182016.htm) explicitly lists both headline/core SA and NSA IDs. The correction table is identity evidence, not a source of current observations.
- The [official payroll report](https://data.bls.gov/timeseries/CES0000000001) identifies the total nonfarm SA level in thousands. The [official CES correction table](https://www.bls.gov/bls/cesbook_stores_correction.htm) identifies `CES0500000002` as total private SA average weekly hours of all employees.
- The [official employment-population report](https://data.bls.gov/timeseries/LNS12300000) verifies its SA status, age coverage, and percent/rate measurement. The [official CPS correction table](https://www.bls.gov/bls/errata/cps-seasonally-adjusted-labor-force-and-unemployment-data-corrected-on-january-10-2024.htm) explicitly identifies `LNS13327709` as SA U-6. [CPS definitions](https://www.bls.gov/cps/definitions.htm) explain the distinct denominators: U-6 includes the marginally attached in its denominator and includes unemployed, marginally attached, and involuntary part-time workers in its numerator; employment-population uses the civilian noninstitutional population.

## Calculations, updates, and limits

The [BLS percent-change method](https://www.bls.gov/cpi/factsheets/calculating-percent-changes.htm) supports `100 × (current index / exact comparison-month index − 1)`. Year-over-year uses the same month one year earlier; monthly uses the preceding calendar month. Annual averages (`M13`) are excluded. Neither missing calendar months nor zero/missing denominators are replaced by adjacent records or invented inputs. Growth is computed from the published index values before retention. Therefore a new capture's earliest annual growth values can be missing when the exact prior-year inputs are outside its response. Retained index values and `sourceValue`, `baseDate`, and `baseValue` permit reproduction of every calculated row.

The [CPI release explanation](https://www.bls.gov/news.release/cpi.nr0.htm) distinguishes SA monthly changes from unadjusted twelve-month changes and notes annual revision of SA CPI history for five years. Our growth outputs are calculated from published indexes, with their precision preserved; they are labeled calculated rather than represented as independently published rounded BLS growth observations.

The [CES FAQ](https://www.bls.gov/web/empsit/cesfaq.htm) describes monthly payroll/hour releases, a pay-period reference including the month's twelfth day, two subsequent sample revisions, and annual benchmark revisions. Hours include paid leave, so they are not a measure of actual hours worked alone. Household-survey ratios and establishment-survey jobs/hours describe different populations and should not be substituted for one another. Monthly CPI/CPS/CES observations use the existing separately captured CPI and Employment Situation calendar associations; observation dates and retrieval timestamps do not establish historical release timestamps.

The parser requires every reviewed raw series, rejects duplicate raw-series responses, duplicate monthly dates, malformed numbers, and nonfinite counts. Suppressed/missing values remain null. Every new output identifies its source ID, measure, formula, and official/calculated status. API output provides no verified historical release instant; `publishedAt` remains null. A failed family request must retain the application's last good BLS capture rather than publish a partial family. Initial source admission, registry units, comparison classification, and calendar association are separate integration gates.
