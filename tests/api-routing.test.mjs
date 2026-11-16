import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/observations.js';

test('public mountain route shares observations function within the hosting limit', async t => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrite = config.rewrites.find(route => route.source === '/api/mountain-outlook');
  assert.equal(rewrite.destination, '/api/observations?view=mountain');
  assert.ok(fs.readdirSync(new URL('../api/', import.meta.url)).filter(name => name.endsWith('.js')).length <= 12);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    const keyword = url.endsWith('=1') ? 'ยอดดอย' : 'ยอดภู';
    return { ok: true, text: async () => `<rss><channel><item><description>${keyword}อากาศหนาว</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>` };
  });
  let status, payload;
  const headers = {};
  const res = { status(value) { status = value; return this; }, json(value) { payload = value; return this; }, setHeader(name, value) { headers[name] = value; } };
  await handler({ method: 'GET', query: Object.fromEntries(new URL(rewrite.destination, 'http://localhost').searchParams) }, res);
  assert.equal(status, 200);
  assert.equal(payload.regions.length, 2);
  assert.equal(payload.unavailable, false);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(url => url.includes('region-daily-forecast')));
  assert.match(headers['Cache-Control'], /s-maxage=1800/);
});
