export const BANGKOK = 'Asia/Bangkok';

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

export function thaiTime(value, options = {}) {
  const date = weatherDate(value);
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุเวลา' : new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, hour: '2-digit', minute: '2-digit', hour12: false, ...options }).format(date);
}

export function displayValue(value, unit = '', digits = 0) {
  const number = finiteOrNull(value);
  return number === null ? '—' : `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(number)}${unit}`;
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

export function normalizeForecast(weather, air, coords) {
  if (!weather?.current || !Array.isArray(weather?.hourly?.time) || !Array.isArray(weather?.daily?.time)) throw new Error('ข้อมูลพยากรณ์ไม่ครบ');
  const currentTime = weather.current.time;
  const index = weather.hourly.time.findIndex(time => time.slice(0, 13) === currentTime?.slice(0, 13));
  const hourValue = key => finiteOrNull(weather.hourly[key]?.[index]);
  const airByTime = new Map((air?.hourly?.time || []).map((time, i) => [time, finiteOrNull(air.hourly.pm2_5?.[i])]));
  const dailyPm = weather.daily.time.map(date => {
    const values = [...airByTime].filter(([time, value]) => time.startsWith(date) && value !== null).map(([, value]) => value);
    return values.length ? Math.max(...values) : null;
  });
  const c = weather.current;
  const pm25 = finiteOrNull(air?.current?.pm2_5);
  return {
    current: {
      temp: finiteOrNull(c.temperature_2m), feelsLike: finiteOrNull(c.apparent_temperature),
      humidity: finiteOrNull(c.relative_humidity_2m), windSpeed: finiteOrNull(c.wind_speed_10m),
      windDirection: finiteOrNull(c.wind_direction_10m), pressure: finiteOrNull(c.surface_pressure),
      visibility: hourValue('visibility'), uv: hourValue('uv_index'), pm25,
      sunrise: weather.daily.sunrise?.[0], sunset: weather.daily.sunset?.[0],
      rainProb: hourValue('precipitation_probability'), precipitation: finiteOrNull(c.precipitation),
      rain: finiteOrNull(c.rain), weatherCode: finiteOrNull(c.weather_code), isDay: c.is_day === 1,
    },
    hourly: { ...weather.hourly, weathercode: weather.hourly.weather_code, pm25: weather.hourly.time.map(time => airByTime.get(time) ?? null) },
    daily: { ...weather.daily, weathercode: weather.daily.weather_code, pm25_max: dailyPm },
    minutely: { time: [], precipitation: [], precipitation_probability: [] },
    coords, observedAt: currentTime, airObservedAt: air?.current?.time || null,
    fetchedAt: new Date().toISOString(), stale: false, source: 'Open-Meteo',
    missing: { pm25: pm25 === null },
  };
}

export function forecastUrls(lat, lon) {
  const params = new URLSearchParams({ latitude: lat, longitude: lon, timezone: BANGKOK, forecast_days: 7, wind_speed_unit: 'kmh',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,is_day',
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,uv_index,visibility,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max',
  });
  return [
    `https://api.open-meteo.com/v1/forecast?${params}`,
    `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ latitude: lat, longitude: lon, current: 'pm2_5', hourly: 'pm2_5', forecast_days: 5, timezone: BANGKOK })}`,
  ];
}
