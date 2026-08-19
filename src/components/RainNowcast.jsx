import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CloudRain, LocateFixed, Navigation, RadioTower, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { usePushNotification } from '../hooks/usePushNotification';

const ALERTS_KEY = 'air4thai.rainAlertsEnabled';
const LAST_ALERT_KEY = 'air4thai.lastRainAlert';

function trendIcon(trend) {
  return trend === 'intensifying' ? TrendingUp : trend === 'weakening' ? TrendingDown : Navigation;
}

function alertTone(level, unavailable) {
  if (unavailable) return 'fallback';
  if (level >= 3) return 'urgent';
  if (level >= 2) return 'warning';
  if (level >= 1) return 'watch';
  return 'clear';
}

function compactRadarSummary(data) {
  if (!data || data.unavailable) return { label: 'เรดาร์ไม่พร้อม', tone: 'fallback' };
  const eta = Number(data?.nowcast?.etaMinutes);
  const probability = Number(data?.nowcast?.probability60 || 0);
  if (data.alertLevel >= 3) return { label: eta > 0 ? `ฝนถึงใน ${eta} นาที` : 'ฝนกำลังเข้าใกล้', tone: 'urgent' };
  if (data.alertLevel >= 2) return { label: 'เตรียมรับฝน', tone: 'warning' };
  if (data.alertLevel >= 1) return { label: 'พบฝนใกล้พื้นที่', tone: 'watch' };
  if (probability >= 50) return { label: 'โอกาสฝนสูง', tone: 'warning' };
  if (probability >= 30) return { label: 'จับตาฝน', tone: 'watch' };
  return { label: 'ยังไม่พบฝน', tone: 'clear' };
}

export default function RainNowcast({ coords, current, locationLabel, minutely, onSummaryChange, onUseLocation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem(ALERTS_KEY) === '1');
  const { isSupported, permission, requestPermission, sendLocalNotification } = usePushNotification();
  const notifiedRef = useRef(localStorage.getItem(LAST_ALERT_KEY) || '');

  const requestBody = useMemo(() => ({
    lat: Number(coords?.lat),
    lon: Number(coords?.lon),
    windDir: Number(current?.windDirection || 0),
    windSpeed: Number(current?.windSpeed || 0),
    locationLabel,
    minuteRain: (minutely?.precipitation || []).slice(0, 4),
    minuteProb: (minutely?.precipitation_probability || []).slice(0, 4),
  }), [coords?.lat, coords?.lon, current?.windDirection, current?.windSpeed, locationLabel, minutely?.precipitation, minutely?.precipitation_probability]);

  const loadNowcast = useCallback(async (signal) => {
    if (!Number.isFinite(requestBody.lat) || !Number.isFinite(requestBody.lon)) return;
    setLoading(true);
    setError('');
    onSummaryChange?.({ label: 'กำลังสแกนฝน', tone: 'loading' });
    try {
      const response = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(requestBody),
        signal,
      });
      if (!response.ok) throw new Error(`ระบบเรดาร์ตอบกลับ ${response.status}`);
      const payload = await response.json();
      setData(payload);
      onSummaryChange?.(compactRadarSummary(payload));
    } catch (loadError) {
      if (loadError.name !== 'AbortError') {
        setError('เชื่อมต่อการวิเคราะห์เรดาร์ไม่ได้ชั่วคราว');
        onSummaryChange?.({ label: 'เรดาร์ไม่พร้อม', tone: 'fallback' });
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [onSummaryChange, requestBody]);

  useEffect(() => {
    const controller = new AbortController();
    loadNowcast(controller.signal);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadNowcast();
    }, 10 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - refreshToken > 5 * 60 * 1000) loadNowcast();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadNowcast, refreshToken]);

  useEffect(() => {
    if (!alertsEnabled || permission !== 'granted' || !data || data.unavailable || data.alertLevel < 2) return;
    const alertId = `${requestBody.lat.toFixed(2)}:${requestBody.lon.toFixed(2)}:${data.radarTime}:${data.alertLevel}`;
    if (notifiedRef.current === alertId) return;
    notifiedRef.current = alertId;
    localStorage.setItem(LAST_ALERT_KEY, alertId);
    sendLocalNotification(data.alertLevel >= 3 ? 'ฝนกำลังเข้าใกล้คุณ' : 'มีฝนใกล้พื้นที่ของคุณ', {
      body: `${data.cardTitle} — ${data.cardDesc}`,
      tag: 'rain-nowcast-location',
      data: { url: '/' },
    });
  }, [alertsEnabled, data, permission, requestBody.lat, requestBody.lon, sendLocalNotification]);

  const enableAlerts = async () => {
    const result = await requestPermission();
    const enabled = result === 'granted';
    setAlertsEnabled(enabled);
    if (enabled) localStorage.setItem(ALERTS_KEY, '1');
  };

  const disableAlerts = () => {
    setAlertsEnabled(false);
    localStorage.removeItem(ALERTS_KEY);
  };

  const refresh = () => {
    setRefreshToken(Date.now());
    loadNowcast();
  };

  const nowcast = data?.nowcast || {};
  const tone = alertTone(data?.alertLevel || 0, data?.unavailable);
  const TrendIcon = trendIcon(nowcast.trend);
  const range = Array.isArray(nowcast.rainRangeMm) ? nowcast.rainRangeMm : [0, 0];

  return (
    <section aria-labelledby="rain-nowcast-title" className={`nowcast-card nowcast-card--${tone}`}>
      <div className="nowcast-card__top">
        <div className="nowcast-card__heading">
          <span className="nowcast-card__radar"><RadioTower aria-hidden="true" size={22} /></span>
          <div><span className="section-label">เรดาร์ฝนใกล้ตัว · อัปเดตทุก 10 นาที</span><h2 id="rain-nowcast-title">{loading && !data ? 'กำลังสแกนฝนรอบตัวคุณ' : data?.cardTitle || 'วิเคราะห์ฝนระยะสั้น'}</h2><p>{data?.currentLocName || locationLabel}</p></div>
        </div>
        <div className="nowcast-card__actions">
          <button className="button button--secondary button--compact" disabled={loading} onClick={refresh} type="button"><RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : ''} size={16} /> อัปเดต</button>
          {isSupported && (alertsEnabled && permission === 'granted'
            ? <button className="button button--quiet button--compact" onClick={disableAlerts} type="button"><BellRing aria-hidden="true" size={16} /> แจ้งเตือนแล้ว</button>
            : <button className="button button--primary button--compact" onClick={enableAlerts} type="button"><BellRing aria-hidden="true" size={16} /> เปิดแจ้งเตือนฝน</button>)}
        </div>
      </div>

      {error && !data ? <div className="nowcast-card__error">{error} ระบบยังใช้พยากรณ์ฝน 15 นาทีบนหน้าได้ตามปกติ</div> : (
        <>
          <div className="nowcast-card__message"><span aria-hidden="true">{data?.cardIcon || '📡'}</span><div><strong>{data?.cardTag || 'กำลังวิเคราะห์'}</strong><p>{data?.cardDesc || 'กำลังเปรียบเทียบภาพเรดาร์ล่าสุดกับพยากรณ์ฝนทุก 15 นาที'}</p></div></div>
          <div className="nowcast-metrics">
            <article><span><CloudRain size={17} /> ฝน 60 นาที</span><strong>{nowcast.rainNext60MinMm > 0 ? `≈ ${nowcast.rainNext60MinMm} มม.` : nowcast.probability60 >= 30 ? `${nowcast.probability60}%` : 'ยังไม่พบ'}</strong><small>{nowcast.rainNext60MinMm > 0 ? `ช่วง ${range[0]}–${range[1]} มม.` : 'จากเรดาร์ + พยากรณ์ 15 นาที'}</small></article>
            <article><span><CloudRain size={17} /> ความแรง</span><strong>{data?.diagnostics?.centerIntensity || data?.diagnostics?.intensity || '–'}</strong><small>{nowcast.rainRateMmh > 0 ? `อัตรา ≈ ${nowcast.rainRateMmh} มม./ชม.` : `ใกล้สุด ${data?.diagnostics?.nearestKm ?? '–'} กม.`}</small></article>
            <article><span><Navigation size={17} /> การเคลื่อนที่</span><strong>{nowcast.direction ? `ไปทาง${nowcast.direction}` : 'ทิศทางยังไม่ชัด'}</strong><small>{nowcast.speedKmh ? `ประมาณ ${nowcast.speedKmh} กม./ชม.` : 'รอเฟรมเรดาร์เพิ่ม'}</small></article>
            <article><span><TrendIcon size={17} /> แนวโน้ม</span><strong>{nowcast.trendLabel || 'กำลังประเมิน'}</strong><small>{nowcast.etaMinutes ? `คาดถึงราว ${nowcast.etaMinutes} นาที` : `ความมั่นใจ ${data?.confidence ?? '–'}%`}</small></article>
          </div>
        </>
      )}

      <footer className="nowcast-card__footer">
        <span>เรดาร์เวลา {data?.radarTime || '–'} · ใช้การเคลื่อนที่จากภาพย้อนหลัง ไม่ใช่ประกาศทางการ</span>
        <div><button className="text-button" onClick={onUseLocation} type="button"><LocateFixed size={15} /> ใช้ตำแหน่งจริงของฉัน</button><a href="https://www.rainviewer.com/" rel="noreferrer" target="_blank">Radar by RainViewer</a></div>
      </footer>
    </section>
  );
}
