import { observationFetch } from './observationFetch.js';

// These feeds contain station observations, never model forecasts.
// References and live-probe details are recorded in docs/data-sources.md.
export const OBSERVATION_SOURCES = {
  weather: { name: 'กรมอุตุนิยมวิทยา · WeatherToday', url: 'https://data.tmd.go.th/api/doc/reference/WeatherToday_ver2.pdf' },
  air: { name: 'กรมควบคุมมลพิษ · Air4Thai', url: 'https://air4thai.pcd.go.th/' },
};

const HOUR = 3600000;
const CACHE_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;
const asArray = value => Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];

export function observationNumber(value, min = -100, max = 10000) {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'object') return null;
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function observationTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;
  const [, y, m, d, h, minute, second = '00', zone = '+07:00'] = match;
  const calendar = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number(y) < 1900 || Number(y) > 2200 || calendar.getUTCMonth() !== Number(m) - 1 || calendar.getUTCDate() !== Number(d) || Number(h) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const parsed = new Date(`${y}-${m}-${d}T${h}:${minute}:${second}${zone}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stationBase(id, name, area, latitude, longitude) {
  const lat = observationNumber(latitude, 4, 22);
  const lon = observationNumber(longitude, 96, 106);
  if (!id || !name || lat === null || lon === null) return null;
  return { id: String(id), name: String(name).trim(), area: area ? String(area).trim() : null, lat, lon };
}

function windowEndingAt(end, hours, label) {
  return { hours, start: end ? new Date(new Date(end).getTime() - hours * HOUR).toISOString() : null, end, label };
}

export function parseWeatherStations(payload) {
  return asArray(payload?.Stations?.Station).flatMap(row => {
    const station = stationBase(row.WmoStationNumber, row.StationNameThai || row.StationNameEnglish, row.Province, row.Latitude, row.Longitude);
    if (!station) return [];
    const observation = row.Observation || {};
    const observedAt = observationTime(observation.DateTime);
    const summaryWindow = windowEndingAt(observedAt, 24, 'ตรวจวัดย้อนหลัง 24 ชั่วโมง สิ้นสุดเวลา 07:00 น.');
    const temperature = observationNumber(observation.Temperature, -60, 60);
    let tempMin = observationNumber(observation.MinTemperature, -60, 60);
    let tempMax = observationNumber(observation.MaxTemperature, -60, 60);
    if (tempMin !== null && tempMax !== null && tempMin > tempMax) { tempMin = null; tempMax = null; }
    const rainMm = observationNumber(observation.Rainfall, 0, 3000);
    if ([temperature, tempMin, tempMax, rainMm].every(value => value === null)) return [];
    return [{ station, observedAt, issuedAt: null, sourceGeneratedAt: observationTime(payload?.Header?.LastBuildDate), temperature, tempMin, tempMax, rainMm,
      kind: 'observation', averagingWindow: summaryWindow,
      metricWindows: { temperature: { hours: 0, start: observedAt, end: observedAt, label: 'ตรวจวัด ณ เวลา 07:00 น.' }, tempMin: summaryWindow, tempMax: summaryWindow, rainMm: summaryWindow },
      units: { temperature: '°C', tempMin: '°C', tempMax: '°C', rainMm: 'mm' },
      source: OBSERVATION_SOURCES.weather.name, sourceUrl: OBSERVATION_SOURCES.weather.url }];
  });
}

export function parseAirStations(payload) {
  return asArray(payload?.stations).flatMap(row => {
    const station = stationBase(row.stationID, row.nameTH || row.nameEN || row.areaTH, row.areaTH, row.lat, row.long);
    if (!station) return [];
    const last = row.AQILast;
    // Only the documented AQILast summary is accepted; similarly named hourly fields
    // and the provider's forecast array must not become 24-hour observations.
    if (!last || typeof last !== 'object') return [];
    const pm25 = observationNumber(last.PM25?.value, 0, 3000);
    if (pm25 === null) return [];
    const observedAt = observationTime(`${last.date || ''} ${last.time || ''}`);
    const averagingWindow = windowEndingAt(observedAt, 24, 'PM2.5 เฉลี่ย 24 ชั่วโมง');
    return [{ station, observedAt, issuedAt: null, pm25, kind: 'observation', averagingWindow, metricWindows: { pm25: averagingWindow },
      // Keep the pollutant-specific official index separate from PM mass concentration.
      pm25Aqi: observationNumber(last.PM25?.aqi, 0, 1000), units: { pm25: 'µg/m³' },
      source: OBSERVATION_SOURCES.air.name, sourceUrl: OBSERVATION_SOURCES.air.url }];
  });
}

export function distanceKm(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLon = radians(b.lon - a.lon);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

export function selectObservation(rows, coordinates, type, now = Date.now()) {
  const validRows = rows.filter(row => {
    const time = Date.parse(row.observedAt);
    return Number.isFinite(time) && time <= now;
  });
  const nearest = validRows.map(row => ({ ...row, distance: distanceKm(coordinates, row.station) })).sort((a, b) => a.distance - b.distance)[0];
  const source = OBSERVATION_SOURCES[type];
  if (!nearest) return { status: 'unavailable', stale: true, station: null, observedAt: null, source: source.name, sourceUrl: source.url, reason: 'ยังไม่มีค่าตรวจวัดพร้อมเวลาจากสถานี' };
  const { distance, ...observation } = nearest;
  const ageHours = (now - Date.parse(nearest.observedAt)) / HOUR;
  // The daily 07:00 report is current until the next reporting cycle; it is not a live temperature.
  const stale = ageHours > (type === 'weather' ? 26 : 3);
  return { ...observation, status: 'available', stale, ageHours: Math.round(ageHours * 10) / 10,
    station: { ...nearest.station, distanceKm: Math.round(distance * 10) / 10 },
    selection: 'nearest-reporting-station', representativeOfRequestedPoint: false, farFromLocation: distance > 50 };
}

export function createObservationService({ fetcher = observationFetch, clock = Date.now, env = {} } = {}) {
  const cache = new Map();
  const pending = new Map();
  // api/api12345 is a published public TMD example, not a private credential.
  const weatherUrl = `https://data.tmd.go.th/api/WeatherToday/V2/?${new URLSearchParams({ uid: env.TMD_OBSERVATION_UID || 'api', ukey: env.TMD_OBSERVATION_KEY || 'api12345', format: 'json' })}`;
  const endpoints = { weather: weatherUrl, air: 'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php' };
  const parsers = { weather: parseWeatherStations, air: parseAirStations };

  async function load(type) {
    const previous = cache.get(type);
    if (previous && clock() - previous.attemptAt < (previous.failed ? RETRY_MS : CACHE_MS)) return previous;
    if (pending.has(type)) return pending.get(type);
    const request = (async () => {
      try {
        const response = await fetcher(endpoints[type], { signal: AbortSignal.timeout(10000), cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('provider-http');
        const rows = parsers[type](await response.json());
        if (!rows.length) throw new Error('provider-empty');
        const entry = { rows, fetchedAt: new Date(clock()).toISOString(), attemptAt: clock(), failed: false };
        cache.set(type, entry);
        return entry;
      } catch {
        const entry = { rows: previous?.rows || [], fetchedAt: previous?.fetchedAt || null, attemptAt: clock(), failed: true };
        cache.set(type, entry);
        return entry;
      }
    })().finally(() => pending.delete(type));
    pending.set(type, request);
    return request;
  }

  return async coordinates => {
    const results = await Promise.all(['weather', 'air'].map(async type => {
      const entry = await load(type);
      const observation = selectObservation(entry.rows, coordinates, type, clock());
      return [type, { ...observation, stale: observation.stale || entry.failed, fetchedAt: entry.fetchedAt,
        lastAttemptAt: new Date(entry.attemptAt).toISOString(), providerAvailable: !entry.failed,
        ...(entry.failed ? { reason: entry.rows.length ? 'เชื่อมต่อแหล่งข้อมูลไม่ได้ แสดงค่าที่เก็บไว้พร้อมเวลาเดิม' : 'ยังเชื่อมต่อแหล่งตรวจวัดไม่ได้' } : {}) }];
    }));
    return { requestedCoords: coordinates, fetchedAt: new Date(clock()).toISOString(), ...Object.fromEntries(results) };
  };
}
