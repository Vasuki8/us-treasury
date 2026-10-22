# BLS calendar access and recovery

The calendar uses BLS's annual release lists for Employment Situation, CPI and JOLTS. The refresh client identifies itself as:

```text
us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)
```

The current and following annual calendars are requested sequentially, with a pause of at least one second. A denied request stops collection. The daily publication policy can retain a verified last-good BLS calendar after the exact approved HTTP 403; its original capture time, provenance and cached/stale warning remain visible.

## Official alternatives and commercial reuse

BLS [documents its subscription feed](https://www.bls.gov/help/hlpiCAL.htm) at `https://www.bls.gov/schedule/news_release/bls.ics`. It is a rolling calendar for most national news releases, updated as needed. A successful HTTP response alone is insufficient to replace annual coverage: a connector must validate event timestamps, timezone, identifiers, revisions and actual coverage, and must leave missing reference periods unknown.

BLS's [copyright policy](https://www.bls.gov/opub/copyright-information.htm) permits reuse of its public-domain publications with agency credit, excluding previously copyrighted photographs and illustrations. This covers the factual agency-authored schedule metadata reviewed in [the data policy](data-sources.md). It does not grant permission to bypass the [automated-access policy](https://www.bls.gov/bls/blsterms.htm).

The OMB annual principal-indicator calendar is not an equivalent replacement: it omits JOLTS, does not supply BLS release clocks, and can retain dates superseded by BLS updates. Do not use it to clear a BLS freshness warning.

## Check access from the actual runner

Run locally:

```powershell
node scripts/check-bls-calendar-access.mjs
```

Or select **Actions → Diagnose official BLS calendar access → Run workflow → main**. This manually checks the current annual HTML and the exact BLS-documented subscription feed, with the same identified client and one-second spacing. It records status, document-format outcome, byte count and SHA-256 for accepted responses, without publishing a snapshot or logging response bodies. Its iCalendar check establishes readable document framing, not a complete event parser. It exits unsuccessfully when neither source document is accepted.

## Request access restoration

When both official formats return an access denial, changing a parser or marking a retained capture fresh cannot restore access. Use BLS's [official publication-information contact form](https://data.bls.gov/forms/opb.htm). The denial page may include an administrator error code and a contact URL containing that code; include it with the UTC timestamp and the diagnostic Actions link.

Prepared request for the repository owner to review and submit:

> Subject: Automated access to official BLS release calendars
>
> I maintain the independent Meridian macroeconomic website at https://vasuki8.github.io/us-treasury/ and the public source repository at https://github.com/Vasuki8/us-treasury. Our identified refresh client receives HTTP 403 when retrieving the annual BLS calendar and the documented iCalendar subscription.
>
> Client identification: `us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)`.
>
> The production refresh runs in GitHub Actions, normally once daily. Annual-calendar requests run sequentially with at least one second between them. We display factual Employment Situation, CPI and JOLTS schedule metadata with BLS credit and source/retrieval information, and retain the previous calendar visibly cached when access fails.
>
> Could you advise the supported automated calendar access method or review this client's access block? I can supply the diagnostic run URL, UTC timestamp and administrator error code from the denied response.

Sending this request requires the owner's contact information. Repository code and diagnostics do not submit the form or send a message to BLS.
