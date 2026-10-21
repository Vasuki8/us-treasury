import { requestText } from './http.mjs';
import { decodeHtmlText } from './calendar-utils.mjs';

const endpoint = 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
const articlePath = '/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology/';
const maxBytes = 2 * 1024 * 1024;
const expectedRule = "Yield curve rates are usually available at Treasury's interest rate website by 6:00 PM Eastern Time each trading day, but may be delayed due to system problems or other issues. Every attempt is made to make this data available as soon as possible.";

function attribute(attributes, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match ? match[1] ?? match[2] ?? match[3] : null;
}

function agencyBody(article) {
  const matches = [...article.matchAll(/<div\b([^>]*)>/gi)].filter(match => attribute(match[1], 'class')?.split(/\s+/).includes('field--name-field-page-body'));
  if (matches.length !== 1) throw new Error('Unrecognized Treasury yield timing body schema');
  const opening = matches[0];
  const start = opening.index + opening[0].length;
  const remainder = article.slice(start);
  let depth = 1;
  for (const tag of remainder.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return remainder.slice(0, tag.index);
  }
  throw new Error('Unclosed Treasury yield timing body schema');
}

/** Extract qualified publication guidance only; this source does not list future release dates. */
export function parseTreasuryYieldTiming(html) {
  if (typeof html !== 'string') throw new Error('Invalid Treasury yield timing HTML');
  if (Buffer.byteLength(html, 'utf8') > maxBytes) throw new Error('Treasury yield timing exceeds the 2 MiB size limit');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(html)) throw new Error('Invalid Treasury yield timing control character');
  const content = html.replace(/<!--[^]*?-->/g, ' ').replace(/<(script|style|template|noscript)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ');
  const mains = [...content.matchAll(/<main\b[^>]*>([^]*?)<\/main\s*>/gi)];
  if (mains.length !== 1 || (content.match(/<main\b/gi) ?? []).length !== 1) throw new Error('Unrecognized Treasury yield timing main-content schema');
  const main = mains[0][1];
  const articles = [...main.matchAll(/<article\b([^>]*)>([^]*?)<\/article\s*>/gi)];
  if (articles.length !== 1 || (main.match(/<article\b/gi) ?? []).length !== 1 || attribute(articles[0][1], 'about') !== articlePath) throw new Error('Unrecognized Treasury yield timing article identity schema');
  const article = articles[0][2];
  if (/\shidden(?=[\s=>])|\baria-hidden\s*=\s*["']?true\b|\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(article)) throw new Error('Unreviewed hidden Treasury yield timing content');
  const body = agencyBody(article);
  const headings = [...body.matchAll(/<h3\b[^>]*>([^]*?)<\/h3\s*>/gi)];
  if (headings.length !== 1 || decodeHtmlText(headings[0][1]) !== 'Treasury Yield Curve Methodology') throw new Error('Unrecognized Treasury yield timing heading schema');
  if ((article.match(/<p\b/gi) ?? []).length !== (article.match(/<\/p\s*>/gi) ?? []).length) throw new Error('Malformed Treasury yield timing paragraph schema');
  const paragraphs = [...article.matchAll(/<p\b[^>]*>([^]*?)<\/p\s*>/gi)].map(match => decodeHtmlText(match[1]));
  // Reject a second publication rule even when it is outside the page-body
  // wrapper. The input-quotation clock is deliberately not a release clock.
  const rules = paragraphs.filter(text => /^Yield curve rates\b/i.test(text) || /\b(?:available|availability|published|publication)\b/i.test(text) && /\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(text));
  const bodyRules = [...body.matchAll(/<p\b[^>]*>([^]*?)<\/p\s*>/gi)].map(match => decodeHtmlText(match[1])).filter(text => text === expectedRule);
  if (rules.length !== 1 || rules[0] !== expectedRule || bodyRules.length !== 1) throw new Error('Changed, duplicate or conflicting Treasury yield timing rule schema');
  return {
    program: 'daily-par-yields', seriesIds: ['yield'], topic: 'Rates', scheduleBasis: 'usual-availability',
    frequency: 'each-trading-day', availableBy: '18:00', timeZone: 'America/New_York', delaysPossible: true, sourceUrl: endpoint,
  };
}

export async function collectTreasuryYieldTiming({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid Treasury yield timing capture date');
  const response = await requestText(endpoint, { fetchImpl, maxBytes, headers: { Accept: 'text/html' } });
  if (response.url !== endpoint) throw new Error('Unexpected Treasury yield timing source URL or redirect');
  const timing = parseTreasuryYieldTiming(response.text);
  const { text: _text, ...provenance } = response;
  return {
    id: 'treasury-yield-timing', agency: 'U.S. Department of the Treasury, Office of Debt Management',
    events: [], timing, provenance: [provenance], fetchedAt: response.retrievedAt, warnings: [],
    coverageNote: 'Treasury par yield curve publication guidance: usually available by 6 p.m. Eastern each trading day; delays are possible. This is an ongoing availability window, not an exact release time or a list of dated events. Trading-day holidays and early closes are not inferred. Input quotations around 3:30 p.m. are not publication times.',
  };
}
