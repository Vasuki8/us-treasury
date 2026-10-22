import { registry } from './registry.js';
import { formatValue, tabularCsv, BLS_DATA_NOTICE } from './model.js';
import { asKnownOn, revisionHistory, normalizeVintageTimestamp, vintageMeasurementsComparable } from './vintages.js';
import { heading, button, panel, table, emptyState, escapeHtml as esc } from './ui.js';

const limitation = 'First captured means an observed Meridian retrieval, not first reported or first release. Change reasons and benchmark versus ordinary revisions are unknown without independent release evidence. Series observations and metadata are reconstructed; supplemental module data and calendars are not reconstructed.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const displayValue = (metadata, value) => finite(value) ? formatValue(metadata, value) : 'Unavailable';
const latestCapture = vintages => [...(vintages?.captures ?? [])].map(item => normalizeVintageTimestamp(item.capturedAt)).sort().at(-1) ?? null;
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
const joined = values => unique(values).join('; ');
const nonComparable = 'Not directly comparable: measurement or definition changed between captures. Cause unknown.';
const comparisonNote = comparable => comparable ? 'Same captured measurement and definition.' : nonComparable;
const measurementDetails = value => Object.fromEntries(['name','unit','frequency','adjustment','definition','observationType','format','precision','periodType','dateConvention','measure','calculation'].filter(key => value?.[key] !== undefined).map(key => [key,value[key]]));

function capturedMetadata(current, source, series) {
  const result = { ...current };
  for (const key of ['agency', 'name', 'unit', 'frequency', 'adjustment', 'definition', 'observationType', 'format', 'precision','periodType','dateConvention','measure','calculation']) result[key] = series?.[key] ?? source?.[key] ?? current[key];
  return result;
}

function capturedRights(metadata, source, series, observation) {
  const licenses = unique([series?.licenseUrl, source?.licenseUrl]), terms = unique([series?.termsUrl, source?.termsUrl]);
  const sourceUrl = observation?.sourceUrl ?? series?.sourceUrl ?? source?.sourceUrl ?? metadata.source.url;
  return {
    sourceUrl,
    sourceUrls: unique([sourceUrl, ...(observation?.sourceUrls ?? []), ...(series?.sourceUrls ?? []), ...(source?.sourceUrls ?? []), series?.sourceUrl, source?.sourceUrl]),
    sourceNotice: joined([source?.sourceNotice, series?.sourceNotice, metadata.agency === 'bls' ? BLS_DATA_NOTICE : '']),
    redistributionNotice: joined([source?.redistributionNotice, series?.redistributionNotice]),
    attribution: joined([source?.attribution, series?.attribution]),
    sourceTitle: series?.sourceTitle ?? source?.sourceTitle ?? '',
    licenseUrls: licenses.length ? licenses : terms,
    termsUrls: terms.length ? terms : licenses,
  };
}

function rightsNotice(contexts, current) {
  const seen = new Set();
  return contexts.map(({ sourceId, source, series, observation }) => {
    const metadata = capturedMetadata(current, source, series), rights = capturedRights(metadata, source, series, observation), key = JSON.stringify({ rights, unit: metadata.unit, frequency: metadata.frequency, adjustment: metadata.adjustment, definition: metadata.definition });
    if (seen.has(key)) return '';
    seen.add(key);
    const links = unique([...rights.sourceUrls, ...rights.licenseUrls, ...rights.termsUrls]).map(url => /^https?:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : esc(url)).join(' · ');
    return `<div class="explain"><p><strong>${esc(rights.sourceTitle || sourceId)}</strong></p><p>${esc([metadata.unit, metadata.frequency, metadata.adjustment].filter(Boolean).join(' · '))}</p>${[metadata.definition, rights.sourceNotice, rights.redistributionNotice, rights.attribution].filter(Boolean).map(value => `<p>${esc(value)}</p>`).join('')}<p>${links}</p></div>`;
  }).join('');
}

/** datetime-local is deliberately interpreted as UTC, never the device timezone. */
function normalizedCutoff(value, vintages) {
  if (value === undefined || value === null) value = latestCapture(vintages);
  if (!value || typeof value !== 'string') throw new Error('Invalid cutoff: select a UTC date and time.');
  let canonical = value;
  if (!value.endsWith('Z')) {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
    if (!match) throw new Error('Invalid cutoff: use a UTC date and time.');
    canonical = `${match[1]}:${match[2] ?? '00'}.${(match[3] ?? '').padEnd(3, '0')}Z`;
  }
  try { return normalizeVintageTimestamp(canonical); }
  catch { throw new Error('Invalid cutoff: the UTC date or time is not valid.'); }
}

function seriesSelection(value) {
  if (!Object.hasOwn(registry, value)) throw new Error('Unknown registered vintage series');
  return value;
}

function filteredHistory(vintages, cutoff) {
  return { version: vintages?.version ?? 1, captures: (vintages?.captures ?? []).filter(item => normalizeVintageTimestamp(item.capturedAt) <= cutoff) };
}

function firstCaptures(history, seriesId) {
  const result = new Map();
  for (const capture of [...history.captures].sort((a, b) => normalizeVintageTimestamp(a.capturedAt).localeCompare(normalizeVintageTimestamp(b.capturedAt)))) {
    const upserts = capture.series[seriesId]?.upserts ?? [];
    if (!upserts.some(observation => !result.has(`${capture.sourceId}|${observation.date}`))) continue;
    const source = { ...capture.metadata, id: capture.sourceId, fetchedAt: normalizeVintageTimestamp(capture.capturedAt), provenance: capture.provenance ?? [] }, series = capture.series[seriesId].metadata ?? {};
    for (const observation of upserts) {
      const key = `${capture.sourceId}|${observation.date}`;
      if (!result.has(key)) result.set(key, { capturedAt: normalizeVintageTimestamp(capture.capturedAt), value: observation.value, sourceId: capture.sourceId, source, series, observation });
    }
  }
  return result;
}

function view(vintages, cutoff, seriesId) {
  const history = filteredHistory(vintages, cutoff), known = asKnownOn(history, cutoff), first = firstCaptures(history, seriesId);
  const observations = Object.entries(known.sources).flatMap(([sourceId, source]) => (source.series[seriesId]?.observations ?? []).map(observation => ({ sourceId, source, series: source.series[seriesId], observation, first: first.get(`${sourceId}|${observation.date}`) })));
  const changes = revisionHistory(history, seriesId);
  const changeContexts = changes.flatMap(item => item.changes.map(change => {
    const source = asKnownOn(history, change.capturedAt).sources[item.sourceId], series = source?.series[seriesId], observation = series?.observations.find(row => row.date === item.date);
    return { sourceId: item.sourceId, source, series, observation, item, change };
  }));
  return { history, observations: observations.sort((a, b) => a.observation.date.localeCompare(b.observation.date) || a.sourceId.localeCompare(b.sourceId)), changes, changeContexts };
}

export function historyStatusMessage(historyState = { status:'idle' }) {
  const failed = historyState.status === 'error';
  return `<div class="empty-state${failed ? ' amber' : ''}" role="${failed ? 'alert' : 'status'}" aria-live="polite"><p>${failed ? 'Capture history could not be loaded.' : 'Loading verified capture history…'}</p><p class="muted">${failed ? esc(historyState.error?.message ?? 'History archive unavailable.') : 'As-known values and observed revisions will appear after archive verification.'} Later values are not substituted.</p>${button(failed ? 'RETRY HISTORY' : 'LOADING HISTORY', `id="history-retry" data-retry-history${failed ? '' : ' aria-disabled="true"'}`)}</div>`;
}

export function vintagesPage(state = {}, vintages, historyState = { status:vintages === undefined ? 'idle' : 'ready' }) {
  state ??= {};
  const ready = historyState.status === 'ready';
  const hasHistory = ready && Boolean(vintages?.captures?.length), seriesId = Object.hasOwn(registry, state.vintageSeries) ? state.vintageSeries : 'gdp', metadata = registry[seriesId];
  let cutoff = null, result = null, error = '';
  try { if (hasHistory) { cutoff = normalizedCutoff(state.vintageCutoff, vintages); result = view(vintages, cutoff, seriesId); } } catch (failure) { error = failure.message; }
  const cutoffValue = cutoff ? cutoff.slice(0, -1) : (state.vintageCutoff ?? '').replace(/Z$/, '');
  const options = Object.values(registry).sort((a, b) => a.name.localeCompare(b.name)).map(item => `<option value="${esc(item.id)}"${item.id === seriesId ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
  const controls = `<div class="filter-body"><label for="vintage-cutoff">Cutoff (UTC)<input id="vintage-cutoff" type="datetime-local" step="0.001" value="${esc(cutoffValue)}" aria-describedby="vintage-cutoff-note"></label><label for="vintage-series">Registered series<select id="vintage-series">${options}</select></label></div><p class="panel-note" id="vintage-cutoff-note">The entered date and time are UTC, independent of your device timezone. Captures at the exact cutoff are included. ${cutoff ? `Selected cutoff: ${esc(cutoff)}.` : 'Select a valid cutoff after captures are available.'}</p>`;
  const available = result?.observations ?? [];
  const knownRows = available.map(({ sourceId, source, series, observation, first }) => {
    const captured = capturedMetadata(metadata, source, series), initial = capturedMetadata(metadata, first?.source, first?.series);
    const comparable = vintageMeasurementsComparable(initial, captured);
    return `<tr><th scope="row">${esc(observation.date)}</th><td class="num">${esc(displayValue(initial, first?.value))}<span class="table-code muted">${esc(initial.unit)}</span></td><td class="num">${esc(displayValue(captured, observation.value))}<span class="table-code muted">${esc(captured.unit)}</span></td><td>${esc(first?.capturedAt ?? 'Unknown')}</td><td>${esc(source.fetchedAt)}</td><td>${esc(observation.publishedAt ?? 'Unknown')}</td><td>${esc(sourceId)}</td><td>${esc(comparisonNote(comparable))}</td></tr>`;
  }).join('');
  const changeRows = (result?.changeContexts ?? []).map(({ source, series, item, change }) => {
    const captured = capturedMetadata(metadata, source, series), previous = capturedMetadata(metadata, null, change.previousMetadata);
    const comparable = change.measurementComparable !== false && vintageMeasurementsComparable(previous, captured);
    return `<tr><th scope="row">${esc(item.date)}</th><td class="num">${esc(displayValue(previous, change.previousValue))}<span class="table-code muted">${esc(previous.unit)}</span></td><td class="num">${esc(displayValue(captured, change.value))}<span class="table-code muted">${esc(captured.unit)}</span></td><td>${esc(change.capturedAt)}</td><td>Unknown · observed value change</td><td>${item.available ? 'In current selected coverage' : 'Outside current selected coverage'}</td><td>${esc(comparisonNote(comparable))}</td></tr>`;
  }).join('');
  const units = unique(available.map(({ source, series }) => capturedMetadata(metadata, source, series).unit));
  const notices = result ? rightsNotice([...available, ...available.map(item => item.first).filter(Boolean), ...result.changeContexts], metadata) : '';
  const baseline = result?.history.captures.filter(item => item.baseline) ?? [];
  const provenance = !ready ? '<p class="panel-note">Capture provenance is awaiting archive verification.</p>' : baseline.length ? table(['SOURCE BASELINE', 'ACTUAL CAPTURE / UTC', 'HISTORY RECORDED / UTC'], baseline.map(item => `<tr><th scope="row">${esc(item.sourceId)}</th><td>${esc(item.capturedAt)}</td><td>${esc(item.recordedAt)}</td></tr>`).join(''), 'Original successful retrievals and later history recording timestamps') : emptyState('No baseline exists at this cutoff.');
  return heading('REVISION HISTORY', 'First captured and latest values · as known at actual retrieval cutoffs', button('CSV VINTAGES', `data-export-vintages${!hasHistory || error ? ' disabled title="A valid cutoff and capture history are required"' : ''}`))
    + panel('01', 'AS-KNOWN CONTROLS', controls)
    + (error ? `<div class="empty-state amber" role="alert"><p>${esc(error)}</p><p>Choose a valid UTC cutoff; later values are not substituted.</p></div>` : '')
    + (!ready ? panel('02', 'CAPTURE HISTORY', historyStatusMessage(historyState)) : !hasHistory ? panel('02', 'CAPTURE HISTORY', emptyState('No capture history is available.', 'Immutable baselines and exact-value deltas will be retained after successful official captures. Earlier historical vintages are not invented.')) : '')
    + (result ? panel('02', `${metadata.name.toUpperCase()} · AS KNOWN`, knownRows ? table(['REFERENCE PERIOD', 'First captured', 'Latest captured', 'FIRST CAPTURE / UTC', 'LAST RETRIEVAL / UTC', 'RELEASE DATE', 'SOURCE','MEASUREMENT COMPARISON'], knownRows, 'As-known values at or before the selected actual retrieval cutoff') : emptyState('No captured observations for this series at the selected cutoff.', 'The source or observation may not have been captured yet.'), '', `Latest units: ${units.join('; ') || metadata.unit}. Each value retains its captured units and definition. First captured is the earliest retained retrieval for that period; latest captured is its value confirmed at this selected cutoff. Null values remain unavailable.`) : '')
    + (result ? panel('03', 'OBSERVED VALUE CHANGES', changeRows ? table(['REFERENCE PERIOD', 'PREVIOUS VALUE', 'NEW VALUE', 'CHANGE CAPTURE / UTC', 'EXPLANATION', 'COVERAGE','MEASUREMENT COMPARISON'], changeRows) : emptyState('No observed value changes for this series at the selected cutoff.', 'This does not prove the series was never revised before Meridian began capturing it.'), '', 'Only tracked changes in the value appear here. Metadata changes and coverage removals are not counted as economic revisions. Changed measurements or definitions are not directly comparable. Ordinary revision versus benchmark change: Unknown without independent evidence.') : '')
    + `<div class="grid g11">${panel('04', 'CAPTURE PROVENANCE', provenance, '', 'A bootstrap may be recorded later than its original capture. Its time comes from genuine prior retrieval provenance, not a historical publication or availability claim.')}${panel('05', 'WHY IT MATTERS & LIMITATIONS', `<div class="explain"><p><strong>WHAT CHANGED.</strong> Compare values actually captured for the same reference period. A new observation period is distinct from a changed previously captured value.</p><p><strong>WHAT CONTRIBUTED.</strong> Each tracked change retains the observed values and retrievals. Explanation: Unknown until a separate official revision or benchmark notice is verified.</p><p><strong>WHY IT MATTERS.</strong> Reconstructed observations let research use information captured by the selected retrieval cutoff without silently including later captures.</p><p><strong>LIMITATIONS.</strong> ${esc(limitation)}</p><p>Supplemental module data and calendars are not reconstructed. Release dates stay separate from reference periods and retrieval times; unknown release dates remain unknown. Historical first-reported values are unavailable unless separately sourced.</p><p>Source identifiers, calculation methodology, coverage and SHA256 provenance accompany the CSV. Missing sources before their first genuine capture remain unavailable; missing periods are not fabricated zeros.</p></div>`)}</div>`
    + (notices ? panel('06', 'CAPTURED SOURCE TERMS & DEFINITIONS', notices) : '');
}

export function vintagesCsv(vintages, { cutoff: requestedCutoff, seriesId = 'gdp' } = {}) {
  seriesSelection(seriesId);
  const headers = ['row_type', 'series_id', 'series_name', 'source_id', 'period', 'value', 'unit', 'cutoff_utc', 'first_captured_at', 'first_captured_value', 'last_captured_at', 'previous_value', 'change_captured_at', 'change_reason', 'release_date', 'retrieved_at', 'observation_type', 'data_status', 'source_url', 'source_series', 'calculation', 'coverage_note', 'provenance_sha256', 'limitations', 'value_status', 'source_notice', 'frequency', 'adjustment', 'definition', 'captured_data_status', 'source_urls', 'license_url', 'terms_url', 'attribution', 'source_title', 'redistribution_notice', 'provenance_urls','first_captured_unit','previous_value_unit','latest_captured_unit','latest_captured_value','first_captured_metadata_json','previous_value_metadata_json','latest_captured_metadata_json','measurement_comparable','measurement_comparison_note','previous_captured_at'];
  if (!vintages?.captures?.length && requestedCutoff === undefined) return tabularCsv(headers, []);
  const cutoff = normalizedCutoff(requestedCutoff, vintages), result = view(vintages, cutoff, seriesId), metadata = registry[seriesId];
  const columns = (source, series, observation, value) => {
    const captured = capturedMetadata(metadata, source, series), rights = capturedRights(captured, source, series, observation);
    return {
      captured,
      common: [captured.observationType ?? 'official', 'captured-as-known', rights.sourceUrl, (series?.sourceIds ?? []).join('; '), series?.calculation ?? '', series?.coverageNote ?? source?.coverageNote ?? '', (source?.provenance ?? []).map(item => item.sha256).filter(Boolean).join('; '), limitation],
      extra: [finite(value) ? 'observed numeric value' : 'explicit missing value', rights.sourceNotice, captured.frequency, captured.adjustment, captured.definition, series?.dataStatus ?? captured.observationType ?? 'official', rights.sourceUrls.join('; '), rights.licenseUrls.join('; '), rights.termsUrls.join('; '), rights.attribution, rights.sourceTitle, rights.redistributionNotice, joined((source?.provenance ?? []).map(item => item.url))],
    };
  };
  const rows = result.observations.map(({ sourceId, source, series, observation, first }) => {
    const { captured, common, extra } = columns(source, series, observation, observation.value);
    const initial = capturedMetadata(metadata, first?.source, first?.series), comparable = vintageMeasurementsComparable(initial, captured);
    return ['as-known-observation', seriesId, captured.name, sourceId, observation.date, observation.value, captured.unit, cutoff, first?.capturedAt, first?.value, source.fetchedAt, null, null, '', observation.publishedAt ?? null, source.fetchedAt, ...common, ...extra,initial.unit,null,captured.unit,observation.value,JSON.stringify(measurementDetails(initial)),null,JSON.stringify(measurementDetails(captured)),comparable,comparisonNote(comparable),null];
  });
  for (const { sourceId, source, series, observation, item, change } of result.changeContexts) {
    const { captured, common, extra } = columns(source, series, observation, change.value);
    const initial = capturedMetadata(metadata, null, item.firstMetadata), previous = capturedMetadata(metadata, null, change.previousMetadata), latest = capturedMetadata(metadata, null, item.latestMetadata);
    const comparable = change.measurementComparable !== false && vintageMeasurementsComparable(previous, captured);
    rows.push(['observed-value-change', seriesId, captured.name, sourceId, item.date, change.value, captured.unit, cutoff, item.firstCaptured.capturedAt, item.firstCaptured.value, item.latest.capturedAt, change.previousValue, change.capturedAt, change.reason, observation?.publishedAt ?? null, change.capturedAt, ...common, ...extra,initial.unit,previous.unit,latest.unit,item.latest.value,JSON.stringify(measurementDetails(initial)),JSON.stringify(measurementDetails(previous)),JSON.stringify(measurementDetails(latest)),comparable,comparisonNote(comparable),change.previousCapturedAt]);
  }
  return tabularCsv(headers, rows);
}
