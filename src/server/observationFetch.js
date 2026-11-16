import https from 'node:https';
import { rootCertificates } from 'node:tls';
import { air4thaiIntermediateChain } from './air4thaiCa.js';

export const AIR4THAI_FEED = 'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php';
// The provider omits part of its new Let's Encrypt chain. Supply the public
// intermediates for this host only; require the existing trusted root and
// normal certificate expiry and hostname verification.
const airAgent = new https.Agent({ ca: [...rootCertificates, ...air4thaiIntermediateChain], rejectUnauthorized: true });

export function observationFetch(url, options = {}) {
  if (url !== AIR4THAI_FEED) return fetch(url, options);
  return new Promise((resolve, reject) => {
    const request = https.get(AIR4THAI_FEED, { agent: airAgent, signal: options.signal, headers: { Accept: 'application/json' } }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) { response.destroy(new Error('Provider response too large')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, json: async () => JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', reject);
  });
}
