// These are current measurement associations, not edits to immutable schedule
// captures or proof that a scheduled release has already published values.
const associations={
 'fomc/fomc-decision':['policyTargetUpper','policyTargetLower','effr','iorb'],
 'fomc/fomc-minutes':['policyTargetUpper','policyTargetLower'],
 'bls/job-openings':['openings','hiresRate','quitsRate','layoffsRate'],
 'bls/consumer-price-index':['cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'],
 'bls/employment-situation':['unrate','payroll','participation','wages','payrollLevel','underemployment','employmentPopulation','weeklyHours','payrollAverage3m','primeAgeEmploymentPopulation','primeAgeParticipation'],
 'bea/personal-income-outlays':['pce','pceIndex','pceCoreIndex','pceCore','pceMonthly','pceCoreMonthly','realSpending','realSpendingMonthly','realDisposableIncome','realDisposableIncomeMonthly','savingRate','pceAnnualized3m','pceAnnualized6m','pceCoreAnnualized3m','pceCoreAnnualized6m'],
 'bea/gdp':['gdp','gdpTotalContribution','gdpConsumptionContribution','gdpInvestmentContribution','gdpGovernmentContribution','gdpExportsContribution','gdpImportsContribution','nominalGdp','privateDomesticDemandGrowth','realGdiGrowth','nonresidentialInvestmentGrowth','residentialInvestmentGrowth'],
 'dol/weekly-claims':['claims','continuedClaims','claimsAdvance','continuedClaimsAdvance'],
 'census/housing-construction':['housingStarts','housingPermits','housingCompletions'],
};
export function calendarRelatedIds(event={}){
 return [...new Set([...(event.seriesIds??[event.seriesId]),...(associations[`${event.sourceId}/${event.program}`]??[])])].filter(Boolean);
}
