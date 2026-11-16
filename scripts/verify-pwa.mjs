import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { preview } from 'vite';

// Run after npm run build. Exercise the installed service worker against real
// model responses, then drop connectivity; cached values must stay labelled.
const server = await preview({ preview: { host: '127.0.0.1', port: 5192, strictPort: true } });
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/api/')) {
      return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'unavailable', weather: { status: 'unavailable' }, air: { status: 'unavailable' } }) });
    }
    return request.continue();
  });
  await page.goto('http://127.0.0.1:5192/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.wx-temperature', { timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.wx-temperature', { timeout: 30000 });
  assert.ok(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
  const temperature = await page.$eval('.wx-temperature', el => el.textContent);
  await page.setOfflineMode(true);
  await page.click('[aria-label="อัปเดตข้อมูลอากาศ"]');
  await page.waitForFunction(() => document.querySelector('.wx-status')?.textContent.includes('ข้อมูลเดิม'), { timeout: 25000 });
  assert.equal(await page.$eval('.wx-temperature', el => el.textContent), temperature);
  assert.equal(await page.$eval('.wx-temperature .risk-value', el => el.dataset.risk), 'unknown');
  assert.equal(await page.$eval('.wx-air-value .risk-value', el => el.dataset.risk), 'unknown');
  console.log('PASS Installed PWA keeps same-location readings explicitly stale and grey after connectivity loss');
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
