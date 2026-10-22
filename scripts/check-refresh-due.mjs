import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFreshness, getScheduledRefreshAt } from '../src/freshness.js';
import { canPublishCachedBls } from './sources/refresh.mjs';

/** Check committed capture provenance; attempts and assembly never replace it. */
export function getDailyRefreshPlan(snapshot = {}, { now = new Date(), force = false } = {}) {
  const expectedRefreshAt = getScheduledRefreshAt(now);
  const currentTime = now.toISOString();
  const freshness = getFreshness(snapshot, { now });
  const policy = snapshot?.publicationPolicy;
  let approvedCachedBls = false;
  const pendingSources = freshness.entries.filter(entry => {
    const [kind, id] = entry.id.split(':');
    const source = kind === 'data' ? snapshot?.sources?.[id] : snapshot?.calendar?.sources?.[id];
    const captureIsValid = entry.fetchedAt !== null && entry.fetchedAt <= currentTime;
    if (captureIsValid && entry.fetchedAt >= expectedRefreshAt && source?.status === 'ok' &&
        (source.error === null || source.error === undefined || source.error === '') &&
        (source.failure === null || source.failure === undefined)) return false;

    // Reuse the publisher's exact narrow HTTP403/provenance exception, and
    // require evidence that BLS was attempted during this specific daily slot.
    if (entry.id === 'calendar:bls' && captureIsValid &&
        policy?.mode === 'allow-cached-bls-calendar' && Array.isArray(policy.cachedCalendarSources) &&
        policy.cachedCalendarSources.includes('bls') && entry.lastAttemptAt !== null &&
        entry.lastAttemptAt >= expectedRefreshAt && entry.lastAttemptAt <= currentTime &&
        canPublishCachedBls(source, now)) {
      approvedCachedBls = true;
      return false;
    }
    return true;
  }).map(entry => entry.label);
  return {
    required: force === true || pendingSources.length > 0,
    expectedRefreshAt,
    pendingSources,
    reason: force === true ? 'Manual force requested; refresh all official sources.'
      : pendingSources.length ? `${pendingSources.length} sources still need a successful capture for this daily slot.`
        : approvedCachedBls ? 'Daily slot is complete; the verified cached BLS calendar was attempted in this slot.'
          : 'All 11 official sources already captured for this daily slot.',
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--force')) throw new Error('Unknown option. Only --force is supported.');
  const { snapshot } = await import('../src/official-snapshot.js');
  const plan = getDailyRefreshPlan(snapshot, { force: args.includes('--force') });
  const decision = plan.required ? 'Run refresh' : 'Skip refresh';
  const pending = plan.pendingSources.length ? plan.pendingSources.join(', ') : 'None';
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Daily refresh check\n\n**${decision}.** ${plan.reason}\n\nExpected scheduled run: ${plan.expectedRefreshAt}\n\nPending sources: ${pending}\n\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `required=${plan.required}\nexpected_refresh_at=${plan.expectedRefreshAt}\n`);
  }
  console.log(`${decision}: ${plan.reason}\nExpected scheduled run: ${plan.expectedRefreshAt}\nPending sources: ${pending}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`Daily refresh check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
