import {appendFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublicationUpkeep,publicationUpkeepExitCode} from './check-publication-upkeep.mjs';

const cell=value=>String(value??'Unavailable').replace(/[|<>\r\n]/g,' ');
export function publicationUpkeepSummary(report){
 const rows=Object.entries(report.families).map(([family,row])=>`| ${cell(family)} | ${cell(row.status)} | ${row.retainedCount} / ${row.approvedCount} | ${row.missingApprovedIds.length} | ${row.reviewQueue.length} | ${cell(row.discovery.status)} |`);
 const details=Object.entries(report.families).map(([family,row])=>{
  const discovery=row.discovery;
  const attempts=(discovery.attempts??[]).map(attempt=>`  - ${cell(attempt.url)} · attempt ${cell(attempt.attempt)} · HTTP ${cell(attempt.httpStatus)} · ${cell(attempt.outcome)}${attempt.errorCode?' · '+cell(attempt.errorCode):''}`).join('\n');
  const rights=[discovery.sourceNotice,discovery.attribution,discovery.license?`${discovery.license.name} · ${discovery.license.url}`:'',discovery.changesNotice].filter(Boolean).map(cell).join(' ');
  return `- **${cell(family)}:** ${cell(discovery.source??discovery.status)}${discovery.coverage?' · '+cell(JSON.stringify(discovery.coverage)):''}. ${discovery.latestPeriod?'Latest aligned reference month: '+cell(discovery.latestPeriod)+'. ':''}${cell(discovery.note??'')}${discovery.error?' Error: '+cell(discovery.error):''}${attempts?'\n'+attempts:''}${rights?'\n  '+rights:''}`;
 }).join('\n');
 return `## Publication evidence upkeep\n\nChecked ${cell(report.checkedAt)}. Overall: **${cell(report.status)}**.\n\n| Family | Status | Retained / approved facts | Missing approved | Awaiting source review | Discovery |\n| --- | --- | ---: | ---: | ---: | --- |\n${rows.join('\n')}\n\n${details}\n\n${cell(report.interpretation)}\n\nThe JSON artifact retains discovery receipts, errors and candidate identities. Discovery failures fail this independent maintenance job; they do not gate unrelated current-data deployment. This report does not admit new publications. Secondary CPI availability confirms a reference month, not an original BLS publication day.\n`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await checkPublicationUpkeep({discover:true});
 await writeFile('publication-upkeep.json',JSON.stringify(report,null,2)+'\n');
 const summary=publicationUpkeepSummary(report);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(summary);
 process.exitCode=publicationUpkeepExitCode(report);
}
