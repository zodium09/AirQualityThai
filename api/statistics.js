const CACHE_SECONDS = 6 * 60 * 60;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

function aggregatePm25(hourly = {}) {
  const groups = new Map();
  (hourly.time || []).forEach((time, index) => {
    const value = Number(hourly.pm2_5?.[index]);
    if (!Number.isFinite(value)) return;
    const key = String(time).slice(0, 10);
    const group = groups.get(key) || [];
    group.push(value);
    groups.set(key, group);
  });
  return new Map([...groups].map(([key, values]) => [key, round(values.reduce((sum, value) => sum + value, 0) / values.length)]));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 4 || lat > 22 || lon < 96 || lon > 106) {
    return res.status(400).json({ error: 'Invalid Thailand coordinates' });
  }

  const now = new Date();
  const weatherEnd = new Date(now);
  weatherEnd.setUTCDate(weatherEnd.getUTCDate() - 5);
  const weatherStart = new Date(weatherEnd);
  weatherStart.setUTCDate(weatherStart.getUTCDate() - 364);

  const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateKey(weatherStart)}&end_date=${dateKey(weatherEnd)}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum&timezone=Asia%2FBangkok`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5&past_days=92&forecast_days=0&timezone=Asia%2FBangkok`;

  try {
    const [weather, air] = await Promise.all([fetchJson(weatherUrl), fetchJson(airUrl).catch(() => null)]);
    const pmByDate = aggregatePm25(air?.hourly);
    const daily = weather.daily || {};
    const rows = (daily.time || []).map((date, index) => ({
      date,
      rain: round(daily.precipitation_sum?.[index]),
      tempMax: round(daily.temperature_2m_max?.[index]),
      tempMin: round(daily.temperature_2m_min?.[index]),
      heatMax: round(daily.apparent_temperature_max?.[index]),
      pm25: pmByDate.get(date) ?? null,
    }));

    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`);
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      period: { startDate: rows[0]?.date || null, endDate: rows.at(-1)?.date || null, weatherDays: rows.length, pm25Days: pmByDate.size },
      sources: ['Open-Meteo Historical Weather API (ERA5)', 'Open-Meteo Air Quality API (CAMS)'],
      daily: rows,
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unable to load historical statistics' });
  }
}
