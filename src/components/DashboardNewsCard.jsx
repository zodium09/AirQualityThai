import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, ExternalLink, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeNewsDisplayItem, newsIsRelevant, readNewsCache, summarizeNewsFeed } from '../server/newsIntegrity';

const CACHE_KEY = 'air4thai-news-v3-cache';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectLatest(feed) {
  if (!feed) return [];
  const thailand = feed.thailand || {};
  const global = feed.global || {};
  const candidates = [
    ...asArray(thailand.warnings).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.storms).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.earthquakes).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.disasters).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.ddpm).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(global.alerts).map(item => ({ ...item, scope: 'global' })),
    ...asArray(feed.events).map(item => ({ ...item, scope: item.scope || 'mixed' })),
  ];
  const seen = new Set();
  const severityOrder = { high: 3, medium: 2, low: 1 };
  return candidates.map(normalizeNewsDisplayItem).filter(item => {
    if (!newsIsRelevant(item)) return false;
    const key = `${item.title}|${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const diff = severityOrder[b.severity] - severityOrder[a.severity];
    if (diff) return diff;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
}

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'ไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function DashboardNewsCard({ now }) {
  const [feed, setFeed] = useState(() => {
    try { return readNewsCache(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); } catch { return null; }
  });
  const [loading, setLoading] = useState(!feed);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch('/api/news', { headers: { Accept: 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]) })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!active || !payload || payload.schemaVersion !== 3) return;
        setFeed(payload);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), payload })); } catch { /* Optional cache. */ }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const items = useMemo(() => collectLatest(feed), [feed]);
  const topItems = items.slice(0, 3);
  const feedStatus = summarizeNewsFeed(feed, now);
  const highCount = items.filter(item => item.severity === 'high').length;

  return (
    <section className="wx-panel wx-news-preview" aria-labelledby="dashboard-news-title">
      <div className="wx-section-head">
        <div className="wx-observations-head">
          <span className={`wx-head-badge ${highCount > 0 ? 'wx-head-badge--danger' : 'wx-head-badge--warm'}`} aria-hidden="true">
            {highCount > 0 ? <ShieldAlert size={20} /> : <BellRing size={20} />}
          </span>
          <div>
            <h2 id="dashboard-news-title">ข่าวสารและประกาศเตือนภัยล่าสุด</h2>
            <p>{loading && !feed ? 'กำลังตรวจสอบประกาศจากหน่วยงานทางการ' : items.length ? `พบ ${items.length} รายการ${highCount > 0 ? ` · สำคัญ ${highCount} รายการ` : ''}${feedStatus.stale ? ' · ข้อมูลเดิม' : ''}` : 'ยังไม่มีประกาศทางการในรอบล่าสุด · ตรวจจากต้นทางเพิ่มเติมได้'}</p>
          </div>
        </div>
        <Link className="wx-button wx-button--quiet" to="/news">ดูประกาศทั้งหมด <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>

      {topItems.length > 0 ? (
        <div className="wx-news-list">
          {topItems.map(item => (
            <article className={`wx-news-item wx-news-item--${item.severity}`} key={item.id}>
              <span className={`severity severity--${item.severity}`}>
                {item.severity === 'high' ? 'สำคัญ' : item.severity === 'medium' ? 'เฝ้าระวัง' : 'ติดตาม'}
              </span>
              <div className="wx-news-item__body">
                <h3>{item.title}</h3>
                {item.summary && <p>{item.summary}</p>}
                <small>{item.source} · {item.area} · {formatDate(item.publishedAt)}</small>
              </div>
              {item.url && (
                <a aria-label={`อ่านต้นทาง: ${item.title}`} className="wx-news-item__ext" href={item.url} rel="noreferrer" target="_blank">
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              )}
            </article>
          ))}
        </div>
      ) : !loading && (
        <p className="wx-footnote">ไม่พบคำเตือนเร่งด่วนในฟีดรอบนี้ · <Link className="wx-inline-link" to="/news">เปิดหน้าประกาศและแนวโน้มเอลนีโญ/ลานีญา <ArrowRight size={14} aria-hidden="true" /></Link></p>
      )}
    </section>
  );
}
