# Component balance/GDP effect history plan

> **For agentic workers:** Implement each task with focused failing tests first; independently review and verify delivery.

**Goal:** Add quarterly and trailing-four-quarter component-level balance/GDP-denominator effect history charts, preserving Graphite and existing total/combined views.

**Architecture:** Reuse the existing guarded effect records, without changing their calculations. A four-component selector controls two three-line charts (balance/GDP/combined), latest readings and historical tables. Reuse `macroMeasure` and the shared date window. Optional frozen context records component/method/window and references existing immutable inputs. Extend the existing CSV builder with an opt-in selected-component scope; default exports and five retained attachments remain unchanged.

**Tech stack:** Existing JavaScript/SVG/CSS, Node tests, GitHub Actions/Pages. Base `ef013d8`; current local checkout. Leave exports/output/tmp untouched. No dependency or infrastructure additions.

## Source mapping, method and product choices

Same admitted BEA ITA Table 1.1 lines 32–35 and current-dollar GDP A191RC from NIPA1.1.5. Feeds: `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv` and `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`. Reuse retained revised captures, source status, license and release/retrieval clocks; no source refresh or historical publication-vintage invention. Official BEA reuse/citation/annual-rate pages rechecked; the existing commercial statistical scope covers these charts and exports. [Source review](../../current-account-gdp-source-review.md).

The existing `symmetric-two-order-v1` method remains authoritative: balance effect `50(N1−N0)(1/D0+1/D1)`, GDP effect `50(N0+N1)(1/D1−1/D0)` pp. They split the existing component ratio change, not an additional contribution to add again. These are Meridian accounting calculations, not official BEA growth contributions or causal explanations. ITA balances are SA quarterly USD billions, not annualized; GDP SAAR/4 supplies each quarterly flow. Adjacent T4Q windows use separately summed flows, five raw quarters and three overlapping quarters. Preserve exact predecessor lookback before date filtering, missing/nonfinite reasons independently, and no older-date fallback.

Choose one component at a time to keep six effects readable, rather than overlay twelve lines per horizon or add eight charts. Selector: Goods, Services, Primary income, Secondary income. Use the existing `macroMeasure` route and explain that it also changes focused history/comparison selection. For total/unrelated focus, component-only panel explicitly defaults to Goods. Total-effect charts remain available. Live selection is URL-persistent; frozen selection is recorded/read-only. Two linked component charts have their own cursor group. A missing split may leave the combined change visible. History tables first50; CSV includes all selected endpoints.

## Tasks and interfaces

### 1. Thin series projection

Files: new `src/current-account-gdp-component-effects.js`, `tests/current-account-gdp-component-effects.test.js`.

- [ ] Test then export frozen `CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS` (four `{id,label}`), `CURRENT_ACCOUNT_GDP_COMPONENT_EFFECTS_CHART='current-account-gdp-component-effects'`, `resolveCurrentAccountComponentEffectMeasure(id)` (admitted ID or Goods), `currentAccountGdpComponentEffectSeries(result,measure)` and `currentAccountGdpComponentEffects(sources={},range={preset:'all'},measure='itaGoodsBalance')`.
- [ ] Wrapper returns base effect result plus `measure:{id,label}` and selected `series:{quarterly:[3],trailing:[3]}`. Builder consumes already-computed balance-effects result so a catalog can project all24 series from one calculation. IDs `${id}QuarterlyBalanceEffect/GdpEffect/RatioChange` and Trailing equivalents. Read `row[horizon].effects[id]` exactly; preserve full endpoint calendar, selected window, pp metadata, method, source references/reasons and partial split/combined availability. No recalculation of formulas or mutation.
- [ ] Verify all4 components × both horizons × all3 fields against existing records, date/count/custom lookback, missing components/nonfinite split, invalid source metadata and empty calendars, no total-chart/default-model changes.

### 2. Graphite component panel, selected CSV and live wiring

Files: new `src/current-account-gdp-component-effects-view.js` / view/integration tests; modify `src/current-account-gdp-contributions-view.js`, `src/macro-coverage-page.js`, `src/app.js`.

- [ ] Add `currentAccountGdpComponentEffectsPanel(sources,range,{measure='itaGoodsBalance',frozen=false,packageId=null})`, `currentAccountGdpComponentEffectsCsv(sources,range,measure)`. Selector `id='current-account-effect-component'`, label `Effect history component`; route valid changes through `navigate({macroMeasure:target.value})`. Panel gets current focused measure. Two scoped three-line charts, latest paired pp table, current/prior signed flow evidence, per-horizon history, formula/source/revised-data caveats and explicit Goods fallback. Existing date controls only once.
- [ ] Extend existing chart catalog options with `componentEffects=false`; use one computed effect result for total and all24 component series, gate optional catalogs independently on frozen contexts. Avoid new dependencies in extracted app chart-binding tests.
- [ ] Extend `currentAccountGdpContributionsCsv(...,{effects=false,componentMeasure=null}={})` and balance-effects CSV wrapper optional `{componentMeasure=null}`. Strictly admit only four components when effects=true. Selected export appends `component_measure_id`, emits two selected-component change rows per endpoint and unique selected-component/GDP input records, retains original metadata/source values/footnotes/current/prior quarters. Default contribution/effect CSVs byte-identical. Live action `data-export-current-account-gdp-component-effects`; frozen action `data-export-frozen-current-account-gdp-component-effects="packageId"` uses recorded component/range/sources only.

### 3. Immutable selection context

Files: `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`; new package/frozen tests.

- [ ] Strict optional `currentAccountGdpComponentEffects={version:1,method:'symmetric-two-order-v1',measure:<four admitted IDs>,range,inputContext:'currentAccountGdpBreakdown'}`. Resolve pin selection with thin module resolver. Reuse six histories, five attachments, existing caps. Scope identifies reconstructed selected chart/CSV; render only if new context exists, with recorded sources/method/window/measure/package ID.
- [ ] Verify strict method/selection/range/reference, independent optional context, old pins get no new panel/selection/live fallback, immutable source isolation and CSV roundtrip, unchanged original attachments, all-history durable package under3MiB.

### 4. Review and delivery

- [ ] Source scope and independent final diff review. Full tests with bounded workers, focused Node22, production build/smoke, default CSV byte checks and immutable archive unchanged.
- [ ] Verify local desktop/narrow content, selection/keyboard linked readouts, exports and missing/error states where tools permit; record unconfirmed manual checks.
- [ ] Commit/push, verify Actions, exact live assets and representative component view. Preserve deployment conventions; Cloudflare remains deferred.

## Progress

Implemented a thin projection of existing effect records, four-component route-linked selector, paired quarterly/T4Q charts, latest readings, signed-flow evidence, historical tables and selected-component CSV. Optional frozen context records component/method/window while sharing existing inputs. Source status now supports the selected numerator's provenance clock; existing callers retain their original default. No new official data, source rights, formula or dependency. Source/method and independent final code review found no actionable findings.

Verification: 1,297/1,297 full tests passed with four workers; 243/243 focused Node22 tests passed. Production build and smoke check passed 143 assets. Default contribution and all-component effect CSVs remain byte-identical to ef013d8 across all/1y/count/custom windows; all four selected CSVs match both-horizon model metrics with unique supporting inputs. Reviewer independently confirmed all eight default CSV combinations and five default catalog configurations unchanged. Every component retains 266 endpoints, with 265 valid quarterly and 262 valid T4Q changes. Immutable source captures/publication archives are unchanged. Full-history frozen package is 3,088,157 bytes under the existing 3 MiB cap, retaining six input histories and five original attachments.

Local browser: Services route displays the selected four-option component selector, both horizons, expected latest endpoint and selected source labels. Component panels at 390/320px report matching viewport/document widths of 375/375 and 305/305px after scrollbars. Tab navigation reaches the labeled selector and charts; Home selects 2025Q2 Services values (quarterly balance −0.033, GDP −0.016, combined −0.049 pp; linked T4Q −0.012/−0.013/−0.025 pp). Screenshot visually checked and saved to `test-results/component-effects-responsive.png`. Semantic selector automation timed out, including an accessibility attempt that reset the browser session; manual selection/change and new CSV download remain unconfirmed. All four route/change branches, export payload/action binding, missing/error states and frozen selection isolation pass automated checks. Temporary previews are ignored QA files/servers.

Push and deployment verification pending.
