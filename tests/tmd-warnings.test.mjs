import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTmdWarnings, parseTmdWarningDetail, tmdWarningLinks } from '../src/server/tmdWarnings.js';
import { isRecentNews, normalizeNewsDisplayItem } from '../src/server/newsIntegrity.js';

const now = Date.parse('2026-11-16T11:00:00+07:00');
const title = 'ฝนตกหนักถึงหนักมากบริเวณภาคใต้ (มีผลกระทบในช่วงวันที่ 18-22 พฤศจิกายน 2569) ฉบับที่ 3 (311/2569)';
const card = { title, summary: 'ระวังอันตรายจากฝนตกหนักมากและน้ำท่วมฉับพลัน', url: 'https://www.tmd.go.th/warning-and-events/warning-storm/southern-rain-311-2569' };
const detail = `<h1>${title}</h1><p>ประกาศ ณ วันที่ 16 พฤศจิกายน พ.ศ. 2569 เวลา 05.00 น.</p><p>กรมอุตุนิยมวิทยาจะออกประกาศฉบับต่อไปในวันที่ 16 พฤศจิกายน พ.ศ. 2569 เวลา 17.00 น.</p>`;
const listing = `<div class="link-list"><div class="link-list-title"><a href="${card.url}">${title}</a></div><div class="link-list-description"><a href="${card.url}">${card.summary}</a></div><div>วันที่ข้อมูล: 16 พฤศจิกายน 2569</div></div>`;

test('actual TMD warning card and issue sentence retain the 05:00 source time, not next issue or fetched time', () => {
  assert.deepEqual(tmdWarningLinks(listing), [card]);
  const item = parseTmdWarningDetail(detail, card, now);
  assert.equal(item.publishedAt, '2026-11-15T22:00:00.000Z');
  assert.equal(item.datePrecision, 'minute');
  assert.equal(item.validFrom, '2026-11-17T17:00:00.000Z');
  assert.equal(item.validTo, '2026-11-22T17:00:00.000Z');
  assert.equal(item.severity, 'high');
  assert.equal(normalizeNewsDisplayItem(item).publishedAt, item.publishedAt);
  assert.equal(isRecentNews(item, 48, now), true);
});

test('an official multiday warning remains eligible during its stated period and expires at its end', () => {
  const item = parseTmdWarningDetail(detail, card, now);
  assert.equal(isRecentNews(item, 48, Date.parse('2026-11-20T12:00:00+07:00')), true);
  assert.equal(isRecentNews(item, 48, Date.parse(item.validTo)), false);
  assert.equal(isRecentNews({ ...item, publishedAt: null, issuedAt: null }, 48, now), false);
});

test('unknown issue dates, invalid calendars, future issue times and external detail links are rejected', () => {
  assert.equal(parseTmdWarningDetail(`<h1>${title}</h1><p>วันที่ข้อมูล 16 พฤศจิกายน 2569</p>`, card, now), null);
  assert.equal(parseTmdWarningDetail(detail.replace('วันที่ 16', 'วันที่ 31'), card, now), null);
  assert.equal(parseTmdWarningDetail(detail.replace('เวลา 05.00', 'เวลา 17.00'), card, now), null);
  assert.deepEqual(tmdWarningLinks(listing.replaceAll('https://www.tmd.go.th/', 'https://example.com/')), []);
});

test('warning fetch verifies real details, supports encoded Thai and never invents no-storm assurances', async () => {
  const encoded = listing.replace('ฝ', '&#xE1D;');
  const items = await fetchTmdWarnings(encoded, async () => detail, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].issuedAt, '2026-11-15T22:00:00.000Z');
  assert.deepEqual(await fetchTmdWarnings('<html>ไม่พบข้อมูล</html>', async () => detail, now), []);
  await assert.rejects(fetchTmdWarnings(listing, async () => { throw new Error('offline'); }, now), /verify/);
});

test('successive numbered bulletins for the same warning retain only the latest issue', async () => {
  const olderListing = listing.replaceAll(card.url, card.url + '-older').replaceAll('ฉบับที่ 3', 'ฉบับที่ 2');
  const olderDetail = detail.replaceAll('ฉบับที่ 3', 'ฉบับที่ 2').replace('เวลา 05.00', 'เวลา 04.00');
  assert.equal(tmdWarningLinks(listing + olderListing).length, 2);
  const items = await fetchTmdWarnings(listing + olderListing, async url => url.endsWith('-older') ? olderDetail : detail, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].issuedAt, '2026-11-15T22:00:00.000Z');
  assert.equal(items[0].url, card.url);
});
