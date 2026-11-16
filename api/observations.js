import { createObservationService, observationNumber } from '../src/server/observations.js';
import { fetchMountainOutlook } from '../src/server/mountainOutlook.js';

const observations = createObservationService({ env: process.env });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  // Share one function with the regional outlook to fit the hosting plan.
  if (req.query?.view === 'mountain') {
    const payload = await fetchMountainOutlook();
    res.setHeader('Cache-Control', payload.unavailable ? 'no-store' : 'public, max-age=0, s-maxage=1800, stale-while-revalidate=300');
    return res.status(200).json(payload);
  }
  const lat = observationNumber(req.query?.lat, 4, 22);
  const lon = observationNumber(req.query?.lon, 96, 106);
  if (lat === null || lon === null) return res.status(400).json({ error: 'Invalid Thailand coordinates' });
  const result = await observations({ lat, lon });
  res.setHeader('Cache-Control', result.weather.providerAvailable || result.air.providerAvailable ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=60' : 'no-store');
  return res.status(200).json(result);
}
