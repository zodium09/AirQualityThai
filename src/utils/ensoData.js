export const NOAA_ENSO_URL = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html';
export const IRI_ENSO_URL = 'https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/';
const MAX_ISSUE_AGE_MS = 45 * 86400000;

function clean(value = '') {
  return String(value).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/g, '&')
    .replace(/&ntilde;|&#241;/gi, 'ñ').replace(/&deg;|&#176;/gi, '°').replace(/\s+/g, ' ').trim();
}

export function buildEnsoOutlook(noaaHtml, iriHtml = '', now = Date.now()) {
  const noaa = clean(noaaHtml);
  const iri = clean(iriHtml);
  const alert = noaa.match(/ENSO Alert System Status:\s*(.*?)(?=\s+Synopsis\b|\s+Diagnostic Discussion|$)/i)?.[1]?.trim().slice(0, 200) || null;
  const issued = noaa.match(/(\d{1,2}\s+[A-Za-z]+\s+20\d{2})\s+ENSO Alert/i)?.[1]
    || noaa.match(/issued\s+(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)?.[1];
  const issueTime = issued ? Date.parse(`${issued} 00:00:00 GMT`) : NaN;
  const issuedAt = Number.isFinite(issueTime) && issueTime <= now + 86400000 ? new Date(issueTime).toISOString() : null;
  const synopsis = noaa.match(/\bSynopsis\b:?\s+(.*?)(?=\.\s+[A-Z]|\s+Discussion\b|$)/i)?.[1]?.trim() || null;

  // Advisory describes the current phase; Watch and outlook text describe future possibilities.
  const advisory = !/final|ended|cancelled|canceled|not active/i.test(alert || '')
    ? alert?.match(/(El Ni[ñn]o|La Ni[ñn]a) Advisory/i)?.[1]?.toLowerCase() : null;
  let phase = advisory?.startsWith('el') ? 'el-nino' : advisory?.startsWith('la') ? 'la-nina' : null;
  if (!phase && /\bENSO-neutral (?:conditions )?(?:are present|is present|continues?\b|continued\b|persisted\b|persist\b|is ongoing)/i.test(synopsis || '')) phase = 'neutral';
  const stale = Boolean(issuedAt && now - issueTime > MAX_ISSUE_AGE_MS);
  const confirmed = Boolean(phase && issuedAt && !stale);
  return {
    issuedAt, sourceUpdatedAt: issuedAt, updatedAt: issuedAt,
    fetchedAt: new Date(now).toISOString(), current: { phase, confirmed }, alert,
    // Keep the source's period/probability wording together; never infer missing numbers.
    outlook: synopsis ? { text: synopsis.slice(0, 650), source: 'NOAA CPC', issuedAt } : null,
    stale, fallback: !confirmed, dataConfidence: confirmed ? 'confirmed' : stale ? 'stale' : 'unconfirmed',
    sources: [
      { label: 'NOAA CPC ENSO', url: NOAA_ENSO_URL, available: Boolean(noaa) },
      { label: 'IRI ENSO Forecast', url: IRI_ENSO_URL, available: Boolean(iri) },
    ],
  };
}

export function getEnsoSummary(data, now = Date.now()) {
  const issueTime = data?.issuedAt ? Date.parse(data.issuedAt) : NaN;
  const stale = data?.stale || (Number.isFinite(issueTime) && now - issueTime > MAX_ISSUE_AGE_MS);
  if (!data?.current?.confirmed || data.fallback || stale || !Number.isFinite(issueTime)) {
    return { title: stale ? 'ประกาศ ENSO เดิม · รอฉบับล่าสุด' : 'ยังยืนยันสถานะ ENSO ล่าสุดไม่ได้', detail: 'ตรวจวันประกาศและแนวโน้มจาก NOAA CPC / IRI ด้านล่าง', tone: 'pending' };
  }
  const states = {
    'el-nino': { title: 'ภาวะเอลนีโญ', tone: 'heat' },
    'la-nina': { title: 'ภาวะลานีญา', tone: 'rain' },
    neutral: { title: 'ภาวะเป็นกลาง', tone: 'neutral' },
  };
  return { ...(states[data.current.phase] || { title: 'ยังยืนยันสถานะ ENSO ไม่ได้', tone: 'pending' }), detail: 'สถานะตามประกาศ NOAA CPC · ดูพยากรณ์กรมอุตุฯ ประกอบสำหรับพื้นที่ประเทศไทย' };
}
