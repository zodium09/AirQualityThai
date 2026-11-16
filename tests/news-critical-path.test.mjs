import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/news.js';

test('official warning delivery does not request generative services even when an API key exists', async t => {
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'unused-test-key';
  t.after(() => { if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
  const now = new Date(), bangkok = new Date(now.getTime() + 7 * 3600000);
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const date = `${bangkok.getUTCDate()} ${months[bangkok.getUTCMonth()]} พ.ศ. ${bangkok.getUTCFullYear() + 543}`;
  const time = `${String(bangkok.getUTCHours()).padStart(2, '0')}.${String(bangkok.getUTCMinutes()).padStart(2, '0')}`;
  const title = 'ประกาศเตือนฝนตกหนักบริเวณภาคใต้';
  const detailUrl = 'https://www.tmd.go.th/warning-and-events/warning-storm/test-warning';
  const listing = `<div class="link-list"><div class="link-list-title"><a href="${detailUrl}">${title}</a></div><div class="link-list-description"><a href="${detailUrl}">ระวังอันตรายจากฝนตกหนักมาก</a></div></div>`;
  const detail = `<h1>${title}</h1><p>ประกาศ ณ วันที่ ${date} เวลา ${time} น.</p>`;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(String(url));
    return { ok: true,
      json: async () => ({ daily: { time: [] }, features: [], data: [], events: [] }),
      text: async () => String(url) === detailUrl ? detail : String(url) === 'https://www.tmd.go.th/warning-and-events/warning-storm' ? listing : '<rss></rss>',
    };
  });
  let status, payload;
  const res = { setHeader() {}, status(value) { status = value; return this; }, json(value) { payload = value; return this; } };
  await handler({ method: 'GET', query: { fresh: '1' }, headers: {} }, res);
  assert.equal(status, 200);
  assert.ok(payload.thailand.storms.some(item => item.title === title));
  assert.equal(payload.digest.mode, 'rule-based');
  assert.ok(!requests.some(url => /generativelanguage|aiplatform|googleapis\.com/.test(url)));
});
