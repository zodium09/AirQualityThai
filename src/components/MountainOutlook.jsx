import { useEffect, useState } from 'react';
import { ChevronDown, Mountain } from 'lucide-react';
import { thaiTime, isStaleTime } from '../utils/weatherData';
import { mountainPlaces } from '../data/mountainPlaces';

export default function MountainOutlook({ onChoose }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetch('/api/mountain-outlook', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]) })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setData(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);
  return <details className="wx-mountain-outlook wx-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><span className="wx-mountain-summary-main"><span className="wx-head-badge wx-head-badge--violet" aria-hidden="true"><Mountain size={19} /></span><span><strong>อากาศบนดอยและยอดภู</strong><small>พยากรณ์รายจุดตามความสูง และประกาศภูเขารายภาค</small></span></span><ChevronDown className="disclosure-chevron" size={21} aria-hidden="true" /></summary>
    <div className="mountain-places">{mountainPlaces.map(place => <button type="button" className="wx-button wx-button--quiet" onClick={() => { onChoose(place.id); window.scrollTo({ top: 0, behavior: 'auto' }); }} key={place.id}>{place.name} · {place.elevation.toLocaleString('th-TH')} ม.</button>)}</div>
    <p>เลือกสถานที่เพื่อดูพยากรณ์ตามพิกัดและความสูง ส่วนข้อความด้านล่างเป็นภาพรวมภูเขารายภาคจากกรมอุตุฯ</p>
    {loading ? <p role="status">กำลังตรวจประกาศภูมิภาค…</p> : data?.regions?.length ? <div className="mountain-regions">{data.regions.map(region => {
      const unavailable = region.unavailable || region.stale || isStaleTime(region.issuedAt, Date.now(), 36 * 3600000) || Boolean(region.validTo && Date.parse(region.validTo) <= Date.now());
      return <article key={region.region}><h3>{region.region}</h3>{unavailable ? <p>ยังยืนยันประกาศล่าสุดไม่ได้ โปรดตรวจต้นทาง</p> : <><p>{region.text}</p><small>ประกาศ {thaiTime(region.issuedAt, { day: 'numeric', month: 'short' })} · {region.validFrom && region.validTo ? `ใช้ช่วง ${thaiTime(region.validFrom, { day: 'numeric', month: 'short' })} ถึง ${thaiTime(region.validTo, { day: 'numeric', month: 'short' })}` : 'ช่วงใช้ได้: โปรดอ่านจากประกาศต้นทาง'}</small></>}</article>;
    })}</div> : <p role="status">ประกาศภูมิภาคยังไม่พร้อม พยากรณ์รายจุดบนดอยยังเลือกดูได้</p>}
    <a href="https://www.tmd.go.th/forecast/daily" target="_blank" rel="noreferrer">อ่านประกาศฉบับเต็มจากกรมอุตุฯ</a>
  </details>;
}
