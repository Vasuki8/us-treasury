# BLS secondary calendar and statistical retention source review

Reviewed 2026-10-24, Toronto local date. The production source change covers only factual dates/times for Employment Situation, Consumer Price Index and Job Openings and Labor Turnover Survey releases. The existing BLS numerical-statistics source and definitions remain unchanged. No additional indicator, forecast, reference period, publication claim, imagery, logo or proprietary series is admitted.

## Decision and observed access

The New York Fed Economic Indicators Calendar is the selected secondary source for the three BLS release programs. It supplies listed dates and Eastern times, without reference periods. Its source identity and limitations must remain visible. A real collection using the honest project identity and the admission helper succeeded at `2026-10-25T00:18:05.620Z`: eight BLS events across October, November and December 2026, through `2026-12-31`, with no warnings. Accepted index/November/December receipts were retrieved at `00:18:03.113Z`, `00:18:04.404Z` and `00:18:05.620Z`, respectively, on that UTC date. The UTC date was still 2026-10-24 locally.

Official BLS bulk files were investigated as an alternate first-party statistical delivery and rejected for this implementation. Initial discovery using Node's default identity returned the twenty native series. The candidate collector's honest project identity received HTTP 403 on its first `ce.footnote` request and stopped. The identical client was also denied in hosted diagnostic run `40146129094`. No request was repeated with a changed identity, proxy, cookie, browser impersonation or access-denial workaround. The numerical-statistics source was not switched to bulk files, and no inactive bulk adapter is shipped.

The user selected updating healthy sources while retaining the last good BLS numerical capture when the existing statistical API returns its specifically recognized HTTP 503 failure. The retained values keep their original retrieval timestamps and a visible cached/error status. This exception does not mark BLS statistics refreshed, invent a new capture, or authorize accepting a different failure or partial BLS family. Healthy source captures and the working secondary calendar may progress independently. Public-domain reuse rights and successful access remain separate gates.

## Existing BLS statistical rights and rejected bulk candidate

The [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm) places agency electronic and printed publications in the public domain, except previously copyrighted photographs and illustrations, and requests source credit. This supports commercial display, calculation, caching and CSV redistribution of the scoped statistical values. Preserve BLS attribution, native series identifiers, real retrieval dates and the existing derived-analysis disclaimer. No BLS emblem or implied endorsement is included.

The [BLS bot policy](https://www.bls.gov/bls/blsterms.htm) prohibits excessive or malicious retrieval, including survey downloads multiple times per second, and allows blocking unidentified robots. The candidate collector identified the project, spaced requests, bounded bodies/time, and stopped immediately on denial. BLS documents flat-file delivery in its [CES access instructions](https://www.bls.gov/web/empsit/cestips.htm), [CPI flat-file instructions](https://www.bls.gov/cpi/factsheets/using-cpi-metadata-aspect-files.htm) and [native series-ID guide](https://www.bls.gov/help/hlpforma.htm). Documentation of a channel does not turn an observed access denial into success.

The investigated files covered the CE, CU, JT, CI, PR and LN families under `https://download.bls.gov/pub/time.series/`, using eight data partitions and six family footnote dictionaries. That investigation does not admit these URLs into production. Existing BLS monthly/quarterly semantics, calculations, units, seasonal adjustment, missing-value handling and unknown publication timestamps remain governed by the original statistical definitions and source policies.

## New York Fed calendar: rights and scope

Sources are the [Economic Indicators Calendar](https://www.newyorkfed.org/research/calendars/nationalecon_cal.html) and its linked month pages, for example [November 2026](https://www.newyorkfed.org/research/calendars/i-nov26.html) and [December 2026](https://www.newyorkfed.org/research/calendars/i-dec26.html). The parser follows only the current month and up to two next-month links. A one-month-old index can supply navigation to the current month; its past events are excluded.

The [New York Fed Terms of Use](https://www.newyorkfed.org/privacy/termsofuse), Permissible Use and Conditions, permit business use, automated noninterfering access, downloading/storage, copying/distribution and modification. Retain source identifiers, URLs, the original title and attribution; label modifications; pass source-content permissions and conditions downstream; avoid endorsement. The calendar has no listed category-specific restriction. Only BLS factual release rows are extracted, with the underlying federal public-domain basis above; unrelated third-party calendar entries are excluded.

Retain the exact title **Economic Indicators Calendar**, calendar URL, terms/license URL and this year-qualified notice with the copied subset:

> © [capture year] Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.

The capture year comes from the retained retrieval timestamp, never the present display date. Also retain these project notices:

- BLS release dates and times extracted and Eastern Time converted to UTC by Meridian. The New York Fed did not make these modifications or endorse Meridian.
- Dates and times are tentative and subject to change. Calendar metadata is redistributed under the New York Fed Terms of Use; those permissions, conditions and restrictions continue to apply. Underlying BLS release metadata is public domain.

`sourceId: bls` remains the canonical releasing-agency/program association, not a claim that BLS delivered this calendar. `provider: new-york-fed`, the source agency label, authentic page URL and `scheduleBasis: secondary-calendar` identify the delivery. Both reference-period fields remain null. A listed date does not establish publication, historical first release, or availability of statistical values. Eastern-to-UTC conversion uses IANA daylight-saving rules; it never assumes fixed EST.

The calendar-only admission helper validates required notices, exact source URLs, program/series mappings, factual event fields, null periods, unique event identities, month/page/receipt agreement, and actual retrieval hashes/timestamps. Any New York Fed receipt or event URL requires the explicit New York Fed provider; dropping that label cannot bypass review. Frozen legacy BLS annual-calendar captures pass through their existing policy unchanged. The capture's Eastern month anchors its bounded calendar window; archived attribution is checked against the retained capture year rather than today's clock.

## Alternatives considered

FRED retains the public-domain status of BLS series and explicitly permits certain commercial display uses. Its [current full terms](https://fred.stlouisfed.org/legal/terms/) condition public-domain reuse on avoiding prohibited uses; service prohibition `(p)` and API prohibition `(l)` separately address storing, caching, archiving and database incorporation. The narrow unresolved issue is service authorization for this application's retained public JSON and exports, not ownership of BLS statistics. A user-owned [API key](https://fred.stlouisfed.org/docs/api/api_key.html) would solve authentication only. The older standalone API terms do not clearly override the current service conditions. No keyless CSV implementation or third-party example key is adopted.

DBnomics [documents automated API access and recommends caching](https://docs.db.nomics.world/web-api/), under original-provider rights and its [ODbL aggregate-database terms](https://db.nomics.world/about). Observed BLS coverage was stale relative to this application's retained values, so it is not admitted as a current substitute. OECD/ILOSTAT licensing alone does not establish exact definitions, coverage or freshness for these twenty native series.
