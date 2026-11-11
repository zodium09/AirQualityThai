import { createElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Droplets, Eye, Gauge, Info, LocateFixed, MapPin, Monitor, Moon, RefreshCw, ShieldCheck, Snowflake, Sun, Sunrise, Sunset, Thermometer, Umbrella, Wind } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { WeatherContext } from '../context/WeatherContext';
import { useWeatherData } from '../hooks/useWeatherData';
import { provinces77 } from '../provinces77';
import { BANGKOK, displayValue as value, finiteOrNull, getWeatherVisual, thaiTime, weatherDate } from '../utils/weatherData';
import RainNowcast from '../components/RainNowcast';

const LOCATION_KEY = 'air4thai.location.v2';
const provinces = [...provinces77].sort((a, b) => a.n.localeCompare(b.n, 'th'));
const icons = { sun: Sun, moon: Moon, cloud: Cloud, partly: CloudSun, cloudMoon: CloudMoon, rain: CloudRain, drizzle: CloudDrizzle, storm: CloudLightning, fog: CloudFog, snow: Snowflake, unknown: Cloud };
const dateLabel = date => new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, weekday: 'short', day: 'numeric', month: 'short' }).format(weatherDate(date));
const cleanName = name => String(name || '').replace(/^จังหวัด/, '').trim();
function initialLocation() {
  try {
    const requested = provinces.find(p => p.n === new URLSearchParams(window.location.search).get('province'));
    if (requested) return { province: requested.n, label: requested.n, lat: requested.lat, lon: requested.lon, district: '' };
    const saved = JSON.parse(localStorage.getItem(LOCATION_KEY));
    if (saved && provinces.some(p => p.n === saved.province) && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && typeof saved.label === 'string') return saved;
    const province = provinces.find(p => p.n === cleanName(localStorage.getItem('air4thai.selectedProvince'))) || provinces77[0];
    return { province: province.n, label: province.n, lat: province.lat, lon: province.lon, district: '' };
  } catch { return { province: provinces77[0].n, label: provinces77[0].n, lat: provinces77[0].lat, lon: provinces77[0].lon, district: '' }; }
}
function WeatherIcon({ code, isDay = true, size = 28 }) {
  const visual = getWeatherVisual(code, isDay);
  return createElement(icons[visual.icon], { size, strokeWidth: 1.7, 'aria-hidden': true, className: `wx-icon wx-icon--${visual.icon}` });
}
function Reading({ icon: Icon, label, reading, detail }) {
  return <div className="wx-reading">{createElement(Icon, { size: 20, 'aria-hidden': true })}<span>{label}</span><strong>{reading}</strong><small>{detail}</small></div>;
}
function HourlyForecast({ hourly, now }) {
  const [metric, setMetric] = useState('temp');
  const start = (hourly.time || []).findIndex(time => weatherDate(time).getTime() >= now - 3600000);
  const hours = start < 0 ? [] : hourly.time.slice(start, start + 24).map((time, offset) => {
    const i = start + offset;
    return { time, label: thaiTime(time), temp: finiteOrNull(hourly.temperature_2m?.[i]), rain: finiteOrNull(hourly.precipitation_probability?.[i]), code: hourly.weathercode?.[i], isDay: hourly.is_day?.[i] === 1 };
  });
  return <section className="wx-panel wx-hourly" aria-labelledby="hourly-title">
    <div className="wx-section-head"><div><h2 id="hourly-title">วางแผน 24 ชั่วโมงข้างหน้า</h2><p>ดูจังหวะอากาศ ก่อนออกเดินทาง</p></div><div className="wx-segment" aria-label="ข้อมูลบนกราฟ" role="group">{[['temp', 'อุณหภูมิ'], ['rain', 'โอกาสฝน']].map(([key, label]) => <button type="button" aria-pressed={metric === key} key={key} onClick={() => setMetric(key)}>{label}</button>)}</div></div>
    {hours.length ? <><div className="wx-chart" role="img" aria-label={`กราฟ${metric === 'temp' ? 'อุณหภูมิ' : 'โอกาสฝน'}รายชั่วโมง ตัวเลขทั้งหมดอ่านได้ในรายการถัดไป`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={hours} margin={{ top: 12, right: 12, bottom: 0, left: -22 }}><defs><linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2786ed" stopOpacity={0.25} /><stop offset="100%" stopColor="#2786ed" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis dataKey="label" interval={5} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><YAxis domain={metric === 'rain' ? [0, 100] : ['auto', 'auto']} unit={metric === 'rain' ? '%' : '°'} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }} formatter={v => [value(v, metric === 'rain' ? '%' : '°C'), metric === 'rain' ? 'โอกาสฝน' : 'อุณหภูมิ']} /><Area isAnimationActive={false} connectNulls={false} type="monotone" dataKey={metric} stroke="#1675df" strokeWidth={2.5} fill="url(#forecast-fill)" /></AreaChart></ResponsiveContainer></div><div className="wx-hour-scroll" tabIndex={0} role="region" aria-label="พยากรณ์รายชั่วโมง เลื่อนแนวนอนเพื่อดูครบ 24 ชั่วโมง"><div className="wx-hours">{hours.map(hour => <div className="wx-hour" key={hour.time}><time dateTime={hour.time}>{hour.label}</time><WeatherIcon code={hour.code} isDay={hour.isDay} /><strong>{value(hour.temp, '°')}</strong><span><Droplets size={12} aria-hidden="true" />{value(hour.rain, '%')}</span></div>)}</div></div><p className="wx-footnote">เวลาไทย (UTC+7) · เปอร์เซ็นต์คือโอกาสฝน ไม่ใช่ปริมาณฝน</p></> : <p className="wx-empty">ไม่มีพยากรณ์รายชั่วโมงที่ยังใช้ได้ ลองอัปเดตข้อมูล</p>}
  </section>;
}

export default function Dashboard() {
  const { amphoeData, stations, stationTemps, weatherMeta, lastUpdated } = useContext(WeatherContext);
  const { weatherData, loadingWeather, weatherError, fetchWeatherByCoords } = useWeatherData();
  const [location, setLocation] = useState(initialLocation);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [geo, setGeo] = useState([]);
  const [now, setNow] = useState(Date.now);
  const [radarOpen, setRadarOpen] = useState(false);
  const locationRequest = useRef(0);
  const geocode = useRef(null);
  useEffect(() => {
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); localStorage.setItem('air4thai.selectedProvince', location.province); } catch { /* Optional preference. */ }
  }, [location]);
  useEffect(() => {
    fetchWeatherByCoords(location.lat, location.lon);
    const refresh = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); fetchWeatherByCoords(location.lat, location.lon); } };
    const timer = setInterval(refresh, 600000);
    const clock = setInterval(() => setNow(Date.now()), 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', refresh); };
  }, [location.lat, location.lon, fetchWeatherByCoords]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/thai_geo.json', { signal: controller.signal }).then(r => r.ok ? r.json() : []).then(data => setGeo(Array.isArray(data) ? data : [])).catch(() => {});
    return () => { controller.abort(); geocode.current?.abort(); locationRequest.current += 1; };
  }, []);
  const districts = useMemo(() => {
    const tmd = Object.entries(amphoeData?.provinces || {}).find(([name]) => cleanName(name) === location.province)?.[1]?.amphoes || [];
    if (tmd.length) return tmd.map(d => ({ name: d.n || d.name, lat: finiteOrNull(d.lat), lon: finiteOrNull(d.lon ?? d.lng ?? d.long) })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return (geo.find(p => cleanName(p.name_th || p.name) === location.province)?.districts || []).map(d => ({ name: d.name_th || d.name, lat: null, lon: null }));
  }, [amphoeData, geo, location.province]);
  const chooseProvince = name => {
    locationRequest.current += 1;
    geocode.current?.abort();
    const province = provinces.find(p => p.n === name);
    if (!province) return;
    setLocation({ province: name, label: name, lat: province.lat, lon: province.lon, district: '' });
    setLocationError(''); setLocating(false);
  };
  const chooseDistrict = async name => {
    if (!name) { chooseProvince(location.province); return; }
    const request = ++locationRequest.current;
    geocode.current?.abort();
    const controller = new AbortController(); geocode.current = controller;
    const district = districts.find(d => d.name === name);
    setLocating(true); setLocationError('');
    try {
      let lat = district?.lat, lon = district?.lon;
      if (lat === null || lon === null || lat === undefined || lon === undefined) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=th&limit=1&q=${encodeURIComponent(`${name} ${location.province} ประเทศไทย`)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error('geocode');
        const results = await response.json(); lat = finiteOrNull(results[0]?.lat); lon = finiteOrNull(results[0]?.lon);
      }
      if (lat === null || lon === null) throw new Error('coordinates');
      if (request === locationRequest.current) { setLocation(previous => ({ ...previous, district: name, label: `${name}, ${previous.province}`, lat, lon })); setLocationOpen(false); }
    } catch { if (request === locationRequest.current) setLocationError('หาพิกัดอำเภอนี้ไม่ได้ ยังแสดงพื้นที่เดิมอยู่ กรุณาลองอีกครั้ง'); }
    finally { if (request === locationRequest.current) setLocating(false); }
  };
  const useLocation = () => {
    if (!navigator.geolocation) { setLocationError('อุปกรณ์ไม่รองรับการระบุตำแหน่ง เลือกจังหวัดแทนได้'); return; }
    const request = ++locationRequest.current; geocode.current?.abort(); setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== locationRequest.current) return;
      setLocation(previous => ({ ...previous, lat: coords.latitude, lon: coords.longitude, label: 'ตำแหน่งปัจจุบันของคุณ', district: '' })); setLocating(false); setLocationOpen(false);
    }, () => { if (request === locationRequest.current) { setLocationError('เข้าถึงตำแหน่งไม่ได้ กรุณาอนุญาตสิทธิ์ หรือเลือกจังหวัดด้านล่าง'); setLocating(false); setLocationOpen(true); } }, { timeout: 10000, maximumAge: 300000 });
  };
  const c = weatherData?.current || {};
  const daily = weatherData?.daily || {};
  const stale = weatherData?.stale || (weatherData && now - weatherDate(weatherData.observedAt).getTime() > 5400000);
  const visual = getWeatherVisual(c.weatherCode, c.isDay);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const days = (daily.time || []).map((date, i) => ({ date, code: daily.weathercode?.[i], high: finiteOrNull(daily.temperature_2m_max?.[i]), low: finiteOrNull(daily.temperature_2m_min?.[i]), rain: finiteOrNull(daily.precipitation_probability_max?.[i]), mm: finiteOrNull(daily.precipitation_sum?.[i]) })).filter(day => day.date >= todayKey);
  const temperatures = days.flatMap(day => [day.high, day.low]).filter(v => v !== null);
  const low = temperatures.length ? Math.min(...temperatures) : 0;
  const range = Math.max(1, (temperatures.length ? Math.max(...temperatures) : 1) - low);
  const knownProvinces = stations.filter(station => finiteOrNull(stationTemps[station.stationID]?.temp) !== null).length;
  const nextRain = (weatherData?.hourly?.time || []).map((time, i) => ({ time, probability: finiteOrNull(weatherData.hourly.precipitation_probability?.[i]) })).find(h => weatherDate(h.time).getTime() >= now && weatherDate(h.time).getTime() < now + 43200000 && h.probability !== null && h.probability >= 50);
  const advice = stale ? 'ข้อมูลเดิม โปรดเช็กเวลา' : c.rainProb >= 60 ? 'พกร่ม เผื่อเวลาเดินทาง' : c.feelsLike >= 39 ? 'อากาศร้อน พักในที่ร่ม' : c.pm25 > 37.5 ? 'ติดตามค่าฝุ่นก่อนออกไป' : 'พร้อมวางแผนวันของคุณ';
  const refresh = () => { setNow(Date.now()); fetchWeatherByCoords(location.lat, location.lon); };

  return <div className="wx-page">
    <header className="wx-page-head"><div><p className="wx-date">{dateLabel(now)}</p><h1>วันนี้ อากาศเป็นอย่างไร</h1></div><Link className="wx-monitor-link" to="/map?monitor=1"><Monitor size={17} aria-hidden="true" /> มอนิเตอร์ประเทศ <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <section className="wx-location" aria-label="เลือกพื้นที่พยากรณ์"><button className="wx-place-button" type="button" onClick={() => setLocationOpen(!locationOpen)} aria-expanded={locationOpen} aria-controls="location-controls"><MapPin size={21} aria-hidden="true" /><span><strong>{location.label}</strong><small>เปลี่ยนพื้นที่ <ChevronDown size={13} aria-hidden="true" /></small></span></button><div className="wx-location-actions"><button className="wx-button wx-button--quiet" disabled={locating} onClick={useLocation} type="button"><LocateFixed size={17} aria-hidden="true" /><span>{locating ? 'กำลังค้นหา' : 'ใกล้ฉัน'}</span></button><button className="wx-button wx-button--quiet" disabled={loadingWeather} onClick={refresh} type="button" aria-label="อัปเดตข้อมูลอากาศ"><RefreshCw size={17} className={loadingWeather ? 'is-spinning' : ''} aria-hidden="true" /><span className="wx-refresh-label">อัปเดต</span></button></div>
    {locationOpen && <div className="wx-location-controls" id="location-controls"><label>จังหวัด<select value={location.province} onChange={event => chooseProvince(event.target.value)}>{provinces.map(p => <option key={p.n}>{p.n}</option>)}</select></label><label>อำเภอ / เขต<select value={location.district} disabled={locating || !districts.length} onChange={event => chooseDistrict(event.target.value)}><option value="">จุดอ้างอิงจังหวัด</option>{districts.map(d => <option key={d.name}>{d.name}</option>)}</select></label><p><Info size={14} aria-hidden="true" /> พยากรณ์ตามพิกัดที่เลือก สภาพจริงอาจต่างกันในแต่ละจุด</p></div>}
    {locationError && <p className="wx-message" role="alert">{locationError}</p>}</section>
    {weatherError && <div className="wx-message" role="status"><Info size={18} aria-hidden="true" />{weatherError}</div>}
    {!weatherData ? <section className="wx-panel wx-unavailable" aria-live="polite">{loadingWeather ? <RefreshCw className="is-spinning" size={34} /> : <Cloud size={42} />}<h2>{loadingWeather ? 'กำลังอ่านท้องฟ้าของคุณ' : 'ยังไม่มีข้อมูลอากาศของพื้นที่นี้'}</h2><p>{loadingWeather ? 'กำลังเชื่อมต่อพยากรณ์อากาศและคุณภาพอากาศ' : 'เมื่อเชื่อมต่อได้ จะแสดงค่าพยากรณ์พร้อมเวลาของข้อมูล'}</p>{!loadingWeather && <button className="wx-button" type="button" onClick={refresh}><RefreshCw size={17} /> ลองอีกครั้ง</button>}</section> : <>
    <div className="wx-overview">
      <section className="wx-current" aria-label="สภาพอากาศปัจจุบัน"><div className="wx-current-status"><span className={`wx-status${stale ? ' wx-status--stale' : ''}`}><i />{stale ? 'ข้อมูลเดิม' : 'ค่าจากแบบจำลอง'}</span><span>เวลา {thaiTime(weatherData.observedAt, { day: 'numeric', month: 'short' })} น.</span></div><div className="wx-current-body"><div><h2>{visual.label}</h2><div className="wx-temperature">{value(c.temp)}<span>°C</span></div><p>รู้สึกเหมือน <strong>{value(c.feelsLike, '°')}</strong><span className="wx-dot-separator">·</span>สูง {value(days[0]?.high, '°')} / ต่ำ {value(days[0]?.low, '°')}</p></div><div className="wx-current-icon"><WeatherIcon code={c.weatherCode} isDay={c.isDay} size={64} /><span>{c.isDay ? 'เวลากลางวัน' : 'เวลากลางคืน'}</span></div></div><div className="wx-current-bottom"><span><Sunrise size={17} aria-hidden="true" /> {thaiTime(c.sunrise)}</span><span><Sunset size={17} aria-hidden="true" /> {thaiTime(c.sunset)}</span><span>เวลาประเทศไทย</span></div></section>
      <aside className="wx-brief"><h2>ก่อนออกจากบ้าน</h2><h3>{advice}</h3><div className="wx-brief-row"><Umbrella size={21} aria-hidden="true" /><div><strong>โอกาสฝนชั่วโมงนี้ {value(c.rainProb, '%')}</strong><p>{nextRain ? `มีโอกาสฝน ${value(nextRain.probability, '%')} ช่วง ${thaiTime(nextRain.time)} น.` : 'ดูแนวโน้มรายชั่วโมงเพื่อวางแผนเดินทาง'}</p></div></div><div className="wx-brief-row"><Wind size={21} aria-hidden="true" /><div><strong>PM2.5 {value(c.pm25, ' µg/m³', 1)}</strong><p>{c.pm25 === null ? 'ข้อมูลฝุ่นยังไม่พร้อม' : 'ค่าประมาณจาก CAMS · ไม่ใช่ AQI สถานี'}</p></div></div><a className="wx-inline-link" href="#weather-details">ดูรายละเอียดอากาศ <ArrowRight size={15} aria-hidden="true" /></a></aside>
    </div>
    <section className="wx-readings" id="weather-details" aria-label="รายละเอียดอากาศ"><Reading icon={Droplets} label="ความชื้น" reading={value(c.humidity, '%')} detail="ความชื้นสัมพัทธ์" /><Reading icon={Wind} label="ความเร็วลม" reading={value(c.windSpeed, ' กม./ชม.')} detail={c.windDirection === null ? 'ทิศทางไม่พร้อม' : `พัดมาจาก ${value(c.windDirection, '°')}`} /><Reading icon={Sun} label="ดัชนี UV" reading={value(c.uv, '', 1)} detail={c.uv === null ? 'ข้อมูลไม่พร้อม' : c.uv >= 8 ? 'สูงมาก' : c.uv >= 6 ? 'สูง' : c.uv >= 3 ? 'ปานกลาง' : 'ต่ำ'} /><Reading icon={Eye} label="ทัศนวิสัย" reading={value(c.visibility === null ? null : c.visibility / 1000, ' กม.', 1)} detail="ระยะมองเห็นโดยประมาณ" /><Reading icon={Gauge} label="ความกดอากาศ" reading={value(c.pressure, ' hPa')} detail="ความกดที่ระดับพื้นผิว" /><Reading icon={CloudRain} label="ปริมาณฝนวันนี้" reading={value(days[0]?.mm, ' มม.', 1)} detail="พยากรณ์สะสมทั้งวัน" /></section>
    <HourlyForecast hourly={weatherData.hourly} now={now} />
    <div className="wx-lower-grid"><section className="wx-panel wx-weekly" aria-labelledby="weekly-title"><div className="wx-section-head"><div><h2 id="weekly-title">พยากรณ์ 7 วัน</h2><p>อุณหภูมิต่ำสุด–สูงสุด และโอกาสฝน</p></div><Thermometer size={22} aria-hidden="true" /></div><div className="wx-day-list">{days.map((day, i) => <div className="wx-day" key={day.date}><div><strong>{i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : dateLabel(day.date).split(' ')[0]}</strong><small>{dateLabel(day.date).split(' ').slice(1).join(' ')}</small></div><WeatherIcon code={day.code} /><span className="wx-day-rain"><Droplets size={13} aria-hidden="true" />{value(day.rain, '%')}</span><span className="wx-day-low">{value(day.low, '°')}</span><span className="wx-temp-range" aria-hidden="true">{day.low !== null && day.high !== null && <i style={{ left: `${(day.low - low) / range * 100}%`, width: `${Math.max(3, (day.high - day.low) / range * 100)}%` }} />}</span><strong>{value(day.high, '°')}</strong></div>)}</div><p className="wx-footnote">พยากรณ์อาจเปลี่ยนแปลง โดยเฉพาะวันที่อยู่ไกลออกไป</p></section>
    <aside className="wx-tools"><section className="wx-panel wx-air"><div className="wx-section-head"><h2>รู้ทันฝุ่น PM2.5</h2><Wind size={23} aria-hidden="true" /></div><div className="wx-air-value">{value(c.pm25, '', 1)}<span>µg/m³</span></div><p>ค่าประมาณรายชั่วโมง ณ พิกัดที่เลือก</p><div className="wx-air-note"><Info size={18} aria-hidden="true" /><p>ค่านี้มาจากแบบจำลอง CAMS ไม่ใช่ค่าตรวจวัดหรือค่าเฉลี่ย 24 ชั่วโมง จึงไม่แสดงเป็นระดับ AQI ทางการ</p></div><small>ข้อมูลฝุ่นเวลา {thaiTime(weatherData.airObservedAt, { day: 'numeric', month: 'short' })}</small><Link className="wx-inline-link" to="/map">ดูข้อมูลภาพรวมประเทศ <ArrowRight size={15} aria-hidden="true" /></Link></section><section className="wx-monitor-promo"><Monitor size={23} aria-hidden="true" /><h2>มองภาพรวมทั้งประเทศ</h2><p>{weatherMeta.source === 'unavailable' ? 'ข้อมูลส่วนกลางยังไม่พร้อม ดูแผนที่และสถานะแต่ละจังหวัดได้' : `${knownProvinces} จังหวัดมีค่าอุณหภูมิ · ${weatherMeta.stale ? 'ข้อมูลเดิม' : 'อัปเดต'} ${thaiTime(lastUpdated)}`}</p><Link className="wx-button" to="/map?monitor=1">เปิดมอนิเตอร์ <ArrowUpRight size={17} aria-hidden="true" /></Link></section></aside></div>
    <section className="wx-radar"><button className="wx-radar-toggle" type="button" onClick={() => setRadarOpen(!radarOpen)} aria-expanded={radarOpen} aria-controls="radar-content"><span><CloudRain size={24} aria-hidden="true" /><span><strong>ดูเรดาร์ฝนใกล้คุณ</strong><small>ภาพกลุ่มฝนและการวิเคราะห์ระยะสั้น</small></span></span><ChevronDown className={radarOpen ? 'is-open' : ''} size={22} aria-hidden="true" /></button>{radarOpen && <div id="radar-content" className="wx-radar-content"><p className="wx-footnote">ตรวจเวลาบนภาพเรดาร์ประกอบทุกครั้ง การวิเคราะห์อัตโนมัติไม่ใช่ประกาศเตือนภัยทางการ</p><iframe loading="lazy" title={`เรดาร์ฝน ${location.label}`} src={`https://embed.windy.com/embed2.html?lat=${location.lat}&lon=${location.lon}&zoom=8&level=surface&overlay=radar&product=radar&marker=true`} allowFullScreen /><RainNowcast key={`${location.lat}:${location.lon}`} coords={weatherData.coords} current={c} locationLabel={location.label} minutely={weatherData.minutely} onUseLocation={useLocation} /></div>}</section>
    </>}
    <footer className="wx-sources"><ShieldCheck size={20} aria-hidden="true" /><div><strong>รู้ที่มา วางแผนได้มั่นใจขึ้น</strong><p>พยากรณ์อากาศ: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · ฝุ่น: <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS</a> ผ่าน Open-Meteo · พิกัดอำเภอ: OpenStreetMap</p><p>อัปเดตอัตโนมัติทุก 10 นาทีเมื่อเปิดหน้านี้ · ค่าที่ไม่มีข้อมูลแสดงเป็น — · <Link to="/news">ดูประกาศจากหน่วยงาน</Link></p></div></footer>
  </div>;
}
