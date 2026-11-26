import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CloudRain, Download, Gauge, LoaderCircle, ThermometerSun, TrendingDown, TrendingUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { provinces77 } from '../provinces77';
import { mountainPlaces } from '../data/mountainPlaces';
import RiskValue, { RiskLegend } from '../components/RiskValue';
import { displayValue, finiteOrNull, weatherDate, BANGKOK } from '../utils/weatherData';

const LOCATION_KEY = 'air4thai.selectedProvince';
const metrics = {
  rain: { label: 'ปริมาณฝน', unit: 'มม.', icon: CloudRain, color: '#2788f5', aggregate: 'sum' },
  tempMin: { label: 'อุณหภูมิต่ำสุด', unit: '°C', icon: ThermometerSun, color: '#155fa0', aggregate: 'average' },
  tempMax: { label: 'อุณหภูมิสูงสุด', unit: '°C', icon: ThermometerSun, color: '#ff8b3d', aggregate: 'average' },
  heatMax: { label: 'อุณหภูมิที่รู้สึก', unit: '°C', icon: ThermometerSun, color: '#f04f70', aggregate: 'average' },
  pm25: { label: 'ฝุ่น PM2.5', unit: 'µg/m³', icon: Gauge, color: '#7357dd', aggregate: 'average' },
};

const periods = [{ value: 30, label: '30 วัน' }, { value: 90, label: '90 วัน' }, { value: 365, label: '1 ปี' }];
const cleanName = (value = '') => String(value).replace(/^จังหวัด/, '').trim();
const round = (value) => Math.round(value * 10) / 10;

function summarize(rows, key, aggregate) {
  const values = rows.map((row) => finiteOrNull(row[key])).filter(value => value !== null);
  if (!values.length) return null;
  return aggregate === 'sum' ? round(values.reduce((sum, value) => sum + value, 0)) : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, day: 'numeric', month: 'short' }).format(weatherDate(value));
}

export default function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortedStations = useMemo(() => [...provinces77.map(p => ({ stationID: p.n, areaTH: p.n, lat: p.lat, long: p.lon, group: 'province' })), ...mountainPlaces.map(p => ({ stationID: p.id, areaTH: p.name, lat: p.lat, long: p.lon, elevation: p.elevation, group: 'mountain' }))].sort((a, b) => a.areaTH.localeCompare(b.areaTH, 'th')), []);
  const requestedProvince = searchParams.get('province');
  const [province, setProvince] = useState(() => {
    const requested = requestedProvince ? cleanName(requestedProvince) : '';
    if (requested && sortedStations.some(item => cleanName(item.areaTH) === requested)) return requested;
    try { return cleanName(localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร'); } catch { return 'กรุงเทพมหานคร'; }
  });
  const [metric, setMetric] = useState('rain');
  const [period, setPeriod] = useState(30);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const provinceStations = useMemo(() => sortedStations.filter(item => item.group === 'province'), [sortedStations]);
  const mountainStations = useMemo(() => sortedStations.filter(item => item.group === 'mountain'), [sortedStations]);
  const selectedStation = useMemo(() => sortedStations.find((item) => cleanName(item.areaTH) === cleanName(province)) || sortedStations[0], [province, sortedStations]);

  useEffect(() => {
    if (!requestedProvince) return;
    const requested = cleanName(requestedProvince);
    if (sortedStations.some(item => cleanName(item.areaTH) === requested)) {
      setProvince(previous => (cleanName(previous) === requested ? previous : requested));
    }
  }, [requestedProvince, sortedStations]);

  useEffect(() => {
    if (!selectedStation) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setPayload(null);
    setError('');
    fetch(`/api/statistics?lat=${selectedStation.lat}&lon=${selectedStation.long}${selectedStation.elevation == null ? '' : '&elevation=' + selectedStation.elevation}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) })
      .then((response) => {
        if (!response.ok) throw new Error(`ระบบสถิติตอบกลับ ${response.status}`);
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('บริการสถิติยังไม่พร้อมในโหมดทดสอบนี้');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setPayload(data); })
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError.name === 'TimeoutError' ? 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองอีกครั้ง' : 'เชื่อมต่อข้อมูลย้อนหลังไม่ได้ กรุณาลองอีกครั้ง'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedStation, retry]);

  const config = metrics[metric];
  const analysis = useMemo(() => {
    const all = payload?.daily || [];
    const currentRows = all.slice(-period);
    const previousRows = all.slice(-(period * 2), -period);
    const current = summarize(currentRows, metric, config.aggregate);
    const complete = rows => rows.length === period && rows.every(row => finiteOrNull(row[metric]) !== null);
    const previous = complete(previousRows) && complete(currentRows) ? summarize(previousRows, metric, config.aggregate) : null;
    const average = summarize(currentRows, metric, 'average');
    const values = currentRows.map((row) => finiteOrNull(row[metric])).filter(value => value !== null);
    const max = values.length ? Math.max(...values) : null;
    const min = values.length ? Math.min(...values) : null;
    const maxDate = max === null ? null : currentRows.find(row => finiteOrNull(row[metric]) === max)?.date || null;
    const minDate = min === null ? null : currentRows.find(row => finiteOrNull(row[metric]) === min)?.date || null;
    const chart = currentRows.map((row) => ({ ...row, label: formatShortDate(row.date) }));
    return {
      current,
      previous,
      average,
      difference: current !== null && previous !== null ? round(current - previous) : null,
      max,
      min,
      maxDate,
      minDate,
      days: values.length,
      chart,
    };
  }, [config.aggregate, metric, payload, period]);

  const changeUp = Number(analysis.difference) > 0;
  const ChangeIcon = changeUp ? TrendingUp : TrendingDown;

  const handleProvince = (event) => {
    setPayload(null);
    setLoading(true);
    setError('');
    if (searchParams.has('province')) setSearchParams({}, { replace: true });
    setProvince(event.target.value);
    try { localStorage.setItem(LOCATION_KEY, event.target.value); } catch { /* Optional preference. */ }
  };

  const exportCsv = () => {
    if (!analysis.chart.length) return;
    const quote = text => `"${String(text ?? '').replace(/"/g, '""').replace(/^[=+@-]/, "'")}"`;
    const lines = [
      ['พื้นที่', 'ละติจูด', 'ลองจิจูด', 'วันที่', 'ต่ำสุด (°C)', 'สูงสุด (°C)', 'รู้สึกสูงสุด (°C)', 'ฝน (มม.)', 'PM2.5 เฉลี่ย 24 ชม. (µg/m³)', 'ชั่วโมง PM2.5 ครบ'],
      ...analysis.chart.map(row => [cleanName(selectedStation?.areaTH), selectedStation?.lat, selectedStation?.long, row.date, row.tempMin, row.tempMax, row.heatMax, row.rain, row.pm25, row.pm25ValidHours ?? 0]),
    ];
    const url = URL.createObjectURL(new Blob(['\ufeff', lines.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `weather-history-${cleanName(selectedStation?.areaTH)}-${period}d.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page stats-page">
      <div className="page__inner">
        <header className="stats-header">
          <div><span className="section-label">มองอดีตเพื่อวางแผนข้างหน้า</span><h1>สถิติอากาศย้อนหลัง</h1><p>ดูฝน อุณหภูมิ ความร้อน และฝุ่น พร้อมเทียบกับช่วงก่อนหน้าในมุมมองเดียว</p></div>
          <div className="stats-header-actions">
            <label className="select-field stats-province"><span className="sr-only">เลือกจังหวัด</span><select onChange={handleProvince} value={province}><optgroup label="จังหวัด (77 จังหวัด)">{provinceStations.map((station) => <option key={station.stationID} value={cleanName(station.areaTH)}>{cleanName(station.areaTH)}</option>)}</optgroup><optgroup label="ดอยและพื้นที่สูง">{mountainStations.map((station) => <option key={station.stationID} value={cleanName(station.areaTH)}>{cleanName(station.areaTH)}</option>)}</optgroup></select></label>
            <button className="wx-button wx-button--quiet" disabled={loading || !analysis.chart.length} onClick={exportCsv} type="button"><Download aria-hidden="true" size={16} /> CSV</button>
          </div>
        </header>

        <div className="stats-controls">
          <div className="metric-tabs" role="group" aria-label="เลือกข้อมูลสถิติ">{Object.entries(metrics).map(([key, item]) => { const Icon = item.icon; return <button aria-pressed={metric === key} className={metric === key ? 'is-active' : ''} data-metric={key.startsWith('temp') || key === 'heatMax' ? 'temp' : key === 'pm25' ? 'wind' : 'rain'} key={key} onClick={() => setMetric(key)} type="button"><Icon aria-hidden="true" size={16} /> {item.label}</button>; })}</div>
          <div className="period-tabs" role="group" aria-label="เลือกช่วงเวลา">{periods.map((item) => <button aria-pressed={period === item.value} className={period === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPeriod(item.value)} type="button">{item.label}</button>)}</div>
        </div>

        {!loading && analysis.chart.length > 0 && <p className="stats-source">ช่วงข้อมูล {formatShortDate(analysis.chart[0].date)} – {formatShortDate(analysis.chart.at(-1).date)} · ข้อมูลย้อนหลังอาจล่าช้าจากวันปัจจุบัน · ค่าสรุปหลายวันใช้สีข้อมูล อ่านระดับสีจากค่ารายวัน</p>}
        {loading ? <div className="stats-loading"><LoaderCircle className="is-spinning" size={28} /><strong>กำลังวิเคราะห์ข้อมูลย้อนหลังของ{cleanName(province)}</strong></div>
          : error ? <div className="empty-state" role="status"><BarChart3 size={28} /><h2>ยังโหลดสถิติไม่ได้</h2><p>{error}</p><button className="wx-button wx-button--quiet" type="button" onClick={() => setRetry(value => value + 1)}>ลองโหลดสถิติอีกครั้ง</button></div>
            : (
              <>
                <section className="stats-kpis" aria-label="สรุปสถิติ">
                  <article className="stat-kpi stat-kpi--primary"><span>{metric === 'rain' ? 'รวมฝนเฉพาะวันที่มีข้อมูล' : `เฉลี่ย${config.label}รายวัน`}</span><strong>{analysis.current ?? '–'} <small>{config.unit}</small></strong><p>{analysis.days} วันที่มีข้อมูล / {period} วัน</p></article>
                  <article className="stat-kpi"><span>เทียบช่วงก่อนหน้า</span><strong className="stat-change">{analysis.difference === null ? '–' : <><span className="stat-change__direction">{analysis.difference === 0 ? 'เท่าเดิม' : changeUp ? 'เพิ่มขึ้น' : 'ลดลง'}</span>{analysis.difference !== 0 && <ChangeIcon aria-hidden="true" size={20} />} {Math.abs(analysis.difference)} <small>{config.unit}</small></>}</strong><p>{analysis.previous === null ? 'ข้อมูลช่วงก่อนหน้าไม่ครบ' : `ช่วงก่อนหน้า ${analysis.previous} ${config.unit}`}</p></article>
                  <article className="stat-kpi"><span>ค่าเฉลี่ยรายวัน</span><strong>{analysis.average ?? '–'} <small>{config.unit}</small></strong><p>สูงสุด <RiskValue metric={metric.startsWith('temp') ? 'temperature' : metric === 'heatMax' ? 'apparent' : metric} value={analysis.max} hours={['rain', 'pm25'].includes(metric) ? 24 : null} />{analysis.maxDate ? ` (${formatShortDate(analysis.maxDate)})` : ''} · ต่ำสุด <RiskValue metric={metric.startsWith('temp') ? 'temperature' : metric === 'heatMax' ? 'apparent' : metric} value={analysis.min} hours={['rain', 'pm25'].includes(metric) ? 24 : null} />{analysis.minDate ? ` (${formatShortDate(analysis.minDate)})` : ''}</p></article>
                </section>

                <section className="stats-chart-card">
                  <div className="section-heading"><div><span className="section-label">แนวโน้ม{cleanName(province)}</span><h2>{config.label}ย้อนหลัง {period === 365 ? '1 ปี' : `${period} วัน`}</h2></div><span className="section-note">เส้นประคือค่าเฉลี่ย {analysis.average ?? '–'} {config.unit}</span></div>
                  <div className="stats-chart" role="img" aria-label={`กราฟ${config.label}ย้อนหลัง`}>
                    <ResponsiveContainer height="100%" width="100%">
                      <AreaChart data={analysis.chart} margin={{ top: 15, right: 10, left: -12, bottom: 0 }}>
                        <defs><linearGradient id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={config.color} stopOpacity={0.42} /><stop offset="100%" stopColor={config.color} stopOpacity={0.03} /></linearGradient></defs>
                        <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                        <XAxis axisLine={false} dataKey="label" minTickGap={34} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} />
                        <YAxis axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} unit={config.unit === '°C' ? '°' : ''} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }} labelStyle={{ color: 'var(--ink)', fontWeight: 600 }} itemStyle={{ color: 'var(--primary-hover)' }} formatter={(value) => [displayValue(value, ` ${config.unit}`, 1), config.label]} labelFormatter={(label) => `วันที่ ${label}`} />
                        {analysis.average !== null && <ReferenceLine stroke={config.color} strokeDasharray="5 5" y={analysis.average} />}
                        <Area dataKey={metric} fill={`url(#fill-${metric})`} isAnimationActive={false} connectNulls={false} stroke={config.color} strokeWidth={2.5} type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="stats-source">ข้อมูลอากาศย้อนหลังจากแบบจำลอง Open-Meteo Best Match และ PM2.5 จาก CAMS · ไม่ใช่ผลตรวจวัดสถานี · ค่าเฉลี่ยฝุ่นรายวันใช้เฉพาะวันที่ครบ 24 ชั่วโมง · ฝุ่นย้อนหลังสูงสุด 92 วัน อากาศย้อนหลัง 1 ปี</p>
                </section>
                <RiskLegend />
                <details className="stats-daily-details"><summary>ดูค่ารายวันและความครบของข้อมูล ({analysis.chart.length} วัน)</summary><div className="stats-table-scroll" tabIndex={0} role="region" aria-label="ข้อมูลสถิติรายวัน เลื่อนเพื่อดูทุกคอลัมน์"><table className="stats-data-table"><caption>พิกัด {selectedStation?.lat}, {selectedStation?.long} · วันตามเวลาไทย · ฝนและฝุ่นเฉลี่ยใช้ช่วง 24 ชั่วโมง</caption><thead><tr><th scope="col">วันที่</th><th scope="col">ต่ำสุด °C</th><th scope="col">สูงสุด °C</th><th scope="col">ฝน มม.</th><th scope="col">PM2.5 µg/m³</th><th scope="col">ชั่วโมงฝุ่น</th></tr></thead><tbody>{[...analysis.chart].reverse().map(row => <tr key={row.date}><th scope="row">{formatShortDate(row.date)}</th><td><RiskValue metric="temperature" value={row.tempMin} /></td><td><RiskValue metric="temperature" value={row.tempMax} /></td><td><RiskValue metric="rain" value={row.rain} hours={24} /></td><td><RiskValue metric="pm25" value={row.pm25} hours={24} /></td><td>{row.pm25ValidHours ?? '—'}/24</td></tr>)}</tbody></table></div></details>
              </>
            )}
      </div>
    </div>
  );
}
