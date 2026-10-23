export const BEA_ITA_URL='https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv';
export const BEA_ITA_PAGE='https://www.bea.gov/data/intl-trade-investment/international-transactions';
export const BEA_ITA_LICENSE='https://www.bea.gov/help/faq/147';
export const currentAccountDefinitions=[
 ['currentAccountBalance','30','Balance on current account (line 1 less line 9)','Current-account balance','Goods and services plus primary income and secondary income balances. Positive is surplus, negative deficit. Includes income and current transfers, unlike a goods/services trade balance.'],
 ['itaGoodsServicesBalance','31','Balance on goods and services (line 2 less line 10)','Goods and services balance · ITA','International-transactions goods and services balance. This is a component of current account; it excludes primary and secondary income.'],
 ['itaGoodsBalance','32','Balance on goods (line 3 less line 11)','Goods balance · ITA','International-transactions goods exports less goods imports; a current-account component.'],
 ['itaServicesBalance','33','Balance on services (line 4 less line 12)','Services balance · ITA','International-transactions services exports less services imports; a current-account component.'],
 ['itaPrimaryIncomeBalance','34','Balance on primary income (line 5 less line 13)','Primary income balance · ITA','Primary income receipts less payments, including investment income and compensation of employees. Distinct from transfers and capital gains.'],
 ['itaSecondaryIncomeBalance','35','Balance on secondary income (line 8 less line 16)','Secondary income balance · ITA','Secondary income receipts less payments, including current transfers such as government grants and personal remittances. Distinct from the capital account.'],
];
export const itaLocator=line=>`ITA:T1.1:line${line}:World:SA:Q`;
export const currentAccountRegistry=Object.fromEntries(currentAccountDefinitions.map(([id,line,_label,name,meaning])=>[id,{
 id,code:`ITA T1.1 L${line} SA`,name,short:name,agency:'beaIta',topic:'Growth',frequency:'Quarterly',dateConvention:'quarter-start',
 format:'billions',precision:3,unit:'USD billions per quarter (not annualized)',adjustment:'Seasonally adjusted',periodType:'flow',comparisonClass:'balance',observationType:'official',
 source:{name:'U.S. Bureau of Economic Analysis, International Transactions',url:BEA_ITA_PAGE},
 definition:`BEA International Transactions Accounts Table 1.1, line ${line}, all countries. ${meaning} Published U.S. dollar millions divided by 1000 for billions per quarter, seasonally adjusted and not annualized. Current revised history; reference dates mark quarter starts, not publication. ITA and NIPA use different accounting adjustments; do not equate these quarterly amounts with NIPA trade at SAAR.`,
}]));
