import { useContext, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CloudRain, Gauge, LoaderCircle, ThermometerSun, TrendingDown, TrendingUp } from 'lucide-react';
import { WeatherContext } from '../context/WeatherContext';

const LOCATION_KEY = 'air4thai.selectedProvince';
const metrics = {
  rain: { label: 'ปริมาณฝน', unit: 'มม.', icon: CloudRain, color: '#2788f5', aggregate: 'sum' },
  tempMax: { label: 'อุณหภูมิสูงสุด', unit: '°C', icon: ThermometerSun, color: '#ff8b3d', aggregate: 'average' },
  heatMax: { label: 'อุณหภูมิที่รู้สึก', unit: '°C', icon: ThermometerSun, color: '#f04f70', aggregate: 'average' },
  pm25: { label: 'ฝุ่น PM2.5', unit: 'µg/m³', icon: Gauge, color: '#7357dd', aggregate: 'average' },
};

const periods = [{ value: 30, label: '30 วัน' }, { value: 90, label: '90 วัน' }, { value: 365, label: '1 ปี' }];
const cleanName = (value = '') => String(value).replace(/^จังหวัด/, '').trim();
const round = (value) => Math.round(value * 10) / 10;

function summarize(rows, key, aggregate) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return aggregate === 'sum' ? round(values.reduce((sum, value) => sum + value, 0)) : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

export default function StatsPage() {
  const { stations } = useContext(WeatherContext);
  const [province, setProvince] = useState(() => cleanName(localStorage.getItem(LOCATION_KEY) || 'กรุงเทพมหานคร'));
  const [metric, setMetric] = useState('rain');
  const [period, setPeriod] = useState(30);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sortedStations = useMemo(() => [...(stations || [])].sort((a, b) => a.areaTH.localeCompare(b.areaTH, 'th')), [stations]);
  const selectedStation = useMemo(() => sortedStations.find((item) => cleanName(item.areaTH) === cleanName(province)) || sortedStations[0], [province, sortedStations]);

  useEffect(() => {
    if (!selectedStation) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/statistics?lat=${selectedStation.lat}&lon=${selectedStation.long}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`ระบบสถิติตอบกลับ ${response.status}`);
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('บริการสถิติยังไม่พร้อมในโหมดทดสอบนี้');
        return response.json();
      })
      .then(setPayload)
      .catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedStation]);

  const config = metrics[metric];
  const analysis = useMemo(() => {
    const all = payload?.daily || [];
    const available = all.filter((row) => Number.isFinite(Number(row[metric])));
    const currentRows = available.slice(-period);
    const previousRows = available.slice(-(period * 2), -period);
    const current = summarize(currentRows, metric, config.aggregate);
    const previous = previousRows.length === currentRows.length ? summarize(previousRows, metric, config.aggregate) : null;
    const average = summarize(currentRows, metric, 'average');
    const values = currentRows.map((row) => Number(row[metric])).filter(Number.isFinite);
    const chart = currentRows.map((row) => ({ ...row, label: formatShortDate(row.date) }));
    return {
      current,
      previous,
      average,
      difference: current !== null && previous !== null ? round(current - previous) : null,
      max: values.length ? round(Math.max(...values)) : null,
      min: values.length ? round(Math.min(...values)) : null,
      days: currentRows.length,
      chart,
    };
  }, [config.aggregate, metric, payload, period]);

  const changeUp = Number(analysis.difference) > 0;
  const ChangeIcon = changeUp ? TrendingUp : TrendingDown;

  const handleProvince = (event) => {
    setProvince(event.target.value);
    localStorage.setItem(LOCATION_KEY, event.target.value);
  };

  return (
    <div className="page stats-page">
      <div className="page__inner">
        <header className="stats-header">
          <div><span className="section-label">มองอดีตเพื่อวางแผนข้างหน้า</span><h1>สถิติอากาศย้อนหลัง</h1><p>ดูฝน อุณหภูมิ ความร้อน และฝุ่น พร้อมเทียบกับช่วงก่อนหน้าในมุมมองเดียว</p></div>
          <label className="select-field stats-province"><span className="sr-only">เลือกจังหวัด</span><select onChange={handleProvince} value={province}>{sortedStations.map((station) => <option key={station.stationID} value={cleanName(station.areaTH)}>{cleanName(station.areaTH)}</option>)}</select></label>
        </header>

        <div className="stats-controls">
          <div className="metric-tabs" role="group" aria-label="เลือกข้อมูลสถิติ">{Object.entries(metrics).map(([key, item]) => { const Icon = item.icon; return <button className={metric === key ? 'is-active' : ''} data-metric={key === 'tempMax' || key === 'heatMax' ? 'temp' : key === 'pm25' ? 'wind' : 'rain'} key={key} onClick={() => setMetric(key)} type="button"><Icon aria-hidden="true" size={16} /> {item.label}</button>; })}</div>
          <div className="period-tabs" role="group" aria-label="เลือกช่วงเวลา">{periods.map((item) => <button className={period === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPeriod(item.value)} type="button">{item.label}</button>)}</div>
        </div>

        {loading ? <div className="stats-loading"><LoaderCircle className="is-spinning" size={28} /><strong>กำลังวิเคราะห์ข้อมูลย้อนหลังของ{cleanName(province)}</strong></div>
          : error ? <div className="empty-state"><BarChart3 size={28} /><h2>ยังโหลดสถิติไม่ได้</h2><p>{error}</p></div>
            : (
              <>
                <section className="stats-kpis" aria-label="สรุปสถิติ">
                  <article className="stat-kpi stat-kpi--primary"><span>{config.label}ช่วงนี้</span><strong>{analysis.current ?? '–'} <small>{config.unit}</small></strong><p>{analysis.days} วันที่มีข้อมูล</p></article>
                  <article className="stat-kpi"><span>เทียบช่วงก่อนหน้า</span><strong className={analysis.difference === null ? '' : changeUp ? 'is-up' : 'is-down'}>{analysis.difference === null ? '–' : <><ChangeIcon size={20} /> {Math.abs(analysis.difference)} <small>{config.unit}</small></>}</strong><p>{analysis.previous === null ? 'ข้อมูลช่วงก่อนหน้าไม่ครบ' : `ช่วงก่อนหน้า ${analysis.previous} ${config.unit}`}</p></article>
                  <article className="stat-kpi"><span>ค่าเฉลี่ยรายวัน</span><strong>{analysis.average ?? '–'} <small>{config.unit}</small></strong><p>สูงสุด {analysis.max ?? '–'} · ต่ำสุด {analysis.min ?? '–'}</p></article>
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
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }} formatter={(value) => [`${value} ${config.unit}`, config.label]} labelFormatter={(label) => `วันที่ ${label}`} />
                        {analysis.average !== null && <ReferenceLine stroke={config.color} strokeDasharray="5 5" y={analysis.average} />}
                        <Area dataKey={metric} fill={`url(#fill-${metric})`} isAnimationActive stroke={config.color} strokeWidth={2.5} type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="stats-source">ข้อมูลอากาศย้อนหลัง ERA5 และข้อมูล PM2.5 จาก CAMS ผ่าน Open-Meteo · ฝุ่นย้อนหลังสูงสุด 92 วัน · อากาศย้อนหลังสูงสุด 1 ปี</p>
                </section>
              </>
            )}
      </div>
    </div>
  );
}
