# Treasury yield publication timing verification — 2026-10-21

Connected Treasury's official par-yield availability guidance to the Graphite calendar and yield detail page. The source describes usual availability by 6 p.m. Eastern each trading day, with possible delays. This is an ongoing window rather than an exact dated release schedule.

## Source, scope and reuse

The connector reads only the exact [Treasury Yield Curve Methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) endpoint. Parsing is bounded to 2 MiB and scoped to the uniquely identified methodology article inside the page's main content. Treasury navigation also contains article elements, so a regression verifies that those are excluded. Missing, changed, duplicate, conflicting, hidden or malformed publication-rule content fails closed. The 3:30 p.m. input quotation clock is never treated as publication timing.

The snapshot retains structured factual fields: the daily-par-yield program, related yield indicator, usual availability time `18:00`, timezone `America/New_York`, trading-day frequency, possible-delay qualification and source link. It stores no raw methodology narrative or HTML. There are no event dates, scheduled/publication instants, inferred holidays, early closes or generated weekdays. Timing adds zero rows to the dated release calendar.

Commercial reuse review is specific to extracted factual metadata and original app wording, credited to Treasury's Office of Debt Management without endorsement. The [Copyright Office](https://www.copyright.gov/what-is-copyright/) excludes facts and noncreative names/titles; [17 USC §§101/105](https://www.copyright.gov/title17/92chap1.html#105) addresses official-duty federal works. No methodology-specific CC0 or blanket permission for copying prose is claimed, and the published-yield dataset's CC0 review is not transferred to methodology prose. Imagery, logos, page design and input quotation feeds are excluded. Scope and evidence are recorded in `docs/data-sources.md` and enforced by `scripts/data-policy.mjs`, including non-event timing validation.

## Capture and failure behavior

- Source key: `treasury-yield-timing`, separate from Treasury Fiscal Data's debt calendar and statistical observations.
- Retrieved: `2026-10-21T21:54:35.020Z`.
- Last-Modified: `Wed, 16 Sep 2026 22:58:47 GMT`; this is source metadata, not a yield publication timestamp.
- Response SHA256: `5d71c779c80ab8adbbc6b6fcbeeee8d68dae202149d7748f969301c6e7c5bea0`.
- All six schedule/timing captures across five agencies succeeded. Existing indicator values/retrieval provenance and all 218 dated calendar entries were compared with the previous commit and remain unchanged.

Refresh uses the existing calendar pipeline. A failed timing refresh retains the original rule, hash and successful retrieval timestamp with independent cached/error status. An initial failure remains unavailable and shows no uncaptured deadline. Aggregate calendar status is partial when this capture fails while others succeed. Observation-only refreshes preserve the capture. Build policy requires the exact source, fields and qualifications, rejects copied narrative or fabricated dated timing events, and does not authorize timing metadata on another source.

## UI and verification

The shared ongoing-timing panel appears near the top of the calendar and on the yield detail page. It preserves “usually,” Eastern seasonal time, each-trading-day scope and possible delays. It distinguishes timing retrieval from yield-observation retrieval and credits the Office of Debt Management separately from the Bureau of the Fiscal Service debt calendar. Rates and yield-watchlist filters include guidance; month/day choices do not change it or increase release counts.

- Adapter, scope policy, missing-source status and UI tests were observed failing before the related implementations and passing afterward.
- Independent review ran 69 focused tests and found one failure-state issue: shared calendar context quoted the deadline before an initial successful capture. The context is now generic. A failing refresh regression and a complete rendered-page test cover the correction; the reviewer confirmed closure with 47 pages/refresh tests and no remaining findings.
- Final `npm test`: 225 passed, zero failed, including local HTTP checks with loopback permission.
- `npm run build`: passed, including commercial-use validation.
- `node scripts/check-build.mjs`: all 12 built assets passed over local HTTP.
- `git diff --check`: passed.
- Browser QA confirmed default visibility, Rates-only guidance with zero dated rows, hiding under Labor and an unrelated/empty watchlist, saving yields and restoring the Rates/watchlist deep link after reload, yield-detail visibility, and restoration of the original unsaved state. Widths 320, 390, 736, 1024 and 1440 pixels had no page/panel/header overflow; the 320px and desktop screenshots were inspected. No browser warnings or errors were observed.

The existing GitHub Actions workflow tests Node 22 and 24 and deploys main. Its run status and the exact live asset comparison supply publication evidence after this commit is pushed. Cloudflare account activation remains deferred as requested.
