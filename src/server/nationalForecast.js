import { provinces77 } from '../provinces77.js';
import { currentForecast, dailyForecast, providerSlots, roundedOrNull } from './providerData.js';
import { weatherDate } from '../utils/weatherData.js';

export async function fetchNationalForecast(fetcher = fetch, now = Date.now()) {
  const batches = [];
  for (let i = 0; i < provinces77.length; i += 40) batches.push(provinces77.slice(i, i + 40));
  const results = await Promise.all(batches.map(async provinces => {
    const location = { latitude: provinces.map(p => p.lat).join(','), longitude: provinces.map(p => p.lon).join(','), timezone: 'Asia/Bangkok' };
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ ...location, forecast_days: 7, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m', hourly: 'precipitation_probability,uv_index', daily: 'temperature_2m_min,temperature_2m_max,apparent_temperature_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max', wind_speed_unit: 'kmh' })}`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ ...location, current: 'pm2_5', hourly: 'pm2_5', past_days: 1, forecast_days: 5 })}`;
    const responses = await Promise.allSettled([weatherUrl, airUrl].map(async url => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!response.ok) throw new Error(`National provider HTTP ${response.status}`);
      return response.json();
    }));
    return { weather: providerSlots(responses[0], provinces.length), air: providerSlots(responses[1], provinces.length) };
  }));
  const weather = results.flatMap(batch => batch.weather);
  const air = results.flatMap(batch => batch.air);
  const stationTemps = {};
  const stationDaily = {};
  const timestamps = [];
  const stations = provinces77.map((p, i) => {
    const w = weather[i], a = air[i];
    const id = `PROV_${i}`;
    const temp = roundedOrNull(w.current?.temperature_2m);
    const pm = roundedOrNull(a.current?.pm2_5);
    const current = currentForecast(w, a, null, now);
    stationTemps[id] = current;
    stationDaily[id] = dailyForecast(w, a);
    if (w.current?.time && temp !== null) timestamps.push(weatherDate(w.current.time).getTime());
    if (a.current?.time && pm !== null) timestamps.push(weatherDate(a.current.time).getTime());
    return { stationID: id, areaTH: p.n, lat: p.lat, long: p.lon, AQILast: { PM25: { value: pm } }, dataSource: 'open-meteo-model', pm25Source: 'cams-model', pm25Time: current.pm25Time, weatherTime: current.weatherTime,
      pm25Average24h: current.pm25Average24h, pm25ValidHours24h: current.pm25ValidHours24h, pm25WindowStart: current.pm25WindowStart, pm25WindowEnd: current.pm25WindowEnd,
      airStale: current.airStale, stale: current.stale, weatherLocation: current.weatherLocation };
  });
  const validTimes = timestamps.filter(Number.isFinite);
  if (!validTimes.length) return null;
  const oldestTime = Math.min(...validTimes);
  return { schemaVersion: 3, stations, stationTemps, stationYesterday: {}, stationMaxYesterday: {}, stationDaily, lastUpdated: new Date(oldestTime).toISOString(), fetchedAt: new Date(now).toISOString(), source: 'open-meteo-model', tmdAvailable: false, stale: now - oldestTime > 5400000 };
}
