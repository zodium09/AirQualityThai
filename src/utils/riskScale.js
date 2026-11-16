import { displayValue, finiteOrNull } from './weatherData.js';

// Concentration bands require a complete 24-hour mean. Never apply them to hourly PM.
export const riskColors = { unknown: '#536579', info: '#155fa0', low: '#166534', cool: '#075985', watch: '#92400e', high: '#9a3412', danger: '#b91c1c', extreme: '#6b21a8' };
const result = (tone, label) => ({ tone, label, color: riskColors[tone] });
export function riskLevel(metric, input, { stale = false, hours = null } = {}) {
  const value = finiteOrNull(input);
  if (value === null || (metric !== 'temperature' && metric !== 'apparent' && value < 0)) return result('unknown', 'ไม่มีข้อมูล');
  if (stale) return result('unknown', 'ข้อมูลเดิม · ตรวจเวลา');
  if (metric === 'temperature') {
    if (value < 8) return result('extreme', 'หนาวจัด');
    if (value < 16) return result('cool', 'หนาว');
    if (value < 23) return result('info', 'เย็น');
    if (value >= 40) return result('danger', 'ร้อนจัด');
    if (value >= 35) return result('watch', 'ร้อน');
    return result('low', 'ช่วง 23–ต่ำกว่า 35°C');
  }
  // Apparent temperature is not the Thai heat index: no borrowed health cutoffs.
  if (metric === 'apparent') return result('info', 'อุณหภูมิที่รู้สึก · ไม่ใช่ดัชนีความร้อน');
  if (metric === 'rain') {
    if (hours !== 24) return result('info', 'ปริมาณฝนสะสมตามช่วงเวลา');
    if (value < 0.1) return result('info', 'น้อยกว่า 0.1 มม.');
    if (value <= 10) return result('low', 'ฝนเล็กน้อย');
    if (value <= 35) return result('watch', 'ฝนปานกลาง');
    if (value <= 90) return result('high', 'ฝนหนัก');
    return result('danger', 'ฝนหนักมาก');
  }
  if (metric === 'pm25') {
    if (hours !== 24) return result('info', 'ค่ารายชั่วโมง · ไม่จัดระดับ AQI');
    if (value <= 15) return result('info', 'ดีมาก');
    if (value <= 25) return result('low', 'ดี');
    if (value <= 37.5) return result('watch', 'ปานกลาง');
    if (value <= 75) return result('high', 'เริ่มมีผลกระทบต่อสุขภาพ');
    return result('danger', 'มีผลกระทบต่อสุขภาพ');
  }
  if (metric === 'uv') {
    if (value < 3) return result('low', 'ต่ำ');
    if (value < 6) return result('watch', 'ปานกลาง');
    if (value < 8) return result('high', 'สูง');
    if (value < 11) return result('danger', 'สูงมาก');
    return result('extreme', 'สูงจัด');
  }
  if (metric === 'wind' || metric === 'gust') {
    if (value >= 62) return result('danger', 'ตั้งแต่ 62 กม./ชม.');
    if (value >= 40) return result('high', '40–ต่ำกว่า 62 กม./ชม.');
    if (value >= 20) return result('watch', '20–ต่ำกว่า 40 กม./ชม.');
    return result('info', 'ต่ำกว่า 20 กม./ชม.');
  }
  if (metric === 'visibility') {
    if (value < 1000) return result('danger', 'มองเห็นต่ำกว่า 1 กม.');
    if (value < 5000) return result('watch', 'มองเห็นต่ำกว่า 5 กม.');
    return result('info', 'มองเห็นตั้งแต่ 5 กม.');
  }
  return result('info', 'ค่าประกอบ · ไม่จัดระดับความเสี่ยง');
}

// Keep the displayed number on the same side of a category boundary as its
// unrounded reading. Three decimal places cover metres shown in kilometres;
// closer boundary values use an explicit bound instead of false precision.
export function formatRiskValue(metric, input, { unit = '', digits = 1, hours = null, divisor = 1 } = {}) {
  const value = finiteOrNull(input), scale = finiteOrNull(divisor);
  const actual = riskLevel(metric, value, { hours });
  if (actual.tone === 'unknown' || scale === null || scale <= 0) return displayValue(null, unit, digits);
  const displayed = value / scale;
  const firstDigits = Math.max(0, Math.min(3, Math.trunc(Number(digits)) || 0));
  let rounded;
  for (let precision = firstDigits; precision <= 3; precision += 1) {
    // Intl rounds negative halves the same way as displayValue; Math.round does not.
    rounded = Number(new Intl.NumberFormat('en-US', { maximumFractionDigits: precision, useGrouping: false }).format(displayed));
    const shown = riskLevel(metric, rounded * scale, { hours });
    if (shown.tone === actual.tone && shown.label === actual.label) return displayValue(displayed, unit, precision);
  }
  return `${displayed < rounded ? '<' : '>'}${displayValue(rounded, unit, 3)}`;
}

export const riskSources = {
  weather: 'https://www.tmd.go.th/info/เกณฑอากาศ',
  rain: 'https://cmmet.tmd.go.th/met/met.php',
  uv: 'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index',
  air: 'https://air4thai.pcd.go.th/webV3/#/AQIInfo',
};
