import {writeFile} from 'node:fs/promises';
import {collectTreasuryAuctionCalendar} from './sources/calendar-treasury-auctions.mjs';
import {assertTreasuryAuctionCalendar} from './treasury-calendar-policy.mjs';

const capture=await collectTreasuryAuctionCalendar();
assertTreasuryAuctionCalendar(capture);
await writeFile(new URL('../src/treasury-auction-calendar-snapshot.js',import.meta.url),`// Independent announced Treasury funding-date capture; refresh with the narrow collector.\nexport const treasuryAuctionCalendarSnapshot = ${JSON.stringify(capture)};\n`);
console.log(`Captured ${capture.auctions.length} announced Treasury records and ${capture.events.length} auction/settlement events; ${capture.coverageStart} through ${capture.coverageEnd}.`);
