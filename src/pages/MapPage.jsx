import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { geoJSON as leafletGeoJSON } from 'leaflet';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { CloudRain, Download, Gauge, Hand, Monitor, RefreshCw, Search, Thermometer, ThermometerSnowflake, ThermometerSun, Wind, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherContext } from '../context/WeatherContext';
import { displayValue, thaiTime } from '../utils/weatherData';
import { formatRiskValue, riskLevel, riskMapColors } from '../utils/riskScale';
import { mapReading } from '../utils/mapReadings';
import RiskValue, { RiskLegend } from '../components/RiskValue';

const metricOptions = {
  rain: { label: 'ฝนวันนี้', unit: 'มม.', icon: CloudRain },
  temp: { label: 'อุณหภูมิขณะนี้', unit: '°C', icon: Thermometer },
  tempMin: { label: 'ต่ำสุดวันนี้', unit: '°C', icon: ThermometerSnowflake },
  tempMax: { label: 'สูงสุดวันนี้', unit: '°C', icon: ThermometerSun },
  wind: { label: 'ลมกระโชก', unit: 'กม./ชม.', icon: Wind },
  pm25: { label: 'PM2.5 เฉลี่ย 24 ชม.', unit: 'µg/m³', icon: Gauge },
  pmHour: { label: 'PM2.5 รายชั่วโมง', unit: 'µg/m³', icon: Gauge },
};
function metricRisk(metric, value, stale = false) {
  return riskLevel(metric.startsWith('temp') ? 'temperature' : metric === 'wind' ? 'gust' : metric === 'pmHour' ? 'pm25' : metric, value, { stale, hours: ['rain', 'pm25'].includes(metric) ? 24 : null });
}
function getMetricTone(metric, value, stale = false) { return metricRisk(metric, value, stale).color; }
function getMetricFill(metric, value, stale = false) { return riskMapColors[metricRisk(metric, value, stale).tone]; }
function getMetricStatus(metric, value, stale = false) { return metricRisk(metric, value, stale).label; }

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

function MapFocus({ station }) {
  const map = useMap();
  const lat = Number(station?.lat), lon = Number(station?.long), id = station?.stationID;
  useEffect(() => {
    if (id && Number.isFinite(lat) && Number.isFinite(lon)) map.flyTo([lat, lon], 7.2, { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.7 });
  }, [map, lat, lon, id]);
  return null;
}

function MapOverview({ bounds, selected, resetVersion }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || selected) return undefined;
    const fit = () => map.fitBounds(bounds, { paddingTopLeft: [20, 20], paddingBottomRight: [20, 60], animate: false });
    fit();
    map.on('resize', fit);
    return () => map.off('resize', fit);
  }, [map, bounds, selected, resetVersion]);
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
  const [metric, setMetric] = useState('rain');
  const [query, setQuery] = useState('');
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [overviewVersion, setOverviewVersion] = useState(0);
  const mapCanvas = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [compact, setCompact] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(true);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
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

  const allRows = useMemo(() => (stations || []).map((station) => {
    const reading = mapReading(station, stationTemps, metric, now);
    return { station: { ...station, lat: reading.lat, long: reading.lon }, name: cleanName(station.areaTH), ...reading, stale: reading.stale || weatherMeta.fetchFailed };
  }), [metric, stationTemps, stations, now, weatherMeta.fetchFailed]);
  const selectedRow = allRows.find(row => row.station.stationID === selectedStationId);
  const selectedStation = selectedRow?.station;
  const countryBounds = useMemo(() => geoData ? leafletGeoJSON(geoData).getBounds() : null, [geoData]);
  const revealMap = () => {
    if (!compact) return;
    mapCanvas.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    mapCanvas.current?.focus({ preventScroll: true });
  };
  const selectProvince = station => { setSelectedStationId(station.stationID); revealMap(); };
  const showCountry = () => { setSelectedStationId(null); setOverviewVersion(version => version + 1); revealMap(); };

  const rowByName = useMemo(() => new Map(allRows.map((row) => [row.name, row])), [allRows]);
  const rows = useMemo(() => allRows.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [allRows, query]);
  const staleSignature = useMemo(() => rows.map((row) => (row.stale ? '1' : '0')).join(''), [rows]);
  const ranked = useMemo(() => [...rows].sort((a, b) => { if (a.value === null || a.stale) return b.value === null || b.stale ? a.name.localeCompare(b.name, 'th') : 1; if (b.value === null || b.stale) return -1; return metric === 'tempMin' ? a.value - b.value : b.value - a.value; }), [rows, metric]);
  const availableRows = allRows.filter(row => row.value !== null && !row.stale);
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
      fillColor: getMetricFill(metric, row?.value ?? null, row?.stale),
      fillOpacity: row?.value === null || row?.stale ? 0.28 : 0.7,
      opacity: 1,
      weight: selected ? 3 : 1.25,
    };
  };

  const bindFeature = (feature, layer) => {
    const name = getFeatureName(feature);
    const row = rowByName.get(name);
    const value = row?.value ?? null;
    const readingText = formatRiskValue(row?.riskMetric || metric, value, { unit: ` ${meta.unit}`, hours: row?.hours }).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    layer.bindPopup(`<div class="map-popup"><strong>${name}</strong><span style="color:${getMetricTone(metric, value, row?.stale)}">${readingText}</span><small>${getMetricStatus(metric, value, row?.stale)} · จุดอ้างอิงจังหวัด · ${thaiTime(row?.validAt, { day: 'numeric', month: 'short' })}</small><a href="/?province=${encodeURIComponent(name)}">ดูพยากรณ์จังหวัดนี้</a></div>`);
    layer.on({
      click: () => {
        if (row) setSelectedStationId(row.station.stationID);
        layer.setStyle({ color: '#102b64', fillOpacity: 0.95, weight: 3 });
      },
      mouseover: () => layer.setStyle({ fillOpacity: 0.95, weight: 2.3 }),
      mouseout: () => layer.setStyle(featureStyle(feature)),
    });
  };

  const legendValues = metric === 'pm25' ? [15, 25, 37.5, 75, 76] : metric.startsWith('temp') ? [7, 15, 22, 30, 35, 40] : metric === 'rain' ? [0, 10, 35, 90, 91] : metric === 'pmHour' ? [0] : [10, 25, 45, 65];
  const legendLabels = metric === 'pm25' ? ['≤15', '>15–25', '>25–37.5', '>37.5–75', '>75'] : metric.startsWith('temp') ? ['<8', '8–<16', '16–<23', '23–<35', '35–<40', '≥40'] : metric === 'rain' ? ['<0.1', '0.1–10', '>10–35', '>35–90', '>90'] : metric === 'pmHour' ? ['รายชั่วโมง · ไม่จัดระดับ AQI'] : ['<20', '20–<40', '40–<62', '≥62'];
  const exportCsv = () => {
    const quote = text => `"${String(text ?? '').replace(/"/g, '""').replace(/^[=+@-]/, "'")}"`;
    const lines = [['จังหวัด (จุดอ้างอิง)', 'ละติจูด', 'ลองจิจูด', meta.label, 'หน่วย', 'เวลาตัวชี้วัด', 'แหล่งข้อมูล', 'รูปแบบเวลา', 'ระยะเวลาที่ค่าแทน (ชั่วโมง)', 'สถานะ'], ...ranked.map(row => [row.name, row.station.lat, row.station.long, row.value, meta.unit, row.validAt || '', row.source, row.periodLabel, row.hours ?? '', row.value === null ? 'ไม่มีข้อมูล' : row.stale ? 'ข้อมูลเดิม' : 'มีข้อมูลตามเวลา'])];
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
        <div className="map-monitor-actions"><button className="wx-button wx-button--quiet" type="button" disabled={refreshing} onClick={refreshWeather}><RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} /> อัปเดต</button><button className="wx-button wx-button--quiet" type="button" onClick={exportCsv}><Download size={16} /> CSV</button><button className="wx-button wx-button--quiet" type="button" aria-pressed={monitor} onClick={() => setMonitor(!monitor)}><Monitor size={16} /> {monitor ? 'มุมมองปกติ' : 'มอนิเตอร์'}</button><button className="wx-button wx-button--quiet" type="button" onClick={showCountry}>ดูทั้งประเทศ</button></div>
      </div>
      <div className="map-data-status"><span>มีข้อมูล {meta.label} · {availableRows.length} / {allRows.length} จังหวัด · ข้อมูลเก่าหรือไม่พร้อมแสดงสีเทา</span><span>รีเฟรชอัตโนมัติทุก 10 นาที · {meta.unit}</span></div>

      <p className="map-scope-note">สีจังหวัดใช้ค่าที่พิกัดอ้างอิงเดียว หมุดคือจุดพยากรณ์ ไม่ใช่ค่าเฉลี่ยทั้งพื้นที่ · {metric === 'rain' ? 'ฝนพยากรณ์สะสมวันนี้ 00:00–24:00 น.' : metric === 'pm25' ? 'CAMS เฉลี่ยครบ 24 ชั่วโมง · สีเทียบเกณฑ์ความเข้มข้น ไม่ใช่ AQI ทางการ' : metric === 'pmHour' ? 'CAMS รายชั่วโมง · ไม่ใช้เกณฑ์เฉลี่ย 24 ชั่วโมง' : 'ค่าจากแบบจำลองตามพิกัด · เวลาไทย'}</p><RiskLegend />
      <div className="map-workspace">
        <aside className="map-sidebar">
          <div className="map-summary"><span className="map-summary__icon"><MetricIcon aria-hidden="true" size={20} /></span><div><small>เฉลี่ยจุดอ้างอิงที่มีข้อมูลใหม่</small><strong>{displayValue(nationalAverage, '', 1)} <span>{meta.unit}</span></strong></div></div>
          <label className="search-field"><Search aria-hidden="true" size={18} /><span className="sr-only">ค้นหาจังหวัด</span><input onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาจังหวัด" type="search" value={query} />{query && <button type="button" className="search-clear" aria-label="ล้างคำค้น" onClick={() => setQuery('')}><X aria-hidden="true" size={16} /></button>}</label>
          {query.trim() && <p className="map-search-count">พบ {ranked.length} จังหวัด</p>}
          <div className="province-list">
            {ranked.map(({ station, name, value, stale, validAt, riskMetric, hours }, index) => <button className={`province-row${selectedStation?.stationID === station.stationID ? ' is-selected' : ''}`} key={station.stationID} onClick={() => selectProvince(station)} aria-pressed={selectedStationId === station.stationID} type="button"><span className="province-row__rank">{value === null || stale ? '–' : index + 1}</span><span className="province-row__name"><strong>{name}</strong><small>{getMetricStatus(metric, value, stale)}</small><small>{thaiTime(validAt, { day: 'numeric', month: 'short' })}</small></span><span className="province-row__value"><RiskValue metric={riskMetric} value={value} hours={hours} stale={stale} /> <small>{meta.unit}</small></span></button>)}
            {!ranked.length && <div className="empty-inline">ไม่พบจังหวัดที่ตรงกับคำค้น</div>}
          </div>
        </aside>

        <section ref={mapCanvas} tabIndex={-1} aria-label={`แผนที่${meta.label}ทั่วประเทศไทย`} className={`map-canvas${mapInteractive ? ' is-interactive' : ''}`}>
          {selectedRow && <div className="map-selection" role="status"><div className="map-selection__head"><strong>{selectedRow.name} · <RiskValue metric={selectedRow.riskMetric} value={selectedRow.value} hours={selectedRow.hours} stale={selectedRow.stale} unit={` ${meta.unit}`} /></strong><button type="button" className="map-selection__close" aria-label="ปิดรายละเอียดจังหวัด" onClick={() => setSelectedStationId(null)}><X size={16} aria-hidden="true" /></button></div><span>{meta.label} · {getMetricStatus(metric, selectedRow.value, selectedRow.stale)}</span><div className="map-selection__links"><Link to={`/?province=${encodeURIComponent(selectedRow.name)}`}>ดูพยากรณ์จังหวัดนี้</Link><Link to={`/stats?province=${encodeURIComponent(selectedRow.name)}`}>ดูสถิติย้อนหลัง</Link></div></div>}
          <MapContainer center={[13.2, 101.1]} maxBounds={[[3.5, 92], [23, 110]]} minZoom={4} zoomSnap={0.25} scrollWheelZoom={false} zoom={5}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapOverview bounds={countryBounds} selected={Boolean(selectedStation)} resetVersion={overviewVersion} />
            <MapFocus station={selectedStation} />
            {rows.map(row => <CircleMarker key={row.station.stationID} center={[Number(row.station.lat), Number(row.station.long)]} radius={selectedStation?.stationID === row.station.stationID ? 6 : 2.5} pathOptions={{ color: '#17344f', fillColor: '#fff', fillOpacity: 1, weight: 1 }} interactive={false} />)}
            <MapInteraction enabled={!compact || mapInteractive} />
            {visibleGeoData && <GeoJSON data={visibleGeoData} key={`${metric}-${query}-${lastUpdated}-${staleSignature}`} onEachFeature={bindFeature} style={featureStyle} />}
          </MapContainer>
          {compact && !mapInteractive && <button className="map-touch-gate" onClick={() => setMapInteractive(true)} type="button"><Hand aria-hidden="true" size={18} /> แตะเพื่อเลื่อนและซูมแผนที่</button>}
          {compact && mapInteractive && <button className="map-touch-exit" onClick={() => setMapInteractive(false)} type="button">เลื่อนหน้าต่อ</button>}
          <div className="map-legend" aria-label={`คำอธิบายสี ${meta.unit}`}>{legendValues.map((v, i) => <span key={v}><i style={{ background: getMetricFill(metric, v) }} /> {legendLabels[i]}</span>)}<span><i style={{ background: getMetricFill(metric, null) }} /> เก่า / ไม่พร้อม</span></div>
        </section>
      </div>
    </div>
  );
}
