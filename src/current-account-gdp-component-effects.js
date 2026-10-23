import {CURRENT_ACCOUNT_GDP_COMPONENTS} from './current-account-gdp-breakdown.js';
import {currentAccountGdpBalanceEffects} from './current-account-gdp-balance-effects.js';

export const CURRENT_ACCOUNT_GDP_COMPONENT_EFFECTS_CHART = 'current-account-gdp-component-effects';
export const CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS = Object.freeze(
  CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => Object.freeze({id, label})),
);

/** Component-only histories explicitly default total or unrelated focus to Goods. */
export function resolveCurrentAccountComponentEffectMeasure(id) {
  return CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.find(component => component.id === id)?.id ?? 'itaGoodsBalance';
}

/** Project an already guarded accounting split; keep its full endpoint calendar and reasons. */
export function currentAccountGdpComponentEffectSeries(result, measure = 'itaGoodsBalance') {
  const id = resolveCurrentAccountComponentEffectMeasure(measure);
  const {label} = CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.find(component => component.id === id);
  return Object.fromEntries([['quarterly', 'Quarterly'], ['trailing', 'Trailing']].map(([horizon, suffix]) => [horizon,
    [['BalanceEffect', 'balanceEffect', 'Balance change effect'], ['GdpEffect', 'gdpEffect', 'GDP-denominator effect'], ['RatioChange', 'totalChange', 'Combined ratio change']].map(([part, field, effectLabel]) => ({
      ...result.series[horizon][0], id: `${id}${suffix}${part}`,
      name: `${label}: ${effectLabel} in ${horizon === 'quarterly' ? 'quarterly' : 'trailing-four-quarter'} current account / GDP`,
      short: effectLabel, unit: 'Percentage points', format: 'percentagePoints', precision: 3, observationType: 'calculated',
      observations: result.allObservations.map(point => {
        const effect = point[horizon].effects[id];
        return {
          date: point.date, priorDate: point.priorDate, value: effect[field],
          reason: Number.isFinite(effect[field]) ? null : effect.reason,
        };
      }),
    })),
  ]));
}

/** Reuse the authoritative effect model and its selected window, inputs and method unchanged. */
export function currentAccountGdpComponentEffects(sources = {}, range = {preset: 'all'}, measure = 'itaGoodsBalance') {
  const id = resolveCurrentAccountComponentEffectMeasure(measure);
  const selected = CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.find(component => component.id === id);
  const base = currentAccountGdpBalanceEffects(sources, range);
  return {...base, measure: {...selected}, series: currentAccountGdpComponentEffectSeries(base, id)};
}
