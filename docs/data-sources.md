# Commercial data reuse policy

The public Meridian website is intended to earn advertising revenue. Display and CSV redistribution must use datasets whose terms permit commercial reuse. Free access, an API key, or an official-looking domain is insufficient evidence by itself.

Review date: **October 21, 2026**. The ten connected indicators and Treasury par yield curve below fit this policy; no source replacement was needed.

| Reviewed dataset scope | Commercial reuse basis | Official evidence |
| --- | --- | --- |
| BLS CPS unemployment and participation, CES payroll and hourly earnings, CPI, JOLTS openings | BLS identifies its own publications as public domain, with exceptions for previously copyrighted photographs and illustrations. API conditions still apply. | [Copyright policy](https://www.bls.gov/opub/copyright-information.htm), [API terms](https://www.bls.gov/developers/termsOfService.htm) |
| BEA NIPA GDP growth and PCE price index | BEA permits reuse of its public-domain website information unless a specific notice says otherwise. This review covers the NIPA statistical values retrieved by our adapters. | [Copyright FAQ](https://www.bea.gov/help/faq/147), [citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea), [official open data](https://www.bea.gov/open-data) |
| Treasury Fiscal Data, Debt to the Penny | The API's License and Authorization section explicitly permits commercial copying, adaptation and redistribution. | [Fiscal Data API documentation](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization) |
| Treasury daily nominal par yield curve, including the 10-year yield | Treasury's official Data.gov record, identifier `015-DO-020`, lists CC0 1.0. CC0 permits commercial copying and modification. This covers Treasury's published yields, not third-party market quote feeds. | [Treasury dataset license](https://catalog.data.gov/dataset/interest-rate-statistics-daily-treasury-yield-curve-rates), [CC0 terms](https://creativecommons.org/publicdomain/zero/1.0/), [Treasury methodology and data links](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics) |

## Attribution and presentation

- Credit the originating agencies and retain source links, series identifiers and actual retrieval timestamps in the app and exports.
- Display the BLS API's required post-retrieval disclaimer clearly on every page and include it in each exported BLS row. Use the last successful retrieval time even when a later refresh fails.
- Distinguish calculations made by this application from agency-published measures. Payroll differences, year-over-year inflation and earnings changes, indexing and unit conversions retain their formulas and input provenance.
- Present Meridian as an independent site. Do not imply agency affiliation, endorsement or sponsorship, including endorsement of advertisements.
- Use plain text agency credits. Agency seals/logos and third-party photographs, illustrations, news, forecasts or commercial market data are outside this review and are not licensed by the statistical data policies above.

## Enforced dataset scope

`scripts/data-policy.mjs` records the reviewed datasets, source identifiers, feed locations, evidence links and review date. Both `npm run build` and `npm run data:refresh` validate the snapshot against it. An unreviewed agency, series, identifier, feed or supporting provenance URL stops the build or snapshot replacement. Calendar observations are also rejected until a calendar reuse policy exists. Tests exercise rejection paths as well as the committed snapshot.

This check enforces the recorded scope; it does not detect future changes to a provider's legal terms. Recheck the primary terms before public launch, when changing feeds, and when adding data. Record any material change here and in the policy module. Confirm commercial display, derived use and downloadable redistribution, including any attribution, caching, rate-limit or third-party restrictions, before admitting a new dataset.

Initial claims (DOL) and retail sales (Census) remain disconnected with no observations. They have not been admitted to this commercial reuse policy. A future integration needs its own dataset-specific review. Release calendars currently contain links only; ingesting or redistributing calendar content also requires reviewing its terms.

## Access and advertising

Reuse rights do not waive API limits or authorize bypassing an access denial. Refresh from the official endpoints server-side, respect their limits, and retain last-good observations when requests fail. Do not replace a blocked official feed with an unreviewed mirror.

This review concerns statistical data rights. Google advertising setup, its policies, privacy/consent implementation and public deployment are separate launch work; no advertising scripts or deployment were added by this change.

## Local verification

On October 21, 2026: all 86 Node tests passed, the production build passed its rights check, and the built app loaded all 12 checked assets over local HTTP. Browser checks at 1440 px and 390 px confirmed the notice wraps without page overflow, retains the successful BLS retrieval time, and produces no console warnings or errors. An independent code review identified the calendar scope gap; a regression test and rejection rule closed it. No source observations were changed or refreshed for this rights update.
