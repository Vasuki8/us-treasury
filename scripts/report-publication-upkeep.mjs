import {appendFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublicationUpkeep} from './check-publication-upkeep.mjs';

const cell=value=>String(value??'Unavailable').replace(/[|<>\r\n]/g,' ');
export function publicationUpkeepSummary(report){
 const rows=Object.entries(report.families).map(([family,row])=>`| ${cell(family)} | ${cell(row.status)} | ${row.retainedCount} / ${row.approvedCount} | ${row.missingApprovedIds.length} | ${row.reviewQueue.length} | ${cell(row.discovery.status)} |`);
 return `## Publication evidence upkeep\n\nChecked ${cell(report.checkedAt)}. Overall: **${cell(report.status)}**.\n\n| Family | Status | Retained / approved facts | Missing approved | Awaiting source review | Discovery |\n| --- | --- | ---: | ---: | ---: | --- |\n${rows.join('\n')}\n\n${cell(report.interpretation)}\n\nThe JSON artifact retains discovery receipts, errors and candidate identities. This report does not admit new publications and does not gate unrelated current-data deployment.\n`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await checkPublicationUpkeep({discover:true});
 await writeFile('publication-upkeep.json',JSON.stringify(report,null,2)+'\n');
 const summary=publicationUpkeepSummary(report);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(summary);
 if(['invalid-archive','missing-approved'].includes(report.status))process.exitCode=1;
}
