import { series } from './data.js';

const key = 'meridian.preferences.v1';
export function readPreferences(storage) {
  const fallback = { saved: [], density: 'compact', theme: 'Light', storageAvailable: true, watchlistSort:'manual',watchlistGroup:false };
  try {
    if (!storage) return { ...fallback, storageAvailable: false };
    const data = JSON.parse(storage.getItem(key) || '{}');
    if (!data || typeof data !== 'object') return fallback;
    return {
      ...fallback,
      watchlistSort:['updated','next'].includes(data.watchlistSort)?data.watchlistSort:'manual',watchlistGroup:data.watchlistGroup===true,
      saved: Array.isArray(data.saved) ? [...new Set(data.saved.filter(id => Object.hasOwn(series, id)))] : [],
      density: data.density === 'comfortable' ? 'comfortable' : 'compact',
      theme: ['Graphite','Midnight'].includes(data.theme) ? 'Graphite' : 'Light',
    };
  } catch (error) {
    return { ...fallback, storageAvailable: error instanceof SyntaxError };
  }
}

export function writePreferences(storage, preferences) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify({ saved: preferences.saved, density: preferences.density, theme: preferences.theme,watchlistSort:preferences.watchlistSort,watchlistGroup:preferences.watchlistGroup }));
    return true;
  } catch {
    return false;
  }
}
