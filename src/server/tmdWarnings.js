const TMD_ORIGIN = 'https://www.tmd.go.th';
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function decode(value = '') {
  return String(value).replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50));
}
const plain = value => decode(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function thaiInstant(day, monthName, year, hour = 0, minute = 0) {
  const month = MONTHS.indexOf(monthName), y = Number(year) > 2400 ? Number(year) - 543 : Number(year);
  if (month < 0 || y < 2000 || y > 2200 || Number(hour) > 23 || Number(minute) > 59) return null;
  const calendar = new Date(Date.UTC(y, month, Number(day), Number(hour), Number(minute)));
  if (calendar.getUTCMonth() !== month || calendar.getUTCDate() !== Number(day)) return null;
  return new Date(calendar.getTime() - 7 * 3600000).toISOString();
}

export function tmdWarningLinks(html) {
  const decoded = decode(html), seen = new Set();
  const cards = decoded.split(/<div\b[^>]*class=["']link-list["'][^>]*>/i).slice(1);
  return cards.flatMap(card => {
    const titleLink = card.match(/<div\b[^>]*class=["']link-list-title["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleLink) return [];
    let url;
    try { url = new URL(titleLink[1], TMD_ORIGIN); } catch { return []; }
    if (url.origin !== TMD_ORIGIN || !url.pathname.startsWith('/warning-and-events/warning-storm/') || seen.has(url.href)) return [];
    seen.add(url.href);
    const summary = card.match(/<div\b[^>]*class=["']link-list-description["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    return [{ title: plain(titleLink[2]), summary: plain(summary || ''), url: url.href }];
  }).slice(0, 3);
}

export function parseTmdWarningDetail(html, card, now = Date.now()) {
  const text = plain(html);
  // Read the actual issuance sentence, never the date of the next bulletin,
  // affected period, page scrape or HTTP fetch.
  const issued = text.match(new RegExp(`ประกาศ\\s*ณ\\s*วันที่\\s*(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(?:พ\\.?\\s*ศ\\.?\\s*)?(\\d{4})\\s+เวลา\\s+(\\d{1,2})[.:](\\d{2})\\s*น`));
  const issuedAt = issued && thaiInstant(...issued.slice(1));
  if (!issuedAt || Date.parse(issuedAt) > now + 3600000) return null;
  const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || card.title);
  const period = title.match(new RegExp(`มีผลกระทบในช่วงวันที่\\s*(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`));
  const validFrom = period ? thaiInstant(period[1], period[3], period[4]) : null;
  const lastDay = period ? thaiInstant(period[2], period[3], period[4]) : null;
  const validTo = lastDay ? new Date(Date.parse(lastDay) + 86400000).toISOString() : null;
  if (validTo && Date.parse(validTo) <= now) return null;
  return { title, summary: card.summary, source: 'TMD', category: 'warning', scope: 'thailand',
    severity: /อันตราย|ฝนตกหนักมาก|น้ำท่วมฉับพลัน/.test(card.summary) ? 'high' : 'medium',
    issuedAt, publishedAt: issuedAt, datePrecision: 'minute', dateConfidence: 'source',
    validFrom, validTo, validPeriodPrecision: period ? 'day' : null,
    url: card.url, link: card.url };
}

export async function fetchTmdWarnings(listHtml, fetchText, now = Date.now()) {
  const cards = tmdWarningLinks(listHtml);
  const results = await Promise.allSettled(cards.map(async card => parseTmdWarningDetail(await fetchText(card.url), card, now)));
  if (results.length && results.every(result => result.status === 'rejected')) throw new Error('Unable to verify TMD warning issue dates');
  const latest = new Map();
  for (const item of results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])) {
    // Consecutive numbered bulletins for the same affected period are updates
    // to one warning, not separate incidents. Keep unrelated warnings intact.
    const base = item.title.replace(/\s*ฉบับที่\s*\d+\s*(?:\([^)]*\))?\s*$/, '').trim();
    const key = base !== item.title && item.validFrom && item.validTo
      ? JSON.stringify([base, item.validFrom, item.validTo]) : item.url;
    const previous = latest.get(key);
    if (!previous || Date.parse(item.issuedAt) > Date.parse(previous.issuedAt)) latest.set(key, item);
  }
  return [...latest.values()].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
}
