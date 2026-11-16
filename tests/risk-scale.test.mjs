import test from 'node:test';
import assert from 'node:assert/strict';
import { riskLevel } from '../src/utils/riskScale.js';

test('missing and stale readings never imply a safe or live level', () => {
  for (const value of [null, undefined, '', NaN, false]) assert.equal(riskLevel('rain', value, { hours: 24 }).tone, 'unknown');
  assert.equal(riskLevel('pm25', 12, { hours: 24, stale: true }).tone, 'unknown');
  assert.equal(riskLevel('temperature', -2).label, 'หนาวจัด');
});
test('rain and air require the correct accumulation period', () => {
  assert.equal(riskLevel('rain', 100, { hours: 3 }).tone, 'info');
  assert.equal(riskLevel('rain', 90, { hours: 24 }).label, 'ฝนหนัก');
  assert.equal(riskLevel('rain', 90.1, { hours: 24 }).label, 'ฝนหนักมาก');
  assert.equal(riskLevel('pm25', 80, { hours: 1 }).tone, 'info');
  assert.equal(riskLevel('pm25', 80, { hours: 24 }).tone, 'danger');
});
test('temperature and UV boundaries include both hot and cold extremes', () => {
  assert.equal(riskLevel('temperature', 35).label, 'ร้อน');
  assert.equal(riskLevel('temperature', 39.9).label, 'ร้อน');
  assert.equal(riskLevel('temperature', 40).label, 'ร้อนจัด');
  assert.equal(riskLevel('temperature', 8).label, 'หนาว');
  assert.equal(riskLevel('uv', 11).label, 'สูงจัด');
  assert.equal(riskLevel('uv', 0).label, 'ต่ำ');
  assert.equal(riskLevel('apparent', 44).tone, 'info');
});
