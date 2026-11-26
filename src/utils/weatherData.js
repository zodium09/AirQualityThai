export const BANGKOK = 'Asia/Bangkok';
const HOUR_MS = 60 * 60 * 1000;

export function finiteOrNull(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Offset-less provider timestamps are Bangkok time, never the device timezone.
export function weatherDate(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date || typeof value === 'number') return new Date(value);
  const text = String(value);
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text}+07:00` : /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00+07:00` : text);
}

export function bangkokDateKey(value = Date.now()) {
  const time = weatherDate(value).getTime();
  return Number.isFinite(time) ? new Date(time + 7 * HOUR_MS).toISOString().slice(0, 10) : null;
}

export function isStaleTime(value, now = Date.now(), maxAge = 90 * 60 * 1000) {
  const time = weatherDate(value).getTime();
  return !Number.isFinite(time) || now - time > maxAge || time - now > 15 * 60 * 1000;
}

// API hourly precipitation is a preceding-hour total, labelled by the end of
// that hour. A requested [start, end) window therefore needs bins (start, end].
// Never turn an incomplete, negative or off-hour window into a dry forecast.
export function sumHourlyPrecipitation(hourly, start, end) {
  const startTime = weatherDate(start).getTime(), endTime = weatherDate(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime % HOUR_MS || endTime % HOUR_MS || endTime <= startTime) return null;
  const bins = new Map((hourly?.time || []).map((time, i) => [weatherDate(time).getTime(), finiteOrNull(hourly.precipitation?.[i])]));
  let total = 0;
  for (let time = startTime + HOUR_MS; time <= endTime; time += HOUR_MS) {
    const amount = bins.get(time);
    if (amount === null || amount === undefined || amount < 0) return null;
    total += amount;
  }
  return Math.round(total * 1000) / 1000;
}

// Count unique, valid whole-hour samples rather than array length. This keeps
// duplicate records and missing hours from masquerading as a complete day.
export function aggregateHourlyDays(hourly = {}, field = 'pm2_5') {
  const groups = new Map();
  (hourly.time || []).forEach((time, i) => {
    const timestamp = weatherDate(time).getTime(), value = finiteOrNull(hourly[field]?.[i]);
    if (!Number.isFinite(timestamp) || timestamp % HOUR_MS || value === null || value < 0) return;
    const date = bangkokDateKey(timestamp), values = groups.get(date) || new Map();
    values.set(timestamp, value);
    groups.set(date, values);
  });
  return new Map([...groups].map(([date, bins]) => {
    const values = [...bins.values()], validHours = values.length;
    return [date, { mean: values.reduce((sum, value) => sum + value, 0) / validHours, max: Math.max(...values), validHours, coverage: validHours / 24 }];
  }));
}

export function rollingPm25(hourly = {}, validAt) {
  const current = weatherDate(validAt).getTime();
  if (!Number.isFinite(current)) return { average: null, validHours: 0, windowStart: null, windowEnd: null };
  const end = Math.floor(current / HOUR_MS) * HOUR_MS, start = end - 24 * HOUR_MS;
  const bins = new Map((hourly.time || []).map((time, i) => [weatherDate(time).getTime(), finiteOrNull(hourly.pm2_5?.[i])]));
  const values = [];
  for (let time = start + HOUR_MS; time <= end; time += HOUR_MS) {
    const value = bins.get(time);
    if (value !== null && value !== undefined && value >= 0) values.push(value);
  }
  return { average: values.length === 24 ? Math.round(values.reduce((sum, value) => sum + value, 0) / 24 * 10) / 10 : null, validHours: values.length, windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString() };
}

export function thaiTime(value, options = {}) {
  const date = weatherDate(value);
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุเวลา' : new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, hour: '2-digit', minute: '2-digit', hour12: false, ...options }).format(date);
}

export function displayValue(value, unit = '', digits = 0) {
  const number = finiteOrNull(value);
  return number === null ? '—' : `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(number)}${unit}`;
}

const WIND_DIRECTIONS_TH = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];

export function thaiWindDirection(degrees) {
  const number = finiteOrNull(degrees);
  if (number === null) return '—';
  const normalized = ((number % 360) + 360) % 360;
  const dir = WIND_DIRECTIONS_TH[Math.round(normalized / 45) % 8];
  return `${dir} (${Math.round(normalized)}°)`;
}

export function getWeatherVisual(code, isDay = true) {
  const value = finiteOrNull(code);
  if (value === null) return { icon: 'unknown', label: 'ยังไม่มีข้อมูลสภาพท้องฟ้า' };
  if ([95, 96, 99].includes(value)) return { icon: 'storm', label: 'ฝนฟ้าคะนอง' };
  if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(value)) return { icon: 'snow', label: 'หิมะหรือหยาดน้ำฟ้าเยือกแข็ง' };
  if ([61, 63, 65, 80, 81, 82].includes(value)) return { icon: 'rain', label: 'มีฝน' };
  if ([51, 53, 55].includes(value)) return { icon: 'drizzle', label: 'ฝนละออง' };
  if ([45, 48].includes(value)) return { icon: 'fog', label: 'มีหมอก' };
  if (value === 3) return { icon: 'cloud', label: 'เมฆมาก' };
  if (value === 2) return { icon: isDay ? 'partly' : 'cloudMoon', label: 'มีเมฆบางส่วน' };
  return { icon: isDay ? 'sun' : 'moon', label: value === 1 ? 'ท้องฟ้าค่อนข้างโปร่ง' : 'ท้องฟ้าแจ่มใส' };
}

export function normalizeForecast(weather, air, coords, now = Date.now()) {
  if (!weather?.current || !Array.isArray(weather?.hourly?.time) || !Array.isArray(weather?.daily?.time)) throw new Error('ข้อมูลพยากรณ์ไม่ครบ');
  const currentTime = weather.current.time;
  const index = weather.hourly.time.findIndex(time => time.slice(0, 13) === currentTime?.slice(0, 13));
  const hourValue = key => finiteOrNull(weather.hourly[key]?.[index]);
  const airByTime = new Map((air?.hourly?.time || []).map((time, i) => [time, finiteOrNull(air.hourly.pm2_5?.[i])]));
  const airDays = aggregateHourlyDays(air?.hourly);
  const dailyPm = weather.daily.time.map(date => airDays.get(date)?.max ?? null);
  const c = weather.current;
  const pm25 = finiteOrNull(air?.current?.pm2_5);
  const airValidAt = air?.current?.time || null;
  const pmWindow = rollingPm25(air?.hourly, airValidAt);
  const today = weather.daily.time.indexOf(bangkokDateKey(currentTime));
  const providerLocation = provider => ({ lat: finiteOrNull(provider?.latitude), lon: finiteOrNull(provider?.longitude), elevation: finiteOrNull(provider?.elevation) });
  return {
    current: {
      temp: finiteOrNull(c.temperature_2m), feelsLike: finiteOrNull(c.apparent_temperature),
      humidity: finiteOrNull(c.relative_humidity_2m), windSpeed: finiteOrNull(c.wind_speed_10m),
      windGust: finiteOrNull(c.wind_gusts_10m),
      windDirection: finiteOrNull(c.wind_direction_10m), pressure: finiteOrNull(c.surface_pressure),
      visibility: hourValue('visibility'), uv: hourValue('uv_index'), pm25,
      sunrise: weather.daily.sunrise?.[today], sunset: weather.daily.sunset?.[today],
      tempMin: finiteOrNull(weather.daily.temperature_2m_min?.[today]), tempMax: finiteOrNull(weather.daily.temperature_2m_max?.[today]), tempDate: weather.daily.time[today] || null,
      rainMm: finiteOrNull(weather.daily.precipitation_sum?.[today]), rainDate: weather.daily.time[today] || null,
      pm25Average24h: pmWindow.average, pm25ValidHours24h: pmWindow.validHours,
      pm25WindowStart: pmWindow.windowStart, pm25WindowEnd: pmWindow.windowEnd,
      rainProb: hourValue('precipitation_probability'), precipitation: finiteOrNull(c.precipitation),
      rain: finiteOrNull(c.rain), weatherCode: finiteOrNull(c.weather_code), isDay: c.is_day === 1,
    },
    hourly: { ...weather.hourly, weathercode: weather.hourly.weather_code, pm25: weather.hourly.time.map(time => airByTime.get(time) ?? null) },
    daily: { ...weather.daily, weathercode: weather.daily.weather_code, pm25_max: dailyPm,
      pm25_validHours: weather.daily.time.map(date => airDays.get(date)?.validHours ?? 0),
      pm25_coverage: weather.daily.time.map(date => airDays.get(date)?.coverage ?? 0) },
    minutely: { time: [], precipitation: [], precipitation_probability: [] },
    coords: { ...coords, elevation: finiteOrNull(coords?.elevation) }, providerLocation: providerLocation(weather), airProviderLocation: providerLocation(air),
    validAt: currentTime, airValidAt, observedAt: currentTime, airObservedAt: airValidAt,
    fetchedAt: new Date(now).toISOString(), stale: isStaleTime(currentTime, now), airStale: pm25 === null || isStaleTime(airValidAt, now), source: 'Open-Meteo',
    precipitationIntervalSeconds: finiteOrNull(c.interval), hourlyPrecipitationInterval: 'preceding-hour',
    missing: { pm25: pm25 === null },
  };
}

export function forecastUrls(lat, lon, elevation) {
  const params = new URLSearchParams({ latitude: lat, longitude: lon, timezone: BANGKOK, forecast_days: 7, wind_speed_unit: 'kmh',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day',
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,visibility,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
  });
  if (finiteOrNull(elevation) !== null) params.set('elevation', String(elevation));
  return [
    `https://api.open-meteo.com/v1/forecast?${params}`,
    `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ latitude: lat, longitude: lon, current: 'pm2_5', hourly: 'pm2_5', past_days: 1, forecast_days: 5, timezone: BANGKOK })}`,
  ];
}
