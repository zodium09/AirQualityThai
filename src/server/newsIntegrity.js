export const NEWS_REFRESH_MS = 10 * 60000;
export const NEWS_STALE_MS = 30 * 60000;
export const NEWS_CACHE_MAX_MS = 24 * 3600000;

export function newsTimestamp(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  // A clock time or year alone does not identify an issue date.
  if (typeof value === 'string' && !/(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function issueTimeOf(item = {}) {
  return newsTimestamp(item.issuedAt) || newsTimestamp(item.publishedAt) || newsTimestamp(item.eventAt) || newsTimestamp(item.time) || newsTimestamp(item.updatedAt);
}

export function isRecentNews(item, maxHours, now = Date.now()) {
  const at = issueTimeOf(item);
  if (!at) return false;
  const age = now - Date.parse(at);
  return age >= -3600000 && age <= maxHours * 3600000;
}

export function readNewsCache(cached, now = Date.now()) {
  if (cached?.payload?.schemaVersion !== 3) return null;
  const generated = newsTimestamp(cached?.payload?.generatedAt);
  const cachedAt = cached?.cachedAt;
  if (!generated || !Number.isFinite(cachedAt)) return null;
  const age = now - Math.min(Date.parse(generated), cachedAt);
  return age >= 0 && age <= NEWS_CACHE_MAX_MS ? cached.payload : null;
}

export function summarizeNewsFeed(feed, now = Date.now()) {
  const sources = Array.isArray(feed?.sourceStatus) ? feed.sourceStatus : [];
  const available = sources.filter(source => source.status === 'ok').length;
  const generated = newsTimestamp(feed?.generatedAt);
  const age = generated ? now - Date.parse(generated) : Infinity;
  return {
    sources, available, total: sources.length, incomplete: !sources.length || available < sources.length,
    stale: age < 0 || age > NEWS_STALE_MS,
    affected: sources.filter(source => source.status !== 'ok'),
  };
}

export function normalizeSourceStatus(label, result, count = 0) {
  if (result.status !== 'fulfilled') return { label, status: 'error', count: 0, error: result.reason?.message || 'อ่านแหล่งข้อมูลไม่ได้' };
  const children = Object.values(result.value?.tmdStatus || result.value?.fetchStatus || {});
  const rejected = children.filter(status => status !== 'fulfilled').length;
  const status = rejected ? rejected === children.length ? 'error' : 'partial' : count > 0 ? 'ok' : 'empty';
  return { label, status, count };
}

export function normalizeNewsDisplayItem(item, index = 0) {
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  const source = item?.source || sources[0] || 'ไม่ระบุแหล่ง';
  const topicHint = `${item?.topic || ''} ${item?.eventType || ''} ${item?.category || ''} ${item?.title || ''} ${item?.summary || item?.description || ''}`.toLowerCase();
  const topic = /earthquake|quake|แผ่นดินไหว/.test(topicHint) ? 'earthquake'
    : /wildfire|fire|ไฟป่า/.test(topicHint) ? 'fire'
      : /storm|cyclone|hurricane|typhoon|พายุ/.test(topicHint) ? 'storm'
        : /flood|น้ำท่วม/.test(topicHint) ? 'flood'
          : /volcano|ภูเขาไฟ/.test(topicHint) ? 'volcano'
            : /drought|ภัยแล้ง/.test(topicHint) ? 'drought'
              : String(item?.topic || item?.eventType || item?.category || 'other').toLowerCase();
  const publishedAt = issueTimeOf(item);
  const severity = publishedAt && item?.severity === 'high' ? 'high' : publishedAt && item?.severity === 'medium' ? 'medium' : 'low';
  const areas = Array.isArray(item?.areas) ? item.areas : [];
  return {
    id: item?.id || `${source}-${publishedAt || index}-${item?.title || index}`,
    title: item?.title || 'ประกาศเหตุการณ์ธรรมชาติ',
    summary: item?.summary || item?.description || 'เปิดต้นทางเพื่อดูรายละเอียด',
    topic, severity, publishedAt, source,
    area: item?.primaryArea || areas[0] || item?.area || 'ไม่ระบุพื้นที่',
    url: item?.url || item?.link || item?.items?.[0]?.url || '', scope: item?.scope || 'unknown',
  };
}

export function newsIsRelevant(item) {
  return item.scope === 'thailand'
    || /ประเทศไทย|ไทย|Thailand|Myanmar|Laos|Cambodia|Vietnam|Malaysia|ภูมิภาคเอเชียตะวันออกเฉียงใต้|อ่าวไทย|อันดามัน/i.test(`${item.title} ${item.summary} ${item.area}`);
}
