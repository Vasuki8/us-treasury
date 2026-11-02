/** Data-free routing allowlist. Modes name native measurements, never rate changes. */
export const indicatorViewDefinitions={
 payroll:{root:'payroll',default:'payroll-change',views:[
  ['payroll-change','Monthly change · SA',['payroll','payrollAverage3m'],'combo'],
  ['payroll-level','Employment level · SA',['payrollLevel']],
  ['payroll-annual','Annual employment growth · SA',['payrollAnnual']],
  ['payroll-trend','3-month mean monthly change · SA',['payrollAverage3m']]]},
 unemployment:{root:'unrate',default:'unemployment-rates',views:[
  ['unemployment-rates','U-3 & U-6 rates · SA',['unrate','underemployment']],
  ['unemployment-spread','U-6 minus U-3 · percentage points',['underutilizationSpread']]]},
 earnings:{root:'wages',default:'earnings-annual',views:[
  ['earnings-annual','Annual earnings growth · SA',['wages','productionEarningsAnnual']],
  ['earnings-monthly','Monthly earnings growth · SA',['earningsMonthly']],
  ['earnings-momentum','3 / 6-month annualized growth · SA',['earningsAnnualized3m','earningsAnnualized6m']],
  ['earnings-real','Real hourly earnings · annual growth',['realEarningsAnnual']]]},
 eci:{root:'eciCompensationQuarterly',default:'eci-annual',views:[
  ['eci-annual','Annual compensation, wages & benefits · NSA',['eciCivilianCompensationAnnual','eciCivilianWagesAnnual','eciCivilianBenefitsAnnual']],
  ['eci-quarterly','Quarterly compensation, wages & benefits · SA',['eciCompensationQuarterly','eciCivilianWagesQuarterly','eciCivilianBenefitsQuarterly']]]},
 productivity:{root:'laborProductivity',default:'productivity-growth',views:[
  ['productivity-growth','Quarterly productivity growth · SAAR',['laborProductivity']],
  ['productivity-output-hours','Output, hours & productivity · quarterly SAAR',['nonfarmOutputQuarterly','hoursWorkedQuarterly','laborProductivity']],
  ['productivity-index','Output, hours & productivity · 2017=100',['productivityIndex','nonfarmOutputIndex','hoursWorkedIndex']]]},
 costs:{root:'unitLaborCosts',default:'costs-growth',views:[
  ['costs-growth','Unit labor costs & productivity · quarterly SAAR',['unitLaborCosts','laborProductivity']],
  ['costs-annual','Unit labor costs & productivity · four-quarter growth',['unitLaborCostsAnnual','productivityAnnual']],
  ['costs-index','Costs, compensation & productivity · 2017=100',['unitLaborCostIndex','nominalHourlyCompensationIndex','productivityIndex']]]},
 cpi:{root:'cpi',default:'cpi-annual',views:[
  ['cpi-annual','Headline & core · annual NSA',['cpi','cpiCore']],
  ['cpi-monthly','Headline & core · monthly SA',['cpiMonthly','cpiCoreMonthly']],
  ['cpi-index','Headline & core price indexes · NSA',['cpiIndex','cpiCoreIndex']],
  ['cpi-momentum','Headline & core · 3 / 6-month annualized SA',['cpiAnnualized3m','cpiCoreAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized6m']]]},
 pce:{root:'pce',default:'pce-annual',views:[
  ['pce-annual','Headline & core · annual growth',['pce','pceCore']],
  ['pce-monthly','Headline & core · monthly growth',['pceMonthly','pceCoreMonthly']],
  ['pce-index','Headline & core price indexes · SA',['pceIndex','pceCoreIndex']],
  ['pce-momentum','Headline & core · 3 / 6-month annualized',['pceAnnualized3m','pceCoreAnnualized3m','pceAnnualized6m','pceCoreAnnualized6m']]]},
};
export const indicatorViewKeys=Object.freeze(Object.values(indicatorViewDefinitions).flatMap(item=>item.views.map(([key])=>key)));
