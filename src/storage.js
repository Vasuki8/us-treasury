import { series } from './data.js';

const key = 'meridian.preferences.v1';
export function readPreferences(storage) {
  const fallback = { saved: [], density: 'compact', theme: 'Light', storageAvailable: true };
  try {
    if (!storage) return { ...fallback, storageAvailable: false };
    const data = JSON.parse(storage.getItem(key) || '{}');
    if (!data || typeof data !== 'object') return fallback;
    return {
      ...fallback,
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
    storage.setItem(key, JSON.stringify({ saved: preferences.saved, density: preferences.density, theme: preferences.theme }));
    return true;
  } catch {
    return false;
  }
}
