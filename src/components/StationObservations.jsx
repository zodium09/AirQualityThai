import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RadioTower, RefreshCw } from 'lucide-react';
import { displayValue, thaiTime, isStaleTime } from '../utils/weatherData';
import RiskValue from './RiskValue';

export default function StationObservations({ lat, lon, now }) {
  const [state, setState] = useState({ loading: true, data: null });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let request;
    let active = true;
    const load = async () => {
      request?.abort(); request = new AbortController();
      const controller = request;
      setState({ loading: true, data: null });
      try {
        const response = await fetch(`/api/observations?lat=${lat}&lon=${lon}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(24000)]) });
        if (!response.ok) throw new Error('observations');
        const data = await response.json();
        if (active && request === controller) setState({ loading: false, data });
      } catch { if (active && request === controller) setState({ loading: false, data: null }); }
    };
    load();
    const visibleLoad = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(visibleLoad, 600000);
    document.addEventListener('visibilitychange', visibleLoad);
    return () => { active = false; request?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visibleLoad); };
  }, [lat, lon, refresh]);
  const weather = state.data?.weather;
  const air = state.data?.air;
  const usableWeather = weather?.status === 'available';
  const usableAir = air?.status === 'available';
  const airStale = air?.stale || isStaleTime(air?.observedAt, now, 10800000);
  const weatherStale = weather?.stale || isStaleTime(weather?.observedAt, now, 26 * 3600000);
  return <section className="wx-panel wx-observations" aria-labelledby="station-title">
    <div className="wx-section-head">
      <div className="wx-observations-head">
        <span className="wx-head-badge wx-head-badge--mint" aria-hidden="true"><RadioTower size={20} /></span>
        <div>
          <h2 id="station-title">ค่าตรวจวัดจากสถานีใกล้เคียง</h2>
          <p>ค่าของสถานีแต่ละแห่ง สภาพจริงที่ตำแหน่งคุณอาจต่างกัน</p>
        </div>
      </div>
      <button className="wx-button wx-button--quiet" type="button" disabled={state.loading} onClick={() => setRefresh(x => x + 1)} aria-label="อัปเดตค่าตรวจวัด"><RefreshCw size={16} className={state.loading ? 'is-spinning' : ''} /></button>
    </div>
    {state.loading ? <p role="status">กำลังตรวจข้อมูลสถานี…</p> : <div className="station-columns">
      <div className="station-card">
        <h3>อากาศ · {usableWeather ? weather.station.name : 'ข้อมูลสถานียังไม่พร้อม'}</h3>
        {usableWeather ? <>
          <p className="station-meta">ห่าง {displayValue(weather.station.distanceKm, ' กม.', 1)} · ตรวจวัด {thaiTime(weather.observedAt, { day: 'numeric', month: 'short' })}{weatherStale ? ' · ข้อมูลเดิม' : ''}</p>
          {weather.farFromLocation && <p className="station-far-note">สถานีอยู่ห่างกว่า 50 กม. · ใช้ดูประกอบเท่านั้น</p>}
          <div className="station-values">
            <div className="station-tile"><span>อุณหภูมิ ณ เวลาตรวจ</span><RiskValue metric="temperature" value={weather.temperature} unit="°C" stale={weatherStale} label /></div>
            <div className="station-tile station-extreme station-extreme--min"><span><ArrowDown size={13} aria-hidden="true" /> ต่ำสุดย้อนหลัง</span><RiskValue className="wx-extreme-min" metric="temperature" value={weather.tempMin} unit="°C" stale={weatherStale} /></div>
            <div className="station-tile station-extreme station-extreme--max"><span><ArrowUp size={13} aria-hidden="true" /> สูงสุดย้อนหลัง</span><RiskValue className="wx-extreme-max" metric="temperature" value={weather.tempMax} unit="°C" stale={weatherStale} /></div>
            <div className="station-tile"><span>ฝนสะสมที่สถานี</span><RiskValue metric="rain" value={weather.rainMm} unit=" มม." hours={weather.averagingWindow?.hours} stale={weatherStale} label /></div>
          </div>
          <p className="wx-footnote">{weather.averagingWindow?.label || 'ตรวจช่วงเวลาจากต้นทาง'}{weather.averagingWindow?.start && ` · ${thaiTime(weather.averagingWindow.start, { day: 'numeric', month: 'short' })} ถึง ${thaiTime(weather.averagingWindow.end, { day: 'numeric', month: 'short' })}`}</p>
          <a href={weather.sourceUrl} target="_blank" rel="noreferrer">ข้อมูลจาก {weather.source}</a>
        </> : <p>ยังยืนยันค่าตรวจวัดไม่ได้ · พยากรณ์จากแบบจำลองยังดูได้ด้านบน</p>}
      </div>
      <div className="station-card">
        <h3>ฝุ่น · {usableAir ? air.station.name : 'ข้อมูลสถานีฝุ่นยังไม่พร้อม'}</h3>
        {usableAir ? <>
          <p className="station-meta">ห่าง {displayValue(air.station.distanceKm, ' กม.', 1)} · {air.averagingWindow?.label || 'ยังไม่ยืนยันช่วงเฉลี่ย'}</p>
          {air.farFromLocation && <p className="station-far-note">สถานีอยู่ห่างกว่า 50 กม. · ใช้ดูประกอบเท่านั้น</p>}
          <div className="station-pm-box">
            <RiskValue className="station-pm" metric="pm25" value={air.pm25} unit=" µg/m³" hours={air.averagingWindow?.hours} stale={airStale} label />
            {Number.isFinite(air.pm25Aqi) && <p className="station-aqi">ดัชนี PM2.5 ของสถานี (Air4Thai): <strong>{displayValue(air.pm25Aqi)}</strong> · แยกจากค่าความเข้มข้น µg/m³</p>}
          </div>
          <p className="station-meta">ข้อมูล {thaiTime(air.observedAt, { day: 'numeric', month: 'short' })}{airStale ? ' · ข้อมูลเดิม' : ''}</p>
          <p className="wx-footnote">ระดับสีเทียบเฉพาะ PM2.5 ตามช่วงเฉลี่ย ไม่ใช่ AQI รวมทุกมลพิษ</p>
          <a href={air.sourceUrl} target="_blank" rel="noreferrer">ข้อมูลจาก {air.source}</a>
        </> : <p>ยังยืนยันค่าฝุ่นจากสถานีไม่ได้ · ไม่มีการแทนค่าด้วยแบบจำลอง</p>}
      </div>
    </div>}
  </section>;
}
