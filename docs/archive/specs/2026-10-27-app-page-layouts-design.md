# Remaining app page layouts

The user requested applying the accepted Fiscal pressure design and review loop to every remaining page, preserving themes, data, calculations and research actions. The accepted pattern is the design authority; page-specific composition is an implementation judgment within that request.

## Intent and approach
Reuse native ES-module renderers, theme tokens, panels, charts, metrics and persisted supporting disclosures. Give each page a clear working result, explicit units and reference dates, then supporting evidence. Keep task-oriented tables prominent on Explore, Calendar, Watchlist, retrieval history and research libraries. Overview and Labor already have strong working layouts; refine their reading basis and support consistency without rebuilding them.

Alternatives considered: a global visual reskin is smaller but leaves content-order problems; replacing every page with the Fiscal grid would misrepresent tasks and mixed clocks. The chosen approach adapts the reviewed hierarchy per route family and reuses the existing design system.

## Scope
- Treasury: Refinancing, Rates & curves, Auctions, Ownership, Market functioning.
- Economy: Prices, Activity, Housing, Policy, all four External-account sections, GDP contributions, Credit & policy transmission.
- Working/research pages: Indicator tabs, Explore catalog/comparison/coverage, Calendar scopes/selected event, Watchlist, Retrieval history, Release evidence, all four Saved research views and selected frozen packages/publication variants.
- Overview and Labor: preserve established compositions; make reading units and measurement basis explicit.
- Fiscal remains the approved reference. There are no settings/help routes to invent.

## Presentation rules
Use compact grouped readings with individual native units, periods and basis. Separate distinct clocks and modeled scenarios. Native trends and contributor evidence precede full secondary evidence on analytical pages. Use existing supportingDetails() keys; add new namespaced keys only for new supporting groups. Keep controls that define the result beside that result. Evidence tables may scroll locally; the page must fit at 320px.

## Invariants
Preserve both Light and Graphite theme tokens and both density settings. Preserve source data, models, transformations, CSV/JSON schemas, licenses/rights, retrieval and release semantics, routing, chart configuration, IDs/action attributes, tab accessibility and return context. Keep source errors, missing/suppressed/noncomparable states, modeled assumptions, storage failure and publication-evidence limitations visible. Preserve immutable frozen inputs, attachment order and exact export scope. No new dependencies, feeds, routes, deployment, or changes to current Fiscal behavior.

## Acceptance
All route families reviewed in both themes at desktop and narrow widths. Meaningful output tests cover changed ordering, basis and visible error states; existing calculation, export, package and action tests stay green. Run the complete suite with two workers, production build and 163-asset smoke check. Independent review findings are resolved and verified before delivery. Browser evidence records responsive behavior and representative working research flows. Browser viewport checks are not physical-device testing.
