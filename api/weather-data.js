import { provinces77 } from '../src/provinces77.js';
import { fetchNationalForecast } from '../src/server/nationalForecast.js';
import { bangkokDateKey, finiteOrNull, isStaleTime, weatherDate } from '../src/utils/weatherData.js';

const CACHE_TTL_SECONDS = 10 * 60;
let nationalCache = null;
let nationalPending = null;
async function nationalForecast() {
  if (nationalCache && Date.now() - nationalCache.at < CACHE_TTL_SECONDS * 1000) return nationalCache.data;
  if (!nationalPending) nationalPending = fetchNationalForecast().then(data => { if (data) nationalCache = { data, at: Date.now() }; return data; }).finally(() => { nationalPending = null; });
  return nationalPending;
}
const getFirebaseUrl = path => {
  const base = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${path}.json` : null;
};
async function fetchJson(url) {
  if (!url) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// A missing source must never become synthetic weather or a zero pollution reading.
export function unavailableWeather() {
  return {
    schemaVersion: 3,
    stations: provinces77.map((province, index) => ({ stationID: `PROV_${index}`, areaTH: province.n, lat: province.lat, long: province.lon, AQILast: { PM25: { value: null } }, dataSource: 'unavailable' })),
    stationTemps: {}, stationYesterday: {}, stationMaxYesterday: {}, stationDaily: {},
    lastUpdated: null, tmdAvailable: false, source: 'unavailable', stale: true, airStale: true,
  };
}

const nonnegative = value => {
  const number = finiteOrNull(value);
  return number !== null && number >= 0 ? number : null;
};
const bounded = (value, maximum) => {
  const number = nonnegative(value);
  return number !== null && number <= maximum ? number : null;
};

// Schema 2 rainMm represented incompatible intervals. Never reinterpret it as
// a calendar-day total, or trust the fetch timestamp as a measurement time.
export function sanitizeWeatherPayload(data, now = Date.now()) {
  if (data?.schemaVersion < 3 || !Number.isFinite(data?.schemaVersion) || !Array.isArray(data?.stations) || data.stations.length !== provinces77.length || data.source === 'deterministic-fallback' || data.fallbackSource === 'deterministic-fallback') return null;
  const byId = new Map(data.stations.map(station => [station?.stationID, station]));
  if (byId.size !== provinces77.length || data.stations.some(station => !station || station.dataSource === 'deterministic-fallback')) return null;
  const stationTemps = {}, times = [], today = bangkokDateKey(now);
  let hasReading = false;
  const stations = provinces77.map((province, index) => {
    const id = `PROV_${index}`, station = byId.get(id) || {}, raw = data.stationTemps?.[id] || {};
    const temp = finiteOrNull(raw.temp), pm25 = nonnegative(station.AQILast?.PM25?.value);
    const validAt = raw.validAt || raw.weatherTime || station.weatherTime || null;
    const pm25Time = station.pm25Time || raw.pm25Time || null;
    const stale = temp === null || isStaleTime(validAt, now), airStale = pm25 === null || isStaleTime(pm25Time, now);
    if (temp !== null || pm25 !== null) hasReading = true;
    if (temp !== null && Number.isFinite(weatherDate(validAt).getTime())) times.push(weatherDate(validAt).getTime());
    if (pm25 !== null && Number.isFinite(weatherDate(pm25Time).getTime())) times.push(weatherDate(pm25Time).getTime());
    const pm25ValidHours24h = finiteOrNull(station.pm25ValidHours24h ?? raw.pm25ValidHours24h);
    const windowStart = station.pm25WindowStart ?? raw.pm25WindowStart ?? null, windowEnd = station.pm25WindowEnd ?? raw.pm25WindowEnd ?? null;
    const end = weatherDate(windowEnd).getTime(), start = weatherDate(windowStart).getTime(), airTime = weatherDate(pm25Time).getTime();
    const validWindow = pm25ValidHours24h === 24 && end - start === 86400000 && end % 3600000 === 0 && end <= airTime && airTime - end < 3600000;
    const average = validWindow ? nonnegative(station.pm25Average24h ?? raw.pm25Average24h) : null;
    const pmFields = { pm25Average24h: average, pm25ValidHours24h: Number.isInteger(pm25ValidHours24h) && pm25ValidHours24h >= 0 && pm25ValidHours24h <= 24 ? pm25ValidHours24h : 0, pm25WindowStart: windowStart, pm25WindowEnd: windowEnd };
    const tempDate = raw.tempDate || raw.rainDate || null;
    let tempMin = tempDate === today ? finiteOrNull(raw.tempMin) : null, tempMax = tempDate === today ? finiteOrNull(raw.tempMax) : null;
    if (tempMin !== null && tempMax !== null && tempMin > tempMax) { tempMin = null; tempMax = null; }
    stationTemps[id] = { ...raw, temp, validAt, weatherTime: validAt, pm25Time, stale, airStale, ...pmFields,
      tempMin, tempMax, tempDate,
      rainMm: raw.rainDate === today && raw.rainPeriod === 'calendar-day' ? nonnegative(raw.rainMm) : null,
      rainProb: bounded(raw.rainProb, 100), windSpeed: nonnegative(raw.windSpeed), windGust: nonnegative(raw.windGust), windDir: bounded(raw.windDir, 360), feelsLike: finiteOrNull(raw.feelsLike), humidity: bounded(raw.humidity, 100), uv: nonnegative(raw.uv),
    };
    return { ...station, stationID: id, areaTH: province.n, lat: province.lat, long: province.lon,
      AQILast: { ...station.AQILast, PM25: { value: pm25 } }, weatherTime: validAt, pm25Time, stale, airStale, ...pmFields };
  });
  if (!hasReading) return null;
  return { ...data, stations, stationTemps, lastUpdated: times.length ? new Date(Math.min(...times)).toISOString() : null,
    stale: stations.some(station => station.stale), airStale: stations.some(station => station.airStale) };
}

export function sanitizeGistdaSummary(data) {
  if (!data?.available || typeof data.available !== 'object') return null;
  const result = { lastUpdated: data.lastUpdated || null, source: 'GISTDA', available: {} };
  for (const key of ['hotspots', 'burntArea', 'lowSoilMoisture', 'lowVegetationMoisture', 'floodArea']) {
    const rows = Array.isArray(data[key]) ? data[key] : [];
    const available = data.available[key] === true && Array.isArray(data[key]) && rows.every(row => typeof row?.province === 'string' && row.province.trim() && nonnegative(row.value) !== null);
    result.available[key] = available;
    result[key] = available ? rows.map(row => ({ province: row.province, value: nonnegative(row.value) })) : [];
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const [weatherData, gistdaSummary, amphoeData] = await Promise.all(
    ['weather_data', 'gistda_disaster', 'weather_data_amphoe'].map(path => fetchJson(getFirebaseUrl(path)).catch(() => null)),
  );
  const usable = sanitizeWeatherPayload(weatherData);
  let payload = usable ? { ...usable, source: 'firebase' } : unavailableWeather();
  if (!usable || payload.stale || payload.airStale) {
    const live = await nationalForecast().catch(() => null);
    const validLive = sanitizeWeatherPayload(live);
    if (validLive) payload = validLive;
  }
  res.setHeader('Cache-Control', payload.source !== 'unavailable' ? `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=600` : 'no-store');
  return res.status(200).json({ ...payload, gistdaSummary: sanitizeGistdaSummary(gistdaSummary), amphoeData });
}
