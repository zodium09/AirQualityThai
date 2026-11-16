import { buildEnsoOutlook, NOAA_ENSO_URL, IRI_ENSO_URL } from '../src/utils/ensoData.js';

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'text/html', 'User-Agent': 'AirQualityThai-ENSO/2.0' },
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.text();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const [noaa, iri] = await Promise.all([
    fetchText(NOAA_ENSO_URL).catch(() => ''),
    fetchText(IRI_ENSO_URL).catch(() => ''),
  ]);
  const payload = buildEnsoOutlook(noaa, iri);
  res.setHeader('Cache-Control', payload.fallback ? 'no-store' : 'public, max-age=0, s-maxage=21600, stale-while-revalidate=3600');
  return res.status(200).json(payload);
}
