import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHourlyDays, bangkokDateKey, forecastUrls, normalizeForecast, rollingPm25, sumHourlyPrecipitation, weatherDate } from '../src/utils/weatherData.js';
import { currentForecast, dailyForecast } from '../src/server/providerData.js';
import { fetchNationalForecast } from '../src/server/nationalForecast.js';
import statistics, { historicalRows } from '../api/statistics.js';
import { sanitizeGistdaSummary, sanitizeWeatherPayload } from '../api/weather-data.js';
import { provinces77 } from '../src/provinces77.js';

const NOW = weatherDate('2026-11-16T12:15').getTime();
const sampleWeather = () => ({
  latitude: 18.78, longitude: 98.98, elevation: 310,
  current: { time: '2026-11-16T12:15', temperature_2m: 29, wind_gusts_10m: 32, is_day: 1 },
  hourly: { time: ['2026-11-16T12:00'], precipitation_probability: [60] },
  daily: { time: ['2026-11-15', '2026-11-16'], temperature_2m_min: [18, 19], temperature_2m_max: [30, 31], precipitation_sum: [0, 12.6], sunrise: ['old-sunrise', 'today-sunrise'] },
});
const dayAir = (date, hours = 24, value = 10) => ({ time: Array.from({ length: hours }, (_, i) => `${date}T${String(i).padStart(2, '0')}:00`), pm2_5: Array(hours).fill(value) });
const rollingAir = () => ({ current: { time: '2026-11-16T12:00', pm2_5: 10 }, hourly: { time: Array.from({ length: 25 }, (_, i) => new Date(weatherDate('2026-11-15T13:00').getTime() + i * 3600000).toISOString()), pm2_5: [...Array(24).fill(10), 999] } });

test('forecast requests elevation only for weather and includes actual rain, gusts and past air', () => {
  const [weather, air] = forecastUrls(18.5, 98.5, 2565).map(url => new URL(url));
  assert.equal(weather.searchParams.get('elevation'), '2565');
  assert.equal(air.searchParams.has('elevation'), false);
  assert.equal(air.searchParams.get('past_days'), '1');
  assert.ok(weather.searchParams.get('current').split(',').includes('wind_gusts_10m'));
  assert.ok(weather.searchParams.get('hourly').split(',').includes('wind_direction_10m'));
  assert.ok(weather.searchParams.get('hourly').split(',').includes('precipitation'));
  assert.equal(new URL(forecastUrls(13, 100)[0]).searchParams.has('elevation'), false);
  assert.equal(new URL(forecastUrls(13, 100, 0)[0]).searchParams.get('elevation'), '0');
});

test('weather and air freshness are independent and requested altitude is distinct from provider metadata', () => {
  const air = rollingAir();
  air.current.time = '2026-11-15T12:00';
  const data = normalizeForecast(sampleWeather(), air, { lat: 18.5, lon: 98.5, elevation: 2565 }, NOW);
  assert.equal(data.stale, false);
  assert.equal(data.airStale, true);
  assert.equal(data.validAt, data.observedAt);
  assert.equal(data.airValidAt, data.airObservedAt);
  assert.equal(data.coords.elevation, 2565);
  assert.equal(data.providerLocation.elevation, 310);
  assert.equal(data.current.tempMin, 19);
  assert.equal(data.current.tempMax, 31);
  assert.equal(data.current.rainMm, 12.6);
  assert.equal(data.current.windGust, 32);
  assert.equal(data.current.sunrise, 'today-sunrise');
});

test('hourly rain bins use preceding-hour semantics across midnight, and missing bins stay unknown', () => {
  const hourly = { time: ['2026-11-15T23:00', '2026-11-16T00:00', '2026-11-16T01:00', '2026-11-16T02:00'], precipitation: [90, 0, 1.2, 2.3] };
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-15T23:00', '2026-11-16T02:00'), 3.5);
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-15T23:00', '2026-11-16T00:00'), 0);
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-15T23:15', '2026-11-16T02:15'), null);
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-16T00:00', '2026-11-17T00:00'), null);
  hourly.precipitation[2] = null;
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-15T23:00', '2026-11-16T02:00'), null);
  hourly.precipitation[2] = -1;
  assert.equal(sumHourlyPrecipitation(hourly, '2026-11-15T23:00', '2026-11-16T02:00'), null);
});

test('rolling PM uses 24 distinct past hours; future and duplicate records cannot fill a missing hour', () => {
  const air = rollingAir();
  assert.deepEqual(rollingPm25(air.hourly, air.current.time), { average: 10, validHours: 24, windowStart: '2026-11-15T05:00:00.000Z', windowEnd: '2026-11-16T05:00:00.000Z' });
  air.hourly.time[2] = air.hourly.time[1];
  const incomplete = rollingPm25(air.hourly, air.current.time);
  assert.equal(incomplete.validHours, 23);
  assert.equal(incomplete.average, null);
  assert.equal(rollingPm25(air.hourly, null).average, null);
});

test('TMD temperature retains its own time and location; hourly TMD rain never replaces daily rain', () => {
  const tmd = { tc: 4.2, validAt: '2026-11-16T12:00', lat: 19.93, lon: 99.04, rain: 1.3 };
  const data = currentForecast(sampleWeather(), rollingAir(), tmd, NOW);
  assert.equal(data.temp, 4);
  assert.equal(data.weatherTime, tmd.validAt);
  assert.equal(data.supplementalWeatherTime, '2026-11-16T12:15');
  assert.equal(data.weatherLocation.lat, 19.93);
  assert.equal(data.rainMm, 12.6);
  assert.equal(data.hourlyRainMm, 1.3);
  assert.equal(data.hourlyRainTime, tmd.validAt);
  for (const validAt of [null, '2026-11-15T12:00', '2026-11-17T12:00']) {
    const fallback = currentForecast(sampleWeather(), {}, { ...tmd, validAt }, NOW);
    assert.equal(fallback.temp, 29);
    assert.equal(fallback.weatherTime, '2026-11-16T12:15');
    assert.equal(fallback.tempSource, 'open-meteo-model');
  }
});

test('daily forecasts keep min/max and rainfall separate from legacy probability', () => {
  const weather = sampleWeather();
  weather.daily.precipitation_probability_max = [0, 60];
  const data = dailyForecast(weather);
  assert.deepEqual(data.tempMin, [18, 19]);
  assert.deepEqual(data.tempMax, [30, 31]);
  assert.deepEqual(data.temp, data.tempMax);
  assert.deepEqual(data.rainMm, [0, 12.6]);
  assert.deepEqual(data.rain, [0, 60]);
  assert.deepEqual(data.windGust, [null, null]);
});

test('calendar PM coverage counts unique valid hours and historical means require all 24', () => {
  const hourly = dayAir('2026-11-15', 23, 0);
  hourly.time.push(hourly.time[0]); hourly.pm2_5.push(0);
  assert.equal(aggregateHourlyDays(hourly).get('2026-11-15').validHours, 23);
  const [row] = historicalRows({ daily: { time: ['2026-11-15'], temperature_2m_min: [0], precipitation_sum: [0] } }, { hourly });
  assert.equal(row.tempMin, 0);
  assert.equal(row.rain, 0);
  assert.equal(row.pm25, null);
  assert.equal(row.pm25ValidHours, 23);
  assert.equal(row.pm25Coverage, 23 / 24);
  assert.equal(historicalRows({ daily: { time: ['2026-11-15'] } }, { hourly: dayAir('2026-11-15', 24, 0) })[0].pm25, 0);
  assert.equal(bangkokDateKey('2026-11-15T18:00:00Z'), '2026-11-16');
});

test('statistics counts complete PM days only after joining the weather period and labels Best Match', async () => {
  const originalFetch = globalThis.fetch;
  const day1 = dayAir('2026-11-10'), day2 = dayAir('2026-11-11', 23), outside = dayAir('2026-11-16');
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('archive-api') ? { daily: { time: ['2026-11-10', '2026-11-11'] } } : { hourly: { time: [...day1.time, ...day2.time, ...outside.time], pm2_5: [...day1.pm2_5, ...day2.pm2_5, ...outside.pm2_5] } } });
  const res = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await statistics({ method: 'GET', query: { lat: '13.75', lon: '100.5' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.period.pm25Days, 1);
    assert.equal(res.body.period.pm25PartialDays, 1);
    assert.ok(res.body.sources[0].includes('Best Match'));
    assert.ok(!res.body.sources[0].includes('ERA5'));
  } finally { globalThis.fetch = originalFetch; }
});

test('national response includes daily extrema/rain and real 24-hour PM without shifting provinces', async () => {
  const result = await fetchNationalForecast(async url => {
    const parsed = new URL(url), count = parsed.searchParams.get('latitude').split(',').length;
    const isAir = parsed.hostname.startsWith('air-quality');
    if (isAir) assert.equal(parsed.searchParams.get('past_days'), '1');
    else assert.ok(parsed.searchParams.get('daily').includes('precipitation_sum'));
    return { ok: true, json: async () => Array.from({ length: count }, () => isAir ? rollingAir() : sampleWeather()) };
  }, NOW);
  assert.equal(result.stations.length, 77);
  assert.equal(result.stations[76].pm25Average24h, 10);
  assert.equal(result.stations[76].pm25ValidHours24h, 24);
  assert.equal(result.stationTemps.PROV_76.rainMm, 12.6);
  assert.equal(result.stationTemps.PROV_76.tempMin, 19);
  assert.deepEqual(result.stationDaily.PROV_76.tempMax, [30, 31]);
});

const cachedNational = () => {
  const current = currentForecast(sampleWeather(), rollingAir(), null, NOW);
  return { schemaVersion: 3, lastUpdated: new Date(NOW).toISOString(), stationTemps: Object.fromEntries(provinces77.map((_, i) => [`PROV_${i}`, { ...current }])),
    stations: provinces77.map((_, i) => ({ stationID: `PROV_${i}`, AQILast: { PM25: { value: 10 } }, weatherTime: current.weatherTime, pm25Time: current.pm25Time,
      pm25Average24h: current.pm25Average24h, pm25ValidHours24h: current.pm25ValidHours24h, pm25WindowStart: current.pm25WindowStart, pm25WindowEnd: current.pm25WindowEnd })) };
};

test('national guard rejects old-schema semantics and never treats a fresh fetch as fresh measurements', () => {
  assert.equal(sanitizeWeatherPayload({ ...cachedNational(), schemaVersion: 2 }, NOW), null);
  assert.equal(sanitizeWeatherPayload({ ...cachedNational(), schemaVersion: undefined }, NOW), null);
  assert.equal(sanitizeWeatherPayload({ ...cachedNational(), source: 'deterministic-fallback' }, NOW), null);
  const data = cachedNational();
  data.stationTemps.PROV_0.validAt = '2026-11-15T12:00';
  data.stations[1].pm25Time = '2026-11-15T12:00';
  const valid = sanitizeWeatherPayload(data, NOW);
  assert.equal(valid.stationTemps.PROV_0.stale, true);
  assert.equal(valid.stationTemps.PROV_0.airStale, false);
  assert.equal(valid.stationTemps.PROV_1.stale, false);
  assert.equal(valid.stationTemps.PROV_1.airStale, true);
  assert.equal(valid.lastUpdated, '2026-11-15T05:00:00.000Z');
});

test('national guard hides wrong-day rainfall/extrema and invalid PM averages instead of manufacturing valid readings', () => {
  const data = cachedNational();
  data.stationTemps.PROV_0.rainDate = '2026-11-15';
  data.stationTemps.PROV_0.tempDate = '2026-11-15';
  data.stationTemps.PROV_1.rainPeriod = 'hourly';
  data.stationTemps.PROV_1.tempMin = 35;
  data.stationTemps.PROV_1.humidity = 101;
  data.stations[2].pm25ValidHours24h = 23;
  data.stations[3].pm25WindowEnd = '2026-11-17T05:00:00Z';
  data.stations[4].AQILast.PM25.value = null;
  const valid = sanitizeWeatherPayload(data, NOW);
  assert.equal(valid.stationTemps.PROV_0.rainMm, null);
  assert.equal(valid.stationTemps.PROV_0.tempMin, null);
  assert.equal(valid.stationTemps.PROV_1.rainMm, null);
  assert.equal(valid.stationTemps.PROV_1.tempMin, null);
  assert.equal(valid.stationTemps.PROV_1.tempMax, null);
  assert.equal(valid.stationTemps.PROV_1.humidity, null);
  assert.equal(valid.stations[2].pm25Average24h, null);
  assert.equal(valid.stations[3].pm25Average24h, null);
  assert.equal(valid.stations[4].AQILast.PM25.value, null);
  assert.equal(valid.stationTemps.PROV_5.rainMm, 12.6);
});

test('GISTDA guard rejects pre-metadata fabricated fallbacks, keeps unavailable arrays empty and preserves real zero', () => {
  assert.equal(sanitizeGistdaSummary({ hotspots: [{ province: 'เชียงใหม่', value: 1507 }] }), null);
  const data = sanitizeGistdaSummary({ available: { hotspots: false, burntArea: true, floodArea: true }, hotspots: [{ province: 'เชียงใหม่', value: 1507 }], burntArea: [{ province: 'เชียงใหม่', value: 0 }], floodArea: [{ province: '-', value: -1 }] });
  assert.deepEqual(data.hotspots, []);
  assert.deepEqual(data.burntArea, [{ province: 'เชียงใหม่', value: 0 }]);
  assert.deepEqual(data.floodArea, []);
  assert.equal(data.available.floodArea, false);
  assert.equal(data.available.lowSoilMoisture, false);
});

test('history sends validated summit elevation only to weather and retains requested/provider locations', async () => {
  const originalFetch = globalThis.fetch, requested = [];
  globalThis.fetch = async url => {
    requested.push(new URL(url));
    return { ok: true, json: async () => String(url).includes('archive-api') ? { latitude: 18.58, longitude: 98.48, elevation: 2565, daily: { time: ['2026-11-10'] } } : { hourly: {} } };
  };
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await statistics({ method: 'GET', query: { lat: '18.588', lon: '98.486', elevation: '2565' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requested.find(url => url.hostname.startsWith('archive-api')).searchParams.get('elevation'), '2565');
    assert.equal(requested.find(url => url.hostname.startsWith('air-quality')).searchParams.has('elevation'), false);
    assert.deepEqual(res.body.requestedLocation, { lat: 18.588, lon: 98.486, elevation: 2565 });
    assert.deepEqual(res.body.providerLocation, { lat: 18.58, lon: 98.48, elevation: 2565 });
  } finally { globalThis.fetch = originalFetch; }
});

test('history rejects empty, repeated and malformed location parameters before any upstream request', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Must not fetch invalid coordinates'); };
  try {
    for (const invalid of [{ lat: '' }, { lat: ' ' }, { lat: ['13', '14'] }, { lat: ['13'] }, { lon: '' }, { lon: ['100'] }, { elevation: '' }, { elevation: ['2565'] }, { elevation: null }, { elevation: 'NaN' }, { elevation: 'Infinity' }, { elevation: '-501' }, { elevation: '9001' }]) {
      const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await statistics({ method: 'GET', query: { lat: '13', lon: '100', ...invalid } }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(invalid));
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});
