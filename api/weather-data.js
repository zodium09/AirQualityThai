import { provinces77 } from '../src/provinces77.js';
import { fetchNationalForecast } from '../src/server/nationalForecast.js';

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
    stations: provinces77.map((province, index) => ({ stationID: `PROV_${index}`, areaTH: province.n, lat: province.lat, long: province.lon, AQILast: { PM25: { value: null } }, dataSource: 'unavailable' })),
    stationTemps: {}, stationYesterday: {}, stationMaxYesterday: {}, stationDaily: {},
    lastUpdated: null, tmdAvailable: false, source: 'unavailable', stale: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const [weatherData, gistdaSummary, amphoeData] = await Promise.all(
    ['weather_data', 'gistda_disaster', 'weather_data_amphoe'].map(path => fetchJson(getFirebaseUrl(path)).catch(() => null)),
  );
  const usable = weatherData?.stations?.length && weatherData.source !== 'deterministic-fallback' && weatherData.fallbackSource !== 'deterministic-fallback' && !weatherData.stations.some(station => station.dataSource === 'deterministic-fallback');
  const age = Date.now() - new Date(weatherData?.lastUpdated).getTime();
  let payload = usable ? { ...weatherData, source: 'firebase', stale: Boolean(weatherData.stale) || !weatherData.lastUpdated || !Number.isFinite(age) || age > 90 * 60 * 1000 } : unavailableWeather();
  if (!usable || payload.stale) {
    const live = await nationalForecast().catch(() => null);
    if (live) payload = live;
  }
  res.setHeader('Cache-Control', payload.source !== 'unavailable' ? `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=600` : 'no-store');
  return res.status(200).json({ ...payload, gistdaSummary, amphoeData });
}
