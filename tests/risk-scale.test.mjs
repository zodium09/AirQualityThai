import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRiskValue, riskLevel, riskMapColors } from '../src/utils/riskScale.js';

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
  assert.equal(riskLevel('temperature', 25).tone, 'low');
  assert.equal(riskLevel('temperature', 30).tone, 'watch');
  assert.equal(riskLevel('temperature', 34).tone, 'watch');
  assert.equal(riskLevel('temperature', 34).label, 'ค่อนข้างร้อน');
  assert.equal(riskLevel('temperature', 35).tone, 'high');
  assert.equal(riskLevel('temperature', 35).label, 'ร้อน');
  assert.equal(riskLevel('temperature', 39.9).label, 'ร้อน');
  assert.equal(riskLevel('temperature', 40).tone, 'danger');
  assert.equal(riskLevel('temperature', 40).label, 'ร้อนจัด');
  assert.equal(riskLevel('temperature', 8).label, 'หนาว');
  assert.equal(riskLevel('uv', 11).label, 'สูงจัด');
  assert.equal(riskLevel('uv', 0).label, 'ต่ำ');
  assert.equal(riskLevel('apparent', 44).tone, 'info');
});

test('shown values retain their risk category when rounding or changing units', () => {
  assert.equal(formatRiskValue('temperature', 34.96, { unit: '°C' }), '34.96°C');
  assert.equal(formatRiskValue('temperature', 7.96), '7.96');
  assert.equal(formatRiskValue('temperature', 22.96), '22.96');
  assert.equal(formatRiskValue('rain', 35.04, { hours: 24, unit: ' มม.' }), '35.04 มม.');
  assert.equal(formatRiskValue('pm25', 25.04, { hours: 24 }), '25.04');
  assert.equal(formatRiskValue('uv', 2.96), '2.96');
  assert.equal(formatRiskValue('gust', 39.96), '39.96');
  assert.equal(formatRiskValue('visibility', 999, { divisor: 1000, unit: ' กม.' }), '0.999 กม.');
  assert.equal(formatRiskValue('visibility', 4999, { divisor: 1000, unit: ' กม.' }), '4.999 กม.');
});

test('ordinary values stay concise and very close category boundaries use explicit bounds', () => {
  assert.equal(formatRiskValue('temperature', 28.244), '28.2');
  assert.equal(formatRiskValue('temperature', -7.95), '-8');
  assert.equal(formatRiskValue('rain', 35.04, { hours: 3 }), '35');
  assert.equal(formatRiskValue('pm25', 25.04, { hours: 1 }), '25');
  assert.equal(formatRiskValue('temperature', 34.99996, { unit: '°C' }), '<35°C');
  assert.equal(formatRiskValue('rain', 35.00004, { hours: 24, unit: ' มม.' }), '>35 มม.');
  assert.equal(formatRiskValue('rain', null, { unit: ' มม.' }), '—');
  assert.equal(formatRiskValue('pm25', -1, { hours: 24 }), '—');
});

test('riskMapColors defines all 8 tones and separates watch, high, and danger fills', () => {
  for (const tone of ['unknown', 'info', 'low', 'cool', 'watch', 'high', 'danger', 'extreme']) {
    assert.match(riskMapColors[tone], /^#[0-9a-f]{6}$/i);
  }
  assert.notEqual(riskMapColors.watch, riskMapColors.high);
  assert.notEqual(riskMapColors.high, riskMapColors.danger);
});
