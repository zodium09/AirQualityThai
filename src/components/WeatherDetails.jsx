import { createElement, useContext, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Droplets, Eye, Gauge, Info, Monitor, Moon, RefreshCw, Snowflake, Sparkles, Sun, Sunrise, Sunset, Thermometer, Umbrella, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WeatherContext } from '../context/WeatherContext';
import { BANGKOK, displayValue as value, finiteOrNull, getWeatherVisual, thaiTime, thaiWindDirection, weatherDate, sumHourlyPrecipitation } from '../utils/weatherData';
import RiskValue, { RiskLegend } from './RiskValue';
import WeatherTimeline from './WeatherTimeline';
import RainNowcast from './RainNowcast';

const icons = { sun: Sun, moon: Moon, cloud: Cloud, partly: CloudSun, cloudMoon: CloudMoon, rain: CloudRain, drizzle: CloudDrizzle, storm: CloudLightning, fog: CloudFog, snow: Snowflake, unknown: Cloud };
const dateLabel = date => new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, weekday: 'short', day: 'numeric', month: 'short' }).format(weatherDate(date));
const dateKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
function WeatherIcon({ code, isDay = true, size = 28 }) {
  const visual = getWeatherVisual(code, isDay);
  return createElement(icons[visual.icon], { size, strokeWidth: 1.8, 'aria-hidden': true, className: `wx-icon wx-icon--${visual.icon}` });
}
function Reading({ icon: Icon, label, reading, detail, metric, number, unit, hours, stale, divisor, tone = 'sky' }) {
  return <div className={`wx-reading wx-reading--${tone}`}>
    <span className="wx-reading-icon" aria-hidden="true">{createElement(Icon, { size: 18 })}</span>
    <span>{label}</span>
    {metric ? <RiskValue metric={metric} value={number} unit={unit} hours={hours} stale={stale} divisor={divisor} label /> : <strong>{reading}</strong>}
    <small>{detail}</small>
  </div>;
}
function pm25ScalePosition(valueInput) {
  const num = finiteOrNull(valueInput);
  if (num === null || num < 0) return null;
  if (num <= 15) return (num / 15) * 20;
  if (num <= 25) return 20 + ((num - 15) / 10) * 20;
  if (num <= 37.5) return 40 + ((num - 25) / 12.5) * 20;
  if (num <= 75) return 60 + ((num - 37.5) / 37.5) * 20;
  return Math.min(98, 80 + ((num - 75) / 75) * 20);
}
export default function WeatherDetails({ forecast, loading, location, now, onRefresh, onUseLocation }) {
  const { stations, stationTemps, weatherMeta, lastUpdated } = useContext(WeatherContext);
  const [radarOpen, setRadarOpen] = useState(false);
  const c = forecast?.current || {};
  const daily = forecast?.daily || {};
  const validAt = forecast?.validAt || forecast?.observedAt;
  const stale = forecast?.stale || !validAt || now - weatherDate(validAt).getTime() > 5400000;
  const airTime = forecast?.airValidAt || forecast?.airObservedAt;
  const airStale = forecast?.airStale || !airTime || now - weatherDate(airTime).getTime() > 5400000;
  const visual = getWeatherVisual(c.weatherCode, c.isDay);
  const todayKey = dateKey(now), tomorrowKey = dateKey(now + 86400000);
  const days = (daily.time || []).map((date, i) => ({ date, code: daily.weathercode?.[i], high: finiteOrNull(daily.temperature_2m_max?.[i]), low: finiteOrNull(daily.temperature_2m_min?.[i]), probability: finiteOrNull(daily.precipitation_probability_max?.[i]), mm: finiteOrNull(daily.precipitation_sum?.[i]) })).filter(day => day.date >= todayKey);
  const today = days.find(day => day.date === todayKey);
  const temperatures = days.flatMap(day => [day.high, day.low]).filter(v => v !== null);
  const low = temperatures.length ? Math.min(...temperatures) : 0;
  const range = Math.max(1, (temperatures.length ? Math.max(...temperatures) : 1) - low);
  const knownProvinces = stations.filter(station => finiteOrNull(stationTemps[station.stationID]?.temp) !== null).length;
  const windowStart = Math.ceil(now / 3600000) * 3600000, windowEnd = windowStart + 3 * 3600000;
  const nextRainMm = sumHourlyPrecipitation(forecast?.hourly || {}, windowStart, windowEnd);
  const adviceInfo = stale ? { text: 'ข้อมูลเดิม โปรดเช็กเวลา', tone: 'stale', icon: Info }
    : nextRainMm !== null && nextRainMm > 0.1 ? { text: 'มีฝนในช่วงถัดไป เตรียมร่มไว้', tone: 'rain', icon: Umbrella }
      : today?.mm !== null && today?.mm > 35 ? { text: 'พยากรณ์ฝนวันนี้ค่อนข้างมาก เผื่อเวลาเดินทาง', tone: 'rain', icon: CloudRain }
        : finiteOrNull(c.pm25Average24h) !== null && !airStale && c.pm25Average24h > 37.5 ? { text: 'ค่าฝุ่น PM2.5 เฉลี่ย 24 ชม. สูง พิจารณาสวมหน้ากาก', tone: 'air', icon: Wind }
          : finiteOrNull(c.temp) !== null && c.temp >= 35 ? { text: 'อากาศร้อน วางแผนช่วงกลางวัน', tone: 'heat', icon: Sun }
            : finiteOrNull(c.temp) !== null && c.temp < 16 ? { text: 'อากาศหนาว เตรียมเสื้อกันหนาว', tone: 'cool', icon: Snowflake }
              : finiteOrNull(c.windGust) !== null && c.windGust >= 40 ? { text: 'มีลมกระโชกแรง ระมัดระวังกลางแจ้ง', tone: 'wind', icon: Wind }
                : { text: 'เช็กอากาศก่อนออกเดินทาง', tone: 'clear', icon: Sparkles };
  const pmMarker = !airStale ? pm25ScalePosition(c.pm25Average24h) : null;

  if (!forecast) return <section className="wx-panel wx-unavailable" aria-live="polite">{loading ? <RefreshCw className="is-spinning" size={34} /> : <Cloud size={42} />}<h2>{loading ? 'กำลังอ่านท้องฟ้าของคุณ' : 'ยังไม่มีข้อมูลอากาศของพื้นที่นี้'}</h2><p>{loading ? 'กำลังเชื่อมต่อพยากรณ์อากาศและคุณภาพอากาศ' : 'เมื่อเชื่อมต่อได้ จะแสดงค่าพยากรณ์พร้อมเวลาของข้อมูล'}</p>{!loading && <button className="wx-button" type="button" onClick={onRefresh}><RefreshCw size={17} /> ลองอีกครั้ง</button>}</section>;
  return <>
    <div className="wx-overview">
      <section className={`wx-current wx-current--${visual.icon} wx-current--${c.isDay ? 'day' : 'night'}`} aria-label="สภาพอากาศปัจจุบัน">
        <div className="wx-current-status">
          <span className={`wx-status${stale ? ' wx-status--stale' : ''}`}><i />{stale ? 'ข้อมูลเดิม' : 'ค่าจากแบบจำลอง'}</span>
          <span className="wx-current-time">เวลา {thaiTime(validAt, { day: 'numeric', month: 'short' })} น.</span>
        </div>
        <div className="wx-current-body">
          <div className="wx-current-main">
            <h2>{visual.label}</h2>
            <div className="wx-temperature"><RiskValue metric="temperature" value={c.temp} digits={1} stale={stale} /><span>°C</span></div>
            <p className="wx-feels-pill">รู้สึกเหมือน <RiskValue metric="apparent" value={c.feelsLike} unit="°" stale={stale} /> · <RiskValue metric="temperature" value={c.temp} stale={stale} label className="risk-label-only" /></p>
          </div>
          <div className="wx-current-icon">
            <div className="wx-current-icon-ring"><WeatherIcon code={c.weatherCode} isDay={c.isDay} size={64} /></div>
            <span>{c.isDay ? 'เวลากลางวัน' : 'เวลากลางคืน'}</span>
          </div>
        </div>
        <div className="wx-extremes">
          <span>พยากรณ์วันนี้</span>
          <div className="wx-extreme-item wx-extreme-item--min"><small><ArrowDown size={13} aria-hidden="true" /> ต่ำสุด</small><RiskValue className="wx-extreme-min" metric="temperature" value={today?.low} unit="°C" stale={stale} /></div>
          <div className="wx-extreme-item wx-extreme-item--max"><small><ArrowUp size={13} aria-hidden="true" /> สูงสุด</small><RiskValue className="wx-extreme-max" metric="temperature" value={today?.high} unit="°C" stale={stale} /></div>
          <small>00:00–24:00 น.</small>
        </div>
        <div className="wx-current-bottom">
          <span className="wx-sun-chip"><Sunrise size={16} aria-hidden="true" /> {thaiTime(c.sunrise)}</span>
          <span className="wx-sun-chip"><Sunset size={16} aria-hidden="true" /> {thaiTime(c.sunset)}</span>
          <span>เวลาประเทศไทย</span>
        </div>
      </section>
      <aside className="wx-brief">
        <div className={`wx-brief-head wx-brief-head--${adviceInfo.tone}`}>
          <span className="wx-brief-badge" aria-hidden="true">{createElement(adviceInfo.icon, { size: 20 })}</span>
          <div>
            <h2>ก่อนออกจากบ้าน</h2>
            <h3>{adviceInfo.text}</h3>
          </div>
        </div>
        <div className="wx-brief-list">
          <div className="wx-brief-row wx-brief-row--rain">
            <span className="wx-brief-icon" aria-hidden="true"><Umbrella size={18} /></span>
            <div><strong>พยากรณ์ฝนวันนี้ <RiskValue metric="rain" value={today?.mm} unit=" มม." hours={24} stale={stale} /></strong><p><RiskValue metric="rain" value={today?.mm} hours={24} stale={stale} label className="risk-label-only" /> · สะสม 00:00–24:00 น.</p></div>
          </div>
          <div className="wx-brief-row wx-brief-row--next">
            <span className="wx-brief-icon" aria-hidden="true"><CloudRain size={18} /></span>
            <div><strong>ช่วง {thaiTime(windowStart)}–{thaiTime(windowEnd)} น. <RiskValue metric="rain" value={nextRainMm} unit=" มม." hours={3} stale={stale} /></strong><p>พยากรณ์สะสม 3 ชั่วโมง · {dateLabel(windowStart)}{dateLabel(windowStart) !== dateLabel(windowEnd) ? ` ถึง ${dateLabel(windowEnd)}` : ''}</p></div>
          </div>
          <div className="wx-brief-row wx-brief-row--air">
            <span className="wx-brief-icon" aria-hidden="true"><Wind size={18} /></span>
            <div><strong>PM2.5 รายชั่วโมง <RiskValue metric="pm25" value={c.pm25} unit=" µg/m³" stale={airStale} /></strong><p>{airStale ? 'ค่าฝุ่นยังไม่พร้อมหรือเป็นข้อมูลเดิม · ตรวจเวลา' : 'ค่าประมาณ CAMS · ดูค่าเฉลี่ยและสถานีด้านล่าง'}</p></div>
          </div>
        </div>
        <a className="wx-inline-link" href="#weather-details">ดูรายละเอียดอากาศ <ArrowRight size={15} aria-hidden="true" /></a>
      </aside>
    </div>
    <section className="wx-readings" id="weather-details" aria-label="รายละเอียดอากาศ">
      <Reading tone="wind" icon={Wind} label="ลมกระโชก" metric="gust" number={c.windGust} unit=" กม./ชม." stale={stale} detail={`ลมปกติ ${value(c.windSpeed, ' กม./ชม.')} · ทิศ${thaiWindDirection(c.windDirection)}`} />
      <Reading tone="uv" icon={Sun} label="ดัชนี UV" metric="uv" number={c.uv} stale={stale} detail="ค่าพยากรณ์ ณ ชั่วโมงนี้" />
      <Reading tone="vis" icon={Eye} label="ทัศนวิสัย" metric="visibility" number={c.visibility} unit=" กม." divisor={1000} stale={stale} detail="ระยะมองเห็นโดยประมาณ" />
      <Reading tone="humid" icon={Droplets} label="ความชื้น" reading={value(c.humidity, '%')} detail="ความชื้นสัมพัทธ์" />
      <Reading tone="press" icon={Gauge} label="ความกดอากาศ" reading={value(c.pressure, ' hPa')} detail="ความกดที่ระดับพื้นผิว" />
      <Reading tone="rain" icon={CloudRain} label="ฝนสะสมวันนี้" metric="rain" number={today?.mm} unit=" มม." hours={24} stale={stale} detail="พยากรณ์ 00:00–24:00 น." />
    </section>
    <RiskLegend />
    <WeatherTimeline hourly={forecast.hourly} now={now} stale={stale} />
    <div className="wx-lower-grid">
      <section className="wx-panel wx-weekly" aria-labelledby="weekly-title">
        <div className="wx-section-head">
          <div><h2 id="weekly-title">พยากรณ์ 7 วัน</h2><p>ต่ำสุด–สูงสุด · ฝนสะสมแต่ละวัน 00:00–24:00 น.</p></div>
          <span className="wx-head-badge wx-head-badge--warm" aria-hidden="true"><Thermometer size={20} /></span>
        </div>
        <div className="wx-day wx-day-head" aria-hidden="true"><span>วัน</span><span /><span className="wx-day-rain">ฝน</span><span className="wx-day-low">ต่ำสุด</span><span className="wx-day-range-col" /><span className="wx-day-high">สูงสุด</span></div>
        <div className="wx-day-list">{days.map(day => <div className={`wx-day${day.date === todayKey ? ' wx-day--today' : ''}`} key={day.date}><div><strong>{day.date === todayKey ? 'วันนี้' : day.date === tomorrowKey ? 'พรุ่งนี้' : dateLabel(day.date).split(' ')[0]}</strong><small>{dateLabel(day.date).split(' ').slice(1).join(' ')}</small></div><WeatherIcon code={day.code} /><span className="wx-day-rain"><RiskValue metric="rain" value={day.mm} unit=" มม." hours={24} stale={stale} /><small>โอกาส {value(day.probability, '%')}</small></span><RiskValue className="wx-day-low wx-extreme-min" metric="temperature" value={day.low} unit="°" stale={stale} /><span className="wx-temp-range" aria-hidden="true">{day.low !== null && day.high !== null && <i style={{ left: `${(day.low - low) / range * 100}%`, width: `${Math.max(4, (day.high - day.low) / range * 100)}%` }} />}</span><RiskValue className="wx-day-high wx-extreme-max" metric="temperature" value={day.high} unit="°" stale={stale} /></div>)}</div>
        <p className="wx-footnote">พยากรณ์อาจเปลี่ยนแปลง โดยเฉพาะวันที่อยู่ไกลออกไป</p>
      </section>
      <aside className="wx-tools">
        <section className="wx-panel wx-air">
          <div className="wx-section-head">
            <div><h2>รู้ทันฝุ่น PM2.5</h2><p>ค่าเฉลี่ย 24 ชั่วโมงจากแบบจำลอง</p></div>
            <span className="wx-head-badge wx-head-badge--air" aria-hidden="true"><Wind size={20} /></span>
          </div>
          <div className="wx-air-hero">
            <div className="wx-air-value"><RiskValue metric="pm25" value={c.pm25Average24h} hours={24} stale={airStale} /><span>µg/m³</span></div>
            <div className="wx-air-badge"><RiskValue metric="pm25" value={c.pm25Average24h} hours={24} stale={airStale} label className="risk-label-only" /></div>
          </div>
          <div className="wx-pm-scale" aria-hidden="true">
            <div className="wx-pm-scale__track">
              <span className="wx-pm-band wx-pm-band--1" />
              <span className="wx-pm-band wx-pm-band--2" />
              <span className="wx-pm-band wx-pm-band--3" />
              <span className="wx-pm-band wx-pm-band--4" />
              <span className="wx-pm-band wx-pm-band--5" />
              {pmMarker !== null && <i className="wx-pm-scale__dot" style={{ left: `${pmMarker}%` }} />}
            </div>
            <div className="wx-pm-scale__labels"><span>0</span><span>15</span><span>25</span><span>37.5</span><span>75+</span></div>
          </div>
          <div className="wx-air-note"><Info size={18} aria-hidden="true" /><p>คำนวณเมื่อมีข้อมูลครบ 24 ชั่วโมงเท่านั้น สีเทียบเกณฑ์ PM2.5 เฉลี่ย 24 ชม. ค่านี้เป็นแบบจำลอง CAMS ไม่ใช่ผลตรวจวัดหรือ AQI ทางการ</p></div>
          <small>มีข้อมูล {c.pm25ValidHours24h ?? 0}/24 ชั่วโมง · {airStale ? 'ข้อมูลเดิม / ไม่พร้อม' : 'เวลาค่าฝุ่น'} {thaiTime(airTime, { day: 'numeric', month: 'short' })}</small>
          <div className="wx-inline-links"><Link className="wx-inline-link" to="/map">ดูข้อมูลภาพรวมประเทศ <ArrowRight size={15} aria-hidden="true" /></Link><Link className="wx-inline-link" to={`/stats?province=${encodeURIComponent(location.mountainId ? location.label : location.province)}`}>ดูสถิติย้อนหลังพื้นที่นี้ <ArrowRight size={15} aria-hidden="true" /></Link></div>
        </section>
        <section className="wx-monitor-promo">
          <span className="wx-monitor-promo__icon" aria-hidden="true"><Monitor size={22} /></span>
          <h2>มองภาพรวมทั้งประเทศ</h2>
          <p>{weatherMeta.source === 'unavailable' ? 'ข้อมูลส่วนกลางยังไม่พร้อม ดูแผนที่และสถานะแต่ละจังหวัดได้' : `${knownProvinces} จุดอ้างอิงจังหวัดมีค่าอุณหภูมิ · ${weatherMeta.stale ? 'ข้อมูลเดิม' : 'อัปเดต'} ${thaiTime(lastUpdated)}`}</p>
          <Link className="wx-button wx-monitor-promo__cta" to="/map?monitor=1">เปิดมอนิเตอร์ <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </section>
      </aside>
    </div>
    <section className="wx-radar"><button className="wx-radar-toggle" type="button" onClick={() => setRadarOpen(!radarOpen)} aria-expanded={radarOpen} aria-controls="radar-content"><span><span className="wx-head-badge wx-head-badge--sky" aria-hidden="true"><CloudRain size={21} /></span><span><strong>ดูเรดาร์ฝนใกล้คุณ</strong><small>ภาพเรดาร์ย้อนหลัง พร้อมเวลาและสถานะพื้นที่ครอบคลุม</small></span></span><ChevronDown className={radarOpen ? 'is-open' : ''} size={22} aria-hidden="true" /></button>{radarOpen && <div id="radar-content" className="wx-radar-content"><RainNowcast key={`${location.lat}:${location.lon}`} coords={forecast.coords} locationLabel={location.label} onUseLocation={onUseLocation} /></div>}</section>
  </>;
}
