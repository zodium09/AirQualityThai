import test from 'node:test';
import assert from 'node:assert/strict';
import { mapReading } from '../src/utils/mapReadings.js';

const now = Date.parse('2026-11-16T10:00:00+07:00');
const station = { stationID: 'PROV_0', lat: 13.7, long: 100.5, weatherTime: '2026-11-16T10:00', pm25Time: '2026-11-16T06:00', pm25Average24h: 12, pm25ValidHours24h: 24, AQILast: { PM25: { value: 0 } } };
test('monitor keeps variable provenance and point coordinates with a TMD temperature', () => {
  const weather = { PROV_0: { source: 'tmd', tempSource: 'tmd-nwp-model', temp: 25, weatherTime: '2026-11-16T10:00', weatherLocation: { lat: 14, lon: 101 }, supplementalWeatherTime: '2026-11-16T07:00', rainMm: 12, rainDate: '2026-11-16', rainSource: 'open-meteo-model', windGust: 40 } };
  const temp = mapReading(station, weather, 'temp', now);
  assert.equal(temp.stale, false); assert.equal(temp.source, 'tmd-nwp-model'); assert.equal(temp.lat, 14);
  const rain = mapReading(station, weather, 'rain', now);
  assert.equal(rain.stale, true); assert.equal(rain.lat, station.lat); assert.equal(rain.source, 'open-meteo-model');
  assert.equal(mapReading(station, weather, 'wind', now).stale, true);
});
test('wrong calendar date and incomplete PM cannot rank as new complete data', () => {
  const weather = { PROV_0: { tempMin: 5, tempDate: '2026-11-15', rainDate: '2026-11-16', rainMm: 0, weatherTime: station.weatherTime } };
  assert.equal(mapReading(station, weather, 'tempMin', now).value, null);
  assert.equal(mapReading(station, weather, 'tempMin', now).hours, 24);
  assert.equal(mapReading(station, weather, 'temp', now).hours, null);
  assert.equal(mapReading(station, weather, 'rain', now).value, 0);
  assert.equal(mapReading(station, weather, 'pmHour', now).value, 0);
  assert.equal(mapReading(station, weather, 'pmHour', now).stale, true);
  assert.equal(mapReading({ ...station, pm25ValidHours24h: 23 }, weather, 'pm25', now).value, null);
});
