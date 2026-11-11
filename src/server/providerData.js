import { finiteOrNull } from '../utils/weatherData.js';

// Reserve a slot for every requested location, even when a whole batch fails.
export function providerSlots(result, count) {
  if (result.status !== 'fulfilled') return Array.from({ length: count }, () => ({}));
  const rows = Array.isArray(result.value) ? result.value : [result.value];
  if (rows.length !== count) return Array.from({ length: count }, () => ({}));
  return rows.map(row => row && !row.error ? row : {});
}

export function roundedOrNull(value, digits = 0) {
  const number = finiteOrNull(value);
  const factor = 10 ** digits;
  return number === null ? null : Math.round(number * factor) / factor;
}

export function dailyAirMax(dates, hourly = {}) {
  const maxima = new Map();
  (hourly.time || []).forEach((time, i) => {
    const value = finiteOrNull(hourly.pm2_5?.[i]);
    if (value === null) return;
    const date = time.slice(0, 10);
    maxima.set(date, Math.max(maxima.get(date) ?? -Infinity, value));
  });
  return dates.map(date => roundedOrNull(maxima.get(date)));
}
