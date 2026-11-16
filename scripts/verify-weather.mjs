import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import { provinces77 } from '../src/provinces77.js';
import { forecastUrls } from '../src/utils/weatherData.js';

const out = 'artifacts/review';
fs.mkdirSync(out, { recursive: true });
const report = { fixtures: 'Synthetic controlled data for UI and failure-state testing; never shipped', checks: [], live: [] };
const record = name => { report.checks.push(name); console.log(`PASS ${name}`); };
const local = date => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
const today = local(new Date()).slice(0, 10);
const start = new Date(`${today}T00:00:00+07:00`).getTime();
const times = Array.from({ length: 168 }, (_, i) => local(new Date(start + i * 3600000)));
const dates = Array.from({ length: 7 }, (_, i) => local(new Date(start + i * 86400000)).slice(0, 10));
function weatherFixture(lat, elevation) {
  const isNorth = lat > 17; const isMountain = Number(elevation) > 1000;
  const hourly = { time: times, precipitation: times.map((_, i) => i % 4 === 0 ? 2 : 0), wind_gusts_10m: times.map(() => 45), temperature_2m: times.map((_, i) => (isNorth ? 25 : 29) + Math.round(Math.sin(i / 4) * 3)), precipitation_probability: times.map((_, i) => [10, 15, 25, 40, 65, 80, 45, 20][i % 8]), weather_code: times.map((_, i) => i % 8 > 3 ? 61 : 2), is_day: times.map(t => Number(t.slice(11, 13)) > 5 && Number(t.slice(11, 13)) < 18 ? 1 : 0), uv_index: times.map(() => 4.2), visibility: times.map(() => 18000) };
  const daily = { time: dates, weather_code: [2, 61, 3, 2, 61, 61, 0], temperature_2m_max: [40, 31, 32, 34, 30, 31, 33], temperature_2m_min: [8, 24, 25, 26, 24, 25, 25], precipitation_probability_max: [65, 80, 20, 15, 70, 60, 10], precipitation_sum: [1.2, 4, 0, 0, 8, 3, 0], sunrise: dates.map(d => `${d}T06:15`), sunset: dates.map(d => `${d}T17:50`) };
  return { current: { time: local(new Date()), temperature_2m: isMountain ? 6 : isNorth ? 25 : 31, apparent_temperature: 34, relative_humidity_2m: 68, surface_pressure: 1008, wind_gusts_10m: 45, wind_speed_10m: 12, wind_direction_10m: 135, is_day: 1, weather_code: 2, precipitation: 0, rain: 0 }, hourly, daily };
}
const airTimes = Array.from({ length: 168 }, (_, i) => local(new Date(start - 86400000 + i * 3600000)));
const airFixture = { current: { time: local(new Date()), pm2_5: 18.4 }, hourly: { time: airTimes, pm2_5: airTimes.map(() => 18.4) } };
const national = { schemaVersion: 3, stations: provinces77.map((p, i) => ({ stationID: `PROV_${i}`, areaTH: p.n, lat: p.lat, long: p.lon, pm25Average24h: i === 2 ? null : i === 0 ? 0 : 18 + i % 30, pm25ValidHours24h: 24, pm25Time: local(new Date()), weatherTime: local(new Date()), AQILast: { PM25: { value: i === 2 ? null : i === 0 ? 0 : 18 + i % 30 } } })), stationTemps: Object.fromEntries(provinces77.map((_, i) => [`PROV_${i}`, { temp: i === 2 ? null : 29 + i % 8, tempMin: 12 + i % 12, tempMax: 32 + i % 12, rainMm: i === 2 ? null : i % 20, rainDate: today, tempDate: today, rainPeriod: 'calendar-day', weatherTime: local(new Date()), windGust: 45, rainProb: i % 100, windSpeed: 10 }])), lastUpdated: new Date().toISOString(), source: 'open-meteo-model', stale: false };
const history = { daily: Array.from({ length: 365 }, (_, i) => ({ date: new Date(start - (365-i) * 86400000).toISOString().slice(0, 10), rain: i === 364 ? null : i % 10, tempMin: 10 + i % 6, pm25ValidHours: i > 300 ? 24 : 0, tempMax: 29 + i % 5, heatMax: 34 + i % 4, pm25: i > 300 ? 22 : null })) };
const observations = { weather: { status: 'available', station: { name: 'สถานีทดสอบอากาศ', distanceKm: 2.4 }, observedAt: new Date().toISOString(), temperature: 26, tempMin: 16, tempMax: 35, rainMm: 42, stale: false, source: 'TMD fixture', sourceUrl: 'https://data.tmd.go.th/', averagingWindow: { hours: 24, label: 'ย้อนหลัง 24 ชั่วโมง' } }, air: { status: 'available', station: { name: 'สถานีทดสอบฝุ่น', distanceKm: 3.2 }, observedAt: new Date().toISOString(), pm25: 80, stale: false, source: 'PCD fixture', sourceUrl: 'https://air4thai.pcd.go.th/', averagingWindow: { hours: 24, label: 'เฉลี่ย 24 ชั่วโมง' } } };
const server = await createServer({ server: { host: '127.0.0.1', port: 5191, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const capture = options => process.env.SKIP_SCREENSHOTS ? Promise.resolve() : page.screenshot(options);
  const failures = [];
  page.on('pageerror', e => { failures.push(e.message); console.log(`PAGE ERROR ${e.message}`); });
  await page.emulateTimezone('America/Los_Angeles');
  let mode = 'normal';
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    const json = data => request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
    if (url.hostname === 'api.open-meteo.com') return mode === 'offline' ? request.abort('failed') : json(weatherFixture(Number(url.searchParams.get('latitude')), url.searchParams.get('elevation')));
    if (url.hostname === 'air-quality-api.open-meteo.com') return mode === 'offline' || mode === 'air-missing' ? request.abort('failed') : json(mode === 'air-stale' ? { ...airFixture, current: { ...airFixture.current, time: local(new Date(Date.now() - 3 * 3600000)) } } : airFixture);
    if (url.pathname === '/api/weather-data') return json(national);
    if (url.pathname === '/api/statistics') return mode === 'stats-offline' ? request.abort('failed') : json(history);
    if (url.pathname === '/api/news') return json({ schemaVersion: 3, generatedAt: new Date().toISOString(), events: [], thailand: { storms: [{ title: 'ฝนตกหนักภาคใต้ · ตัวอย่างทดสอบ', summary: 'ประกาศสำหรับทดสอบตัวกรอง', source: 'TMD', category: 'warning', severity: 'high', issuedAt: new Date(Date.now() - 3600000).toISOString(), url: 'https://www.tmd.go.th/warning-and-events/warning-storm' }] }, sourceStatus: [{ source: 'TMD fixture', status: 'ok', count: 1 }] });
    if (url.pathname === '/api/observations') return json(observations);
    if (url.pathname === '/api/mountain-outlook') return json({ unavailable: true, regions: [] });
    if (url.pathname === '/api/enso') return json({ fallback: true });
    if (url.pathname === '/api/radar') return json({ unavailable: true, radarTime: null });
    if (url.hostname.includes('windy.com')) return request.respond({ status: 200, contentType: 'text/html', body: '<p>Radar embed omitted in controlled test</p>' });
    request.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5191', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.wx-temperature');
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.$eval('.wx-temperature', el => el.textContent), /31/);
  assert.equal(await page.$$eval('iframe', els => els.length), 0);
  record('Dashboard loads, real controls rendered, radar deferred');
  await page.waitForSelector('.station-pm[data-risk="danger"]');
  assert.ok(await page.$('.wx-extremes .risk-danger'));
  assert.ok(await page.$('.wx-extremes .risk-cool'));
  assert.match(await page.$eval('.wx-brief', el => el.textContent), /มม./);
  assert.equal(await page.$eval('.wx-segment button:first-child', el => el.getAttribute('aria-pressed')), 'true');
  assert.match(await page.$eval('.wx-air-value', el => el.textContent), /18.4/);
  record('Rainfall millimetres, temperature extremes and full 24-hour PM use period-aware colors');
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    function rgb(color) { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); }
    function luminance(color) { const a = rgb(color).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return a[0] * .2126 + a[1] * .7152 + a[2] * .0722; }
    const result = [];
    for (const dark of [false, true]) { document.body.classList.toggle('dark-theme', dark);
      for (const hero of [false, true]) { const host = document.createElement('div'); host.className = hero ? 'wx-current' : 'wx-panel'; document.body.append(host);
        const bg = hero && !dark ? '#cceaff' : getComputedStyle(host).backgroundColor;
        for (const tone of ['unknown','info','low','cool','watch','high','danger','extreme']) { const probe = document.createElement('span'); probe.className = 'risk-value risk-' + tone; host.append(probe); const fg = getComputedStyle(probe).color, a = luminance(fg), b = luminance(bg); result.push({ dark, hero, tone, ratio: (Math.max(a,b)+.05)/(Math.min(a,b)+.05) }); }
        host.remove();
      }
    }
    document.body.classList.remove('dark-theme'); return result;
  });
  assert.ok(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast.filter(item => item.ratio < 4.5)));
  report.contrast = contrast;
  record('All eight semantic foreground colors pass 4.5:1 on light/dark panels and sky hero');
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture({ path: `${out}/desktop.png`, fullPage: true });
  await capture({ path: `${out}/desktop-first.png` });
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForSelector('.wx-temperature');
  await page.click('.mobile-nav__theme');
  assert.ok(await page.evaluate(() => document.body.classList.contains('dark-theme')));
  await page.click('.mobile-nav__theme');
  assert.ok(await page.evaluate(() => !document.body.classList.contains('dark-theme')));
  record('Mobile theme control is reachable and switches both ways');
  await capture({ path: `${out}/mobile.png`, fullPage: true });
  await capture({ path: `${out}/mobile-first.png` });
  await page.evaluate(() => document.body.classList.add('dark-theme'));
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
  await capture({ path: `${out}/mobile-dark.png`, fullPage: true });
  await page.evaluate(() => document.body.classList.remove('dark-theme'));
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewport({ width, height: 900 });
    await page.waitForSelector('.wx-temperature');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `overflow ${width}`);
  }
  record('Dashboard has no document overflow at 320, 390, 768, 1280, 1440px');
  await page.click('.wx-segment button:last-child');
  assert.equal(await page.$eval('.wx-segment button:last-child', el => el.getAttribute('aria-pressed')), 'true');
  await page.click('.wx-place-button');
  await page.select('.wx-location-controls select', 'เชียงใหม่');
  await page.waitForFunction(() => document.querySelector('.wx-temperature')?.textContent.includes('25'));
  record('Province switch changes requested location and displayed weather');
  await page.click('.wx-place-button');
  await page.click('.wx-place-button');
  await page.select('.wx-mountain-select select', 'doi-inthanon-summit');
  await page.waitForFunction(() => document.querySelector('.wx-temperature')?.textContent.includes('6'));
  assert.ok(await page.$('.wx-temperature .risk-extreme'));
  assert.match(await page.$eval('.wx-place-note', el => el.textContent), /2,565/);
  await capture({ path: out + '/mountain.png', fullPage: true });
  record('Mountain selection requests verified altitude and cold extremes use the cold scale');
  await page.click('.wx-place-button');
  await page.select('.wx-location-controls select', 'เชียงใหม่');
  await page.waitForFunction(() => document.querySelector('.wx-temperature')?.textContent.includes('25'));
  await page.click('.wx-place-button');
  mode = 'air-stale';
  await page.click('[aria-label="อัปเดตข้อมูลอากาศ"]');
  await page.waitForSelector('.wx-air-value .risk-unknown');
  assert.ok(await page.$('.wx-temperature .risk-low'));
  record('Stale air is grey independently of fresh weather');
  mode = 'air-missing';
  await page.click('[aria-label="อัปเดตข้อมูลอากาศ"]');
  await page.waitForFunction(() => document.querySelector('.wx-air-value')?.textContent.includes('—'));
  record('Missing PM remains missing while weather stays available');
  mode = 'offline';
  await page.click('[aria-label="อัปเดตข้อมูลอากาศ"]');
  await page.waitForFunction(() => document.body.innerText.includes('กำลังแสดงข้อมูลเดิม'));
  assert.match(await page.$eval('.wx-status', el => el.textContent), /ข้อมูลเดิม/);
  assert.ok(await page.$('.wx-air-value .risk-unknown'));
  record('Refresh failure keeps same-location data with stale notice');
  await page.click('.wx-place-button');
  await page.select('.wx-location-controls select', 'ภูเก็ต');
  await page.waitForSelector('.wx-unavailable .wx-button');
  assert.equal(await page.$('.wx-temperature'), null);
  record('New-location failure never shows previous city weather');
  await capture({ path: `${out}/unavailable.png`, fullPage: true });
  mode = 'normal';
  await page.goto('http://127.0.0.1:5191/map?monitor=1', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.province-row');
  await page.click('[data-metric="pm25"]');
  assert.match(await page.$eval('.map-data-status', el => el.textContent), /76 \/ 77/);
  await capture({ path: `${out}/map-desktop.png`, fullPage: true });
  await page.type('input[type="search"]', 'กรุงเทพ');
  assert.equal(await page.$$eval('.province-row', els => els.length), 1);
  assert.match(await page.$eval('.province-row__value', el => el.textContent), /0/);
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: `${process.cwd()}/artifacts/review` });
  await page.click('.map-monitor-actions button:nth-child(2)');
  record('Monitor search, coverage and legitimate zero pollution work');
  await page.setViewport({ width: 390, height: 844 });
  await capture({ path: `${out}/map-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.goto('http://127.0.0.1:5191/stats', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.stats-kpis');
  assert.match(await page.$eval('.stat-kpi', el => el.textContent), /29 วันที่มีข้อมูล/);
  record('Statistics exclude missing samples instead of averaging zero');
  await page.click('.metric-tabs button:nth-child(2)');
  assert.equal(await page.$eval('.metric-tabs button:nth-child(2)', el => el.getAttribute('aria-pressed')), 'true');
  await page.waitForFunction(() => document.querySelector('.stat-kpi')?.textContent.includes('อุณหภูมิต่ำสุด'));
  await page.click('.stats-daily-details summary');
  assert.ok(await page.$('.stats-data-table tbody .risk-cool'));
  record('Minimum temperature statistics and per-day coverage table work');
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture({ path: `${out}/stats-mobile.png`, fullPage: true });
  mode = 'stats-offline';
  await page.select('.stats-province select', 'เชียงใหม่');
  await page.waitForSelector('.empty-state button');
  mode = 'normal';
  await page.click('.empty-state button');
  await page.waitForSelector('.stats-kpis');
  record('Statistics connection failure has a working retry and selected controls expose state');
  await page.goto('http://127.0.0.1:5191/news', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.priority-alert');
  for (const button of [2, 3]) {
    await page.click(`.filter-row button:nth-child(${button})`);
    assert.match(await page.$eval('.priority-alert h2', el => el.textContent), /ฝนตกหนักภาคใต้/);
    assert.equal(await page.$eval(`.filter-row button:nth-child(${button})`, el => el.getAttribute('aria-pressed')), 'true');
  }
  record('Official heavy-rain bulletin appears in both warning and rain filters');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  record('News route loads on mobile without overflow');
  assert.deepEqual(failures, []);
  record('No React/browser runtime errors across all four routes');
  await page.close();
  for (const url of forecastUrls(13.7563, 100.5018)) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(15000) }); const data = await response.json(); report.live.push({ provider: new URL(url).hostname, status: response.status, time: data.current?.time, error: data.reason }); }
    catch(e) { report.live.push({ provider: new URL(url).hostname, error: e.message }); }
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.live));
} finally { await browser.close(); await server.close(); }
