import { Jimp, intToRGBA } from 'jimp';

const MANIFEST_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_HOST = 'https://tilecache.rainviewer.com';
const CACHE_MS = 5 * 60 * 1000;
const MAX_FRAME_AGE_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 80;
const resultCache = new Map();
const pending = new Map();
let manifestCache = null;
let manifestPending = null;

export function radarCoordinates(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const parse = value => typeof value === 'number' || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  const lat = parse(body.lat), lon = parse(body.lon);
  return Number.isFinite(lat) && lat >= 4 && lat <= 22 && Number.isFinite(lon) && lon >= 96 && lon <= 106 ? { lat, lon } : null;
}

function trustedHost(value) {
  try {
    const url = new URL(value || TILE_HOST);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || (url.hostname !== 'rainviewer.com' && !url.hostname.endsWith('.rainviewer.com'))) return null;
    return url.origin;
  } catch { return null; }
}

export function radarFrames(manifest, coords, now = Date.now()) {
  const host = trustedHost(manifest?.host);
  if (!host) return [];
  const frames = new Map();
  // Future nowcast frames were discontinued in 2026 and are deliberately ignored.
  for (const frame of Array.isArray(manifest?.radar?.past) ? manifest.radar.past : []) {
    if (!Number.isInteger(frame.time) || frame.time * 1000 > now || now - frame.time * 1000 > 150 * 60 * 1000) continue;
    if (typeof frame.path !== 'string' || !/^\/v2\/radar\/[A-Za-z0-9_/-]+$/.test(frame.path)) continue;
    const path = frame.path.replace(/\/$/, '');
    frames.set(frame.time, {
      timestamp: frame.time, time: new Date(frame.time * 1000).toISOString(),
      url: `${host}${path}/512/7/${coords.lat.toFixed(5)}/${coords.lon.toFixed(5)}/2/0_0.png`,
      tileUrl: `${host}${path}/256/{z}/{x}/{y}/2/0_0.png`,
    });
  }
  return [...frames.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-13);
}

export function classifyCoverage(pixels) {
  if (!Array.isArray(pixels) || pixels.length !== 9) return 'unknown';
  const transparent = pixels.filter(pixel => pixel?.a === 0).length;
  const black = pixels.filter(pixel => pixel?.a === 255 && pixel.r === 0 && pixel.g === 0 && pixel.b === 0).length;
  if (transparent === 9) return 'covered';
  if (black === 9) return 'uncovered';
  if (transparent + black === 9) return 'partial';
  return 'unknown';
}

export function buildRadarHistory(manifest, coords, coverage = 'unknown', now = Date.now()) {
  const frames = radarFrames(manifest, coords, now);
  const last = frames.at(-1);
  const stale = !last || now - last.timestamp * 1000 > MAX_FRAME_AGE_MS;
  return {
    kind: 'radar-history', status: !last ? 'unavailable' : stale ? 'stale' : 'available', unavailable: !last,
    stale, coords, frames, radarTime: last?.time || null,
    coverage, coverageNote: 'ขอบเขตครอบคลุมจากหน้ากากของผู้ให้บริการ ไม่ใช่หลักฐานว่ามีข้อมูลล่าสุดทุกจุด',
    timeMeaning: 'เวลาเฟรมภาพรวม ภาพจากแต่ละสถานีอาจมีเวลาต่างกัน',
    source: 'RainViewer', sourceUrl: 'https://www.rainviewer.com/', fetchedAt: new Date(now).toISOString(),
  };
}

async function getManifest() {
  if (manifestCache && Date.now() - manifestCache.at < CACHE_MS) return manifestCache.data;
  if (!manifestPending) manifestPending = (async () => {
    const response = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(9000), cache: 'no-store' });
    if (!response.ok) throw new Error('Radar manifest unavailable');
    const data = await response.json();
    manifestCache = { at: Date.now(), data };
    return data;
  })().finally(() => { manifestPending = null; });
  return manifestPending;
}

async function coverageAt(host, coords) {
  if (!host) return 'unknown';
  try {
    const url = `${host}/v2/coverage/0/256/7/${coords.lat.toFixed(5)}/${coords.lon.toFixed(5)}/0/0_0.png`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) return 'unknown';
    if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) return 'unknown';
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2 * 1024 * 1024) return 'unknown';
    const image = await Jimp.read(Buffer.from(bytes));
    if (image.bitmap.width !== 256 || image.bitmap.height !== 256) return 'unknown';
    const pixels = [];
    for (let y = 127; y <= 129; y++) for (let x = 127; x <= 129; x++) pixels.push(intToRGBA(image.getPixelColor(x, y)));
    return classifyCoverage(pixels);
  } catch { return 'unknown'; }
}

async function loadHistory(coords) {
  const key = `${coords.lat.toFixed(5)}:${coords.lon.toFixed(5)}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    const stale = cached.payload.stale || Date.now() - Date.parse(cached.payload.radarTime) > MAX_FRAME_AGE_MS;
    return { ...cached.payload, stale, status: stale ? 'stale' : 'available' };
  }
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    try {
      const manifest = await getManifest();
      const coverage = await coverageAt(trustedHost(manifest.host), coords);
      const payload = buildRadarHistory(manifest, coords, coverage);
      if (!payload.unavailable) {
        resultCache.set(key, { at: Date.now(), payload });
        if (resultCache.size > MAX_CACHE_ENTRIES) resultCache.delete(resultCache.keys().next().value);
      }
      return payload;
    } catch { return buildRadarHistory(null, coords); }
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const coords = radarCoordinates(body);
  if (!coords) return res.status(400).json({ error: 'Invalid Thailand coordinates' });
  const data = await loadHistory(coords);
  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(200).json({ ...data, currentLocName: String(body.locationLabel || '').replace(/[<>]/g, '').slice(0, 120) });
}
