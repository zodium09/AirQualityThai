import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { air4thaiIntermediateChain } from '../src/server/air4thaiCa.js';
import { observationFetch } from '../src/server/observationFetch.js';

test('Air4Thai public intermediate chain verifies to an existing Node trusted root', () => {
  const [intermediate, crossSigned] = air4thaiIntermediateChain.map(pem => new X509Certificate(pem));
  const root = rootCertificates.map(pem => new X509Certificate(pem)).find(cert => cert.subject.includes('CN=ISRG Root X1'));
  assert.equal(intermediate.ca, true);
  assert.equal(crossSigned.ca, true);
  assert.ok(intermediate.verify(crossSigned.publicKey));
  assert.ok(crossSigned.verify(root.publicKey));
  assert.equal(intermediate.fingerprint256, '13:94:96:34:D9:9C:D6:FD:6A:A8:0B:C0:34:FE:FA:CC:EB:19:69:FE:EF:98:65:86:71:3E:CD:BB:05:75:8D:3F');
  assert.ok(Date.parse(intermediate.validTo) > Date.now());
});

test('observation transport leaves all other provider requests on the normal fetch path', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { calls.push(args); return { ok: true }; });
  const options = { signal: AbortSignal.timeout(1000) };
  await observationFetch('https://data.tmd.go.th/api/WeatherToday/V2/', options);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], options);
});
