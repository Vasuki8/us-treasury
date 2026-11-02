/** Program-native alternatives; no generic growth calculation is applied to rates. */
const programs=[
 ['payroll','payrollLevel','payrollAnnual','payrollAverage3m','payrollAverage6m'],
 ['unrate','underemployment','underutilizationSpread'],
 ['wages','hourlyEarnings','earningsMonthly','earningsAnnualized3m','earningsAnnualized6m'],
 ['eciCompensationQuarterly','eciCivilianCompensationAnnual','eciCompensation'],
 ['laborProductivity','productivityAnnual','productivityIndex'],
 ['unitLaborCosts','unitLaborCostsAnnual','unitLaborCostIndex'],
];
export const laborHistoryIds=Object.freeze([...new Set(programs.flat())]);
export const laborHistoryViews=id=>programs.find(ids=>ids.includes(id))??[id];
