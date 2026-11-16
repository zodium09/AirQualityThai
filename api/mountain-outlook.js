import { fetchMountainOutlook } from '../src/server/mountainOutlook.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const payload = await fetchMountainOutlook();
  res.setHeader('Cache-Control', payload.unavailable ? 'no-store' : 'public, max-age=0, s-maxage=1800, stale-while-revalidate=300');
  return res.status(200).json(payload);
}
