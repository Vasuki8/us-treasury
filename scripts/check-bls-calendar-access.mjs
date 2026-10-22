import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { OfficialSourceHttpError, requestBytes } from './sources/http.mjs';
import { parseBlsCalendar } from './sources/calendar-bls.mjs';
import { easternFields } from './sources/calendar-utils.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)';
const SUPPORT_URL = 'https://data.bls.gov/forms/opb.htm';

// This checks document access only; it does not parse feed events or publish data.
function readableCalendarFeed(text) {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
  return lines[0] === 'BEGIN:VCALENDAR' && lines.at(-1) === 'END:VCALENDAR' &&
    lines.includes('VERSION:2.0') && lines.includes('BEGIN:VEVENT') && lines.includes('END:VEVENT');
}

/** Two fixed official endpoints, one request each, with no access-denial retries. */
export async function probeBlsCalendarAccess({ fetchImpl = globalThis.fetch, now = new Date(), pause = delay } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError('A valid date is required.');
  const year = Number(easternFields(now.toISOString()).date.slice(0, 4));
  const documents = [
    {url: `https://www.bls.gov/schedule/${year}/home.htm`, format: 'annual-calendar', accept: 'text/html'},
    {url: 'https://www.bls.gov/schedule/news_release/bls.ics', format: 'icalendar-document', accept: 'text/calendar'},
  ];
  const sources = [];
  for (const [index, document] of documents.entries()) {
    if (index) await pause(1000);
    const result = {url: document.url, format: document.format, outcome: 'error', httpStatus: null, sha256: null, bytes: null, error: null};
    let redirected = false;
    let stage = 'request';
    try {
      const response = await requestBytes(document.url, {
        maxBytes: MAX_BYTES,
        headers: {Accept: document.accept, 'User-Agent': USER_AGENT},
        fetchImpl: async (url, options) => {
          // Do not follow a redirect to a different endpoint during this diagnostic.
          const fetched = await fetchImpl(url, {...options, redirect: 'manual'});
          result.httpStatus = fetched.status;
          redirected = Boolean(fetched.redirected);
          return fetched;
        },
      });
      stage = 'validation';
      if (result.httpStatus !== 200 || redirected || response.url !== document.url) {
        result.error = 'Unexpected HTTP status or source redirect; document was not accepted.';
      } else {
        const text = response.bytes.toString('utf8');
        if (document.format === 'annual-calendar') parseBlsCalendar(text, {year});
        else if (!readableCalendarFeed(text)) throw new Error('Invalid calendar document');
        result.outcome = 'ok';
        result.sha256 = response.sha256;
        result.bytes = response.bytes.length;
      }
    } catch (error) {
      if (error instanceof OfficialSourceHttpError) {
        result.httpStatus = error.status;
        result.outcome = error.status === 403 ? 'denied' : 'error';
        result.error = `Official BLS source HTTP ${error.status}.`;
      } else {
        // Never emit untrusted response bodies, arbitrary error strings or URLs.
        result.error = stage === 'validation' ? 'Unrecognized calendar document; validation failed.'
          : 'Request failed or exceeded the 2 MiB response limit.';
      }
    }
    sources.push(result);
  }
  return {checkedAt: now.toISOString(), sources};
}

async function main() {
  if (process.argv.length > 2) throw new Error('Unknown option. This diagnostic accepts no options.');
  const report = await probeBlsCalendarAccess();
  console.log(JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = report.sources.map(source => `| [${source.format}](${source.url}) | ${source.outcome} | ${source.httpStatus ?? 'None'} | ${source.bytes ?? 'None'} | ${source.sha256 ?? 'None'} | ${source.error ?? 'Document readable'} |`).join('\n');
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `### Official BLS calendar access diagnostic\n\nChecked: ${report.checkedAt}\n\n| Official document | Outcome | HTTP | Bytes | SHA-256 | Detail |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n\nThe iCalendar check confirms document framing only; it does not validate event fields or publish calendar data. No source snapshot was changed.\n\nBLS access guidance: [terms and bot policy](https://www.bls.gov/bls/blsterms.htm). For access-denial assistance, [contact BLS](${SUPPORT_URL}).\n`);
  }
  if (!report.sources.some(source => source.outcome === 'ok')) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // These are fixed CLI/summary failures, not raw remote-source errors.
    console.error(error.message === 'Unknown option. This diagnostic accepts no options.' ? error.message : 'BLS access diagnostic could not complete.');
    process.exitCode = 1;
  });
}
