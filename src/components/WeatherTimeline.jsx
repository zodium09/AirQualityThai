import { createElement, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Droplets, Moon, Snowflake, Sun } from 'lucide-react';
import { displayValue, finiteOrNull, getWeatherVisual, thaiTime, weatherDate } from '../utils/weatherData';
import RiskValue from './RiskValue';

const hourIcons = { sun: Sun, moon: Moon, cloud: Cloud, partly: CloudSun, cloudMoon: CloudMoon, rain: CloudRain, drizzle: CloudDrizzle, storm: CloudLightning, fog: CloudFog, snow: Snowflake, unknown: Cloud };

export default function WeatherTimeline({ hourly, now, stale }) {
  const [metric, setMetric] = useState('rain');
  const scrollRef = useRef(null);
  const times = hourly.time || [];
  const start = times.findIndex(time => weatherDate(time).getTime() >= Math.floor(now / 3600000) * 3600000);
  const hours = start < 0 ? [] : times.slice(start, start + 24).map((time, offset) => {
    const i = start + offset;
    const end = weatherDate(time).getTime() + 3600000;
    const validBin = weatherDate(times[i + 1]).getTime() === end;
    return {
      time, label: thaiTime(time), period: `${thaiTime(time)}–${thaiTime(end)}`,
      temp: finiteOrNull(hourly.temperature_2m?.[i]),
      rain: validBin ? finiteOrNull(hourly.precipitation?.[i + 1]) : null,
      probability: validBin ? finiteOrNull(hourly.precipitation_probability?.[i + 1]) : null,
      code: finiteOrNull(hourly.weathercode?.[i] ?? hourly.weather_code?.[i]),
      isDay: hourly.is_day?.[i] !== 0,
    };
  });
  const scrollHours = direction => {
    scrollRef.current?.scrollBy({ left: direction * 280, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const Chart = metric === 'rain' ? BarChart : AreaChart;
  return <section className="wx-panel wx-hourly" aria-labelledby="hourly-title">
    <div className="wx-section-head"><div><h2 id="hourly-title">วางแผน 24 ชั่วโมงข้างหน้า</h2><p>ฝนสะสมแต่ละช่วง 1 ชั่วโมง · เวลาประเทศไทย</p></div><div className="wx-segment" aria-label="ข้อมูลบนกราฟ" role="group">{[['rain', 'ปริมาณฝน'], ['temp', 'อุณหภูมิ']].map(([key, label]) => <button type="button" aria-pressed={metric === key} key={key} onClick={() => setMetric(key)}>{label}</button>)}</div></div>
    {hours.length ? <><div className="wx-chart" role="img" aria-label={`กราฟ${metric === 'rain' ? 'ปริมาณฝนรายชั่วโมงเป็นมิลลิเมตร' : 'อุณหภูมิ'} ตัวเลขอ่านได้ในรายการถัดไป`}><ResponsiveContainer width="100%" height="100%"><Chart data={hours} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}><defs><linearGradient id="wx-rain-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} /><stop offset="100%" stopColor="#0284c7" stopOpacity={0.72} /></linearGradient><linearGradient id="wx-temp-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.34} /><stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis dataKey="label" interval={5} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><YAxis domain={metric === 'rain' ? [0, 'auto'] : ['auto', 'auto']} unit={metric === 'rain' ? '' : '°'} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 10px 25px rgba(11, 116, 222, 0.12)', color: 'var(--ink)' }} labelStyle={{ color: 'var(--ink)', fontWeight: 700 }} itemStyle={{ color: metric === 'rain' ? 'var(--primary-hover)' : '#ea580c' }} labelFormatter={(label, points) => metric === 'rain' ? points?.[0]?.payload?.period || label : label} formatter={v => [displayValue(v, metric === 'rain' ? ' มม.' : '°C', 1), metric === 'rain' ? 'ฝนสะสม 1 ชม.' : 'อุณหภูมิ']} />{metric === 'rain' ? <Bar dataKey="rain" fill="url(#wx-rain-fill)" radius={[8, 8, 2, 2]} maxBarSize={22} isAnimationActive={false} /> : <Area dataKey="temp" stroke="#ea580c" fill="url(#wx-temp-fill)" strokeWidth={2.75} connectNulls={false} isAnimationActive={false} />}</Chart></ResponsiveContainer></div><div className="wx-hour-wrap"><button type="button" className="wx-hour-nav wx-hour-nav--prev" onClick={() => scrollHours(-1)} aria-label="เลื่อนดูชั่วโมงก่อนหน้า"><ChevronLeft size={18} aria-hidden="true" /></button><div className="wx-hour-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="พยากรณ์รายชั่วโมง เลื่อนแนวนอนเพื่อดูครบ"><div className="wx-hours">{hours.map((hour, index) => { const visual = getWeatherVisual(hour.code, hour.isDay); const hasRain = hour.rain !== null && hour.rain > 0.1; return <div className={`wx-hour${index === 0 ? ' wx-hour--now' : ''}${hasRain ? ' wx-hour--rain' : ''}`} key={hour.time}><time dateTime={hour.time}>{hour.period}</time>{index === 0 && <em className="wx-hour-badge">ตอนนี้</em>}{createElement(hourIcons[visual.icon] || Cloud, { size: 20, strokeWidth: 1.85, 'aria-hidden': true, className: `wx-icon wx-icon--${visual.icon}` })}<RiskValue metric="temperature" value={hour.temp} unit="°" stale={stale} /><span className={`wx-hour-rain${hasRain ? ' is-wet' : ''}`}><Droplets size={12} aria-hidden="true" />{displayValue(hour.rain, ' มม.', 1)}</span><small>โอกาส {displayValue(hour.probability, '%')}</small></div>; })}</div></div><button type="button" className="wx-hour-nav wx-hour-nav--next" onClick={() => scrollHours(1)} aria-label="เลื่อนดูชั่วโมงถัดไป"><ChevronRight size={18} aria-hidden="true" /></button></div><p className="wx-footnote">มม. คือปริมาณฝนสะสมในช่วงที่ระบุ · เปอร์เซ็นต์เป็นโอกาสฝน ณ พิกัด ไม่ใช่สัดส่วนพื้นที่ฝนตก · ไม่มีข้อมูลใช้ —</p></> : <p className="wx-empty">ไม่มีพยากรณ์รายชั่วโมงที่ยังใช้ได้ ลองอัปเดตข้อมูล</p>}
  </section>;
}
