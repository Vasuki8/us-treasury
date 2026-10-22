// These are current measurement associations, not edits to immutable schedule
// captures or proof that a scheduled release has already published values.
const associations={
 'bls/consumer-price-index':['cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly'],
 'bls/employment-situation':['unrate','payroll','participation','wages','payrollLevel','underemployment','employmentPopulation','weeklyHours'],
 'bea/personal-income-outlays':['pce','pceIndex','pceCoreIndex','pceCore','pceMonthly','pceCoreMonthly','realSpending','realSpendingMonthly','realDisposableIncome','realDisposableIncomeMonthly'],
 'bea/gdp':['gdp','gdpTotalContribution','gdpConsumptionContribution','gdpInvestmentContribution','gdpGovernmentContribution','gdpExportsContribution','gdpImportsContribution'],
 'dol/weekly-claims':['claims','continuedClaims','claimsAdvance','continuedClaimsAdvance'],
 'census/housing-construction':['housingStarts','housingPermits','housingCompletions'],
};
export function calendarRelatedIds(event={}){
 return [...new Set([...(event.seriesIds??[event.seriesId]),...(associations[`${event.sourceId}/${event.program}`]??[])])].filter(Boolean);
}
