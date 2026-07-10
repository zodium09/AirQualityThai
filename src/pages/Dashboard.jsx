import { createElement, useContext, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronDown,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Dumbbell,
  Gauge,
  LocateFixed,
  Map,
  Moon,
  Navigation,
  RadioTower,
  ShieldCheck,
  Shirt,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Umbrella,
  Wind,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherContext } from '../context/WeatherContext';
import { useWeatherData } from '../hooks/useWeatherData';

const LOCATION_KEY = 'air4thai.selectedProvince';
const DISTRICT_KEY = 'air4thai.selectedDistrict';

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

function formatClock(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '–';
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function getDaylight(current) {
  const rise = new Date(current?.sunrise || 0);
  const set = new Date(current?.sunset || 0);
  const now = new Date();
  if (Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime()) || set <= rise) {
    return { progress: 0.5, isDay: true, rise: '–', set: '–' };
  }
  const isDay = now >= rise && now <= set;
  if (isDay) {
    return { progress: Math.max(0, Math.min(1, (now - rise) / (set - rise))), isDay, rise: formatClock(rise), set: formatClock(set) };
  }
  const nightStart = now < rise ? new Date(set.getTime() - 24 * 60 * 60 * 1000) : set;
  const nightEnd = now < rise ? rise : new Date(rise.getTime() + 24 * 60 * 60 * 1000);
  const progress = Math.max(0, Math.min(1, (now - nightStart) / (nightEnd - nightStart)));
  return { progress, isDay, rise: formatClock(rise), set: formatClock(set) };
}

function getActivityAdvice(current, pm25) {
  const rain = Number(current?.rainProb || 0);
  const heat = Number(current?.feelsLike || current?.temp || 0);
  const wind = Number(current?.windSpeed || 0);
  const dust = Number(pm25 || 0);
  const clamp = (value) => Math.max(0, Math.min(10, value));
  const describe = (score) => score >= 8 ? 'เหมาะมาก' : score >= 6 ? 'ทำได้' : score >= 4 ? 'ควรระวัง' : 'ควรเลี่ยง';
  const tone = (score) => score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'warning' : 'danger';
  const items = [
    {
      title: 'ออกกำลังกาย', icon: Dumbbell,
      score: clamp(9.5 - Math.max(0, heat - 32) * 0.45 - Math.max(0, dust - 20) * 0.08 - rain * 0.025),
      bestTime: heat >= 35 ? 'ก่อน 09:00 หรือหลัง 18:00' : 'ช่วงเช้าหรือเย็น',
      reason: `รู้สึก ${Math.round(heat)}° · PM2.5 ${Math.round(dust)}`,
    },
    {
      title: 'เดินทาง', icon: CarFront,
      score: clamp(9.4 - rain * 0.045 - Math.max(0, wind - 20) * 0.12),
      bestTime: rain >= 50 ? 'ออกก่อนช่วงฝนหนัก' : 'เดินทางได้ตามแผน',
      reason: `ฝน ${Math.round(rain)}% · ลม ${Math.round(wind)} กม./ชม.`,
    },
    {
      title: 'ซักผ้า', icon: Shirt,
      score: clamp(9.6 - rain * 0.075 + (heat >= 32 ? 0.5 : 0)),
      bestTime: rain >= 45 ? 'ควรรอช่วงฝนลด' : 'ก่อน 15:00',
      reason: `โอกาสฝน ${Math.round(rain)}%`,
    },
    {
      title: 'ดูแลต้นไม้', icon: Sprout,
      score: clamp(rain >= 70 ? 5 : 8.6 - rain * 0.025 + (heat >= 35 ? 0.5 : 0)),
      bestTime: rain >= 60 ? 'รอดูฝนก่อนรดน้ำ' : 'ช่วง 17:00-19:00',
      reason: heat >= 35 ? 'อากาศร้อน น้ำระเหยเร็ว' : 'รดช่วงเย็นลดการระเหย',
    },
  ].map((item) => ({ ...item, label: describe(item.score), tone: tone(item.score) }));
  return items.sort((a, b) => b.score - a.score).slice(0, 3);
}

function ActivityItem({ item }) {
  return (
    <article className={`activity-item activity-item--${item.tone}`}>
      <span className="activity-item__icon">{createElement(item.icon, { 'aria-hidden': true, size: 20 })}</span>
      <div className="activity-item__body">
        <div><strong>{item.title}</strong><span>{item.label}</span></div>
        <p>{item.reason}</p>
        <small>{item.bestTime}</small>
      </div>
      <div className="activity-item__score" aria-label={`คะแนน ${item.score.toFixed(1)} จาก 10`}>
        <b>{item.score.toFixed(1)}</b><span>/10</span>
        <i><em style={{ width: `${item.score * 10}%` }} /></i>
      </div>
    </article>
  );
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
  const { amphoeData, lastUpdated, stations, weatherMeta } = useContext(WeatherContext);
  const { weatherData, loadingWeather, fetchWeatherByCoords } = useWeatherData();
  const [selectedProvince, setSelectedProvince] = useState(() => localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร');
  const [locationLabel, setLocationLabel] = useState(() => localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร');
  const [selectedDistrict, setSelectedDistrict] = useState(() => localStorage.getItem(DISTRICT_KEY) || '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [geoDistricts, setGeoDistricts] = useState([]);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarLoaded, setRadarLoaded] = useState(false);

  const sortedStations = useMemo(() => [...(stations || [])].sort((a, b) => a.areaTH.localeCompare(b.areaTH, 'th')), [stations]);
  const districts = useMemo(() => {
    const provinceKey = cleanProvinceName(selectedProvince);
    const provinces = amphoeData?.provinces || {};
    const province = provinces[provinceKey]
      || provinces[selectedProvince]
      || Object.entries(provinces).find(([name]) => cleanProvinceName(name) === provinceKey)?.[1];
    const tmdDistricts = (province?.amphoes || []).map((item) => ({
      name: String(item.n || item.name || '').trim(),
      lat: finiteOrNull(item.lat),
      lon: finiteOrNull(item.lon ?? item.lng ?? item.long),
    })).filter((item) => item.name);
    if (tmdDistricts.length) return tmdDistricts.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const fallbackProvince = geoDistricts.find((item) => cleanProvinceName(item.name_th || item.name || '') === provinceKey);
    return (fallbackProvince?.districts || []).map((item) => ({
      name: String(item.name_th || item.name || '').trim(),
      lat: null,
      lon: null,
    })).filter((item) => item.name).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [amphoeData, geoDistricts, selectedProvince]);

  const radarSrc = useMemo(() => {
    const lat = Number(weatherData?.coords?.lat || 13.75);
    const lon = Number(weatherData?.coords?.lon || 100.5);
    return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=8&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true`;
  }, [weatherData?.coords?.lat, weatherData?.coords?.lon]);

  useEffect(() => {
    const station = sortedStations.find((item) => cleanProvinceName(item.areaTH) === cleanProvinceName(selectedProvince))
      || sortedStations.find((item) => cleanProvinceName(item.areaTH) === 'กรุงเทพมหานคร');
    if (!station) return;
    fetchWeatherByCoords(Number(station.lat), Number(station.long));
    setLocationLabel(cleanProvinceName(station.areaTH));
  }, [fetchWeatherByCoords, selectedProvince, sortedStations]);

  useEffect(() => {
    if (amphoeData?.provinces || geoDistricts.length) return undefined;
    const controller = new AbortController();
    fetch('/thai_geo.json', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Geo ${response.status}`)))
      .then((data) => setGeoDistricts(Array.isArray(data) ? data : (data?.data || [])))
      .catch((error) => {
        if (error.name !== 'AbortError') console.warn('District fallback unavailable:', error.message);
      });
    return () => controller.abort();
  }, [amphoeData, geoDistricts.length]);

  useEffect(() => {
    if (!selectedDistrict) return;
    const district = districts.find((item) => item.name === selectedDistrict);
    if (!district || !Number.isFinite(district.lat) || !Number.isFinite(district.lon)) return;
    fetchWeatherByCoords(district.lat, district.lon);
    setLocationLabel(`${district.name}, ${cleanProvinceName(selectedProvince)}`);
  }, [districts, fetchWeatherByCoords, selectedDistrict, selectedProvince]);

  useEffect(() => {
    setRadarLoaded(false);
  }, [radarSrc]);

  const handleProvinceChange = (event) => {
    const next = event.target.value;
    setSelectedProvince(next);
    setLocationLabel(cleanProvinceName(next));
    setLocationError('');
    setSelectedDistrict('');
    localStorage.setItem(LOCATION_KEY, next);
    localStorage.removeItem(DISTRICT_KEY);
  };

  const handleDistrictChange = async (event) => {
    const next = event.target.value;
    setSelectedDistrict(next);
    setLocationError('');
    if (next) localStorage.setItem(DISTRICT_KEY, next);
    else localStorage.removeItem(DISTRICT_KEY);
    if (!next) {
      const station = sortedStations.find((item) => cleanProvinceName(item.areaTH) === cleanProvinceName(selectedProvince));
      if (station) fetchWeatherByCoords(Number(station.lat), Number(station.long));
      setLocationLabel(cleanProvinceName(selectedProvince));
      return;
    }

    setLocationLabel(`${next}, ${cleanProvinceName(selectedProvince)}`);
    const district = districts.find((item) => item.name === next);
    if (Number.isFinite(district?.lat) && Number.isFinite(district?.lon)) return;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${next} ${cleanProvinceName(selectedProvince)} ประเทศไทย`)}&limit=1`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`ค้นหาพิกัด ${response.status}`);
      const results = await response.json();
      const lat = Number(results?.[0]?.lat);
      const lon = Number(results?.[0]?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('ไม่พบพิกัด');
      fetchWeatherByCoords(lat, lon);
    } catch {
      setLocationError('เลือกอำเภอแล้ว แต่ยังหาพิกัดไม่ได้ ระบบจะแสดงข้อมูลระดับจังหวัดแทน');
    }
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
        setSelectedDistrict('');
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
  const activities = getActivityAdvice(current, pm25);
  const daylight = getDaylight(current);
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
            {districts.length > 0 && (
              <label className="select-field select-field--district">
                <span className="sr-only">เลือกอำเภอหรือเขต</span>
                <select onChange={handleDistrictChange} value={selectedDistrict}>
                  <option value="">ทั้งจังหวัด</option>
                  {districts.map((district) => <option key={district.name} value={district.name}>{district.name}</option>)}
                </select>
              </label>
            )}
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

        <section aria-labelledby="activities-title" className="section-block section-block--activities">
          <div className="section-heading">
            <div>
              <span className="section-label">วางแผนวันนี้</span>
              <h2 id="activities-title">กิจกรรมที่เหมาะตอนนี้</h2>
            </div>
            <span className="section-note">คะแนนจากฝน ความร้อน ฝุ่น และลม</span>
          </div>
          <div className="daily-planner">
            <div className="activity-list">
              {activities.map((item) => <ActivityItem item={item} key={item.title} />)}
            </div>
            <aside className="sun-cycle" aria-label="เวลาพระอาทิตย์ขึ้นและตก">
              <div className="sun-cycle__heading">
                <span><Sun aria-hidden="true" size={19} /></span>
                <div><strong>จังหวะของวัน</strong><small>{daylight.isDay ? 'ช่วงกลางวัน' : 'ช่วงกลางคืน'}</small></div>
              </div>
              <div className="sun-cycle__visual">
                <div className="sun-cycle__arc" />
                <span className={`sun-cycle__orb${daylight.isDay ? '' : ' is-night'}`} style={{ left: `${daylight.progress * 100}%` }}>
                  {daylight.isDay ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
                </span>
              </div>
              <div className="sun-cycle__times">
                <span><Sunrise aria-hidden="true" size={17} /><small>ขึ้น</small><strong>{daylight.rise}</strong></span>
                <span><Sunset aria-hidden="true" size={17} /><small>ตก</small><strong>{daylight.set}</strong></span>
              </div>
              <p>ใช้ช่วงเช้าและเย็นเป็นตัวเลือกแรกเมื่ออากาศร้อนหรือรังสี UV สูง</p>
            </aside>
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

        <section className={`radar-disclosure${radarOpen ? ' is-open' : ''}`}>
          <div className="radar-disclosure__intro">
            <span className="radar-disclosure__icon"><RadioTower aria-hidden="true" size={22} /></span>
            <div>
                <span className="section-label">ดูฝนแบบเรียลไทม์</span>
              <h2>เรดาร์ฝนใกล้ {locationLabel}</h2>
              <p>ดูทิศทางกลุ่มฝนก่อนเดินทาง เปิดเฉพาะเมื่อใช้เพื่อช่วยประหยัดข้อมูลและเวลาโหลด</p>
            </div>
          </div>
          <button aria-expanded={radarOpen} className="button button--secondary radar-disclosure__toggle" onClick={() => setRadarOpen((value) => !value)} type="button">
            {radarOpen ? 'ซ่อนเรดาร์' : 'เปิดเรดาร์ฝน'} <ChevronDown aria-hidden="true" size={18} />
          </button>
          {radarOpen && (
            <div className="radar-frame">
              {!radarLoaded && <div className="radar-frame__loading"><RadioTower aria-hidden="true" size={22} /><span>กำลังเชื่อมต่อภาพเรดาร์</span></div>}
              <iframe allowFullScreen loading="lazy" onLoad={() => setRadarLoaded(true)} src={radarSrc} title={`เรดาร์ฝนใกล้ ${locationLabel}`} />
            </div>
          )}
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
