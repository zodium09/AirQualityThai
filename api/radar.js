import { Jimp, intToRGBA } from 'jimp';

const TILE_SIZE = 256;
const RADAR_ZOOM = 7;
const SCAN_RADIUS_KM = 90;
const CENTER_RADIUS_KM = 7;
const TILE_TIMEOUT_MS = 4500;
const API_TIMEOUT_MS = 9000;
const RESULT_CACHE_MS = 8 * 60 * 1000;
const resultCache = new Map();
const tileCache = new Map();
const tilePromiseCache = new Map();

const RAIN_PALETTE = [
  '#88ddee', '#6cd1eb', '#51c5e8', '#36bae5', '#1baee2', '#00a3e0', '#009ad5', '#0091ca', '#0088bf', '#007fb4',
  '#0077aa', '#0070a3', '#00699c', '#006295', '#005b8e', '#005588', '#005180', '#004e78', '#004a70', '#004768',
  '#ffee00', '#ffe000', '#ffd200', '#ffc500', '#ffb700', '#ffaa00', '#ff9f00', '#ff9500', '#ff8b00', '#ff8100',
  '#ff4400', '#f23600', '#e62800', '#d91b00', '#cd0d00', '#c10000', '#a80000', '#8f0000', '#760000', '#5d0000',
  '#ffaaff', '#ff9fff', '#ff95ff', '#ff8bff', '#ff81ff', '#ff77ff', '#ff6cff', '#ff62ff', '#ff58ff', '#ff4eff',
];
const DBZ_BY_COLOR = new Map(RAIN_PALETTE.map((color, index) => [color, index + 15]));

const abortableFetch = async (url, timeoutMs = API_TIMEOUT_MS) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

const normalizeDegree = (degree) => ((Number(degree) % 360) + 360) % 360;

const angularDiff = (a, b) => {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
};

const getWindDirectionText = (degree) => {
  if (degree === undefined || degree === null || Number.isNaN(Number(degree))) return '-';
  const dirs = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];
  return dirs[Math.round(normalizeDegree(degree) / 45) % 8];
};

const bearingFromPixelVector = (dx, dy) => normalizeDegree(Math.atan2(dx, -dy) * 180 / Math.PI);

const bearingFromPointToTarget = (dxFromTarget, dyFromTarget) => bearingFromPixelVector(-dxFromTarget, -dyFromTarget);

const metersPerPixel = (lat, zoom) => (156543.03392 * Math.cos(Number(lat) * Math.PI / 180)) / Math.pow(2, zoom);

const getLocationName = async (lat, lon) => {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=th`;
    const res = await abortableFetch(url, 5000);
    const data = await res.json();
    if (!data) return null;

    let area = data.city || data.locality || '';
    const province = data.principalSubdivision || '';
    if (area.includes('แขวง')) area = data.city ? data.city : area.replace(/แขวง/g, '');
    area = area.replace(/แขวง/g, '').trim();
    if (area && !area.includes('เขต') && !area.includes('อำเภอ')) {
      area = (province.includes('กรุงเทพ') || province === 'Bangkok') ? `เขต${area}` : `อ.${area}`;
    }
    area = area.replace('เขตเขต', 'เขต').replace('อ.อ.', 'อ.');
    return `${area} ${province}`.trim();
  } catch {
    return null;
  }
};

const rainLevelInfo = (level) => {
  if (level >= 5) return { label: 'ชมพู/ขาว', desc: 'ฝนหนักมาก', color: '#9f1239' };
  if (level >= 4) return { label: 'แดง', desc: 'ฝนหนัก', color: '#ef4444' };
  if (level >= 3) return { label: 'เหลือง/ส้ม', desc: 'ฝนปานกลางถึงหนัก', color: '#f59e0b' };
  if (level >= 2) return { label: 'น้ำเงินเข้ม', desc: 'ฝนปานกลาง', color: '#2563eb' };
  if (level >= 1) return { label: 'ฟ้า', desc: 'ฝนเบา', color: '#0ea5e9' };
  return { label: 'โปร่ง', desc: 'ไม่พบฝน', color: '#0ea5e9' };
};

const getRainPixelInfo = (rgba) => {
  if (!rgba || rgba.a < 220) return { level: 0, dbz: null, rateMmh: 0 };
  const hex = `#${[rgba.r, rgba.g, rgba.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  let dbz = DBZ_BY_COLOR.get(hex);
  if (!dbz) {
    if (rgba.r >= 245 && rgba.b >= 235) dbz = 57;
    else if (rgba.r >= 70 && rgba.g < 90 && rgba.b < 70) dbz = 50;
    else if (rgba.r >= 230 && rgba.g < 195 && rgba.b < 80) dbz = 42;
    else if (rgba.r >= 220 && rgba.g >= 190 && rgba.b < 100) dbz = 36;
    else if (rgba.b >= 90 && rgba.g >= 55) dbz = rgba.g >= 125 ? 20 : 30;
  }
  if (!dbz) return { level: 0, dbz: null, rateMmh: 0 };
  const level = dbz >= 55 ? 5 : dbz >= 45 ? 4 : dbz >= 35 ? 3 : dbz >= 25 ? 2 : 1;
  const reflectivity = 10 ** (dbz / 10);
  const rateMmh = (reflectivity / 200) ** (1 / 1.6);
  return { level, dbz, rateMmh };
};

const tileUrlForFrame = (host, frame, zoom, tx, ty) => {
  const path = frame.path || `/v2/radar/${frame.time}`;
  return `${host}${path}/${TILE_SIZE}/${zoom}/${tx}/${ty}/2/0_0.png`;
};

const loadRadarTile = async (url) => {
  const cached = tileCache.get(url);
  if (cached && Date.now() - cached.at < RESULT_CACHE_MS) return cached.image;
  if (tilePromiseCache.has(url)) return tilePromiseCache.get(url);

  const promise = (async () => {
    const res = await abortableFetch(url, TILE_TIMEOUT_MS);
    if (!res.ok) return null;
    const image = await Jimp.read(Buffer.from(await res.arrayBuffer()));
    tileCache.set(url, { at: Date.now(), image });
    if (tileCache.size > 120) {
      [...tileCache.entries()]
        .sort((a, b) => a[1].at - b[1].at)
        .slice(0, 24)
        .forEach(([key]) => tileCache.delete(key));
    }
    return image;
  })().finally(() => tilePromiseCache.delete(url));
  tilePromiseCache.set(url, promise);
  return promise;
};

const loadFrameTiles = async ({ host, frame, minTileX, maxTileX, minTileY, maxTileY }) => {
  const tileEntries = [];
  for (let tx = minTileX; tx <= maxTileX; tx += 1) {
    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
      tileEntries.push({ tx, ty });
    }
  }

  const loaded = await Promise.all(tileEntries.map(async ({ tx, ty }) => {
    try {
      const image = await loadRadarTile(tileUrlForFrame(host, frame, RADAR_ZOOM, tx, ty));
      return { key: `${tx}_${ty}`, image };
    } catch {
      return null;
    }
  }));

  return loaded.reduce((acc, item) => {
    if (item?.image) acc[item.key] = item.image;
    return acc;
  }, {});
};

const scanFrame = ({ frame, tiles, centerAbsX, centerAbsY, radiusPx, centerRadiusPx, kmPerPixel }) => {
  let scanned = 0;
  let rainPixels = 0;
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let maxLevel = 0;
  let centerLevel = 0;
  let nearestDistPx = Infinity;
  let nearestLevel = 0;
  let nearestDx = 0;
  let nearestDy = 0;
  let rainRateTotal = 0;
  let centerRainRateTotal = 0;
  let centerRainPixels = 0;
  let maxRateMmh = 0;
  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (let dy = -radiusPx; dy <= radiusPx; dy += 1) {
    for (let dx = -radiusPx; dx <= radiusPx; dx += 1) {
      const distPx = Math.sqrt(dx * dx + dy * dy);
      if (distPx > radiusPx) continue;
      scanned += 1;

      const currAbsX = Math.floor(centerAbsX + dx);
      const currAbsY = Math.floor(centerAbsY + dy);
      const tx = Math.floor(currAbsX / TILE_SIZE);
      const ty = Math.floor(currAbsY / TILE_SIZE);
      const px = ((currAbsX % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
      const py = ((currAbsY % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
      const image = tiles[`${tx}_${ty}`];
      if (!image) continue;

      const pixel = getRainPixelInfo(intToRGBA(image.getPixelColor(px, py)));
      const level = pixel.level;
      if (!level) continue;

      rainPixels += 1;
      buckets[level] += 1;
      maxLevel = Math.max(maxLevel, level);

      const weight = level * level;
      weightedX += dx * weight;
      weightedY += dy * weight;
      totalWeight += weight;
      rainRateTotal += pixel.rateMmh;
      maxRateMmh = Math.max(maxRateMmh, pixel.rateMmh);

      if (distPx <= centerRadiusPx) {
        centerLevel = Math.max(centerLevel, level);
        centerRainRateTotal += pixel.rateMmh;
        centerRainPixels += 1;
      }
      if (distPx < nearestDistPx) {
        nearestDistPx = distPx;
        nearestLevel = level;
        nearestDx = dx;
        nearestDy = dy;
      }
    }
  }

  const coveragePct = scanned ? Math.round((rainPixels / scanned) * 1000) / 10 : 0;
  const heavyPixels = buckets[4] + buckets[5];
  const moderatePixels = buckets[3] + heavyPixels;
  const centroidDx = totalWeight ? weightedX / totalWeight : null;
  const centroidDy = totalWeight ? weightedY / totalWeight : null;

  return {
    time: frame.time,
    type: frame.type,
    hasRain: rainPixels > 0,
    maxLevel,
    centerLevel,
    coveragePct,
    heavyCoveragePct: scanned ? Math.round((heavyPixels / scanned) * 1000) / 10 : 0,
    moderateCoveragePct: scanned ? Math.round((moderatePixels / scanned) * 1000) / 10 : 0,
    nearestLevel,
    nearestDistKm: Number.isFinite(nearestDistPx) ? Math.round(nearestDistPx * kmPerPixel) : null,
    nearestDx,
    nearestDy,
    centroidDx,
    centroidDy,
    rainPixels,
    meanRateMmh: rainPixels ? Math.round((rainRateTotal / rainPixels) * 10) / 10 : 0,
    centerRateMmh: centerRainPixels ? Math.round((centerRainRateTotal / centerRainPixels) * 10) / 10 : 0,
    maxRateMmh: Math.round(maxRateMmh * 10) / 10,
    buckets,
  };
};

const computeTrend = (analyses) => {
  const past = analyses.filter((item) => item.type === 'past').sort((a, b) => a.time - b.time).slice(-4);
  if (past.length < 2) return { id: 'uncertain', label: 'ข้อมูลแนวโน้มยังไม่พอ', changePct: null };
  const first = past[0];
  const latest = past[past.length - 1];
  const firstSignal = first.coveragePct * Math.max(1, first.meanRateMmh);
  const latestSignal = latest.coveragePct * Math.max(1, latest.meanRateMmh);
  const changePct = firstSignal > 0 ? Math.round(((latestSignal - firstSignal) / firstSignal) * 100) : (latestSignal > 0 ? 100 : 0);
  if (changePct >= 25) return { id: 'intensifying', label: 'กลุ่มฝนกำลังแรงขึ้น', changePct };
  if (changePct <= -25) return { id: 'weakening', label: 'กลุ่มฝนกำลังอ่อนลง', changePct };
  return { id: 'steady', label: 'ความแรงค่อนข้างคงที่', changePct };
};

const computeMotion = (analyses, kmPerPixel) => {
  const past = analyses
    .filter((item) => item.type === 'past' && item.hasRain && item.centroidDx !== null && item.centroidDy !== null)
    .sort((a, b) => a.time - b.time);
  const latest = past[past.length - 1];
  const previous = [...past].reverse().find((item) => latest && latest.time - item.time >= 600);
  if (!latest || !previous) return null;

  const elapsedMin = (latest.time - previous.time) / 60;
  if (elapsedMin <= 0) return null;

  const dx = latest.centroidDx - previous.centroidDx;
  const dy = latest.centroidDy - previous.centroidDy;
  const movedKm = Math.sqrt(dx * dx + dy * dy) * kmPerPixel;
  const speedKmh = movedKm / (elapsedMin / 60);
  // Centroid jumps can occur when separate cells appear/disappear between frames.
  // Reject speeds outside plausible short-term storm motion instead of showing a false ETA.
  if (!Number.isFinite(speedKmh) || speedKmh < 1 || speedKmh > 120) return null;

  const bearing = bearingFromPixelVector(dx, dy);
  const latestVectorDx = Number.isFinite(latest.nearestDistKm) ? latest.nearestDx : latest.centroidDx;
  const latestVectorDy = Number.isFinite(latest.nearestDistKm) ? latest.nearestDy : latest.centroidDy;
  const distPx = Math.sqrt(latestVectorDx * latestVectorDx + latestVectorDy * latestVectorDy);
  const vxPerMin = dx / elapsedMin;
  const vyPerMin = dy / elapsedMin;
  const approachSpeedKmh = distPx > 0
    ? ((vxPerMin * (-latestVectorDx / distPx)) + (vyPerMin * (-latestVectorDy / distPx))) * kmPerPixel * 60
    : 0;

  return {
    speedKmh: Math.round(speedKmh),
    bearing,
    directionText: getWindDirectionText(bearing),
    approachSpeedKmh: Math.round(Math.max(0, approachSpeedKmh)),
    etaMinutes: approachSpeedKmh > 2 && Number.isFinite(latest.nearestDistKm)
      ? Math.round((latest.nearestDistKm / approachSpeedKmh) * 60)
      : null,
  };
};

const computeWindSupport = ({ windDir, windSpeed, stormDx, stormDy, distanceKm }) => {
  const speed = Number(windSpeed || 0);
  if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(distanceKm)) return null;

  const windTo = normalizeDegree(Number(windDir || 0) + 180);
  const stormToTarget = bearingFromPointToTarget(stormDx, stormDy);
  const diff = angularDiff(windTo, stormToTarget);
  const approachSpeedKmh = Math.max(0, Math.cos(diff * Math.PI / 180) * speed);

  return {
    windTo,
    windToText: getWindDirectionText(windTo),
    supportsApproach: speed >= 8 && diff <= 60 && approachSpeedKmh >= 6,
    approachSpeedKmh: Math.round(approachSpeedKmh),
    etaMinutes: speed >= 8 && approachSpeedKmh >= 6 ? Math.round((distanceKm / approachSpeedKmh) * 60) : null,
    diff: Math.round(diff),
    isWeakWind: speed < 8,
  };
};

const makeClearResult = ({ timeStr, targetDistrict, scanRadiusKm, factors = [], unavailable = false }) => ({
  radarTime: timeStr,
  currentLocName: targetDistrict,
  alertLevel: 0,
  cardTitle: unavailable ? 'ยังสแกนเรดาร์ไม่ได้' : 'ยังไม่พบฝนใกล้ตัว',
  cardDesc: unavailable
    ? 'RainViewer โหลดไม่สำเร็จชั่วคราว ระบบจะใช้พยากรณ์ 15 นาทีและข้อมูลฝนปัจจุบันประกอบแทน'
    : `สแกนเรดาร์รัศมี ${scanRadiusKm} กม. รอบ ${targetDistrict || 'พิกัดนี้'} แล้วไม่พบกลุ่มฝนที่มีนัยสำคัญ`,
  cardColor: unavailable ? 'yellow' : 'blue',
  cardIcon: unavailable ? '⚠️' : '🌤️',
  cardTag: unavailable ? 'ใช้ข้อมูลสำรอง' : 'ปลอดภัย',
  confidence: unavailable ? 35 : 78,
  unavailable,
  sourceStatus: unavailable ? 'fallback' : 'radar',
  nowcast: {
    rainRateMmh: 0,
    rainNext60MinMm: 0,
    rainRangeMm: [0, 0],
    trend: unavailable ? 'uncertain' : 'clear',
    trendLabel: unavailable ? 'ประเมินแนวโน้มไม่ได้' : 'ยังไม่พบสัญญาณฝน',
    direction: null,
    speedKmh: null,
    etaMinutes: null,
  },
  factors,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const windDir = Number(body.windDir);
  const windSpeed = Number(body.windSpeed);
  const minuteRain = Array.isArray(body.minuteRain) ? body.minuteRain.map(Number).filter(Number.isFinite).slice(0, 4) : [];
  const minuteProb = Array.isArray(body.minuteProb) ? body.minuteProb.map(Number).filter(Number.isFinite).slice(0, 4) : [];
  const suppliedLocation = String(body.locationLabel || '').replace(/[<>]/g, '').trim().slice(0, 80);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Missing lat/lon' });

  const cacheKey = `${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.round((windDir || 0) / 45)}:${Math.round((windSpeed || 0) / 5)}:${suppliedLocation}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RESULT_CACHE_MS) {
    res.setHeader?.('X-Nowcast-Cache', 'HIT');
    return res.status(200).json(cached.payload);
  }

  try {
    const [rvDataRes, targetDistrict] = await Promise.all([
      abortableFetch('https://api.rainviewer.com/public/weather-maps.json'),
      suppliedLocation ? Promise.resolve(suppliedLocation) : getLocationName(lat, lon),
    ]);
    if (!rvDataRes.ok) throw new Error(`RainViewer ${rvDataRes.status}`);
    const rvData = await rvDataRes.json();

    const host = rvData.host || 'https://tilecache.rainviewer.com';
    const pastFrames = (rvData.radar?.past || []).slice(-6).map((frame) => ({ ...frame, type: 'past' }));
    // RainViewer public API discontinued future nowcast frames in 2026.
    // Keep optional support if a compatible provider exposes them, but derive motion from observed frames.
    const nowcastFrames = (rvData.radar?.nowcast || []).slice(0, 3).map((frame) => ({ ...frame, type: 'nowcast' }));
    const frames = [...pastFrames, ...nowcastFrames].filter((frame) => frame.time || frame.path);
    if (!frames.length) throw new Error('No RainViewer frames');

    const n = Math.pow(2, RADAR_ZOOM);
    const x = ((lon + 180) / 360) * n;
    const latRad = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    const centerAbsX = x * TILE_SIZE;
    const centerAbsY = y * TILE_SIZE;
    const kmPerPixel = metersPerPixel(lat, RADAR_ZOOM) / 1000;
    const radiusPx = Math.ceil(SCAN_RADIUS_KM / kmPerPixel);
    const centerRadiusPx = Math.max(2, Math.ceil(CENTER_RADIUS_KM / kmPerPixel));

    const minAbsX = Math.floor(centerAbsX - radiusPx);
    const maxAbsX = Math.floor(centerAbsX + radiusPx);
    const minAbsY = Math.floor(centerAbsY - radiusPx);
    const maxAbsY = Math.floor(centerAbsY + radiusPx);
    const minTileX = Math.floor(minAbsX / TILE_SIZE);
    const maxTileX = Math.floor(maxAbsX / TILE_SIZE);
    const minTileY = Math.floor(minAbsY / TILE_SIZE);
    const maxTileY = Math.floor(maxAbsY / TILE_SIZE);

    const analyses = [];
    for (const frame of frames) {
      const tiles = await loadFrameTiles({ host, frame, minTileX, maxTileX, minTileY, maxTileY });
      if (Object.keys(tiles).length === 0) continue;
      analyses.push(scanFrame({ frame, tiles, centerAbsX, centerAbsY, radiusPx, centerRadiusPx, kmPerPixel }));
    }

    const latest = [...analyses].reverse().find((item) => item.type === 'past') || analyses[analyses.length - 1];
    if (!latest) throw new Error('Radar tiles unavailable');

    const futureHit = analyses
      .filter((item) => item.type === 'nowcast' && (item.centerLevel > 0 || (item.nearestDistKm !== null && item.nearestDistKm <= 18)))
      .sort((a, b) => a.time - b.time)[0] || null;
    const motion = computeMotion(analyses, kmPerPixel);
    const trend = computeTrend(analyses);
    const stormDx = Number.isFinite(latest.nearestDistKm) ? latest.nearestDx : (latest.centroidDx || 0);
    const stormDy = Number.isFinite(latest.nearestDistKm) ? latest.nearestDy : (latest.centroidDy || 0);
    const stormDistanceKm = Number.isFinite(latest.nearestDistKm)
      ? latest.nearestDistKm
      : Math.round(Math.sqrt(stormDx * stormDx + stormDy * stormDy) * kmPerPixel);
    const stormBearing = Number.isFinite(latest.nearestDistKm) ? bearingFromPixelVector(stormDx, stormDy) : null;
    const windSupport = computeWindSupport({ windDir, windSpeed, stormDx, stormDy, distanceKm: stormDistanceKm });
    const intensity = rainLevelInfo(Math.max(latest.maxLevel, futureHit?.maxLevel || 0));
    const centerIntensity = rainLevelInfo(Math.max(latest.centerLevel, futureHit?.centerLevel || 0));

    const radarMotionReliable = motion && motion.speedKmh >= 3;
    const windMotionReliable = !radarMotionReliable && windSupport?.supportsApproach;
    const approachEta = radarMotionReliable ? motion.etaMinutes : (windMotionReliable ? windSupport.etaMinutes : null);
    const isApproaching = (radarMotionReliable && (motion?.approachSpeedKmh || 0) >= 5) || windMotionReliable;
    const heavyNearby = latest.nearestDistKm !== null && latest.nearestDistKm <= 28 && latest.nearestLevel >= 3;

    let alertLevel = 0;
    if (latest.centerLevel >= 4 || futureHit?.centerLevel >= 4) alertLevel = 4;
    else if (latest.centerLevel > 0 || futureHit?.centerLevel > 0) alertLevel = Math.max(2, Math.min(3, Math.max(latest.centerLevel, futureHit?.centerLevel)));
    else if (approachEta !== null && approachEta <= 30 && latest.nearestLevel >= 2) alertLevel = latest.nearestLevel >= 4 ? 4 : 3;
    else if (approachEta !== null && approachEta <= 90 && latest.nearestLevel >= 2) alertLevel = 2;
    else if (heavyNearby || (latest.heavyCoveragePct >= 1 && latest.nearestDistKm !== null && latest.nearestDistKm <= 25)) alertLevel = 1;
    else if (latest.nearestDistKm !== null || latest.coveragePct >= 1) alertLevel = 1;

    const timeStr = new Date((latest.time || Date.now() / 1000) * 1000).toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetName = targetDistrict || 'พิกัดนี้';
    const directionText = stormBearing === null ? '-' : getWindDirectionText(stormBearing);
    const motionText = radarMotionReliable
      ? `กลุ่มฝนเคลื่อนไปทาง${motion.directionText} ${motion.speedKmh} กม./ชม.`
      : windMotionReliable
        ? `ใช้ลมประกอบ: พัดไปทาง${windSupport?.windToText || '-'} ${Math.round(windSpeed || 0)} กม./ชม.`
        : `ลมอ่อน ${Math.round(windSpeed || 0)} กม./ชม. จึงยังใช้เป็นตัวพาฝนได้จำกัด`;
    const etaText = approachEta !== null && approachEta <= 90 ? `คาดถึงในราว ${approachEta} นาที` : 'ยังไม่ควรตีความว่าเข้าถึงพื้นที่เร็ว';
    const confidence = Math.max(35, Math.min(96,
      50
      + (analyses.length >= 4 ? 12 : 0)
      + (motion ? 16 : 0)
      + (windSupport?.supportsApproach ? 8 : 0)
      + (latest.maxLevel >= 3 ? 8 : 0)
      - (latest.rainPixels < 8 ? 12 : 0),
    ));

    const modelRain60 = Math.round(minuteRain.reduce((sum, value) => sum + Math.max(0, value || 0), 0) * 10) / 10;
    const modelProb60 = minuteProb.length ? Math.max(...minuteProb) : 0;
    const radarRateAtTarget = latest.centerRateMmh > 0
      ? latest.centerRateMmh
      : futureHit?.centerRateMmh > 0
        ? futureHit.centerRateMmh
        : (isApproaching && approachEta !== null && approachEta <= 60 ? latest.maxRateMmh * 0.55 : 0);
    const radarRain60 = Math.round(Math.max(0, radarRateAtTarget) * 10) / 10;
    const estimatedRain60 = radarRain60 > 0 && modelRain60 > 0
      ? Math.round((radarRain60 * 0.55 + modelRain60 * 0.45) * 10) / 10
      : Math.round(Math.max(radarRain60, modelRain60) * 10) / 10;
    const uncertainty = confidence >= 80 ? [0.7, 1.35] : confidence >= 60 ? [0.55, 1.55] : [0.4, 1.8];
    const rainRangeMm = estimatedRain60 > 0
      ? [Math.round(estimatedRain60 * uncertainty[0] * 10) / 10, Math.round(estimatedRain60 * uncertainty[1] * 10) / 10]
      : [0, modelProb60 >= 40 ? 0.5 : 0];

    const factors = [
      { label: 'สีเรดาร์', value: intensity.desc, detail: intensity.label, tone: intensity.color },
      { label: 'ระยะฝนใกล้สุด', value: latest.nearestDistKm !== null ? `${latest.nearestDistKm} กม.` : 'ไม่พบ', detail: directionText, tone: latest.nearestLevel >= 3 ? '#ef4444' : '#2563eb' },
      { label: 'การเคลื่อนที่', value: radarMotionReliable ? `${motion.speedKmh} กม./ชม.` : `${Math.round(windSpeed || 0)} กม./ชม.`, detail: radarMotionReliable ? `ไปทาง${motion.directionText}` : (windMotionReliable ? `ลมไปทาง${windSupport?.windToText || '-'}` : 'ลมอ่อน/ยังไม่ชัด'), tone: isApproaching ? '#f59e0b' : '#64748b' },
      { label: 'พื้นที่ฝนในรัศมี', value: `${latest.coveragePct}%`, detail: `หนัก ${latest.heavyCoveragePct}%`, tone: latest.heavyCoveragePct > 0 ? '#ef4444' : '#0ea5e9' },
      { label: 'ฝน 60 นาที', value: estimatedRain60 > 0 ? `≈ ${estimatedRain60} มม.` : modelProb60 >= 30 ? `โอกาส ${Math.round(modelProb60)}%` : 'ยังไม่พบฝน', detail: estimatedRain60 > 0 ? `ช่วง ${rainRangeMm[0]}–${rainRangeMm[1]} มม.` : trend.label, tone: estimatedRain60 >= 10 ? '#ef4444' : estimatedRain60 > 0 ? '#2563eb' : '#0ea5e9' },
      { label: 'ความมั่นใจ', value: `${confidence}%`, detail: `${analyses.length} เฟรม`, tone: confidence >= 75 ? '#16a34a' : '#f59e0b' },
    ];

    let resultData = makeClearResult({ timeStr, targetDistrict: targetName, scanRadiusKm: SCAN_RADIUS_KM, factors });
    resultData = {
      ...resultData,
      radarTime: timeStr,
      alertLevel,
      confidence,
      diagnostics: {
        framesAnalyzed: analyses.length,
        scanRadiusKm: SCAN_RADIUS_KM,
        centerLevel: latest.centerLevel,
        maxLevel: latest.maxLevel,
        intensity: intensity.desc,
        centerIntensity: centerIntensity.desc,
        nearestKm: latest.nearestDistKm,
        nearestDirection: directionText,
        coveragePct: latest.coveragePct,
        heavyCoveragePct: latest.heavyCoveragePct,
        stormMotionKmh: motion?.speedKmh || null,
        stormMotionDirection: motion?.directionText || null,
        approachSpeedKmh: radarMotionReliable ? motion?.approachSpeedKmh : (windMotionReliable ? windSupport?.approachSpeedKmh : null),
        etaMinutes: approachEta !== null && approachEta <= 120 ? approachEta : null,
        windMoveDirection: windSupport?.windToText || null,
        windSupportsApproach: windSupport?.supportsApproach || false,
        futureHitMinutes: futureHit ? Math.max(0, Math.round((futureHit.time - latest.time) / 60)) : null,
      },
      factors,
      nowcast: {
        rainRateMmh: Math.round(radarRateAtTarget * 10) / 10,
        rainNext60MinMm: estimatedRain60,
        rainRangeMm,
        probability60: Math.round(modelProb60),
        trend: trend.id,
        trendLabel: trend.label,
        trendChangePct: trend.changePct,
        direction: radarMotionReliable ? motion?.directionText : windSupport?.windToText || null,
        speedKmh: radarMotionReliable ? motion?.speedKmh : windSupport?.approachSpeedKmh || null,
        etaMinutes: approachEta !== null && approachEta <= 120 ? approachEta : null,
        method: 'radar-extrapolation-plus-15min-forecast',
      },
    };

    if (alertLevel >= 3) {
      resultData.cardColor = 'red';
      resultData.cardIcon = alertLevel >= 4 ? '🚨' : '⛈️';
      resultData.cardTag = 'เตือนด่วน';
      resultData.cardTitle = latest.centerLevel > 0 || futureHit?.centerLevel > 0
        ? `${centerIntensity.desc}กำลังปกคลุมพื้นที่`
        : 'กลุ่มฝนกำลังพัดเข้าใกล้มาก';
      resultData.cardDesc = latest.centerLevel > 0 || futureHit?.centerLevel > 0
        ? `เรดาร์พบ${centerIntensity.desc}บริเวณ ${targetName} โดยตรง สีเรดาร์ระดับ${centerIntensity.label} ควรเลี่ยงออกกลางแจ้งทันที`
        : `พบ${intensity.desc}ห่าง ${latest.nearestDistKm} กม. ทางทิศ${directionText} ${motionText} และ${etaText}`;
    } else if (alertLevel === 2) {
      resultData.cardColor = 'yellow';
      resultData.cardIcon = '☔';
      resultData.cardTag = 'เฝ้าระวังใกล้';
      resultData.cardTitle = 'ฝนมีแนวโน้มเข้าใกล้พื้นที่';
      resultData.cardDesc = `พบกลุ่ม${intensity.desc}ห่าง ${latest.nearestDistKm ?? '-'} กม. ทางทิศ${directionText} ${motionText} ${etaText}`;
    } else if (alertLevel === 1) {
      resultData.cardColor = 'green';
      resultData.cardIcon = '👀';
      resultData.cardTag = 'จับตา';
      resultData.cardTitle = 'พบเมฆฝนในรัศมีเฝ้าระวัง';
      resultData.cardDesc = `พบกลุ่ม${intensity.desc}ในรัศมี ${SCAN_RADIUS_KM} กม. ใกล้สุด ${latest.nearestDistKm ?? '-'} กม. ทางทิศ${directionText} แต่เวลาถึงโดยประมาณยังเกิน 90 นาทีหรือทิศทางยังไม่ชัด จึงให้เป็นเพียงการจับตา`;
    }

    resultCache.set(cacheKey, { at: Date.now(), payload: resultData });
    if (resultCache.size > 80) {
      const oldest = [...resultCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 20);
      oldest.forEach(([key]) => resultCache.delete(key));
    }
    res.setHeader?.('X-Nowcast-Cache', 'MISS');
    return res.status(200).json(resultData);
  } catch (error) {
    const fallbackTime = new Date().toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
    });
    return res.status(200).json(makeClearResult({
      timeStr: fallbackTime,
      targetDistrict: 'พิกัดนี้',
      scanRadiusKm: SCAN_RADIUS_KM,
      unavailable: true,
      factors: [{ label: 'เรดาร์', value: 'โหลดไม่สำเร็จ', detail: error.message || 'RainViewer', tone: '#f59e0b' }],
    }));
  }
}
