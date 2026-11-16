import { aggregateHourlyDays, bangkokDateKey, finiteOrNull } from '../src/utils/weatherData.js';

const CACHE_SECONDS = 6 * 60 * 60;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function scalarNumber(value) {
  return typeof value === 'number' || typeof value === 'string' ? finiteOrNull(value) : null;
}

async function fetchJson(url, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function round(value) {
  const parsed = finiteOrNull(value);
  return parsed === null ? null : Math.round(parsed * 10) / 10;
}

export function historicalRows(weather = {}, air = {}) {
  const pmByDate = aggregateHourlyDays(air?.hourly);
  const daily = weather.daily || {};
  return (daily.time || []).map((date, index) => {
    const pm = pmByDate.get(date);
    return {
      date, rain: round(daily.precipitation_sum?.[index]), tempMax: round(daily.temperature_2m_max?.[index]),
      tempMin: round(daily.temperature_2m_min?.[index]), heatMax: round(daily.apparent_temperature_max?.[index]),
      pm25: pm?.validHours === 24 ? round(pm.mean) : null,
      pm25ValidHours: pm?.validHours ?? 0, pm25Coverage: pm?.coverage ?? 0,
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const lat = scalarNumber(req.query.lat);
  const lon = scalarNumber(req.query.lon);
  const hasElevation = req.query.elevation !== undefined;
  const elevation = hasElevation ? scalarNumber(req.query.elevation) : null;
  if (lat === null || lon === null || lat < 4 || lat > 22 || lon < 96 || lon > 106 || (hasElevation && (elevation === null || elevation < -500 || elevation > 9000))) {
    return res.status(400).json({ error: 'Invalid Thailand coordinates or elevation' });
  }

  // Date arithmetic starts on the Bangkok calendar day even on a UTC server.
  const now = new Date(`${bangkokDateKey()}T12:00:00Z`);
  const weatherEnd = new Date(now);
  weatherEnd.setUTCDate(weatherEnd.getUTCDate() - 5);
  const weatherStart = new Date(weatherEnd);
  weatherStart.setUTCDate(weatherStart.getUTCDate() - 364);

  const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateKey(weatherStart)}&end_date=${dateKey(weatherEnd)}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum&timezone=Asia%2FBangkok${hasElevation ? `&elevation=${elevation}` : ''}`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5&past_days=92&forecast_days=0&timezone=Asia%2FBangkok`;

  try {
    const [weather, air] = await Promise.all([fetchJson(weatherUrl), fetchJson(airUrl).catch(() => null)]);
    if (!Array.isArray(weather?.daily?.time) || !weather.daily.time.length) throw new Error('Historical weather data is unavailable');
    const rows = historicalRows(weather, air);

    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`);
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      requestedLocation: { lat, lon, elevation },
      providerLocation: { lat: finiteOrNull(weather.latitude), lon: finiteOrNull(weather.longitude), elevation: finiteOrNull(weather.elevation) },
      period: { startDate: rows[0]?.date || null, endDate: rows.at(-1)?.date || null, weatherDays: rows.length, pm25Days: rows.filter(row => row.pm25 !== null).length, pm25PartialDays: rows.filter(row => row.pm25ValidHours > 0 && row.pm25ValidHours < 24).length },
      sources: ['Open-Meteo Historical Weather API (Best Match)', 'Open-Meteo Air Quality API (CAMS)'],
      pm25Aggregation: { method: 'calendar-day-mean', requiredHours: 24, timezone: 'Asia/Bangkok' },
      daily: rows,
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unable to load historical statistics' });
  }
}
