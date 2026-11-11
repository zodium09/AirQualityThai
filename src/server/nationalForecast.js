import { provinces77 } from '../provinces77.js';
import { providerSlots, roundedOrNull } from './providerData.js';
import { weatherDate } from '../utils/weatherData.js';

export async function fetchNationalForecast(fetcher = fetch) {
  const batches = [];
  for (let i = 0; i < provinces77.length; i += 40) batches.push(provinces77.slice(i, i + 40));
  const results = await Promise.all(batches.map(async provinces => {
    const location = { latitude: provinces.map(p => p.lat).join(','), longitude: provinces.map(p => p.lon).join(','), timezone: 'Asia/Bangkok', forecast_days: 1 };
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ ...location, current: 'temperature_2m,wind_speed_10m', hourly: 'precipitation_probability', wind_speed_unit: 'kmh' })}`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ ...location, current: 'pm2_5' })}`;
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
  const timestamps = [];
  const stations = provinces77.map((p, i) => {
    const w = weather[i], a = air[i];
    const id = `PROV_${i}`;
    const hour = w.hourly?.time?.findIndex(time => time.slice(0, 13) === w.current?.time?.slice(0, 13));
    const temp = roundedOrNull(w.current?.temperature_2m);
    const pm = roundedOrNull(a.current?.pm2_5);
    stationTemps[id] = { temp, windSpeed: roundedOrNull(w.current?.wind_speed_10m), rainProb: roundedOrNull(w.hourly?.precipitation_probability?.[hour]), source: 'open-meteo-model' };
    if (w.current?.time && temp !== null) timestamps.push(weatherDate(w.current.time).getTime());
    if (a.current?.time && pm !== null) timestamps.push(weatherDate(a.current.time).getTime());
    return { stationID: id, areaTH: p.n, lat: p.lat, long: p.lon, AQILast: { PM25: { value: pm } }, dataSource: 'open-meteo-model', pm25Source: 'cams-model', pm25Time: a.current?.time || null, weatherTime: w.current?.time || null };
  });
  const validTimes = timestamps.filter(Number.isFinite);
  if (!validTimes.length) return null;
  const oldestTime = Math.min(...validTimes);
  return { stations, stationTemps, stationYesterday: {}, stationMaxYesterday: {}, stationDaily: {}, lastUpdated: new Date(oldestTime).toISOString(), fetchedAt: new Date().toISOString(), source: 'open-meteo-model', tmdAvailable: false, stale: Date.now() - oldestTime > 5400000 };
}
