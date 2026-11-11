import test from 'node:test';
import assert from 'node:assert/strict';
import { finiteOrNull, forecastUrls, normalizeForecast, weatherDate, thaiTime, getWeatherVisual } from '../src/utils/weatherData.js';
import { dailyAirMax, providerSlots } from '../src/server/providerData.js';
import { fetchNationalForecast } from '../src/server/nationalForecast.js';
import { unavailableWeather } from '../api/weather-data.js';

test('unknown values stay missing; measured zero is preserved', () => {
  for (const input of [null, undefined, '', ' ', true, false, NaN, Infinity, 'bad']) assert.equal(finiteOrNull(input), null);
  for (const input of [0, '0']) assert.equal(finiteOrNull(input), 0);
  assert.equal(finiteOrNull('-4.5'), -4.5);
});
test('Bangkok provider times remain Bangkok times on foreign devices', () => {
  assert.equal(weatherDate('2026-11-11T08:15').toISOString(), '2026-11-11T01:15:00.000Z');
  assert.equal(thaiTime('2026-11-11T08:15'), '08:15');
});
test('weather and air variables are requested from their supported providers', () => {
  const [weather, air] = forecastUrls(13.75, 100.5).map(url => new URL(url));
  assert.ok(!weather.searchParams.get('hourly').includes('pm2_5'));
  assert.ok(weather.searchParams.get('hourly').includes('weather_code'));
  assert.equal(weather.searchParams.get('wind_speed_unit'), 'kmh');
  assert.equal(air.searchParams.get('forecast_days'), '5');
});
const weather = { current: { time: '2026-11-11T08:15', temperature_2m: 30, is_day: 1 }, hourly: { time: ['2026-11-11T08:00', '2026-11-11T09:00'], uv_index: [3, 4], precipitation_probability: [0, null], weather_code: [0, 61] }, daily: { time: ['2026-11-11', '2026-11-12', '2026-11-13'] } };
test('missing air does not report zero PM or fabricated future forecasts', () => {
  const data = normalizeForecast(weather, null, { lat: 13, lon: 100 });
  assert.equal(data.current.pm25, null);
  assert.deepEqual(data.hourly.pm25, [null, null]);
  assert.deepEqual(data.daily.pm25_max, [null, null, null]);
  assert.equal(data.current.rainProb, 0);
  assert.equal(data.current.pressure, null);
});
test('air values align by timestamp, never by array position or carrying today into tomorrow', () => {
  const air = { current: { pm2_5: 12 }, hourly: { time: ['2026-11-11T09:00', '2026-11-12T08:00'], pm2_5: [17, null] } };
  const data = normalizeForecast(weather, air, { lat: 13, lon: 100 });
  assert.deepEqual(data.hourly.pm25, [null, 17]);
  assert.deepEqual(data.daily.pm25_max, [17, null, null]);
});
test('unknown weather is not sunshine and cloud codes do not imply rain', () => {
  assert.equal(getWeatherVisual(null).icon, 'unknown');
  assert.equal(getWeatherVisual(3).icon, 'cloud');
  assert.equal(getWeatherVisual(61).icon, 'rain');
  assert.equal(getWeatherVisual(0, false).icon, 'moon');
});
test('failed provider batches reserve all slots without shifting later provinces', () => {
  const first = providerSlots({ status: 'rejected' }, 40);
  const second = providerSlots({ status: 'fulfilled', value: [{ current: { temperature_2m: 26 } }] }, 1);
  assert.equal([...first, ...second][40].current.temperature_2m, 26);
  assert.equal(first.length, 40);
  assert.deepEqual(providerSlots({ status: 'fulfilled', value: [{ error: true }] }, 2), [{}, {}]);
});
test('daily maxima keep absent days missing and legitimate zero values', () => {
  assert.deepEqual(dailyAirMax(['2026-11-11', '2026-11-12', '2026-11-13'], { time: ['2026-11-11T01:00', '2026-11-12T01:00'], pm2_5: [0, null] }), [0, null, null]);
});
test('unavailable national response has no weather inventions', () => {
  const data = unavailableWeather();
  assert.equal(data.stations.length, 77);
  assert.equal(data.lastUpdated, null);
  assert.ok(data.stations.every(station => station.AQILast.PM25.value === null));
  assert.deepEqual(data.stationTemps, {});
});
test('national fallback survives one failed batch and separate air failure', async () => {
  let weatherBatch = 0;
  const result = await fetchNationalForecast(async url => {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith('air-quality')) throw new Error('air offline');
    if (weatherBatch++ === 0) throw new Error('first batch offline');
    const count = parsed.searchParams.get('latitude').split(',').length;
    return { ok: true, json: async () => Array.from({ length: count }, () => ({ current: { time: '2026-11-11T08:00', temperature_2m: 26, wind_speed_10m: 0 }, hourly: { time: ['2026-11-11T08:00'], precipitation_probability: [0] } })) };
  });
  assert.equal(result.stationTemps.PROV_0.temp, null);
  assert.equal(result.stationTemps.PROV_40.temp, 26);
  assert.equal(result.stationTemps.PROV_40.rainProb, 0);
  assert.equal(result.stations[40].AQILast.PM25.value, null);
});
