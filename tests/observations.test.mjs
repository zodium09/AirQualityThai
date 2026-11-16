import test from 'node:test';
import assert from 'node:assert/strict';
import { createObservationService, observationNumber, observationTime, parseAirStations, parseWeatherStations, selectObservation } from '../src/server/observations.js';
import { mountainPlaces } from '../src/data/mountainPlaces.js';
import handler from '../api/observations.js';

const now = Date.parse('2026-11-16T03:00:00Z');
const weatherPayload = { Header: { LastBuildDate: '2026-11-16 09:39:00' }, Stations: { Station: [
  { WmoStationNumber: '48302', StationNameThai: 'ดอยอ่างขาง', Province: 'เชียงใหม่', Latitude: '19.93139', Longitude: '99.04833', Observation: { DateTime: '2026-11-16 07:00:00.000', Temperature: '16.8', MinTemperature: '16.2', MaxTemperature: '23.5', Rainfall: '0.00' } },
] } };
const airPayload = { stations: [{ stationID: '02t', nameTH: 'สถานีทดสอบ', areaTH: 'กรุงเทพฯ', lat: '13.732846', long: '100.487662', AQILast: { date: '2026-11-16', time: '09:00', PM25: { value: '29.2', aqi: '67' } } }] };

test('station sentinel values remain missing and real zero/negative temperatures survive', () => {
  for (const missing of [null, undefined, '', ' ', '-', '-999', true, {}, []]) assert.equal(observationNumber(missing), null);
  assert.equal(observationNumber('0.00'), 0);
  assert.equal(observationNumber('-2.3', -60, 60), -2.3);
  assert.equal(observationNumber('-1', 0, 3000), null);
  assert.equal(observationTime('2026-11-16 07:00:00.000'), '2026-11-16T00:00:00.000Z');
  assert.equal(observationTime('2026-02-31 07:00:00'), null);
});

test('TMD daily observations retain their 07:00 measurement and previous-24-hour window', () => {
  const [row] = parseWeatherStations(weatherPayload);
  assert.equal(row.temperature, 16.8);
  assert.equal(row.rainMm, 0);
  assert.equal(row.metricWindows.temperature.hours, 0);
  assert.equal(row.metricWindows.tempMin.start, '2026-11-15T00:00:00.000Z');
  assert.equal(row.metricWindows.rainMm.end, '2026-11-16T00:00:00.000Z');
  assert.notEqual(row.observedAt, row.sourceGeneratedAt);
});

test('Air4Thai AQILast PM mass and official index are different fields', () => {
  const [row] = parseAirStations(airPayload);
  assert.equal(row.pm25, 29.2);
  assert.equal(row.pm25Aqi, 67);
  assert.equal(row.averagingWindow.hours, 24);
  assert.equal(row.observedAt, '2026-11-16T02:00:00.000Z');
  const missing = structuredClone(airPayload);
  missing.stations[0].AQILast.PM25.value = '-1';
  assert.deepEqual(parseAirStations(missing), []);
  missing.stations[0].forecast = [{ PM25: { value: 12 } }];
  assert.deepEqual(parseAirStations(missing), []);
});

test('nearest reporting station retains distance and cannot be mistaken for summit measurement', () => {
  const result = selectObservation(parseWeatherStations(weatherPayload), { lat: 18.589493, lon: 98.487161 }, 'weather', now);
  assert.equal(result.station.id, '48302');
  assert.ok(result.station.distanceKm > 100);
  assert.equal(result.farFromLocation, true);
  assert.equal(result.representativeOfRequestedPoint, false);
  assert.equal(result.stale, false);
  assert.equal(selectObservation(parseWeatherStations(weatherPayload), { lat: 19.93, lon: 99.04 }, 'weather', now + 27 * 3600000).stale, true);
  assert.equal(selectObservation(parseAirStations(airPayload), { lat: 13.7, lon: 100.5 }, 'air', now + 4 * 3600000).stale, true);
  assert.equal(selectObservation(parseWeatherStations(weatherPayload), { lat: 19.93, lon: 99.04 }, 'weather', now - 24 * 3600000).status, 'unavailable');
  assert.equal(selectObservation(parseAirStations(airPayload), { lat: 13.7, lon: 100.5 }, 'air', Date.parse('2026-11-16T01:59:59Z')).status, 'unavailable');
});

test('concurrent requests share provider fetches; partial failure does not fabricate other source', async () => {
  let calls = 0;
  const service = createObservationService({ clock: () => now, fetcher: async url => { calls++; if (url.includes('air4thai')) throw new Error('offline'); return { ok: true, json: async () => weatherPayload }; } });
  const [a, b] = await Promise.all([service({ lat: 19.93, lon: 99.04 }), service({ lat: 13.7, lon: 100.5 })]);
  assert.equal(calls, 2);
  assert.equal(a.weather.status, 'available');
  assert.equal(a.air.status, 'unavailable');
  assert.equal(a.air.observedAt, null);
  assert.equal(a.air.pm25, undefined);
  assert.notEqual(a.weather.station.distanceKm, b.weather.station.distanceKm);
});

test('failed refresh preserves source timestamp and explicitly marks cached readings stale', async () => {
  let current = now, failed = false;
  const service = createObservationService({ clock: () => current, fetcher: async url => { if (failed) throw new Error('offline'); return { ok: true, json: async () => url.includes('air4thai') ? airPayload : weatherPayload }; } });
  const first = await service({ lat: 13.7, lon: 100.5 });
  current += 6 * 60 * 1000;
  failed = true;
  const cached = await service({ lat: 13.7, lon: 100.5 });
  assert.equal(cached.air.observedAt, first.air.observedAt);
  assert.equal(cached.air.fetchedAt, first.air.fetchedAt);
  assert.equal(cached.air.stale, true);
  assert.equal(cached.air.providerAvailable, false);
});

test('observation endpoint rejects empty, repeated and out-of-country coordinates before fetching', async () => {
  for (const query of [{}, { lat: '', lon: '100' }, { lat: ['13', '14'], lon: '100' }, { lat: '40', lon: '100' }]) {
    let status;
    const res = { status(value) { status = value; return this; }, json(value) { return value; } };
    await handler({ method: 'GET', query }, res);
    assert.equal(status, 400);
  }
});

test('mountain references are independently sourced points with explicit height and place type', () => {
  assert.ok(mountainPlaces.length >= 2);
  assert.equal(new Set(mountainPlaces.map(place => place.id)).size, mountainPlaces.length);
  for (const place of mountainPlaces) {
    assert.ok(place.lat > 4 && place.lat < 22 && place.lon > 96 && place.lon < 106);
    assert.ok(place.elevation > 1000 && place.elevation < 3000);
    assert.match(place.sourceUrl, /^https:\/\//);
    assert.ok(place.sourceNote);
  }
});
