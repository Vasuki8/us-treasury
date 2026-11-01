/** Canonical research identities; each desk loads and freezes all displayed source families. */
export const stitchDeskContracts={
 refunding:{path:'/treasury/refunding',title:'Quarterly Refunding & TBAC',family:'treasury',sources:['treasuryRefunding','auctions','refinancing'],ids:['auctionOfferingMonthly','marketableDebt']},
 debtCeiling:{path:'/treasury/debt-ceiling',title:'Debt Ceiling & Cash Management',family:'treasury',sources:['dtsDesk','treasury'],ids:['statutoryHeadroom','debtSubjectLimit','statutoryDebtLimit','dtsCash']},
 dealers:{path:'/market/dealers',title:'Primary Dealer Positions',family:'fed',sources:['dealerDetails','marketFunctioning'],ids:['dealerNetBills','dealerNetFrn','dealerNetTips','dealerNetAgencyMbs']},
 money:{path:'/market/money',title:'Money Markets & Repo',family:'fed',sources:['moneyRates','repoOperations','ofrRepo','ofrMmf','nyfedTriParty','marketFunctioning','policyRates','onRrp'],ids:['sofr','tgcr','bgcr','obfr']},
 liquidity:{path:'/market/liquidity',title:'Secondary Treasury Liquidity & Depth',family:'fed',sources:['dealerDetails','marketFunctioning','ofrRepo','nyfedTriParty','treasuryRefunding'],ids:['dealerFailsDeliver','dealerFailsReceive','dealerTreasuryTransactions','ofrDvpTransactionVolume']},
 fomc:{path:'/rates/fomc',title:'FOMC Projections & Policy Path',family:'fed',sources:['fedSep','policyRates','bls','bea','marketFunctioning'],ids:['policyTargetUpper','policyTargetLower','effr']},
 qt:{path:'/rates/qt',title:'Fed Balance Sheet & QT',family:'fed',sources:['fedQt','fedBalance','onRrp'],ids:['fedAssets','reserveBalances','fedTreasurySecurities','fedMbs']},
 tips:{path:'/rates/tips',title:'TIPS & Breakeven Inflation',family:'fed',sources:['yields','treasury','dkwInflation','auctions'],ids:['realYield10','inflationComp10','dkwInflationExpected10','dkwInflationRisk10']},
 wedge:{path:'/inflation/wedge',title:'CPI–PCE Wedge Decomposition',family:'economy',sources:['inflationBea','inflationCleveland','bls','bea','pcePriceContributions'],ids:['cpi','pce','cpiCore','pceCore']},
 fxBasis:{path:'/market/fx-basis',title:'Cross-Currency Funding & FX Basis',family:'fed',sources:['fedFx','ecbFx','ecbPolicy','policyRates'],ids:['fxUsdJpy','fxUsdEur','fxGbpEur','ecbDepositRate']},
};
export const stitchDeskPages=Object.keys(stitchDeskContracts);
export function stitchPageSources(state={}){
 const result=[...(stitchDeskContracts[state.page]?.sources??[])];
 if(state.page==='labor'||state.page==='macroCoverage'&&state.macroFamily==='labor')result.push('blsDesk');
 if(state.page==='ownership')result.push('ticHolders');
 if(state.page==='indicator'){
  if(/^(?:payroll|eci|productivity|unitLaborCost|earnings|hourlyEarnings|productionHourlyEarnings|u[1-6]Rate)/.test(state.seriesId??'')||['unrate','underemployment','wages','laborProductivity'].includes(state.seriesId))result.push('blsDesk');
  if(/^(?:cpi|pce)/.test(state.seriesId??''))result.push('inflationBea','inflationCleveland','pcePriceContributions','cpiDetail');
 }
 return [...new Set(result)];
}
