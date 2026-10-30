# Fiscal pressure live deployment verification — October 27, 2026

## Merge and publication
- Merged the reviewed Fiscal pressure implementation into main at b44ddc3839656b1a8412a969deb95b9afc571378. Includes implementation 10f5115 and test-formatting cleanup d5688dc.
- Pushed main without altering unrelated untracked exports/output/tmp work.
- Used the existing manual deployment workflow with refresh_data=false and check_sources=false. The merge commit suppresses the push-triggered all-source refresh; both verification jobs still ran normally.
- [Test, build and deploy run 125](https://github.com/Vasuki8/us-treasury/actions/runs/40605494567) completed successfully on the exact merge commit.
- Node 22 and Node 24 each passed all 1,892 tests, build and 163-asset HTTP smoke checks.
- GitHub Pages deployment succeeded. Cloudflare was skipped under the existing hosting configuration.
- Live page: [Fiscal pressure](https://vasuki8.github.io/us-treasury/#/fiscal).

## Exact deployed build
- Verified artifact: meridian-static-node-24, artifact ID 12781100397 from run 40605494567.
- Downloaded ZIP SHA-256 matched GitHub's digest: 7a80b68adb255db5cdf3cf41aab66263fe614da8765984507e5a4257f42fafcf.
- Published asset directory: assets/0c20f6d1481a73b9.
- The repository's verifyLiveBuild function compared the live root against that extracted CI artifact: all 163 assets matched byte for byte, including lazy source-history bundles and required MIME types.
- This comparison used the actual Linux CI artifact, avoiding differences between CI and a Windows rebuild.

## Public browser verification
- Light and Graphite checked at 320, 390, 736, 1024 and 1440 pixels.
- Five TTM readings, a separate dated public-debt stock and four GDP ratios present at every width; native chart fits; primary contributor/GDP tables need no horizontal scrolling; no page overflow.
- GDP evidence remains open after indicator inspection and contextual return to Fiscal.
- Native chart ArrowLeft changes the exact readout from September to August 2026 for all three series.
- Save form retains Research name, Save view, Freeze result and Saved research; menu fits at 320 pixels. No saved research records were written during live checks.
- Expanded GDP/monthly/debt evidence at 320 pixels in Comfortable density retained all five monthly rows, with no page overflow or duplicate IDs.
- No browser warning/error observed. Initial Light/Compact appearance restored after checks.
- Desktop and mobile captures in both themes and JSON observations are retained in output/fiscal-layout-deployment/live-proof and the chat's fiscal-live visualization directory.

## Preservation and limits
The source snapshot, fiscal calculations, economic-depth calculations, export functions and research-package contracts are unchanged from the pre-layout main revision. These are browser viewport checks, not physical-device tests. This evidence-only record does not change the deployed application assets.
