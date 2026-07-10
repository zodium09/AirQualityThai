import { useContext, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { CloudRain, Gauge, Search, Thermometer, Wind } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherContext } from '../context/WeatherContext';

const metricOptions = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', icon: Gauge },
  temp: { label: 'อุณหภูมิ', unit: '°C', icon: Thermometer },
  rain: { label: 'โอกาสฝน', unit: '%', icon: CloudRain },
  wind: { label: 'ความเร็วลม', unit: 'กม./ชม.', icon: Wind },
};

function cleanName(value = '') {
  return String(value).replace(/^จังหวัด/, '').trim();
}

function getMetricValue(station, stationTemps, metric) {
  const weather = stationTemps?.[station.stationID] || {};
  const value = metric === 'pm25'
    ? station.AQILast?.PM25?.value
    : metric === 'temp'
      ? weather.temp
      : metric === 'rain'
        ? weather.rainProb
        : weather.windSpeed;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetricTone(metric, value) {
  if (value === null) return '#64748b';
  if (metric === 'pm25') {
    if (value <= 15) return '#0f8a78';
    if (value <= 25) return '#2f9e44';
    if (value <= 37.5) return '#c28b00';
    if (value <= 75) return '#e56a2f';
    return '#d13b4b';
  }
  if (metric === 'temp') {
    if (value < 24) return '#168aad';
    if (value < 32) return '#0f8a78';
    if (value < 36) return '#d28500';
    return '#d94a3a';
  }
  if (metric === 'rain') {
    if (value < 20) return '#64748b';
    if (value < 50) return '#168aad';
    if (value < 75) return '#2563b8';
    return '#5146a5';
  }
  if (value < 12) return '#0f8a78';
  if (value < 25) return '#168aad';
  if (value < 40) return '#d28500';
  return '#d94a3a';
}

function getMetricStatus(metric, value) {
  if (value === null) return 'ไม่มีข้อมูล';
  if (metric === 'pm25') {
    if (value <= 15) return 'ดีมาก';
    if (value <= 25) return 'ดี';
    if (value <= 37.5) return 'ปานกลาง';
    if (value <= 75) return 'เริ่มกระทบสุขภาพ';
    return 'กระทบสุขภาพ';
  }
  if (metric === 'temp') return value >= 36 ? 'ร้อนจัด' : value >= 32 ? 'ค่อนข้างร้อน' : 'ทั่วไป';
  if (metric === 'rain') return value >= 75 ? 'โอกาสสูง' : value >= 50 ? 'ควรเตรียมรับฝน' : 'โอกาสไม่สูง';
  return value >= 40 ? 'ลมแรง' : value >= 25 ? 'ลมค่อนข้างแรง' : 'ลมไม่แรง';
}

function MapFocus({ station }) {
  const map = useMap();
  useEffect(() => {
    if (!station) return;
    map.flyTo([Number(station.lat), Number(station.long)], 8, { duration: 0.8 });
  }, [map, station]);
  return null;
}

export default function MapPage() {
  const { lastUpdated, loading, stationTemps, stations, weatherMeta } = useContext(WeatherContext);
  const [metric, setMetric] = useState('pm25');
  const [query, setQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState(null);
  const meta = metricOptions[metric];
  const MetricIcon = meta.icon;

  const rows = useMemo(() => (stations || []).map((station) => ({
    station,
    name: cleanName(station.areaTH),
    value: getMetricValue(station, stationTemps, metric),
  })).filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [metric, query, stationTemps, stations]);

  const ranked = useMemo(() => [...rows].filter((row) => row.value !== null).sort((a, b) => b.value - a.value), [rows]);
  const nationalAverage = ranked.length ? ranked.reduce((sum, row) => sum + row.value, 0) / ranked.length : null;
  const sourceIsFallback = weatherMeta?.source === 'deterministic-fallback' || weatherMeta?.source === 'unavailable' || weatherMeta?.stale;

  if (loading) return <LoadingScreen title="กำลังเปิดแผนที่" subtitle="รวบรวมข้อมูลจาก 77 จังหวัด" />;

  return (
    <div className={`map-page map-page--${metric}`}>
      <div className="map-toolbar">
        <div>
          <span className="section-label">ภาพรวมทั่วประเทศ</span>
          <h1>แผนที่เฝ้าระวัง</h1>
          <p>{sourceIsFallback ? 'ข้อมูลประมาณการสำรอง' : 'ข้อมูลล่าสุด'} · {lastUpdated ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(lastUpdated)) : 'ไม่ระบุเวลา'}</p>
        </div>
        <div aria-label="เลือกตัวชี้วัด" className="metric-tabs" role="group">
          {Object.entries(metricOptions).map(([key, option]) => {
            const Icon = option.icon;
            return (
              <button className={metric === key ? 'is-active' : ''} data-metric={key} key={key} onClick={() => setMetric(key)} type="button">
                <Icon aria-hidden="true" size={16} /> {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-workspace">
        <aside className="map-sidebar">
          <div className="map-summary">
            <span className="map-summary__icon"><MetricIcon aria-hidden="true" size={20} /></span>
            <div>
              <small>ค่าเฉลี่ยจากจังหวัดที่มีข้อมูล</small>
              <strong>{nationalAverage === null ? '–' : metric === 'temp' ? nationalAverage.toFixed(1) : Math.round(nationalAverage)} <span>{meta.unit}</span></strong>
            </div>
          </div>

          <label className="search-field">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">ค้นหาจังหวัด</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาจังหวัด" type="search" value={query} />
          </label>

          <div className="province-list">
            {ranked.map(({ station, name, value }, index) => (
              <button
                className={`province-row${selectedStation?.stationID === station.stationID ? ' is-selected' : ''}`}
                key={station.stationID}
                onClick={() => setSelectedStation(station)}
                type="button"
              >
                <span className="province-row__rank">{index + 1}</span>
                <span className="province-row__name"><strong>{name}</strong><small>{getMetricStatus(metric, value)}</small></span>
                <span className="province-row__value" style={{ color: getMetricTone(metric, value) }}>{Math.round(value)} <small>{meta.unit}</small></span>
              </button>
            ))}
            {!ranked.length && <div className="empty-inline">ไม่พบจังหวัดที่ตรงกับคำค้น</div>}
          </div>
        </aside>

        <section aria-label={`แผนที่${meta.label}ทั่วประเทศไทย`} className="map-canvas">
          <MapContainer center={[13.2, 101.1]} maxBounds={[[3.5, 92], [23, 110]]} minZoom={5} scrollWheelZoom zoom={5.6}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus station={selectedStation} />
            {rows.map(({ station, name, value }) => {
              if (value === null) return null;
              const color = getMetricTone(metric, value);
              return (
                <CircleMarker
                  center={[Number(station.lat), Number(station.long)]}
                  eventHandlers={{ click: () => setSelectedStation(station) }}
                  key={station.stationID}
                  pathOptions={{ color: '#ffffff', fillColor: color, fillOpacity: 0.9, opacity: 0.95, weight: 2 }}
                  radius={selectedStation?.stationID === station.stationID ? 12 : 8}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>{name}</strong>
                      <span style={{ color }}>{Math.round(value)} {meta.unit}</span>
                      <small>{getMetricStatus(metric, value)}</small>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          <div className="map-legend" aria-label="คำอธิบายสี">
            <span><i style={{ background: '#0f8a78' }} /> ต่ำ</span>
            <span><i style={{ background: '#168aad' }} /> เฝ้าดู</span>
            <span><i style={{ background: '#d28500' }} /> ควรระวัง</span>
            <span><i style={{ background: '#d94a3a' }} /> สูง</span>
          </div>
        </section>
      </div>
    </div>
  );
}
