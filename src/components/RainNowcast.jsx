import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LocateFixed, Pause, Play, RadioTower, RefreshCw } from 'lucide-react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { thaiTime } from '../utils/weatherData';

const coverageLabels = {
  covered: 'จุดที่เลือกอยู่ในขอบเขตครอบคลุมเรดาร์',
  uncovered: 'จุดที่เลือกอยู่นอกขอบเขตครอบคลุมเรดาร์',
  partial: 'จุดที่เลือกอยู่ใกล้ขอบเขตครอบคลุมเรดาร์',
  unknown: 'ยังยืนยันความครอบคลุมเรดาร์ ณ จุดนี้ไม่ได้',
};

export default function RainNowcast({ coords, locationLabel, onSummaryChange, onUseLocation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const activeRequest = useRef(null);
  const lastAttempt = useRef(0);
  const summaryCallback = useRef(onSummaryChange);
  useEffect(() => { summaryCallback.current = onSummaryChange; }, [onSummaryChange]);
  const requestBody = useMemo(() => ({ lat: Number(coords?.lat), lon: Number(coords?.lon), locationLabel }), [coords?.lat, coords?.lon, locationLabel]);

  const loadHistory = useCallback(async signal => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    lastAttempt.current = Date.now();
    setPlaying(false);
    setLoading(true);
    setError('');
    summaryCallback.current?.({ label: 'กำลังโหลดภาพเรดาร์', tone: 'loading' });
    try {
      const response = await fetch('/api/radar', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(requestBody),
        signal: AbortSignal.any([controller.signal, ...(signal ? [signal] : []), AbortSignal.timeout(20000)]),
      });
      if (!response.ok) throw new Error('Radar unavailable');
      const payload = await response.json();
      if (activeRequest.current !== controller || signal?.aborted) return;
      setData(payload);
      setFrameIndex(Math.max(0, (payload.frames?.length || 0) - 1));
      setTileError(false);
      setNow(Date.now());
      summaryCallback.current?.({ label: payload.unavailable ? 'เรดาร์ไม่พร้อม' : payload.stale ? 'ภาพเรดาร์เก่า' : 'ดูภาพเรดาร์ย้อนหลัง', tone: payload.unavailable || payload.stale ? 'fallback' : 'watch' });
    } catch {
      if (activeRequest.current === controller && !signal?.aborted && !controller.signal.aborted) {
        setError('โหลดภาพเรดาร์ไม่ได้ชั่วคราว ลองอัปเดตอีกครั้ง');
        summaryCallback.current?.({ label: 'เรดาร์ไม่พร้อม', tone: 'fallback' });
      }
    } finally {
      if (activeRequest.current === controller && !signal?.aborted) setLoading(false);
    }
  }, [requestBody]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    loadHistory(controller.signal);
    const refreshWhenVisible = () => {
      setNow(Date.now());
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= 10 * 60 * 1000) loadHistory(controller.signal);
    };
    const interval = window.setInterval(refreshWhenVisible, 60 * 1000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      controller.abort(); activeRequest.current?.abort(); activeRequest.current = null;
      window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadHistory]);

  const frames = Array.isArray(data?.frames) ? data.frames : [];
  const frame = frames[frameIndex];
  const stale = data?.stale || !data?.radarTime || now - Date.parse(data.radarTime) > 30 * 60 * 1000;
  const unavailable = data?.unavailable || !frames.length;
  const isPlaying = playing && frames.length > 1 && !unavailable;
  const coverage = coverageLabels[data?.coverage] ? data.coverage : 'unknown';
  const selectFrame = index => { setPlaying(false); setFrameIndex(index); setTileError(false); };

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setTileError(false);
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, 850);
    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length]);

  return <section aria-labelledby="rain-nowcast-title" className={`nowcast-card nowcast-card--${error || stale || unavailable ? 'fallback' : 'watch'}`}>
    <div className="nowcast-card__top">
      <div className="nowcast-card__heading"><span className="nowcast-card__radar"><RadioTower aria-hidden="true" size={22} /></span><div><h2 id="rain-nowcast-title">ภาพเรดาร์ย้อนหลัง</h2><p>{locationLabel} · อัปเดตทุก 10 นาที</p></div></div>
      <button className="button button--secondary button--compact" disabled={loading} onClick={() => loadHistory()} type="button"><RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : ''} size={16} /> อัปเดต</button>
    </div>
    {error && <p className="nowcast-card__error" role="status">{error}</p>}
    {loading && !data ? <p role="status">กำลังโหลดภาพเรดาร์และขอบเขตครอบคลุม</p> : unavailable ? <p className="nowcast-card__error" role="status">ยังไม่มีภาพเรดาร์ที่ตรวจสอบเวลาได้ จึงสรุปไม่ได้ว่าจุดนี้มีฝนหรือไม่มีฝน</p> : <>
      <div className="radar-status-row" role="status">
        <span>{stale ? 'ภาพล่าสุดเกิน 30 นาที โปรดตรวจเวลา' : 'ภาพเรดาร์ย้อนหลังพร้อมเวลาเฟรม'}</span>
        <span className={`radar-coverage radar-coverage--${coverage}`}>{coverageLabels[coverage]}</span>
      </div>
      <div className="radar-history-image" role="region" aria-label={`แผนที่เรดาร์ย้อนหลัง ${locationLabel}`}>
        <MapContainer key={`${requestBody.lat}:${requestBody.lon}`} center={[requestBody.lat, requestBody.lon]} zoom={7} minZoom={4} maxZoom={7} scrollWheelZoom={false} style={{ height: '100%', minHeight: 300, width: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {frame && <TileLayer key={frame.timestamp} attribution='<a href="https://www.rainviewer.com/">Radar by RainViewer</a>' url={frame.tileUrl} maxNativeZoom={7} opacity={0.8} eventHandlers={{ tileerror: () => setTileError(true) }} />}
          <CircleMarker center={[requestBody.lat, requestBody.lon]} radius={6} pathOptions={{ color: '#17344f', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}><Tooltip permanent direction="top">{locationLabel}</Tooltip></CircleMarker>
        </MapContainer>
      </div>
      {tileError && <p className="nowcast-card__error" role="status">โหลดภาพบางส่วนไม่ได้ พื้นที่ว่างบนแผนที่ไม่ได้ยืนยันว่าไม่มีฝน</p>}
      <div className="radar-history-controls">
        <label htmlFor="radar-history-time">เวลาเฟรมภาพ {thaiTime(frame?.time, { day: 'numeric', month: 'short' })} น.</label>
        <input id="radar-history-time" type="range" min={0} max={Math.max(0, frames.length - 1)} step={1} value={frameIndex} disabled={frames.length < 2} aria-valuetext={`เวลาเฟรมภาพ ${thaiTime(frame?.time)}`} onChange={event => selectFrame(Number(event.target.value))} />
        <div className="radar-play-group"><button className="button button--quiet button--compact" type="button" disabled={frames.length < 2} aria-pressed={isPlaying} onClick={() => setPlaying(prev => !prev)}>{isPlaying ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />} {isPlaying ? 'หยุด' : 'เล่น'}</button><button className="button button--quiet button--compact" type="button" disabled={frameIndex <= 0} onClick={() => selectFrame(frameIndex - 1)}><ChevronLeft aria-hidden="true" size={16} /> ก่อนหน้า</button><span>{frameIndex + 1} / {frames.length} ภาพ</span><button className="button button--quiet button--compact" type="button" disabled={frameIndex >= frames.length - 1} onClick={() => selectFrame(frameIndex + 1)}>ถัดไป <ChevronRight aria-hidden="true" size={16} /></button></div>
      </div>
      <p className="wx-footnote">วงกลมคือพิกัดที่เลือก สีภาพเป็นสัญญาณเรดาร์จากผู้ให้บริการ เวลาเฟรมเป็นเวลาประกอบภาพซึ่งอาจรวมสถานีต่างเวลา พื้นที่ว่างหรือข้อมูลไม่ครบไม่ยืนยันว่าไม่มีฝน</p>
    </>}
    <footer className="nowcast-card__footer"><span>ภาพย้อนหลัง · ใช้ประกอบพยากรณ์ฝนรายชั่วโมง</span><div>{onUseLocation && <button className="text-button" onClick={onUseLocation} type="button"><LocateFixed size={15} /> ใช้ตำแหน่งจริงของฉัน</button>}<a href="https://www.rainviewer.com/" rel="noreferrer" target="_blank">Radar by RainViewer</a><a href={`https://www.windy.com/?radar,${requestBody.lat},${requestBody.lon},7`} rel="noreferrer" target="_blank">ดูเรดาร์บน Windy</a></div></footer>
  </section>;
}
