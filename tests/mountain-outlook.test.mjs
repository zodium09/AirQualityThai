import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMountainOutlook, MOUNTAIN_REGIONS, parseMountainBulletin } from '../src/server/mountainOutlook.js';

const now = Date.parse('2026-11-16T12:00:00+07:00');
const rss = (description, issued = 'Mon, 16 Nov 2026 06:00:00 +0700', extra = '') => `<rss><channel><item><description><![CDATA[${description}]]></description>${issued ? `<pubDate>${issued}</pubDate>` : ''}${extra}</item></channel></rss>`;

test('mountain bulletin keeps the actual regional excerpt and source issue date', () => {
  const bulletin = parseMountainBulletin(rss('อุณหภูมิต่ำสุด 18-23 องศาเซลเซียส<br>บริเวณยอดดอยอากาศหนาว อุณหภูมิต่ำสุด 10-15 องศาเซลเซียส<br>ลมตะวันออกเฉียงเหนือ 10-20 กม./ชม.'), MOUNTAIN_REGIONS[0], now);
  assert.equal(bulletin.region, 'ภาคเหนือ');
  assert.equal(bulletin.text, 'บริเวณยอดดอยอากาศหนาว อุณหภูมิต่ำสุด 10-15 องศาเซลเซียส');
  assert.doesNotMatch(bulletin.text, /18-23|ลมตะวัน/);
  assert.equal(bulletin.issuedAt, '2026-11-15T23:00:00.000Z');
  assert.equal(bulletin.stale, false);
  assert.equal(bulletin.validFrom, null);
  assert.equal(bulletin.validTo, null);
  assert.equal(bulletin.temperatureMin, undefined);
});

test('a scrape date never supplies the unknown issue date or relative valid period', () => {
  const xml = rss('06:00 วันนี้ ถึง 06:00 วันพรุ่งนี้ บริเวณยอดภูอากาศเย็นถึงหนาว อุณหภูมิต่ำสุด 11-17 องศาเซลเซียส', null);
  const bulletin = parseMountainBulletin(xml, MOUNTAIN_REGIONS[1], now);
  assert.equal(bulletin.issuedAt, null);
  assert.equal(bulletin.validFrom, null);
  assert.equal(bulletin.validTo, null);
  assert.equal(bulletin.unavailable, true);
  assert.equal(bulletin.stale, true);
});

test('explicit zoned valid period is preserved and expiry marks the bulletin stale', () => {
  const xml = rss('ยอดดอยอากาศหนาว', 'Mon, 16 Nov 2026 06:00:00 +0700', '<validFrom>2026-11-16T06:00:00+07:00</validFrom><validTo>2026-11-17T06:00:00+07:00</validTo>');
  const current = parseMountainBulletin(xml, MOUNTAIN_REGIONS[0], now);
  assert.equal(current.validFrom, '2026-11-15T23:00:00.000Z');
  assert.equal(current.validTo, '2026-11-16T23:00:00.000Z');
  assert.equal(current.stale, false);
  assert.equal(parseMountainBulletin(xml, MOUNTAIN_REGIONS[0], now + 86400000).stale, true);
});

test('wrong region text, old or future publications do not become current bulletins', () => {
  assert.equal(parseMountainBulletin(rss('ยอดภูอากาศเย็น'), MOUNTAIN_REGIONS[0], now).unavailable, true);
  assert.equal(parseMountainBulletin(rss('ยอดดอยอากาศหนาว', 'Sat, 14 Nov 2026 06:00:00 +0700'), MOUNTAIN_REGIONS[0], now).stale, true);
  assert.equal(parseMountainBulletin(rss('ยอดดอยอากาศหนาว', 'Tue, 17 Nov 2026 06:00:00 +0700'), MOUNTAIN_REGIONS[0], now).stale, true);
});

test('one unavailable region cannot shift or replace the other regional bulletin', async () => {
  const data = await fetchMountainOutlook(async url => {
    if (url.endsWith('=1')) throw new Error('timeout');
    return { ok: true, text: async () => rss('ยอดภูอากาศเย็นถึงหนาว อุณหภูมิต่ำสุด 11-17 องศาเซลเซียส') };
  }, now);
  assert.equal(data.regions[0].region, 'ภาคเหนือ');
  assert.equal(data.regions[0].unavailable, true);
  assert.equal(data.regions[1].region, 'ภาคอีสาน');
  assert.equal(data.regions[1].unavailable, false);
  assert.equal(data.partial, true);
  assert.equal(data.unavailable, false);
  assert.equal(data.sourceUrl, 'https://www.tmd.go.th/forecast/daily');
});
