import { newsTimestamp } from './newsIntegrity.js';

export const MOUNTAIN_SOURCE_URL = 'https://www.tmd.go.th/forecast/daily';
export const MOUNTAIN_REGIONS = [
  { region: 'ภาคเหนือ', regionId: 1, keyword: 'ยอดดอย' },
  { region: 'ภาคอีสาน', regionId: 2, keyword: 'ยอดภู' },
];
const MAX_ISSUE_AGE_MS = 36 * 3600000;

function textOf(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : '')
    .replace(/[\t\r ]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}

function tag(block, name) {
  return textOf(block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
}

function absoluteTime(value) {
  // Only accept timestamps whose timezone is stated; never use the server's timezone.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? newsTimestamp(value) : null;
}

function explicitPeriod(block) {
  const validFrom = absoluteTime(tag(block, 'validFrom'));
  const validTo = absoluteTime(tag(block, 'validTo'));
  if (validFrom && validTo && Date.parse(validTo) > Date.parse(validFrom)) return { validFrom, validTo };
  // Relative phrases such as "วันนี้ถึงพรุ่งนี้" are kept as text, not anchored to fetch time.
  return { validFrom: null, validTo: null };
}

function emptyRegion(config, reason, sourceUrl) {
  return { region: config.region, text: null, issuedAt: null, validFrom: null, validTo: null, stale: true, unavailable: true, reason, sourceUrl };
}

export function parseMountainBulletin(xml, config, now = Date.now()) {
  const sourceUrl = `https://www.tmd.go.th/api/xml/region-daily-forecast?regionid=${config.regionId}`;
  const items = String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const candidates = items.map(item => {
    const description = tag(item, 'description');
    const start = description.indexOf(config.keyword);
    if (start < 0) return null;
    const prefix = description.slice(Math.max(0, start - 6), start) === 'บริเวณ' ? start - 6 : start;
    const text = description.slice(prefix).split(/\n\s*(?:ลม|ภาค)|ลม(?:ตะวัน|ฝ่าย|เหนือ|ใต้)/)[0].trim().slice(0, 500);
    const issuedAt = newsTimestamp(tag(item, 'pubDate'));
    const period = explicitPeriod(item);
    const age = issuedAt ? now - Date.parse(issuedAt) : Infinity;
    const stale = age < -3600000 || age > MAX_ISSUE_AGE_MS || Boolean(period.validTo && Date.parse(period.validTo) <= now);
    return {
      region: config.region, text, issuedAt, ...period, stale,
      unavailable: !issuedAt,
      reason: !issuedAt ? 'ต้นทางไม่ระบุวันประกาศที่ตรวจสอบได้' : stale ? 'ประกาศเดิม โปรดตรวจฉบับล่าสุดที่กรมอุตุฯ' : !period.validFrom ? 'ยังไม่ยืนยันช่วงเวลามีผลแบบวันและเวลาเต็ม' : null,
      sourceUrl,
    };
  }).filter(Boolean).sort((a, b) => (Date.parse(b.issuedAt) || 0) - (Date.parse(a.issuedAt) || 0));
  return candidates[0] || emptyRegion(config, `ยังอ่านประกาศที่มีข้อความ${config.keyword}ไม่ได้`, sourceUrl);
}

export async function fetchMountainOutlook(fetcher = fetch, now = Date.now()) {
  const regions = await Promise.all(MOUNTAIN_REGIONS.map(async config => {
    const url = `https://www.tmd.go.th/api/xml/region-daily-forecast?regionid=${config.regionId}`;
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/xml,text/xml' } });
      if (!response.ok) throw new Error('Provider unavailable');
      return parseMountainBulletin(await response.text(), config, now);
    } catch {
      return emptyRegion(config, 'เชื่อมต่อประกาศกรมอุตุฯ ไม่ได้ในขณะนี้', url);
    }
  }));
  return {
    source: 'TMD', sourceUrl: MOUNTAIN_SOURCE_URL, fetchedAt: new Date(now).toISOString(), regions,
    unavailable: regions.every(region => region.unavailable || region.stale),
    partial: regions.some(region => region.unavailable || region.stale),
  };
}
