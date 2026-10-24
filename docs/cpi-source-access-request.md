# Prepared BLS public-feed access request

Draft only. No message has been sent. The owner must supply a reply email and authorize submission.

Official route: [BLS information request form](https://data.bls.gov/forms/opb.htm), linked by the [BLS privacy/contact guidance](https://www.bls.gov/bls/pss.htm). The form itself could not be inspected with the research tool. This request concerns public news-release documents, not privileged or embargoed access.

**Subject:** HTTP 403 when checking the public CPI news-release feed from GitHub Actions

Hello BLS support,

I maintain Meridian, a public US macroeconomic research dashboard at https://vasuki8.github.io/us-treasury/. The source repository is https://github.com/Vasuki8/us-treasury.

Our automated checker receives HTTP 403 for both of these official public documents:

- https://www.bls.gov/feed/cpi.rss — the CPI news-release feed listed in your RSS directory.
- https://www.bls.gov/bls/news-release/cpi.htm — the dated CPI release archive index.

Could you advise how to obtain permitted, reliable automated access to these public documents, or identify an approved equivalent source for discovering dated CPI release links?

The checker identifies itself as:

`us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)`

It runs in GitHub-hosted Ubuntu with Node.js 24. There are three scheduled daily checks plus three release-time checks on weekdays; manual checks and website updates can also trigger a check. Normally the primary feed requires one request. Each request has a 12-second deadline and a 2 MiB response limit. Only temporary transport/server failures receive bounded retries. Access denials are not retried, and no browser impersonation, proxy or security challenge is used.

The reproducible hosted check began at **2026-10-24T04:26:25.446Z**. It made one request to each URL, and both returned 403. The detailed public run is https://github.com/Vasuki8/us-treasury/actions/runs/40062327314; its `publication-evidence-upkeep` artifact records the two statuses. The earlier run https://github.com/Vasuki8/us-treasury/actions/runs/40059245626 also recorded a 403 for the archive index.

The feed is used only to discover candidate dated releases for source review. Existing reviewed CPI evidence remains retained with BLS attribution. We do not infer actual publication instants from feed timestamps or use scheduled dates to invent published results.

Please let me know whether a different approved request configuration, registered contact or fixed-egress setup is needed, and what diagnostic information would help you investigate.

Thank you,

[Owner name]

[Reply email]
