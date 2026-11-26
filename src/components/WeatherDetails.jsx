import { createElement, useContext, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Droplets, Eye, Gauge, Info, Monitor, Moon, RefreshCw, Snowflake, Sun, Sunrise, Sunset, Thermometer, Umbrella, Wind } from 'lucide-react';
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
  return createElement(icons[visual.icon], { size, strokeWidth: 1.7, 'aria-hidden': true, className: `wx-icon wx-icon--${visual.icon}` });
}
function Reading({ icon: Icon, label, reading, detail, metric, number, unit, hours, stale, divisor }) {
  return <div className="wx-reading">{createElement(Icon, { size: 20, 'aria-hidden': true })}<span>{label}</span>{metric ? <RiskValue metric={metric} value={number} unit={unit} hours={hours} stale={stale} divisor={divisor} label /> : <strong>{reading}</strong>}<small>{detail}</small></div>;
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
  const advice = stale ? 'ข้อมูลเดิม โปรดเช็กเวลา'
    : nextRainMm !== null && nextRainMm > 0.1 ? 'มีฝนในช่วงถัดไป เตรียมร่มไว้'
      : today?.mm !== null && today?.mm > 35 ? 'พยากรณ์ฝนวันนี้ค่อนข้างมาก เผื่อเวลาเดินทาง'
        : finiteOrNull(c.pm25Average24h) !== null && !airStale && c.pm25Average24h > 37.5 ? 'ค่าฝุ่น PM2.5 เฉลี่ย 24 ชม. สูง พิจารณาสวมหน้ากาก'
          : finiteOrNull(c.temp) !== null && c.temp >= 35 ? 'อากาศร้อน วางแผนช่วงกลางวัน'
            : finiteOrNull(c.temp) !== null && c.temp < 16 ? 'อากาศหนาว เตรียมเสื้อกันหนาว'
              : finiteOrNull(c.windGust) !== null && c.windGust >= 40 ? 'มีลมกระโชกแรง ระมัดระวังกลางแจ้ง'
                : 'เช็กอากาศก่อนออกเดินทาง';

  if (!forecast) return <section className="wx-panel wx-unavailable" aria-live="polite">{loading ? <RefreshCw className="is-spinning" size={34} /> : <Cloud size={42} />}<h2>{loading ? 'กำลังอ่านท้องฟ้าของคุณ' : 'ยังไม่มีข้อมูลอากาศของพื้นที่นี้'}</h2><p>{loading ? 'กำลังเชื่อมต่อพยากรณ์อากาศและคุณภาพอากาศ' : 'เมื่อเชื่อมต่อได้ จะแสดงค่าพยากรณ์พร้อมเวลาของข้อมูล'}</p>{!loading && <button className="wx-button" type="button" onClick={onRefresh}><RefreshCw size={17} /> ลองอีกครั้ง</button>}</section>;
  return <>
    <div className="wx-overview">
      <section className="wx-current" aria-label="สภาพอากาศปัจจุบัน">
        <div className="wx-current-status"><span className={`wx-status${stale ? ' wx-status--stale' : ''}`}><i />{stale ? 'ข้อมูลเดิม' : 'ค่าจากแบบจำลอง'}</span><span>เวลา {thaiTime(validAt, { day: 'numeric', month: 'short' })} น.</span></div>
        <div className="wx-current-body"><div><h2>{visual.label}</h2><div className="wx-temperature"><RiskValue metric="temperature" value={c.temp} digits={1} stale={stale} /><span>°C</span></div><p>รู้สึกเหมือน <RiskValue metric="apparent" value={c.feelsLike} unit="°" stale={stale} /> · <RiskValue metric="temperature" value={c.temp} stale={stale} label className="risk-label-only" /></p></div><div className="wx-current-icon"><WeatherIcon code={c.weatherCode} isDay={c.isDay} size={64} /><span>{c.isDay ? 'เวลากลางวัน' : 'เวลากลางคืน'}</span></div></div>
        <div className="wx-extremes"><span>พยากรณ์วันนี้</span><div><small>ต่ำสุด</small><RiskValue metric="temperature" value={today?.low} unit="°C" stale={stale} /></div><div><small>สูงสุด</small><RiskValue metric="temperature" value={today?.high} unit="°C" stale={stale} /></div><small>00:00–24:00 น.</small></div>
        <div className="wx-current-bottom"><span><Sunrise size={17} aria-hidden="true" /> {thaiTime(c.sunrise)}</span><span><Sunset size={17} aria-hidden="true" /> {thaiTime(c.sunset)}</span><span>เวลาประเทศไทย</span></div>
      </section>
      <aside className="wx-brief"><h2>ก่อนออกจากบ้าน</h2><h3>{advice}</h3>
        <div className="wx-brief-row"><Umbrella size={21} aria-hidden="true" /><div><strong>พยากรณ์ฝนวันนี้ <RiskValue metric="rain" value={today?.mm} unit=" มม." hours={24} stale={stale} /></strong><p><RiskValue metric="rain" value={today?.mm} hours={24} stale={stale} label className="risk-label-only" /> · สะสม 00:00–24:00 น.</p></div></div>
        <div className="wx-brief-row"><CloudRain size={21} aria-hidden="true" /><div><strong>ช่วง {thaiTime(windowStart)}–{thaiTime(windowEnd)} น. <RiskValue metric="rain" value={nextRainMm} unit=" มม." hours={3} stale={stale} /></strong><p>พยากรณ์สะสม 3 ชั่วโมง · {dateLabel(windowStart)}{dateLabel(windowStart) !== dateLabel(windowEnd) ? ` ถึง ${dateLabel(windowEnd)}` : ''}</p></div></div>
        <div className="wx-brief-row"><Wind size={21} aria-hidden="true" /><div><strong>PM2.5 รายชั่วโมง <RiskValue metric="pm25" value={c.pm25} unit=" µg/m³" stale={airStale} /></strong><p>{airStale ? 'ค่าฝุ่นยังไม่พร้อมหรือเป็นข้อมูลเดิม · ตรวจเวลา' : 'ค่าประมาณ CAMS · ดูค่าเฉลี่ยและสถานีด้านล่าง'}</p></div></div>
        <a className="wx-inline-link" href="#weather-details">ดูรายละเอียดอากาศ <ArrowRight size={15} aria-hidden="true" /></a>
      </aside>
    </div>
    <section className="wx-readings" id="weather-details" aria-label="รายละเอียดอากาศ">
      <Reading icon={Wind} label="ลมกระโชก" metric="gust" number={c.windGust} unit=" กม./ชม." stale={stale} detail={`ลมปกติ ${value(c.windSpeed, ' กม./ชม.')} · ทิศ${thaiWindDirection(c.windDirection)}`} />
      <Reading icon={Sun} label="ดัชนี UV" metric="uv" number={c.uv} stale={stale} detail="ค่าพยากรณ์ ณ ชั่วโมงนี้" />
      <Reading icon={Eye} label="ทัศนวิสัย" metric="visibility" number={c.visibility} unit=" กม." divisor={1000} stale={stale} detail="ระยะมองเห็นโดยประมาณ" />
      <Reading icon={Droplets} label="ความชื้น" reading={value(c.humidity, '%')} detail="ความชื้นสัมพัทธ์" />
      <Reading icon={Gauge} label="ความกดอากาศ" reading={value(c.pressure, ' hPa')} detail="ความกดที่ระดับพื้นผิว" />
      <Reading icon={CloudRain} label="ฝนสะสมวันนี้" metric="rain" number={today?.mm} unit=" มม." hours={24} stale={stale} detail="พยากรณ์ 00:00–24:00 น." />
    </section>
    <RiskLegend />
    <WeatherTimeline hourly={forecast.hourly} now={now} stale={stale} />
    <div className="wx-lower-grid"><section className="wx-panel wx-weekly" aria-labelledby="weekly-title"><div className="wx-section-head"><div><h2 id="weekly-title">พยากรณ์ 7 วัน</h2><p>ต่ำสุด–สูงสุด · ฝนสะสมแต่ละวัน 00:00–24:00 น.</p></div><Thermometer size={22} aria-hidden="true" /></div><div className="wx-day-list">{days.map(day => <div className="wx-day" key={day.date}><div><strong>{day.date === todayKey ? 'วันนี้' : day.date === tomorrowKey ? 'พรุ่งนี้' : dateLabel(day.date).split(' ')[0]}</strong><small>{dateLabel(day.date).split(' ').slice(1).join(' ')}</small></div><WeatherIcon code={day.code} /><span className="wx-day-rain"><RiskValue metric="rain" value={day.mm} unit=" มม." hours={24} stale={stale} /><small>โอกาส {value(day.probability, '%')}</small></span><RiskValue className="wx-day-low" metric="temperature" value={day.low} unit="°" stale={stale} /><span className="wx-temp-range" aria-hidden="true">{day.low !== null && day.high !== null && <i style={{ left: `${(day.low - low) / range * 100}%`, width: `${Math.max(3, (day.high - day.low) / range * 100)}%` }} />}</span><RiskValue metric="temperature" value={day.high} unit="°" stale={stale} /></div>)}</div><p className="wx-footnote">พยากรณ์อาจเปลี่ยนแปลง โดยเฉพาะวันที่อยู่ไกลออกไป</p></section>
      <aside className="wx-tools"><section className="wx-panel wx-air"><div className="wx-section-head"><h2>รู้ทันฝุ่น PM2.5</h2><Wind size={23} aria-hidden="true" /></div><div className="wx-air-value"><RiskValue metric="pm25" value={c.pm25Average24h} hours={24} stale={airStale} /><span>µg/m³</span></div><p>ค่าเฉลี่ย 24 ชั่วโมงจากแบบจำลอง</p><div className="wx-air-badge"><RiskValue metric="pm25" value={c.pm25Average24h} hours={24} stale={airStale} label className="risk-label-only" /></div><div className="wx-air-note"><Info size={18} aria-hidden="true" /><p>คำนวณเมื่อมีข้อมูลครบ 24 ชั่วโมงเท่านั้น สีเทียบเกณฑ์ PM2.5 เฉลี่ย 24 ชม. ค่านี้เป็นแบบจำลอง CAMS ไม่ใช่ผลตรวจวัดหรือ AQI ทางการ</p></div><small>มีข้อมูล {c.pm25ValidHours24h ?? 0}/24 ชั่วโมง · {airStale ? 'ข้อมูลเดิม / ไม่พร้อม' : 'เวลาค่าฝุ่น'} {thaiTime(airTime, { day: 'numeric', month: 'short' })}</small><div className="wx-inline-links"><Link className="wx-inline-link" to="/map">ดูข้อมูลภาพรวมประเทศ <ArrowRight size={15} aria-hidden="true" /></Link><Link className="wx-inline-link" to={`/stats?province=${encodeURIComponent(location.mountainId ? location.label : location.province)}`}>ดูสถิติย้อนหลังพื้นที่นี้ <ArrowRight size={15} aria-hidden="true" /></Link></div></section><section className="wx-monitor-promo"><Monitor size={23} aria-hidden="true" /><h2>มองภาพรวมทั้งประเทศ</h2><p>{weatherMeta.source === 'unavailable' ? 'ข้อมูลส่วนกลางยังไม่พร้อม ดูแผนที่และสถานะแต่ละจังหวัดได้' : `${knownProvinces} จุดอ้างอิงจังหวัดมีค่าอุณหภูมิ · ${weatherMeta.stale ? 'ข้อมูลเดิม' : 'อัปเดต'} ${thaiTime(lastUpdated)}`}</p><Link className="wx-button" to="/map?monitor=1">เปิดมอนิเตอร์ <ArrowUpRight size={17} aria-hidden="true" /></Link></section></aside>
    </div>
    <section className="wx-radar"><button className="wx-radar-toggle" type="button" onClick={() => setRadarOpen(!radarOpen)} aria-expanded={radarOpen} aria-controls="radar-content"><span><CloudRain size={24} aria-hidden="true" /><span><strong>ดูเรดาร์ฝนใกล้คุณ</strong><small>ภาพเรดาร์ย้อนหลัง พร้อมเวลาและสถานะพื้นที่ครอบคลุม</small></span></span><ChevronDown className={radarOpen ? 'is-open' : ''} size={22} aria-hidden="true" /></button>{radarOpen && <div id="radar-content" className="wx-radar-content"><RainNowcast key={`${location.lat}:${location.lon}`} coords={forecast.coords} locationLabel={location.label} onUseLocation={onUseLocation} /></div>}</section>
  </>;
}
