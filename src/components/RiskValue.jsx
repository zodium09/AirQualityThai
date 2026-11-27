import { ChevronDown, Info } from 'lucide-react';
import { formatRiskValue, riskLevel, riskSources } from '../utils/riskScale';

export default function RiskValue({ value, metric, unit = '', digits = 1, stale = false, hours = null, label = false, className = '', divisor = 1 }) {
  const risk = riskLevel(metric, value, { stale, hours });
  const displayed = formatRiskValue(metric, value, { unit, digits, hours, divisor });
  return <span className={`risk-value risk-${risk.tone} ${className}`} title={risk.label} data-risk={risk.tone} aria-label={`${displayed} · ${risk.label}`}>
    <span className="risk-number">{displayed}</span>{label && <small className="risk-caption">{risk.label}</small>}
  </span>;
}

export function RiskLegend() {
  return <details className="risk-legend">
    <summary><span className="risk-legend__title"><Info size={16} aria-hidden="true" /> สีตัวเลขบอกอะไร · ดูเกณฑ์และแหล่งอ้างอิง</span><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true" /></summary>
    <div className="risk-legend-swatches"><span className="risk-swatch risk-info"><i></i>ฟ้า · ข้อมูล / ระดับต่ำ</span><span className="risk-swatch risk-low"><i></i>เขียว · ระดับทั่วไป</span><span className="risk-swatch risk-watch"><i></i>เหลืองเข้ม · เริ่มเฝ้าระวัง</span><span className="risk-swatch risk-high"><i></i>ส้ม · ระดับสูง</span><span className="risk-swatch risk-danger"><i></i>แดง · ระดับสูงมาก</span><span className="risk-swatch risk-extreme"><i></i>ม่วง · ค่าสุดขั้ว</span><span className="risk-swatch risk-unknown"><i></i>เทา · ข้อมูลเก่าหรือไม่พร้อม</span></div>
    <p>แต่ละตัวแปรใช้เกณฑ์ต่างกัน อ่านคำกำกับพร้อมสีเสมอ สีไม่ใช่ประกาศเตือนภัยหรือการรับรองความปลอดภัย</p>
    <ul><li>อุณหภูมิ: ต่ำกว่า 8°C หนาวจัด (ม่วง) · 8–ต่ำกว่า 16°C หนาว (ฟ้าเข้ม) · 16–ต่ำกว่า 23°C เย็น (ฟ้า) · 23–ต่ำกว่า 30°C สบาย (เขียว) · 30–ต่ำกว่า 35°C ค่อนข้างร้อน (เหลืองเข้ม) · 35–ต่ำกว่า 40°C ร้อน (ส้ม) · ตั้งแต่ 40°C ร้อนจัด (แดง) — <a href={riskSources.weather} target="_blank" rel="noreferrer">เกณฑ์กรมอุตุฯ</a></li>
      <li>ค่าต่ำสุด–สูงสุดที่แสดงคู่กัน: ใช้สีฟ้า (↓) แทนค่าต่ำสุด และสีส้มอุ่น (↑) แทนค่าสูงสุด เพื่อให้แยกอ่านได้ชัดเจน โดยยังคงเน้นสีม่วงเมื่อหนาวจัด (&lt;8°C) สีแดงเมื่อร้อนจัด (≥40°C) และสีเทาเมื่อข้อมูลเก่าหรือไม่พร้อม</li>
      <li>ฝนสะสม 24 ชม.: 0.1–10 มม. เล็กน้อย · มากกว่า 10–35 ปานกลาง · มากกว่า 35–90 หนัก · มากกว่า 90 หนักมาก ใช้กับค่าพยากรณ์เต็มวันเพื่อเทียบช่วงปริมาณ ไม่ใช้กับฝนรายชั่วโมงหรือผลรวมหลายวัน — <a href={riskSources.rain} target="_blank" rel="noreferrer">เกณฑ์ฝน</a></li>
      <li>PM2.5: ใช้เกณฑ์เฉลี่ย 24 ชม. เฉพาะเมื่อข้อมูลครบ ค่าแบบจำลองเป็นเพียงการเทียบเกณฑ์ ไม่ใช่ AQI ทางการ ค่ารายชั่วโมงใช้สีฟ้า — <a href={riskSources.air} target="_blank" rel="noreferrer">เกณฑ์ คพ.</a></li>
      <li>UV: ต่ำกว่า 3 ต่ำ · 3–ต่ำกว่า 6 ปานกลาง · 6–ต่ำกว่า 8 สูง · 8–ต่ำกว่า 11 สูงมาก · ตั้งแต่ 11 สูงจัด — <a href={riskSources.uv} target="_blank" rel="noreferrer">WHO</a></li>
      <li>ลม / ลมกระโชก: สีช่วยแยกช่วงความเร็ว 20, 40, 62 กม./ชม. ทัศนวิสัย: เฝ้าระวังเมื่อต่ำกว่า 5 กม. และเน้นเมื่อต่ำกว่า 1 กม. เป็นเกณฑ์แสดงผลของแอป ไม่ใช่คำเตือนทางการ</li>
      <li>อุณหภูมิที่รู้สึก ความชื้น และความกดอากาศใช้สีข้อมูล ไม่อนุมานความเสี่ยงจากค่าเดียว</li></ul>
  </details>;
}
