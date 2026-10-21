/**
 * Deliberately synthetic fixtures for the local Graphite foundation.
 * Source links identify the agency's methodology; they do not verify these values
 * or the illustrative release schedule. No network requests are made here.
 * Values are stored in their displayed units (percent, thousands, millions, USD trillions).
 */

const iso = (date) => date.toISOString().slice(0, 10);
const source = (agency, url) => ({ name: `Synthetic · ${agency}`, url });
const bls = source('Bureau of Labor Statistics', 'https://www.bls.gov/');
const bea = source('Bureau of Economic Analysis', 'https://www.bea.gov/');
const treasury = source('U.S. Treasury', 'https://home.treasury.gov/');

function monthly(values, endMonth = 8, publicationDay = 2) {
  return values.map((value, i) => {
    const period = new Date(Date.UTC(2026, endMonth - values.length + 1 + i, 1));
    return {
      date: iso(period), value,
      publishedAt: iso(new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, publicationDay))),
    };
  });
}

function quarterly(values) {
  return values.map((value, i) => {
    const period = new Date(Date.UTC(2026, 3 - (values.length - 1 - i) * 3, 1));
    return {
      date: iso(period), value,
      publishedAt: iso(new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 3, 30))),
    };
  });
}

function daily(values) {
  // Twelve weekday observations; Oct 12 is omitted as a U.S. federal holiday.
  const dates = ['2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
    '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20'];
  return values.map((value, i) => ({ date: dates[i], value, publishedAt: dates[i] }));
}

function weekly(values) {
  return values.map((value, i) => {
    const period = new Date(Date.UTC(2026, 9, 10 - (values.length - 1 - i) * 7));
    return {
      date: iso(period), value,
      publishedAt: iso(new Date(period.getTime() + 5 * 86400000)),
    };
  });
}

const percent = { unit: 'Percent', precision: 1, format: 'percent' };
const monthlyAdjusted = { frequency: 'Monthly', adjustment: 'Seasonally adjusted' };

export const series = {
  unrate: {
    id: 'unrate', code: 'UNRATE', name: 'Unemployment rate', short: 'Unemployment', topic: 'Labor',
    ...monthlyAdjusted, ...percent, source: bls,
    definition: 'Share of the civilian labor force aged 16 and older that is unemployed. Synthetic monthly levels.',
    observations: monthly([4.1, 4.1, 4.2, 4.2, 4.1, 4.0, 4.1, 4.1, 4.2, 4.3, 4.3, 4.2]),
    revisions: [],
  },
  payroll: {
    id: 'payroll', code: 'PAYEMS-CHANGE', name: 'Nonfarm payroll employment change', short: 'Nonfarm payrolls', topic: 'Labor',
    ...monthlyAdjusted, unit: 'Thousands of jobs', precision: 0, format: 'thousands', source: bls,
    definition: 'Monthly change in total nonfarm payroll employment, in thousands of jobs. Synthetic observations.',
    observations: monthly([182, 176, 158, 164, 151, 172, 167, 156, 149, 138, 134, 142]),
    revisions: [{ period: '2026-08-01', initial: 128, revised: 134, publishedAt: '2026-10-02' }],
  },
  cpi: {
    id: 'cpi', code: 'CPIAUCSL-YOY', name: 'Consumer price inflation', short: 'CPI inflation', topic: 'Inflation',
    ...monthlyAdjusted, ...percent, source: bls,
    definition: 'Year-over-year change in the consumer price index for all urban consumers. Each level is already an annual inflation rate; a period change is in percentage points. Synthetic observations.',
    observations: monthly([3.2, 3.1, 3.0, 3.1, 3.0, 2.9, 2.8, 2.9, 2.8, 2.7, 2.8, 2.9], 8, 14),
    revisions: [],
  },
  pce: {
    id: 'pce', code: 'PCEPI-YOY', name: 'Personal consumption expenditure inflation', short: 'PCE inflation', topic: 'Inflation',
    ...monthlyAdjusted, ...percent, source: bea,
    definition: 'Year-over-year change in the personal consumption expenditures price index. Synthetic annual inflation rates observed monthly.',
    observations: monthly([2.9, 2.8, 2.8, 2.7, 2.8, 2.7, 2.6, 2.6, 2.5, 2.5, 2.6, 2.6], 7, 25),
    revisions: [{ period: '2026-07-01', initial: 2.5, revised: 2.6, publishedAt: '2026-09-25' }],
  },
  gdp: {
    id: 'gdp', code: 'A191RL1Q225SBEA', name: 'Real gross domestic product growth', short: 'Real GDP', topic: 'Growth',
    frequency: 'Quarterly', ...percent, adjustment: 'Seasonally adjusted annual rate', source: bea,
    definition: 'Quarter-over-quarter real GDP growth at an annualized rate. Synthetic quarterly observations; period changes are differences in the annualized growth rate, in percentage points.',
    observations: quarterly([3.4, 3.1, 2.2, 2.6, 2.8, 2.5, 2.3, 2.7, 2.5, 2.1, 2.2, 2.4]),
    revisions: [{ period: '2026-04-01', initial: 2.3, revised: 2.4, publishedAt: '2026-08-27' }],
  },
  yield: {
    id: 'yield', code: 'DGS10', name: '10-year Treasury yield', short: '10Y Treasury', topic: 'Rates',
    frequency: 'Daily', ...percent, precision: 2, adjustment: 'Not seasonally adjusted', source: treasury,
    definition: 'Illustrative 10-year constant maturity Treasury yield. Daily levels are percent; daily changes are basis points. Synthetic observations.',
    observations: daily([4.04, 4.06, 4.03, 4.08, 4.1, 4.12, 4.09, 4.11, 4.14, 4.16, 4.15, 4.18]),
    revisions: [],
  },
  debt: {
    id: 'debt', code: 'GFDEBTN-DAILY', name: 'Total federal debt outstanding', short: 'Federal debt', topic: 'Fiscal',
    frequency: 'Daily', unit: 'USD trillions', precision: 2, format: 'trillions', adjustment: 'Not seasonally adjusted',
    source: source('U.S. Treasury Fiscal Data', 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/'),
    definition: 'Illustrative total public debt outstanding, including debt held by the public and intragovernmental holdings, in USD trillions. Synthetic observations.',
    observations: daily([37.48, 37.49, 37.51, 37.5, 37.52, 37.54, 37.55, 37.56, 37.58, 37.59, 37.6, 37.62]),
    revisions: [],
  },
  claims: {
    id: 'claims', code: 'ICSA', name: 'Initial unemployment insurance claims', short: 'Initial claims', topic: 'Labor',
    frequency: 'Weekly', unit: 'Thousands of claims', precision: 0, format: 'thousands', adjustment: 'Seasonally adjusted',
    source: source('U.S. Department of Labor', 'https://www.dol.gov/ui/data.pdf'),
    definition: 'Initial applications for unemployment insurance benefits, in thousands. Dates denote the week ending, with publication stored separately. Synthetic observations.',
    observations: weekly([232, 228, 230, 225, 222, 224, 221, 219, 225, 222, 216, 218]),
    revisions: [{ period: '2026-10-03', initial: 214, revised: 216, publishedAt: '2026-10-15' }],
  },
  participation: {
    id: 'participation', code: 'CIVPART', name: 'Labor force participation rate', short: 'Participation', topic: 'Labor',
    ...monthlyAdjusted, ...percent, source: bls,
    definition: 'Civilian labor force as a share of the civilian noninstitutional population aged 16 and older. Synthetic monthly levels.',
    observations: monthly([62.5, 62.5, 62.6, 62.5, 62.6, 62.7, 62.6, 62.7, 62.6, 62.7, 62.6, 62.7]),
    revisions: [],
  },
  wages: {
    id: 'wages', code: 'CES0500000003-YOY', name: 'Average hourly earnings growth', short: 'Wage growth', topic: 'Labor',
    ...monthlyAdjusted, ...percent, source: bls,
    definition: 'Year-over-year growth in average hourly earnings of all private nonfarm employees. Synthetic annual growth rates observed monthly.',
    observations: monthly([4.1, 4.0, 4.0, 3.9, 4.0, 3.9, 3.8, 3.8, 3.9, 3.8, 3.8, 3.7]),
    revisions: [],
  },
  openings: {
    id: 'openings', code: 'JTSJOL', name: 'Job openings', short: 'Job openings', topic: 'Labor',
    ...monthlyAdjusted, unit: 'Millions of openings', precision: 2, format: 'millions', source: bls,
    definition: 'Number of available job openings on the last business day of the month, in millions. The missing January sample observation is intentionally retained. Synthetic observations.',
    observations: monthly([8.05, 7.98, 7.92, 7.88, null, 7.8, 7.75, 7.68, 7.62, 7.54, 7.49, 7.45], 7, 30),
    revisions: [{ period: '2026-07-01', initial: 7.52, revised: 7.49, publishedAt: '2026-09-30' }],
  },
  retail: {
    id: 'retail', code: 'RSAFS-MOM', name: 'Retail sales growth', short: 'Retail sales', topic: 'Growth',
    ...monthlyAdjusted, ...percent,
    source: source('U.S. Census Bureau', 'https://www.census.gov/retail/index.html'),
    definition: 'Month-over-month change in nominal advance retail and food services sales. Synthetic monthly growth rates.',
    observations: monthly([0.5, 0.3, -0.1, 0.6, 0.4, 0.2, 0.3, 0.5, 0.2, 0.3, 0.5, 0.4], 8, 16),
    revisions: [{ period: '2026-08-01', initial: 0.4, revised: 0.5, publishedAt: '2026-10-16' }],
  },
};

// The publication attached to a current value is the release of that value,
// including a revision. The separate revision record retains its initial value.
for (const s of Object.values(series)) {
  for (const revision of s.revisions) {
    const observation = s.observations.find((o) => o.date === revision.period);
    if (observation?.value === revision.revised && observation.publishedAt < revision.publishedAt) {
      observation.publishedAt = revision.publishedAt;
    }
  }
}

/** Illustrative week, not an official or verified agency schedule. Consensus is unavailable. */
export const releases = [
  { id: 'debt-oct19', date: '2026-10-19', time: '16:00', seriesId: 'debt', name: 'Debt outstanding', agency: 'U.S. Treasury', period: '2026-10-19', topic: 'Fiscal', status: 'released', actual: 37.6, consensus: null, prior: 37.59, revised: null },
  { id: 'payroll-oct20', date: '2026-10-20', time: '08:30', seriesId: 'payroll', name: 'Payroll employment · sample update', agency: 'Bureau of Labor Statistics', period: '2026-09-01', topic: 'Labor', status: 'released', actual: 142, consensus: null, prior: 128, revised: 134 },
  { id: 'retail-oct21', date: '2026-10-21', time: '08:30', seriesId: 'retail', name: 'Retail sales · sample update', agency: 'U.S. Census Bureau', period: '2026-09-01', topic: 'Growth', status: 'scheduled', actual: null, consensus: null, prior: 0.4, revised: 0.5 },
  { id: 'claims-oct22', date: '2026-10-22', time: '08:30', seriesId: 'claims', name: 'Initial jobless claims', agency: 'U.S. Department of Labor', period: '2026-10-17', topic: 'Labor', status: 'scheduled', actual: null, consensus: null, prior: 218, revised: null },
  { id: 'gdp-oct22', date: '2026-10-22', time: '08:30', seriesId: 'gdp', name: 'Real GDP · sample advance estimate', agency: 'Bureau of Economic Analysis', period: '2026-07-01', topic: 'Growth', status: 'scheduled', actual: null, consensus: null, prior: 2.4, revised: null },
  { id: 'pce-oct23', date: '2026-10-23', time: '08:30', seriesId: 'pce', name: 'PCE price inflation', agency: 'Bureau of Economic Analysis', period: '2026-09-01', topic: 'Inflation', status: 'scheduled', actual: null, consensus: null, prior: 2.6, revised: null },
];

export const yieldCurve = [
  { tenor: '1M', years: 1 / 12, value: 4.62, previous: 4.63 },
  { tenor: '3M', years: 0.25, value: 4.54, previous: 4.55 },
  { tenor: '6M', years: 0.5, value: 4.39, previous: 4.4 },
  { tenor: '1Y', years: 1, value: 4.2, previous: 4.22 },
  { tenor: '2Y', years: 2, value: 4.01, previous: 4.0 },
  { tenor: '3Y', years: 3, value: 3.99, previous: 3.98 },
  { tenor: '5Y', years: 5, value: 4.03, previous: 4.01 },
  { tenor: '7Y', years: 7, value: 4.1, previous: 4.07 },
  { tenor: '10Y', years: 10, value: 4.18, previous: 4.15 },
  { tenor: '20Y', years: 20, value: 4.45, previous: 4.42 },
  { tenor: '30Y', years: 30, value: 4.49, previous: 4.46 },
];
