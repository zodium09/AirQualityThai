import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { buildRadarHistory, classifyCoverage, radarCoordinates, radarFrames } from '../api/radar.js';

const now = Date.parse('2026-11-16T03:00:00Z');
const timestamp = now / 1000;
const coords = { lat: 13.75, lon: 100.5 };
const manifest = { host: 'https://tilecache.rainviewer.com', radar: { past: [
  { time: timestamp - 1200, path: `/v2/radar/${timestamp - 1200}` },
  { time: timestamp - 600, path: `/v2/radar/${timestamp - 600}` },
], nowcast: [{ time: timestamp + 600, path: `/v2/radar/${timestamp + 600}` }] } };

test('radar history excludes future nowcast and future/malformed past frames', () => {
  const copy = structuredClone(manifest);
  copy.radar.past.push(copy.radar.past[0], copy.radar.nowcast[0], { time: timestamp, path: '/v2/radar/../../private' }, { time: timestamp - 600, path: 'https://evil.example/x' });
  const frames = radarFrames(copy, coords, now);
  assert.equal(frames.length, 2);
  assert.ok(frames.every(frame => frame.timestamp <= timestamp));
  assert.ok(frames[0].url.includes('/512/7/13.75000/100.50000/2/0_0.png'));
  assert.match(frames[0].tileUrl, /\/256\/\{z\}\/\{x\}\/\{y\}\/2\/0_0.png$/);
  assert.equal(frames[1].time, '2026-11-16T02:50:00.000Z');
});

test('provider metadata cannot cause arbitrary tile host requests', () => {
  for (const host of ['http://tilecache.rainviewer.com', 'https://localhost', 'https://rainviewer.com.evil.example', 'https://user:password@tilecache.rainviewer.com', 'https://tilecache.rainviewer.com:444']) {
    assert.deepEqual(radarFrames({ ...manifest, host }, coords, now), []);
  }
});

test('only a fully known central coverage mask is classified as covered/uncovered', () => {
  const clear = { r: 0, g: 0, b: 0, a: 0 }, black = { r: 0, g: 0, b: 0, a: 255 };
  assert.equal(classifyCoverage(Array(9).fill(clear)), 'covered');
  assert.equal(classifyCoverage(Array(9).fill(black)), 'uncovered');
  assert.equal(classifyCoverage([...Array(8).fill(clear), black]), 'partial');
  assert.equal(classifyCoverage([...Array(8).fill(clear), { ...black, a: 128 }]), 'unknown');
  assert.equal(classifyCoverage([]), 'unknown');
});

test('missing or unknown coverage never becomes no-rain or a confidence/ETA/rainfall number', () => {
  const history = buildRadarHistory(manifest, coords, 'unknown', now);
  assert.equal(history.status, 'available');
  assert.equal(history.coverage, 'unknown');
  for (const key of ['nowcast', 'confidence', 'alertLevel', 'rainNext60MinMm', 'etaMinutes', 'probability60']) assert.equal(key in history, false);
  const absent = buildRadarHistory(null, coords, 'unknown', now);
  assert.equal(absent.status, 'unavailable');
  assert.equal(absent.radarTime, null);
  assert.deepEqual(absent.frames, []);
});

test('latest frame older than 30 minutes is explicitly stale without changing its timestamp', () => {
  const fresh = buildRadarHistory(manifest, coords, 'covered', now);
  const old = buildRadarHistory(manifest, coords, 'covered', now + 21 * 60 * 1000);
  assert.equal(fresh.stale, false);
  assert.equal(old.status, 'stale');
  assert.equal(old.radarTime, fresh.radarTime);
});

test('bad POST JSON and invalid coordinates fail before a provider request', async () => {
  for (const value of [{ lat: null, lon: 100 }, { lat: '', lon: 100 }, { lat: [13], lon: 100 }, { lat: 23, lon: 100 }]) assert.equal(radarCoordinates(value), null);
  assert.deepEqual(radarCoordinates({ lat: '13.75', lon: '100.50' }), coords);
  for (const body of ['{oops', '{}', 'null', 'false', '[]', '{"lat":13,"lon":null}']) {
    let status;
    const res = { status(value) { status = value; return this; }, json(value) { return value; } };
    await handler({ method: 'POST', body }, res);
    assert.equal(status, 400);
  }
});
