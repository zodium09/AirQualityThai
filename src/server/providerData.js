import { aggregateHourlyDays, bangkokDateKey, finiteOrNull, isStaleTime, rollingPm25 } from '../utils/weatherData.js';

// Reserve a slot for every requested location, even when a whole batch fails.
export function providerSlots(result, count) {
  if (result.status !== 'fulfilled') return Array.from({ length: count }, () => ({}));
  const rows = Array.isArray(result.value) ? result.value : [result.value];
  if (rows.length !== count) return Array.from({ length: count }, () => ({}));
  return rows.map(row => row && !row.error ? row : {});
}

// Keep source precision unless a caller explicitly needs coordinate rounding.
// Rounding measurements before risk classification can cross a threshold.
export function roundedOrNull(value, digits) {
  const number = finiteOrNull(value);
  if (digits === undefined) return number;
  const factor = 10 ** digits;
  return number === null ? null : Math.round(number * factor) / factor;
}

export function dailyAirMax(dates, hourly = {}) {
  const days = aggregateHourlyDays(hourly);
  return dates.map(date => roundedOrNull(days.get(date)?.max));
}

export function dailyForecast(weather = {}, air = {}) {
  const daily = weather.daily || {}, dates = daily.time || [];
  const field = name => dates.map((_, i) => finiteOrNull(daily[name]?.[i]));
  const airDays = aggregateHourlyDays(air.hourly);
  return {
    dates, temp: field('temperature_2m_max'), tempMin: field('temperature_2m_min'), tempMax: field('temperature_2m_max'),
    heat: field('apparent_temperature_max'), rain: field('precipitation_probability_max'), rainMm: field('precipitation_sum'),
    wind: field('wind_speed_10m_max'), windGust: field('wind_gusts_10m_max'), uv: field('uv_index_max'),
    pm25: dailyAirMax(dates, air.hourly), pm25ValidHours: dates.map(date => airDays.get(date)?.validHours ?? 0),
    pm25Coverage: dates.map(date => airDays.get(date)?.coverage ?? 0),
    weatherSource: 'open-meteo-model', pm25Source: 'cams-model', rainPeriod: 'calendar-day', timezone: 'Asia/Bangkok',
  };
}

// A source's value, valid time and point travel together. Do not label a TMD
// forecast with Open-Meteo's timestamp or with the province reference point.
export function currentForecast(weather = {}, air = {}, tmd = null, now = Date.now()) {
  const current = weather.current || {};
  const hasTmd = finiteOrNull(tmd?.tc) !== null && !isStaleTime(tmd?.validAt, now);
  const validAt = hasTmd ? tmd.validAt : current.time || null;
  const date = bangkokDateKey(now);
  const day = weather.daily?.time?.indexOf(date) ?? -1;
  const hour = weather.hourly?.time?.findIndex(time => time.slice(0, 13) === current.time?.slice(0, 13)) ?? -1;
  const pmWindow = rollingPm25(air.hourly, air.current?.time);
  return {
    temp: roundedOrNull(hasTmd ? tmd.tc : current.temperature_2m), tempMin: roundedOrNull(weather.daily?.temperature_2m_min?.[day]), tempMax: roundedOrNull(weather.daily?.temperature_2m_max?.[day]), tempDate: day >= 0 ? date : null,
    feelsLike: roundedOrNull(current.apparent_temperature), humidity: roundedOrNull(hasTmd ? tmd.rh : current.relative_humidity_2m),
    rainProb: roundedOrNull(weather.hourly?.precipitation_probability?.[hour]), rainMm: roundedOrNull(weather.daily?.precipitation_sum?.[day]), rainDate: day >= 0 ? date : null,
    windSpeed: roundedOrNull(current.wind_speed_10m), windGust: roundedOrNull(current.wind_gusts_10m), windDir: roundedOrNull(current.wind_direction_10m),
    uv: roundedOrNull(weather.hourly?.uv_index?.[hour]), pressure: hasTmd ? roundedOrNull(tmd.slp) : null, cond: hasTmd ? finiteOrNull(tmd.cond) : null,
    source: hasTmd ? 'tmd' : 'open-meteo-model', validAt, weatherTime: validAt, pm25Time: air.current?.time || null,
    tempSource: hasTmd ? 'tmd-nwp-model' : 'open-meteo-model', tempMinMaxSource: 'open-meteo-model', rainSource: 'open-meteo-model', rainPeriod: 'calendar-day',
    supplementalWeatherTime: current.time || null,
    weatherLocation: hasTmd ? { lat: finiteOrNull(tmd.lat), lon: finiteOrNull(tmd.lon), elevation: null } : { lat: finiteOrNull(weather.latitude), lon: finiteOrNull(weather.longitude), elevation: finiteOrNull(weather.elevation) },
    hourlyRainMm: hasTmd ? roundedOrNull(tmd.rain) : null, hourlyRainTime: hasTmd ? tmd.validAt : null, hourlyRainSource: hasTmd ? 'tmd-nwp-model' : null,
    pm25Average24h: pmWindow.average, pm25ValidHours24h: pmWindow.validHours, pm25WindowStart: pmWindow.windowStart, pm25WindowEnd: pmWindow.windowEnd,
    stale: isStaleTime(validAt, now), airStale: finiteOrNull(air.current?.pm2_5) === null || isStaleTime(air.current?.time, now),
  };
}
