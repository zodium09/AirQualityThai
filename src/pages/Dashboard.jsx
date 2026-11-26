import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Info, LocateFixed, MapPin, Monitor, Mountain, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { WeatherContext } from '../context/WeatherContext';
import { useWeatherData } from '../hooks/useWeatherData';
import { provinces77 } from '../provinces77';
import { BANGKOK, displayValue as value, finiteOrNull, weatherDate } from '../utils/weatherData';
import WeatherDetails from '../components/WeatherDetails';
import StationObservations from '../components/StationObservations';
import MountainOutlook from '../components/MountainOutlook';
import { mountainPlaces } from '../data/mountainPlaces';

const LOCATION_KEY = 'air4thai.location.v2';
const RECENT_KEY = 'air4thai.recentLocations.v1';
const provinces = [...provinces77].sort((a, b) => a.n.localeCompare(b.n, 'th'));
const dateLabel = date => new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, weekday: 'short', day: 'numeric', month: 'short' }).format(weatherDate(date));
const cleanName = name => String(name || '').replace(/^จังหวัด/, '').trim();
function readRecentLocations() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => item && typeof item.label === 'string' && Number.isFinite(item.lat) && Number.isFinite(item.lon)).slice(0, 4);
  } catch { return []; }
}
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
export default function Dashboard() {
  const { amphoeData } = useContext(WeatherContext);
  const { weatherData, loadingWeather, weatherError, fetchWeatherByCoords } = useWeatherData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [location, setLocation] = useState(initialLocation);
  const [recentLocations, setRecentLocations] = useState(readRecentLocations);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [geo, setGeo] = useState([]);
  const [now, setNow] = useState(Date.now);
  const locationRequest = useRef(0);
  const geocode = useRef(null);
  const requestedProvince = searchParams.get('province');
  const clearRequestedProvince = () => { if (searchParams.has('province')) setSearchParams({}, { replace: true }); };
  useEffect(() => {
    if (!requestedProvince) return;
    const requested = provinces.find(p => p.n === cleanName(requestedProvince));
    if (!requested) return;
    setLocation(previous => previous.province === requested.n && !previous.district && !previous.mountainId
      ? previous
      : { province: requested.n, label: requested.n, lat: requested.lat, lon: requested.lon, district: '' });
  }, [requestedProvince]);
  useEffect(() => {
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); localStorage.setItem('air4thai.selectedProvince', location.province); } catch { /* Optional preference. */ }
    if (location.label && location.label !== 'ตำแหน่งปัจจุบันของคุณ') {
      setRecentLocations(previous => {
        const entry = { province: location.province, district: location.district || '', label: location.label, lat: location.lat, lon: location.lon, elevation: location.elevation ?? null, mountainId: location.mountainId || null };
        const next = [entry, ...previous.filter(item => item.label !== entry.label)].slice(0, 4);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Optional preference. */ }
        return next;
      });
    }
  }, [location]);
  useEffect(() => {
    fetchWeatherByCoords(location.lat, location.lon, location.elevation);
    const refresh = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); fetchWeatherByCoords(location.lat, location.lon, location.elevation); } };
    const timer = setInterval(refresh, 600000);
    const clock = setInterval(() => setNow(Date.now()), 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', refresh); };
  }, [location.lat, location.lon, location.elevation, fetchWeatherByCoords]);
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
    clearRequestedProvince();
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
      if (request === locationRequest.current) { clearRequestedProvince(); setLocation(previous => ({ ...previous, mountainId: null, elevation: null, district: name, label: `${name}, ${previous.province}`, lat, lon })); setLocationOpen(false); }
    } catch { if (request === locationRequest.current) setLocationError('หาพิกัดอำเภอนี้ไม่ได้ ยังแสดงพื้นที่เดิมอยู่ กรุณาลองอีกครั้ง'); }
    finally { if (request === locationRequest.current) setLocating(false); }
  };
  const useLocation = () => {
    if (!navigator.geolocation) { setLocationError('อุปกรณ์ไม่รองรับการระบุตำแหน่ง เลือกจังหวัดแทนได้'); return; }
    const request = ++locationRequest.current; geocode.current?.abort(); setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== locationRequest.current) return;
      clearRequestedProvince();
      setLocation(previous => ({ ...previous, mountainId: null, elevation: null, lat: coords.latitude, lon: coords.longitude, label: 'ตำแหน่งปัจจุบันของคุณ', district: '' })); setLocating(false); setLocationOpen(false);
    }, () => { if (request === locationRequest.current) { setLocationError('เข้าถึงตำแหน่งไม่ได้ กรุณาอนุญาตสิทธิ์ หรือเลือกจังหวัดด้านล่าง'); setLocating(false); setLocationOpen(true); } }, { timeout: 10000, maximumAge: 300000 });
  };
  const chooseMountain = id => {
    const place = mountainPlaces.find(item => item.id === id);
    if (!place) return;
    locationRequest.current += 1; geocode.current?.abort(); setLocating(false); setLocationError('');
    clearRequestedProvince();
    setLocation({ province: place.province, district: '', label: place.name, lat: place.lat, lon: place.lon, elevation: place.elevation, mountainId: place.id });
    setLocationOpen(false);
  };
  const chooseRecent = item => {
    locationRequest.current += 1; geocode.current?.abort(); setLocating(false); setLocationError('');
    clearRequestedProvince();
    setLocation(item);
    setLocationOpen(false);
  };
  const recentOther = recentLocations.filter(item => item.label !== location.label);
  const place = mountainPlaces.find(item => item.id === location.mountainId);
  const matchesPlace = weatherData?.coords?.lat === location.lat && weatherData?.coords?.lon === location.lon && (weatherData?.coords?.elevation ?? null) === (location.elevation ?? null);
  const refresh = () => { setNow(Date.now()); fetchWeatherByCoords(location.lat, location.lon, location.elevation); };
  return <div className="wx-page">
    <header className="wx-page-head"><div><p className="wx-date">{dateLabel(now)}</p><h1>วันนี้ อากาศเป็นอย่างไร</h1></div><Link className="wx-monitor-link" to="/map?monitor=1"><Monitor size={17} aria-hidden="true" /> มอนิเตอร์ประเทศ <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <section className="wx-location" aria-label="เลือกพื้นที่พยากรณ์"><button className="wx-place-button" type="button" onClick={() => setLocationOpen(!locationOpen)} aria-expanded={locationOpen} aria-controls="location-controls"><MapPin size={21} aria-hidden="true" /><span><strong>{location.label}</strong><small>เปลี่ยนพื้นที่ <ChevronDown size={13} className={locationOpen ? 'is-open' : ''} aria-hidden="true" /></small></span></button><div className="wx-location-actions"><button className="wx-button wx-button--quiet" disabled={locating} onClick={useLocation} type="button"><LocateFixed size={17} aria-hidden="true" /><span>{locating ? 'กำลังค้นหา' : 'ใกล้ฉัน'}</span></button><button className="wx-button wx-button--quiet" disabled={loadingWeather} onClick={refresh} type="button" aria-label="อัปเดตข้อมูลอากาศ"><RefreshCw size={17} className={loadingWeather ? 'is-spinning' : ''} aria-hidden="true" /><span className="wx-refresh-label">อัปเดต</span></button></div>
    {locationOpen && <div className="wx-location-controls" id="location-controls"><label>จังหวัด<select value={location.province} onChange={event => chooseProvince(event.target.value)}>{provinces.map(p => <option key={p.n}>{p.n}</option>)}</select></label><label>อำเภอ / เขต<select value={location.district} disabled={locating || !districts.length} onChange={event => chooseDistrict(event.target.value)}><option value="">จุดอ้างอิงจังหวัด</option>{districts.map(d => <option key={d.name}>{d.name}</option>)}</select></label><label className="wx-mountain-select"><span><Mountain size={16} /> ดอยและพื้นที่สูง</span><select value={location.mountainId || ''} onChange={event => chooseMountain(event.target.value)}><option value="">เลือกสถานที่บนดอย</option>{mountainPlaces.map(item => <option key={item.id} value={item.id}>{item.name} · {item.elevation} ม.</option>)}</select></label>{recentOther.length > 0 && <div className="wx-recent-places"><span>ดูล่าสุด</span><div>{recentOther.map(item => <button className="wx-button wx-button--quiet wx-recent-chip" key={item.label} onClick={() => chooseRecent(item)} type="button">{item.label}</button>)}</div></div>}<p><Info size={14} aria-hidden="true" /> พยากรณ์ตามพิกัดที่เลือก ค่าจุดอ้างอิงจังหวัดไม่ใช่ค่าเฉลี่ยทั้งจังหวัด</p></div>}
    {locationError && <p className="wx-message" role="alert">{locationError}</p>}</section>
    {weatherError && <div className="wx-message" role="status"><Info size={18} aria-hidden="true" />{weatherError}</div>}
    {place && <p className="wx-place-note"><Mountain size={18} /> {place.name} · สูง {value(place.elevation, ' ม.')} · <a href={place.sourceUrl} target="_blank" rel="noreferrer">ที่มาพิกัดและความสูง</a> · พยากรณ์จากแบบจำลองตามความสูง</p>}
    <WeatherDetails forecast={matchesPlace ? weatherData : null} loading={loadingWeather} location={location} now={now} onRefresh={refresh} onUseLocation={useLocation} />
    <MountainOutlook onChoose={chooseMountain} />
    <StationObservations key={location.lat + ':' + location.lon} lat={location.lat} lon={location.lon} now={now} />
    <footer className="wx-sources"><ShieldCheck size={20} aria-hidden="true" /><div><strong>รู้ที่มา วางแผนได้มั่นใจขึ้น</strong><p>พยากรณ์อากาศ: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · ฝุ่น: <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS</a> ผ่าน Open-Meteo · พิกัดอำเภอ: OpenStreetMap</p><p>อัปเดตอัตโนมัติทุก 10 นาทีเมื่อเปิดหน้านี้ · ค่าที่ไม่มีข้อมูลแสดงเป็น — · <Link to="/news">ดูประกาศจากหน่วยงาน</Link></p></div></footer>
  </div>;
}
