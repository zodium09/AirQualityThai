import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnsoOutlook, getEnsoSummary } from '../src/utils/ensoData.js';
import { buildNewsEvents, parseDdpmHtml, parseTmdEqHtml, prioritizeItems } from '../api/news.js';
import { issueTimeOf, isRecentNews, newsTimestamp, normalizeNewsDisplayItem, newsIsRelevant, normalizeSourceStatus, readNewsCache, summarizeNewsFeed } from '../src/server/newsIntegrity.js';

const now = Date.parse('2026-11-16T12:00:00Z');

test('official heavy-rain bulletins retain both their rain topic and warning category', () => {
  const bulletin = { title: 'ฝนตกหนักถึงหนักมากบริเวณภาคใต้', summary: 'ติดตามประกาศฉบับล่าสุด', source: 'TMD', category: 'warning', scope: 'thailand', issuedAt: new Date(Date.now() - 60000).toISOString() };
  const item = normalizeNewsDisplayItem(bulletin);
  assert.equal(item.topic, 'rain');
  assert.equal(item.category, 'warning');
  const [event] = buildNewsEvents([bulletin]);
  assert.equal(normalizeNewsDisplayItem(event).category, 'warning');
});
const datedDiscussion = text => `12 November 2026 ENSO Alert System Status: ${text}`;

test('neutral current conditions never become El Niño from an outlook or IRI mention', () => {
  const data = buildEnsoOutlook(datedDiscussion('Not Active Synopsis: ENSO-neutral conditions are present. El Niño may develop in spring.'), 'El Niño is one possible future scenario.', now);
  assert.deepEqual(data.current, { phase: 'neutral', confirmed: true });
  assert.equal(getEnsoSummary(data, now).title, 'ภาวะเป็นกลาง');
  assert.equal(data.issuedAt, '2026-11-12T00:00:00.000Z');
  assert.notEqual(data.issuedAt, data.fetchedAt);
  assert.equal(data.forecast, undefined);
});

test('Watch is a future signal; a future neutral transition cannot override an Advisory', () => {
  const advisory = buildEnsoOutlook(datedDiscussion('La Niña Advisory / El Niño Watch Synopsis: La Niña continues, with a transition to ENSO-neutral expected in spring.'), '', now);
  assert.equal(advisory.current.phase, 'la-nina');
  assert.equal(getEnsoSummary(advisory, now).title, 'ภาวะลานีญา');
  const watch = buildEnsoOutlook(datedDiscussion('El Niño Watch Synopsis: El Niño is expected during winter.'), '', now);
  assert.equal(watch.current.phase, null);
  assert.equal(watch.fallback, true);
});

test('NOAA heading-based synopsis is separate from alert and discussion text', () => {
  const html = '<p>12 November 2026 ENSO Alert System Status: <a>El Niño Advisory</a></p><h2>Synopsis</h2><p>El Niño continues through January–March 2027 (79% chance).</p><h2>Discussion</h2><p>Older neutral periods are discussed here.</p>';
  const data = buildEnsoOutlook(html, '', now);
  assert.equal(data.alert, 'El Niño Advisory');
  assert.equal(data.current.phase, 'el-nino');
  assert.match(data.outlook.text, /January–March 2027/);
  assert.doesNotMatch(data.outlook.text, /Older neutral/);
});

test('unknown or old ENSO issue date is not refreshed by fetching the page again', () => {
  const unknown = buildEnsoOutlook('ENSO Alert System Status: El Niño Advisory Synopsis: El Niño continues.', '', now);
  assert.equal(unknown.issuedAt, null);
  assert.equal(unknown.current.confirmed, false);
  assert.equal(getEnsoSummary(unknown, now).tone, 'pending');
  const old = buildEnsoOutlook('1 September 2026 ENSO Alert System Status: El Niño Advisory Synopsis: El Niño continues.', '', now);
  assert.equal(old.stale, true);
  assert.equal(getEnsoSummary(old, now).tone, 'pending');
  const final = buildEnsoOutlook(datedDiscussion('Final El Niño Advisory Synopsis: Conditions are changing.'), '', now);
  assert.equal(final.current.phase, null);
});

test('an unavailable ENSO page or unrelated HTML supplies no inferred climate trend', () => {
  for (const html of ['', '<h1>Service maintenance</h1>']) {
    const data = buildEnsoOutlook(html, '', now);
    assert.equal(data.current.phase, null);
    assert.equal(data.outlook, null);
    assert.equal(data.fallback, true);
  }
});

test('unknown DDPM and earthquake issue dates remain unknown and cannot become fresh alerts', () => {
  const ddpm = parseDdpmHtml('<p>ประกาศเตือนภัยน้ำท่วม ขอให้ติดตามข้อมูลจากหน่วยงานในพื้นที่</p>');
  const quake = parseTmdEqHtml('<table><tr><td>เชียงราย</td><td>5.1 ML</td><td>ไม่ระบุวันที่</td></tr></table>');
  assert.ok(ddpm.length > 0 && quake.length > 0);
  for (const item of [...ddpm, ...quake]) {
    assert.equal(item.publishedAt, null);
    assert.equal(issueTimeOf(item), null);
    assert.ok(item.fetchedAt);
    assert.equal(isRecentNews(item, 96, now), false);
  }
  assert.deepEqual(prioritizeItems([...ddpm, ...quake]), []);
  assert.deepEqual(buildNewsEvents([...ddpm, ...quake]), []);
});

test('only actual issue or event dates determine freshness, never scrape time', () => {
  const item = { publishedAt: null, scrapedAt: new Date(now).toISOString(), fetchedAt: new Date(now).toISOString() };
  assert.equal(issueTimeOf(item), null);
  assert.equal(isRecentNews(item, 48, now), false);
  assert.equal(isRecentNews({ publishedAt: '2026-11-15T12:00:00Z' }, 48, now), true);
  assert.equal(isRecentNews({ publishedAt: '2026-11-19T12:00:00Z' }, 48, now), false);
  assert.equal(newsTimestamp('12:30'), null);
  assert.equal(newsTimestamp('2026'), null);
  assert.equal(newsTimestamp('not a date'), null);
  assert.equal(newsTimestamp('Mon, 16 Nov 2026 12:00:00 GMT'), '2026-11-16T12:00:00.000Z');
});

test('unknown global area never becomes Thailand because of default labels or publisher name', () => {
  const unknown = normalizeNewsDisplayItem({ title: 'Severe storm', source: 'Thai PBS', scope: 'global', severity: 'high' });
  assert.equal(unknown.area, 'ไม่ระบุพื้นที่');
  assert.equal(unknown.severity, 'low');
  assert.equal(newsIsRelevant(unknown), false);
  assert.equal(newsIsRelevant(normalizeNewsDisplayItem({ title: 'Flooding in Thailand', scope: 'global' })), true);
  assert.equal(newsIsRelevant(normalizeNewsDisplayItem({ title: 'เตือนฝนภาคเหนือ', scope: 'thailand' })), true);
});

test('news cache expires by original generation time and rejects pre-fix schemas', () => {
  const payload = { schemaVersion: 3, generatedAt: '2026-11-16T10:00:00Z' };
  assert.equal(readNewsCache({ payload, cachedAt: now }, now), payload);
  assert.equal(readNewsCache({ payload, cachedAt: now }, now + 25 * 3600000), null);
  assert.equal(readNewsCache({ payload: { ...payload, generatedAt: '2026-11-14T00:00:00Z' }, cachedAt: now }, now), null);
  assert.equal(readNewsCache({ payload: { ...payload, schemaVersion: 2 }, cachedAt: now }, now), null);
});

test('HTTP success cannot hide missing feeds, nested source failures, or stale cached data', () => {
  const partial = normalizeSourceStatus('TMD', { status: 'fulfilled', value: { tmdStatus: { forecast: 'fulfilled', warnings: 'rejected' } } }, 4);
  assert.equal(partial.status, 'partial');
  const empty = normalizeSourceStatus('DDPM', { status: 'fulfilled', value: [] }, 0);
  assert.equal(empty.status, 'empty');
  const failed = normalizeSourceStatus('USGS', { status: 'rejected', reason: new Error('timeout') });
  assert.equal(failed.status, 'error');
  const state = summarizeNewsFeed({ generatedAt: '2026-11-16T11:00:00Z', sourceStatus: [partial, empty, failed, { status: 'ok' }] }, now);
  assert.equal(state.available, 1);
  assert.equal(state.total, 4);
  assert.equal(state.incomplete, true);
  assert.equal(state.stale, true);
});
