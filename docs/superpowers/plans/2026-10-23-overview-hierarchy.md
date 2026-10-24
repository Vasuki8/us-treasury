# Approved Overview hierarchy implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Implement the approved comparison without importing prototype runtime code.

**Goal:** Publish the approved Clearer hierarchy Overview with the existing Koyfin UI and Light/Graphite colors.

**Architecture:** Reorganize the existing native Overview renderer and add scoped responsive styling. Reuse live models, native charts, links, publication validation and research packages. Keep supporting information available through disclosures; preserve their open state during asynchronous refreshes.

**Tech stack:** Native JavaScript modules, CSS, Node tests, GitHub Pages.

**Spec:** User-approved `overview-hierarchy-study.html`, variant Clearer hierarchy, in the thread visualization directory. Its capture is a design reference; production continues to use current official data and real navigation.

## Global constraints

- Preserve current UI and exact Light/Graphite palettes; limit visual changes to the Overview.
- Eight headline readings across Growth, Inflation, Labor, Policy, Rates and Fiscal; show target bounds separately if periods differ or an input is unavailable.
- Headlines: GDP; core PCE year over year; payroll monthly gain; unemployment; aligned Fed target range; 10Y Treasury par yield; 2s10s spread; trailing-12-month net interest/receipts.
- Native monthly headline/core PCE and three-month-average payroll charts show momentum. Do not copy the sample SVG implementation.
- Desktop: conditions and momentum left, grouped next catalysts right. Mobile: conditions, catalysts, momentum, supporting research.
- Supporting activity/income, weekly claims, publication evidence, effective policy rate, public debt, personal research and source methods remain reachable without repeated headline-value panels.
- Claims keep distinct initial/continued reference weeks and source estimate roles. Publications, schedules, reference periods and collection clocks stay separate.
- No new feeds, economic scores, forecasts, consensus, source-policy changes or prototype comparison controls in production.
- Preserve saved views, freeze/export contracts, current search/navigation, source warnings and other pages.

## Review focus

- Composite target bounds with missing values or different reference dates must not imply a valid range.
- Headline latest readings stay independent of inherited historical analysis windows.
- Archived publication rows use their own reference periods; historical capture is never a new release today.
- Lazy archive/checkpoint completion must retain open disclosures and user position.
- Frozen Overview context must retain the new payroll-average chart inputs and all existing supplemental data.

## Tasks

### 1. Native Overview content and behavior
Owner: page implementer. Files: `src/overview-page.js`, optional `src/overview-presentation.js`, Overview page tests. Interfaces: native `overviewPage(state, context)`; all production disclosures receive stable `data-overview-disclosure` keys. Root owns router, app, context, styles and unrelated tests.
- [x] Add failing tests for eight headline homes, ordering/disclosures, range guards, precise roles/periods and absent duplicate panels.
- [x] Implement the approved hierarchy with production models and native chart calls; preserve current actions, warnings, comparisons and source evidence.
- [x] Run focused tests and review semantics.

### 2. Scoped styling
Owner: CSS implementer. File: `styles.css` only. Contract: `.overview-hierarchy` wrapper; sample `.sample-*` classes become `.oh-*`. Shared DOM classes are `oh-desk`, `oh-snapshot`, `oh-topic-grid`, `oh-topic`, `oh-reading`, `oh-pair`, `oh-catalysts`, `oh-momentum`, `oh-plots`, `oh-support`; reading children `reading-label/value/unit/change`. Production page scrolls normally.
- [x] Adapt approved sample layout to native page, keeping existing palettes/type/panels, responsive to 320px and both densities.
- [x] Keep styles scoped; inspect native chart-label fit and mobile ordering.

### 3. Integration and reproducibility
Owner: root. Files: `src/app.js`, `src/router.js`, `src/workspace-context.js`, `src/research-context.js`, focused tests.
- [x] Preserve stable Overview disclosure state across rerenders and support bounded Back to Overview detail navigation.
- [x] Retain three-month payroll chart inputs in frozen context; keep previous packages and complete supporting scope valid.
- [x] Run targeted context/actions/package tests.

### 4. Review, verification and publication
- [x] Independent economist/investor and code review; resolve material findings.
- [x] Complete regression suite, build and asset smoke check (1,397 tests; 152 built assets).
- [x] Browser checks at desktop, 390px and 320px; both themes; links, disclosures, native chart resizing and freeze result.
- [ ] Publish approved change, verify CI/deployment and compare exact live assets; record final runtime revision and evidence.
