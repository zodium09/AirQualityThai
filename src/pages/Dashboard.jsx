import { createElement, useContext, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  LocateFixed,
  Map,
  Navigation,
  ShieldCheck,
  Sun,
  ThermometerSun,
  Umbrella,
  Wind,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherContext } from '../context/WeatherContext';
import { useWeatherData } from '../hooks/useWeatherData';

const LOCATION_KEY = 'air4thai.selectedProvince';

const finiteOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function cleanProvinceName(value = '') {
  return String(value).replace(/^จังหวัด/, '').trim();
}

function formatUpdatedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'ไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(value));
}

function formatDay(value, index) {
  if (index === 0) return 'วันนี้';
  if (index === 1) return 'พรุ่งนี้';
  return new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
}

function formatHour(value, index) {
  if (index === 0) return 'ตอนนี้';
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function getAirStatus(pm25) {
  if (pm25 === null) return { label: 'รอค่าฝุ่น', detail: 'ยังไม่มีข้อมูล PM2.5 ที่ยืนยันได้', tone: 'neutral' };
  if (pm25 <= 15) return { label: 'อากาศดีมาก', detail: 'ทำกิจกรรมนอกอาคารได้ตามปกติ', tone: 'excellent' };
  if (pm25 <= 25) return { label: 'อากาศดี', detail: 'คนส่วนใหญ่ออกไปข้างนอกได้', tone: 'good' };
  if (pm25 <= 37.5) return { label: 'ปานกลาง', detail: 'กลุ่มเสี่ยงควรสังเกตอาการ', tone: 'moderate' };
  if (pm25 <= 75) return { label: 'เริ่มกระทบสุขภาพ', detail: 'ลดเวลาทำกิจกรรมนอกอาคาร', tone: 'warning' };
  return { label: 'มีผลกระทบต่อสุขภาพ', detail: 'ควรอยู่ในอาคารและสวมหน้ากากเมื่อออกไป', tone: 'danger' };
}

function getWeatherSummary(current, pm25) {
  const feelsLike = finiteOrNull(current?.feelsLike);
  const rain = finiteOrNull(current?.rainProb) || 0;

  if (pm25 !== null && pm25 > 37.5) {
    return {
      title: 'ลดเวลานอกอาคาร',
      detail: 'ค่าฝุ่นสูงกว่าระดับที่เหมาะกับกิจกรรมกลางแจ้ง โดยเฉพาะเด็ก ผู้สูงอายุ และผู้มีโรคทางเดินหายใจ',
      action: 'เตรียมหน้ากากกรองฝุ่น',
      tone: pm25 > 75 ? 'danger' : 'warning',
      icon: ShieldCheck,
    };
  }
  if (rain >= 60) {
    return {
      title: 'เตรียมรับฝน',
      detail: `โอกาสฝนช่วงนี้ประมาณ ${Math.round(rain)}% ตรวจเส้นทางและพกร่มก่อนออกจากบ้าน`,
      action: 'พกร่มและเผื่อเวลาเดินทาง',
      tone: 'rain',
      icon: Umbrella,
    };
  }
  if (feelsLike !== null && feelsLike >= 39) {
    return {
      title: 'อากาศร้อนจัด',
      detail: `อุณหภูมิที่ร่างกายรู้สึกประมาณ ${Math.round(feelsLike)}°C ควรหลีกเลี่ยงแดดช่วงกลางวัน`,
      action: 'ดื่มน้ำและพักในที่ร่ม',
      tone: 'heat',
      icon: ThermometerSun,
    };
  }
  return {
    title: 'ออกไปข้างนอกได้',
    detail: 'ฝุ่นและฝนยังไม่อยู่ในระดับที่ต้องหลีกเลี่ยงกิจกรรมนอกอาคาร',
    action: 'เช็กช่วงฝนก่อนเดินทางไกล',
    tone: 'good',
    icon: Navigation,
  };
}

function WeatherGlyph({ code, isDay = true, rain = 0, size = 24 }) {
  const common = { 'aria-hidden': true, size, strokeWidth: 1.9 };
  if (rain >= 45 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(Number(code))) return <CloudRain {...common} />;
  if ([0, 1].includes(Number(code))) return isDay ? <Sun {...common} /> : <Cloud {...common} />;
  return <CloudSun {...common} />;
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__icon">{createElement(Icon, { 'aria-hidden': true, size: 19 })}</span>
      <div>
        <span className="metric__label">{label}</span>
        <strong className="metric__value">{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { lastUpdated, stations, weatherMeta } = useContext(WeatherContext);
  const { weatherData, loadingWeather, fetchWeatherByCoords } = useWeatherData();
  const [selectedProvince, setSelectedProvince] = useState(() => localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร');
  const [locationLabel, setLocationLabel] = useState(() => localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const sortedStations = useMemo(() => [...(stations || [])].sort((a, b) => a.areaTH.localeCompare(b.areaTH, 'th')), [stations]);

  useEffect(() => {
    const station = sortedStations.find((item) => cleanProvinceName(item.areaTH) === cleanProvinceName(selectedProvince))
      || sortedStations.find((item) => cleanProvinceName(item.areaTH) === 'กรุงเทพมหานคร');
    if (!station) return;
    fetchWeatherByCoords(Number(station.lat), Number(station.long));
    setLocationLabel(cleanProvinceName(station.areaTH));
  }, [fetchWeatherByCoords, selectedProvince, sortedStations]);

  const handleProvinceChange = (event) => {
    const next = event.target.value;
    setSelectedProvince(next);
    setLocationLabel(cleanProvinceName(next));
    setLocationError('');
    localStorage.setItem(LOCATION_KEY, next);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        fetchWeatherByCoords(coords.latitude, coords.longitude);
        setLocationLabel('ตำแหน่งปัจจุบัน');
        setLocating(false);
      },
      () => {
        setLocationError('ไม่สามารถใช้ตำแหน่งได้ กรุณาอนุญาตสิทธิ์หรือลองเลือกจังหวัด');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  if (!weatherData || loadingWeather) {
    return <LoadingScreen title="กำลังดูอากาศวันนี้" subtitle={`เตรียมข้อมูลของ${locationLabel}`} />;
  }

  const { current, daily, hourly } = weatherData;
  const pm25 = finiteOrNull(current?.pm25);
  const air = getAirStatus(pm25);
  const summary = getWeatherSummary(current, pm25);
  const SummaryIcon = summary.icon;
  const now = Date.now();
  const firstHour = Math.max(0, hourly?.time?.findIndex((time) => new Date(time).getTime() >= now - 30 * 60 * 1000) || 0);
  const hours = (hourly?.time || []).slice(firstHour, firstHour + 12).map((time, index) => {
    const sourceIndex = firstHour + index;
    return {
      time,
      temp: Math.round(finiteOrNull(hourly.temperature_2m?.[sourceIndex]) || 0),
      rain: Math.round(finiteOrNull(hourly.precipitation_probability?.[sourceIndex]) || 0),
      code: Number(hourly.weathercode?.[sourceIndex] ?? current?.weatherCode),
    };
  });
  const days = (daily?.time || []).slice(0, 7).map((time, index) => ({
    time,
    code: daily.weathercode?.[index],
    high: Math.round(finiteOrNull(daily.temperature_2m_max?.[index]) || 0),
    low: Math.round(finiteOrNull(daily.temperature_2m_min?.[index]) || 0),
    rain: Math.round(finiteOrNull(daily.precipitation_probability_max?.[index]) || 0),
    pm25: finiteOrNull(daily.pm25_max?.[index]),
  }));
  const sourceIsFallback = Boolean(weatherData.fallback || current?.fallback || weatherMeta?.source === 'deterministic-fallback' || weatherMeta?.source === 'unavailable');
  const updatedText = formatUpdatedAt(lastUpdated || new Date());

  return (
    <div className="page dashboard-page">
      <div className="page__inner">
        <section className="location-bar" aria-label="เลือกพื้นที่">
          <div className="location-bar__title">
            <span className="location-bar__icon"><Map aria-hidden="true" size={18} /></span>
            <div>
              <small>พื้นที่ที่กำลังดู</small>
              <strong>{locationLabel}</strong>
            </div>
          </div>
          <div className="location-bar__controls">
            <label className="select-field">
              <span className="sr-only">เลือกจังหวัด</span>
              <select onChange={handleProvinceChange} value={selectedProvince}>
                {sortedStations.map((station) => (
                  <option key={station.stationID} value={station.areaTH}>{cleanProvinceName(station.areaTH)}</option>
                ))}
              </select>
            </label>
            <button className="button button--secondary button--compact" disabled={locating} onClick={handleUseLocation} type="button">
              <LocateFixed aria-hidden="true" size={17} /> {locating ? 'กำลังค้นหา' : 'ใช้ตำแหน่งฉัน'}
            </button>
          </div>
          {locationError && <p className="field-error" role="alert">{locationError}</p>}
        </section>

        <section className={`today-hero today-hero--${summary.tone}`}>
          <div aria-hidden="true" className="weather-scene">
            <span className="weather-scene__sun"><Sun size={30} strokeWidth={1.8} /></span>
            <span className="weather-scene__cloud"><Cloud size={42} strokeWidth={1.7} /></span>
            <span className="weather-scene__wind"><Wind size={27} strokeWidth={1.8} /></span>
          </div>
          <div className="today-hero__main">
            <div className="data-line">
              <span className={`status-dot ${sourceIsFallback ? 'is-fallback' : 'is-live'}`} />
              {sourceIsFallback ? 'ข้อมูลประมาณการสำรอง' : 'ข้อมูลล่าสุด'} · อัปเดต {updatedText}
            </div>
            <div className="today-hero__weather">
              <span className="weather-symbol">
                <WeatherGlyph code={current?.weatherCode} isDay={current?.isDay} rain={current?.rainProb} size={34} />
              </span>
              <div>
                <p className="today-hero__place">{locationLabel}</p>
                <div className="today-hero__temperature">{Math.round(current?.temp)}<span>°</span></div>
                <p>รู้สึกเหมือน {Math.round(current?.feelsLike)}°C · ฝน {Math.round(current?.rainProb || 0)}%</p>
              </div>
            </div>
          </div>

          <div className="today-hero__decision">
            <span className="decision-icon"><SummaryIcon aria-hidden="true" size={24} /></span>
            <div>
              <span className="section-label">คำแนะนำตอนนี้</span>
              <h1>{summary.title}</h1>
              <p>{summary.detail}</p>
              <strong>{summary.action}</strong>
            </div>
          </div>
        </section>

        <section aria-labelledby="conditions-title" className="section-block section-block--conditions">
          <div className="section-heading">
            <div>
              <span className="section-label">สถานการณ์สำคัญ</span>
              <h2 id="conditions-title">สิ่งที่ควรรู้ก่อนออกไป</h2>
            </div>
            <Link className="text-link" to="/map">ดูบนแผนที่ <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>

          <div className="condition-grid">
            <article className={`condition-primary tone-${air.tone}`}>
              <div className="condition-primary__top">
                <span className="condition-icon"><Gauge aria-hidden="true" size={22} /></span>
                <span>PM2.5</span>
              </div>
              <div className="condition-primary__value">{pm25 === null ? '–' : Math.round(pm25)}<small>µg/m³</small></div>
              <h3>{air.label}</h3>
              <p>{air.detail}</p>
            </article>

            <div className="metrics-panel">
              <Metric detail={current?.humidity >= 75 ? 'ค่อนข้างชื้น' : 'อยู่ในเกณฑ์ทั่วไป'} icon={Droplets} label="ความชื้น" tone="humidity" value={`${Math.round(current?.humidity || 0)}%`} />
              <Metric detail={current?.windSpeed >= 20 ? 'ลมค่อนข้างแรง' : 'ลมไม่แรง'} icon={Wind} label="ลม" tone="wind" value={`${Math.round(current?.windSpeed || 0)} กม./ชม.`} />
              <Metric detail={current?.uv >= 8 ? 'ควรหลบแดด' : current?.uv >= 3 ? 'ทากันแดด' : 'รังสีต่ำ'} icon={Sun} label="รังสี UV" tone="sun" value={Math.round(current?.uv || 0)} />
              <Metric detail="ความกดอากาศ" icon={Gauge} label="ความกด" tone="pressure" value={`${Math.round(current?.pressure || 0)} hPa`} />
            </div>
          </div>
        </section>

        <section aria-labelledby="hourly-title" className="section-block section-block--hourly">
          <div className="section-heading">
            <div>
              <span className="section-label">12 ชั่วโมงข้างหน้า</span>
              <h2 id="hourly-title">ฝนจะมาเมื่อไร</h2>
            </div>
            <span className="section-note"><CloudRain aria-hidden="true" size={16} /> ตัวเลขคือโอกาสฝน</span>
          </div>
          <div className="hourly-strip" role="list">
            {hours.map((hour, index) => (
              <div className={`hour-cell${hour.rain >= 60 ? ' is-rainy' : ''}`} key={hour.time} role="listitem" style={{ '--rain-level': `${hour.rain}%` }}>
                <span>{formatHour(hour.time, index)}</span>
                <WeatherGlyph code={hour.code} rain={hour.rain} size={21} />
                <strong>{hour.temp}°</strong>
                <small>{hour.rain}%</small>
                <span aria-hidden="true" className="hour-cell__rainbar"><i /></span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="weekly-title" className="section-block section-block--weekly">
          <div className="section-heading">
            <div>
              <span className="section-label">มองล่วงหน้า</span>
              <h2 id="weekly-title">7 วันจากนี้</h2>
            </div>
            <span className="section-note"><CalendarDays aria-hidden="true" size={16} /> พยากรณ์รายวัน</span>
          </div>
          <div className="forecast-list">
            {days.map((day, index) => (
              <div className="forecast-row" key={day.time}>
                <strong>{formatDay(day.time, index)}</strong>
                <span className="forecast-row__date">{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(`${day.time}T12:00:00`))}</span>
                <span className="forecast-row__weather"><WeatherGlyph code={day.code} rain={day.rain} size={20} /> ฝน {day.rain}%</span>
                <span className="forecast-row__air">PM2.5 {day.pm25 === null ? '–' : Math.round(day.pm25)}</span>
                <span className="forecast-row__temp"><b>{day.high}°</b> / {day.low}°</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="source-note">
          <ShieldCheck aria-hidden="true" size={18} />
          <p><strong>รู้ที่มาของข้อมูล:</strong> อากาศรายพื้นที่ใช้ Open-Meteo และ Air Quality API ส่วนภาพรวมประเทศใช้ข้อมูลที่ระบบรวบรวมจากสถานีและแหล่งสำรอง ค่าพยากรณ์อาจเปลี่ยนได้เมื่อมีข้อมูลรอบใหม่</p>
        </aside>
      </div>
    </div>
  );
}
