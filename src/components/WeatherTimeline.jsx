import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets } from 'lucide-react';
import { displayValue, finiteOrNull, thaiTime, weatherDate } from '../utils/weatherData';
import RiskValue from './RiskValue';

export default function WeatherTimeline({ hourly, now, stale }) {
  const [metric, setMetric] = useState('rain');
  const times = hourly.time || [];
  const start = times.findIndex(time => weatherDate(time).getTime() >= Math.floor(now / 3600000) * 3600000);
  const hours = start < 0 ? [] : times.slice(start, start + 24).map((time, offset) => {
    const i = start + offset;
    const end = weatherDate(time).getTime() + 3600000;
    const validBin = weatherDate(times[i + 1]).getTime() === end;
    return { time, label: thaiTime(time), period: `${thaiTime(time)}–${thaiTime(end)}`, temp: finiteOrNull(hourly.temperature_2m?.[i]), rain: validBin ? finiteOrNull(hourly.precipitation?.[i + 1]) : null, probability: validBin ? finiteOrNull(hourly.precipitation_probability?.[i + 1]) : null };
  });
  const Chart = metric === 'rain' ? BarChart : AreaChart;
  return <section className="wx-panel wx-hourly" aria-labelledby="hourly-title">
    <div className="wx-section-head"><div><h2 id="hourly-title">วางแผน 24 ชั่วโมงข้างหน้า</h2><p>ฝนสะสมแต่ละช่วง 1 ชั่วโมง · เวลาประเทศไทย</p></div><div className="wx-segment" aria-label="ข้อมูลบนกราฟ" role="group">{[['rain', 'ปริมาณฝน'], ['temp', 'อุณหภูมิ']].map(([key, label]) => <button type="button" aria-pressed={metric === key} key={key} onClick={() => setMetric(key)}>{label}</button>)}</div></div>
    {hours.length ? <><div className="wx-chart" role="img" aria-label={`กราฟ${metric === 'rain' ? 'ปริมาณฝนรายชั่วโมงเป็นมิลลิเมตร' : 'อุณหภูมิ'} ตัวเลขอ่านได้ในรายการถัดไป`}><ResponsiveContainer width="100%" height="100%"><Chart data={hours} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis dataKey="label" interval={5} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><YAxis domain={metric === 'rain' ? [0, 'auto'] : ['auto', 'auto']} unit={metric === 'rain' ? '' : '°'} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }} labelFormatter={(label, points) => metric === 'rain' ? points?.[0]?.payload?.period || label : label} formatter={v => [displayValue(v, metric === 'rain' ? ' มม.' : '°C', 1), metric === 'rain' ? 'ฝนสะสม 1 ชม.' : 'อุณหภูมิ']} />{metric === 'rain' ? <Bar dataKey="rain" fill="#1675df" radius={[4, 4, 0, 0]} isAnimationActive={false} /> : <Area dataKey="temp" stroke="#1675df" fill="#d9ebfc" strokeWidth={2.5} connectNulls={false} isAnimationActive={false} />}</Chart></ResponsiveContainer></div><div className="wx-hour-scroll" tabIndex={0} role="region" aria-label="พยากรณ์รายชั่วโมง เลื่อนแนวนอนเพื่อดูครบ"><div className="wx-hours">{hours.map(hour => <div className="wx-hour" key={hour.time}><time dateTime={hour.time}>{hour.period}</time><RiskValue metric="temperature" value={hour.temp} unit="°" stale={stale} /><span><Droplets size={12} aria-hidden="true" />{displayValue(hour.rain, ' มม.', 1)}</span><small>โอกาส {displayValue(hour.probability, '%')}</small></div>)}</div></div><p className="wx-footnote">มม. คือปริมาณฝนสะสมในช่วงที่ระบุ · เปอร์เซ็นต์เป็นโอกาสฝน ณ พิกัด ไม่ใช่สัดส่วนพื้นที่ฝนตก · ไม่มีข้อมูลใช้ —</p></> : <p className="wx-empty">ไม่มีพยากรณ์รายชั่วโมงที่ยังใช้ได้ ลองอัปเดตข้อมูล</p>}
  </section>;
}
