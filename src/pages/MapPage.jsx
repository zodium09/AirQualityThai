import { useContext, useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { CloudRain, Download, Gauge, Hand, Monitor, RefreshCw, Search, Thermometer, Wind } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherContext } from '../context/WeatherContext';
import { finiteOrNull, thaiTime } from '../utils/weatherData';

const metricOptions = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', icon: Gauge },
  temp: { label: 'อุณหภูมิ', unit: '°C', icon: Thermometer },
  rain: { label: 'โอกาสฝน', unit: '%', icon: CloudRain },
  wind: { label: 'ความเร็วลม', unit: 'กม./ชม.', icon: Wind },
};

function cleanName(value = '') {
  return String(value).replace(/^จังหวัด/, '').trim();
}

const featureNameOverrides = {
  BangkokMetropolis: 'กรุงเทพมหานคร',
  Chaiyaphum: 'ชัยภูมิ',
  Kanchanaburi: 'กาญจนบุรี',
  NakhonPathom: 'นครปฐม',
  Phetchabun: 'เพชรบูรณ์',
};

function getFeatureName(feature) {
  const properties = feature?.properties || {};
  return featureNameOverrides[properties.NAME_1] || cleanName(properties.NL_NAME_1 || properties.NAME_1);
}

function getMetricValue(station, stationTemps, metric) {
  const weather = stationTemps?.[station.stationID] || {};
  const value = metric === 'pm25' ? station.AQILast?.PM25?.value
    : metric === 'temp' ? weather.temp
      : metric === 'rain' ? weather.rainProb : weather.windSpeed;
  const parsed = finiteOrNull(value);
  if (parsed === null || (metric !== 'temp' && parsed < 0)) return null;
  return parsed;
}

function getMetricTone(metric, value) {
  if (value === null) return '#94a3b8';
  if (metric === 'pm25') {
    if (value <= 15) return '#25b9e8';
    if (value <= 25) return '#35c9c4';
    if (value <= 37.5) return '#f6c945';
    if (value <= 75) return '#ff8a4c';
    return '#f04f70';
  }
  if (metric === 'temp') {
    if (value < 24) return '#38bdf8';
    if (value < 32) return '#36c6d3';
    if (value < 36) return '#ffb33e';
    return '#ff5f57';
  }
  if (metric === 'rain') {
    if (value < 20) return '#b8d8f8';
    if (value < 50) return '#55b9ff';
    if (value < 75) return '#287fea';
    return '#6758d9';
  }
  if (value < 12) return '#38bdf8';
  if (value < 25) return '#36c6d3';
  if (value < 40) return '#ffb33e';
  return '#ff5f57';
}

function getMetricStatus(metric, value) {
  if (value === null) return 'ไม่มีข้อมูล';
  if (metric === 'pm25') return 'PM2.5 จากแบบจำลอง · ไม่ใช่ AQI';
  if (metric === 'temp') return value >= 36 ? 'ร้อนจัด' : value >= 32 ? 'ค่อนข้างร้อน' : 'ทั่วไป';
  if (metric === 'rain') return value >= 75 ? 'โอกาสสูง' : value >= 50 ? 'ควรเตรียมรับฝน' : 'โอกาสไม่สูง';
  return value >= 40 ? 'ลมแรง' : value >= 25 ? 'ลมค่อนข้างแรง' : 'ลมไม่แรง';
}

function MapFocus({ station }) {
  const map = useMap();
  useEffect(() => {
    if (station) map.flyTo([Number(station.lat), Number(station.long)], 7.2, { duration: 0.7 });
  }, [map, station]);
  return null;
}

function MapInteraction({ enabled }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
    }
    map.scrollWheelZoom.disable();
  }, [enabled, map]);
  return null;
}

export default function MapPage() {
  const { lastUpdated, loading, refreshing, refreshWeather, stationTemps, stations, weatherMeta } = useContext(WeatherContext);
  const [monitor, setMonitor] = useState(() => new URLSearchParams(window.location.search).get('monitor') === '1');
  const [metric, setMetric] = useState('pm25');
  const [query, setQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [compact, setCompact] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(true);
  const meta = metricOptions[metric];
  const MetricIcon = meta.icon;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/thailand-provinces.geojson', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`GeoJSON ${response.status}`)))
      .then(setGeoData)
      .catch((error) => { if (error.name !== 'AbortError') console.warn(error.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => { setCompact(media.matches); setMapInteractive(!media.matches); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const allRows = useMemo(() => (stations || []).map((station) => ({
    station,
    name: cleanName(station.areaTH),
    value: getMetricValue(station, stationTemps, metric),
  })), [metric, stationTemps, stations]);

  const rowByName = useMemo(() => new Map(allRows.map((row) => [row.name, row])), [allRows]);
  const rows = useMemo(() => allRows.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [allRows, query]);
  const ranked = useMemo(() => [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)), [rows]);
  const availableRows = allRows.filter(row => row.value !== null);
  const nationalAverage = availableRows.length ? availableRows.reduce((sum, row) => sum + row.value, 0) / availableRows.length : null;
  const sourceIsFallback = weatherMeta?.source === 'deterministic-fallback' || weatherMeta?.source === 'unavailable' || weatherMeta?.stale;

  const visibleGeoData = useMemo(() => {
    if (!geoData) return null;
    const visibleNames = new Set(rows.map((row) => row.name));
    return { ...geoData, features: geoData.features.filter((feature) => visibleNames.has(getFeatureName(feature))) };
  }, [geoData, rows]);

  const featureStyle = (feature) => {
    const name = getFeatureName(feature);
    const row = rowByName.get(name);
    const selected = selectedStation?.stationID === row?.station.stationID;
    return {
      color: selected ? '#102b64' : '#ffffff',
      fillColor: getMetricTone(metric, row?.value ?? null),
      fillOpacity: row?.value === null ? 0.35 : 0.82,
      opacity: 1,
      weight: selected ? 3 : 1.25,
    };
  };

  const bindFeature = (feature, layer) => {
    const name = getFeatureName(feature);
    const row = rowByName.get(name);
    const value = row?.value ?? null;
    layer.bindPopup(`<div class="map-popup"><strong>${name}</strong><span style="color:${getMetricTone(metric, value)}">${value === null ? '–' : Math.round(value)} ${meta.unit}</span><small>${getMetricStatus(metric, value)}</small><a href="/?province=${encodeURIComponent(name)}">ดูพยากรณ์จังหวัดนี้</a></div>`);
    layer.on({
      click: () => {
        if (row) setSelectedStation(row.station);
        layer.setStyle({ color: '#102b64', fillOpacity: 0.95, weight: 3 });
      },
      mouseover: () => layer.setStyle({ fillOpacity: 0.95, weight: 2.3 }),
      mouseout: () => layer.setStyle(featureStyle(feature)),
    });
  };

  const legendValues = metric === 'pm25' ? [15, 25, 37.5, 75, 76] : metric === 'temp' ? [23, 31, 35, 36] : metric === 'rain' ? [19, 49, 74, 75] : [11, 24, 39, 40];
  const legendLabels = metric === 'pm25' ? ['≤15', '15–25', '25–37.5', '37.5–75', '>75'] : metric === 'temp' ? ['<24', '24–<32', '32–<36', '≥36'] : metric === 'rain' ? ['<20', '20–<50', '50–<75', '≥75'] : ['<12', '12–<25', '25–<40', '≥40'];
  const exportCsv = () => {
    const quote = text => `"${String(text ?? '').replace(/"/g, '""').replace(/^[=+@-]/, "'")}"`;
    const lines = [['จังหวัด', meta.label, 'หน่วย', 'เวลาข้อมูล', 'สถานะ'], ...ranked.map(row => [row.name, row.value, meta.unit, lastUpdated || '', sourceIsFallback ? 'ข้อมูลเดิมหรือไม่พร้อม' : 'ข้อมูลส่วนกลาง'])];
    const url = URL.createObjectURL(new Blob(['\ufeff', lines.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `weather-${metric}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (loading) return <LoadingScreen title="กำลังเปิดแผนที่" subtitle="รวบรวมข้อมูลจาก 77 จังหวัด" />;

  return (
    <div className={`map-page map-page--${metric}${monitor ? ' is-monitor' : ''}`}>
      <div className="map-toolbar">
        <div><h1>แผนที่เฝ้าระวังประเทศไทย</h1><p>{weatherMeta?.source === 'unavailable' ? 'ข้อมูลส่วนกลางยังไม่พร้อม' : sourceIsFallback ? 'ข้อมูลเดิม โปรดตรวจเวลา' : 'ข้อมูลส่วนกลาง'} · {thaiTime(lastUpdated, { day: 'numeric', month: 'short' })}</p></div>
        <div aria-label="เลือกตัวชี้วัด" className="metric-tabs" role="group">
          {Object.entries(metricOptions).map(([key, option]) => {
            const Icon = option.icon;
            return <button aria-pressed={metric === key} className={metric === key ? 'is-active' : ''} data-metric={key} key={key} onClick={() => setMetric(key)} type="button"><Icon aria-hidden="true" size={16} /> {option.label}</button>;
          })}
        </div>
        <div className="map-monitor-actions"><button className="wx-button wx-button--quiet" type="button" disabled={refreshing} onClick={refreshWeather}><RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} /> อัปเดต</button><button className="wx-button wx-button--quiet" type="button" onClick={exportCsv}><Download size={16} /> CSV</button><button className="wx-button wx-button--quiet" type="button" aria-pressed={monitor} onClick={() => setMonitor(!monitor)}><Monitor size={16} /> {monitor ? 'มุมมองปกติ' : 'มอนิเตอร์'}</button></div>
      </div>
      <div className="map-data-status"><span>มีข้อมูล{meta.label} {availableRows.length} / {allRows.length} จังหวัด · จังหวัดที่ไม่มีข้อมูลแสดงสีเทา</span><span>รีเฟรชอัตโนมัติทุก 10 นาที · {meta.unit}</span></div>

      <div className="map-workspace">
        <aside className="map-sidebar">
          <div className="map-summary"><span className="map-summary__icon"><MetricIcon aria-hidden="true" size={20} /></span><div><small>ค่าเฉลี่ยจังหวัดที่มีข้อมูล</small><strong>{nationalAverage === null ? '–' : metric === 'temp' ? nationalAverage.toFixed(1) : Math.round(nationalAverage)} <span>{meta.unit}</span></strong></div></div>
          <label className="search-field"><Search aria-hidden="true" size={18} /><span className="sr-only">ค้นหาจังหวัด</span><input onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาจังหวัด" type="search" value={query} /></label>
          <div className="province-list">
            {ranked.map(({ station, name, value }, index) => <button className={`province-row${selectedStation?.stationID === station.stationID ? ' is-selected' : ''}`} key={station.stationID} onClick={() => setSelectedStation(station)} type="button"><span className="province-row__rank">{value === null ? '–' : index + 1}</span><span className="province-row__name"><strong>{name}</strong><small>{getMetricStatus(metric, value)}</small></span><span className="province-row__value">{value === null ? '—' : Math.round(value)} <small>{meta.unit}</small></span></button>)}
            {!ranked.length && <div className="empty-inline">ไม่พบจังหวัดที่ตรงกับคำค้น</div>}
          </div>
        </aside>

        <section aria-label={`แผนที่${meta.label}ทั่วประเทศไทย`} className={`map-canvas${mapInteractive ? ' is-interactive' : ''}`}>
          <MapContainer center={[13.2, 101.1]} maxBounds={[[3.5, 92], [23, 110]]} minZoom={5} scrollWheelZoom={false} zoom={5.6}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus station={selectedStation} />
            <MapInteraction enabled={!compact || mapInteractive} />
            {visibleGeoData && <GeoJSON data={visibleGeoData} key={`${metric}-${query}-${lastUpdated}`} onEachFeature={bindFeature} style={featureStyle} />}
          </MapContainer>
          {compact && !mapInteractive && <button className="map-touch-gate" onClick={() => setMapInteractive(true)} type="button"><Hand aria-hidden="true" size={18} /> แตะเพื่อเลื่อนและซูมแผนที่</button>}
          {compact && mapInteractive && <button className="map-touch-exit" onClick={() => setMapInteractive(false)} type="button">เลื่อนหน้าต่อ</button>}
          <div className="map-legend" aria-label={`คำอธิบายสี ${meta.unit}`}>{legendValues.map((v, i) => <span key={v}><i style={{ background: getMetricTone(metric, v) }} /> {legendLabels[i]}</span>)}<span><i style={{ background: getMetricTone(metric, null) }} /> ไม่มีข้อมูล</span></div>
        </section>
      </div>
    </div>
  );
}
