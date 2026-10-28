/** Announced facts only. No auction close, publication instant or settlement cash flow is inferred. */
export function treasuryAuctionEvents(source) {
  const provenance = source?.provenance ?? [],events = [];
  for (const row of source?.auctions ?? []) {
    const receipt = provenance[row.sourceReceiptIndex];
    if (!receipt || !/^[a-f0-9]{64}$/.test(receipt.sha256)) throw new Error('Treasury calendar auction receipt is unavailable');
    for (const [program,date] of [['auction',row.auctionDate],['settlement',row.issueDate]]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) throw new Error('Invalid Treasury funding date');
      events.push({id:`treasury-funding-${program}-${row.id}`,sourceId:'treasury-auctions',program,
        name:`${row.securityType} ${row.securityTerm} ${program==='auction'?'auction':'issue / settlement'}`,
        agency:'U.S. Treasury, Bureau of the Fiscal Service',seriesId:'auctionOfferingMonthly',seriesIds:['auctionOfferingMonthly'],topic:'Treasury funding',
        date,datePrecision:'day',time:null,scheduledAt:null,period:null,periodLabel:null,scheduleBasis:'announced-date',sourceUrl:receipt.url,
        auctionId:row.id,auctionDate:row.auctionDate,announcementDate:row.announcementDate,issueDate:row.issueDate,
        offeringAmount:row.offeringAmount,securityType:row.securityType,securityTerm:row.securityTerm,originalTerm:row.originalTerm,
        reopening:row.reopening,cashManagement:row.cashManagement,sourceReceiptIndex:row.sourceReceiptIndex,
      });
    }
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

export const treasuryFundingReferences = [
  {label:'Official auction announcements',url:'https://www.treasurydirect.gov/auctions/auction-announcements/'},
  {label:'Quarterly refunding and borrowing documents',url:'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding'},
];
