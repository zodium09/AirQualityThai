import { useEffect, useMemo, useState } from 'react';
import { getEnsoSummary, NOAA_ENSO_URL, IRI_ENSO_URL } from '../utils/ensoData';
import { NEWS_REFRESH_MS, normalizeNewsDisplayItem, newsIsRelevant, readNewsCache, summarizeNewsFeed } from '../server/newsIntegrity';
import {
  AlertTriangle,
  BellRing,
  CloudRain,
  ExternalLink,
  Flame,
  RefreshCw,
  Search,
  ShieldAlert,
  Waves,
} from 'lucide-react';

const CACHE_KEY = 'air4thai-news-v3-cache';

const categories = [
  { id: 'all', label: 'ทั้งหมด', icon: BellRing, topics: [] },
  { id: 'warning', label: 'ประกาศทางการ', icon: ShieldAlert, topics: ['warning', 'alert', 'disaster'] },
  { id: 'rain', label: 'ฝน น้ำท่วม และพายุ', icon: CloudRain, topics: ['rain', 'flood', 'weather', 'storm', 'cyclone', 'hurricane', 'typhoon'] },
  { id: 'earthquake', label: 'แผ่นดินไหว', icon: Waves, topics: ['earthquake'] },
  { id: 'fire-air', label: 'ไฟป่าและฝุ่น', icon: Flame, topics: ['fire', 'wildfire', 'air', 'pm25'] },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return readNewsCache(cached);
  } catch {
    return null;
  }
}

function collectItems(feed) {
  if (!feed) return [];
  const thailand = feed.thailand || {};
  const global = feed.global || {};
  const candidates = [
    ...asArray(thailand.warnings).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.storms).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.earthquakes).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.disasters).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(thailand.ddpm).map(item => ({ ...item, scope: 'thailand' })),
    ...asArray(global.alerts).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.earthquakesRegional).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(feed.events).map((item) => ({ ...item, scope: item.scope || 'mixed' })),
    ...asArray(feed.topStories).map((item) => ({ ...item, scope: item.scope || 'mixed' })),
  ];
  const seen = new Set();
  return candidates.map(normalizeNewsDisplayItem).filter((item) => {
    if (!newsIsRelevant(item)) return false;
    const key = `${item.title}|${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff) return severityDiff;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
}

function formatTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'ไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function SeverityBadge({ severity }) {
  const label = severity === 'high' ? 'สำคัญ' : severity === 'medium' ? 'เฝ้าระวัง' : 'ติดตาม';
  return <span className={`severity severity--${severity}`}>{label}</span>;
}

export default function NewsPage() {
  const [feed, setFeed] = useState(readCache);
  const [loading, setLoading] = useState(!feed);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [enso, setEnso] = useState(null);
  const [ensoLoading, setEnsoLoading] = useState(true);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let active = true;
    let controller;
    let requestId = 0;
    async function loadNews(manual = false) {
      const id = ++requestId;
      controller?.abort();
      controller = new AbortController();
      const requestController = controller;
      const timeout = setTimeout(() => requestController.abort(), 35000);
      setLoading(true);
      setError('');
      try {
        const response = await fetch(manual ? '/api/news?fresh=' + Date.now() : '/api/news', {
          cache: 'no-store',
          headers: { Accept: 'application/json', ...(manual ? { 'X-User-Refresh': '1' } : {}) },
          signal: requestController.signal,
        });
        if (!response.ok) throw new Error('ระบบประกาศตอบกลับ ' + response.status);
        const payload = await response.json();
        if (!active || id !== requestId) return;
        if (payload.schemaVersion !== 3) throw new Error('ข้อมูลประกาศยังไม่พร้อม');
        setFeed(payload);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), payload })); } catch { /* Optional offline cache. */ }
      } catch {
        if (active && id === requestId) setError('ยังยืนยันประกาศรอบล่าสุดไม่ได้ โปรดตรวจเวลาของข้อมูลและเปิดต้นทาง');
      } finally {
        clearTimeout(timeout);
        if (active && id === requestId) { setLoading(false); setNow(Date.now()); }
      }
    }
    loadNews(Boolean(refreshToken));
    const refreshVisible = () => { if (document.visibilityState === 'visible') loadNews(); };
    const timer = setInterval(refreshVisible, NEWS_REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 60000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadEnso() {
      setEnsoLoading(true);
      try {
        const response = await fetch(refreshToken ? `/api/enso?fresh=${refreshToken}` : '/api/enso', { signal: controller.signal });
        if (!response.ok) throw new Error('ENSO unavailable');
        const payload = await response.json();
        if (active) setEnso(payload);
      } catch (loadError) {
        if (loadError.name !== 'AbortError' && active) setEnso(null);
      } finally {
        if (active) setEnsoLoading(false);
      }
    }

    loadEnso();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshToken]);

  const items = useMemo(() => collectItems(feed), [feed]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const category = categories.find((item) => item.id === activeCategory);
    return items.filter((item) => {
      const matchesCategory = activeCategory === 'all' || category.topics.some((topic) => item.topic.includes(topic));
      const haystack = `${item.title} ${item.summary} ${item.area} ${item.source}`.toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [activeCategory, items, query]);

  const highCount = items.filter((item) => item.severity === 'high').length;
  const priority = filtered[0];
  const remaining = filtered.slice(1);
  const ensoSummary = getEnsoSummary(enso, now);
  const feedStatus = summarizeNewsFeed(feed, now);
  const generatedAt = feed?.generatedAt || feed?.fetchedAt || feed?.updatedAt;

  return (
    <div className="page news-page">
      <div className="page__inner page__inner--narrow">
        <header className="news-header">
          <div>
            <span className="section-label">ประกาศล่าสุด</span>
            <h1>คำเตือนที่ควรรู้</h1>
            <p>ติดตามเหตุการณ์ที่อาจกระทบพื้นที่ของคุณ เรียงเรื่องสำคัญไว้ก่อน</p>
          </div>
          <button className="button button--secondary button--compact" disabled={loading} onClick={() => setRefreshToken(Date.now())} type="button">
            <RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : ''} size={17} /> {loading ? 'กำลังอัปเดต' : 'อัปเดตประกาศ'}
          </button>
        </header>

        <div className="news-status" aria-live="polite">
          <span className={`status-dot ${error || feedStatus.stale || feedStatus.incomplete ? 'is-fallback' : 'is-live'}`} />
          <span>{error || (feed ? `${feedStatus.stale ? 'ข้อมูลเดิม · ' : ''}${feedStatus.incomplete ? 'ข้อมูลบางแหล่งยังไม่ครบ · ' : ''}ดึงข้อมูล ${formatTime(generatedAt)}` : 'กำลังโหลดประกาศ')}</span>
          <span className="news-status__counts">สำคัญ {highCount} · ทั้งหมด {items.length} · รีเฟรชทุก 10 นาทีเมื่อเปิดหน้านี้</span>
        </div>

        <section className={`enso-card enso-card--${ensoSummary.tone}`} aria-label="แนวโน้มเอลนีโญและลานีญา">
          <span className="enso-card__icon"><Waves aria-hidden="true" size={22} /></span>
          <div>
            <span className="section-label">แนวโน้มฝนและความร้อนระยะยาว</span>
            <h2>{ensoLoading ? 'กำลังอัปเดตแนวโน้ม' : ensoSummary.title}</h2>
            <p>{ensoLoading ? 'รอสักครู่' : ensoSummary.detail}</p>
            {!ensoLoading && <>
              <p><small>วันประกาศ: {enso?.issuedAt ? new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(enso.issuedAt)) : 'ยังไม่ยืนยัน'} · ตรวจล่าสุด: {formatTime(enso?.fetchedAt)}</small></p>
              {enso?.alert && <p><small>สถานะประกาศต้นทาง: {enso.alert}</small></p>}
              {enso?.outlook?.text && <details><summary>อ่านแนวโน้มตามช่วงเวลาในประกาศ NOAA</summary><p lang="en">{enso.outlook.text}</p></details>}
              <p><a href={NOAA_ENSO_URL} target="_blank" rel="noreferrer">NOAA CPC</a> · <a href={IRI_ENSO_URL} target="_blank" rel="noreferrer">IRI ENSO</a></p>
            </>}
          </div>
        </section>

        <section className="news-tools" aria-label="ค้นหาและกรองประกาศ">
          <label className="search-field search-field--large">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">ค้นหาประกาศ</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเหตุการณ์หรือจังหวัด" type="search" value={query} />
          </label>
          <div className="filter-row" role="group" aria-label="ประเภทประกาศ">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button className={activeCategory === category.id ? 'is-active' : ''} key={category.id} onClick={() => setActiveCategory(category.id)} type="button">
                  <Icon aria-hidden="true" size={15} /> {category.label}
                </button>
              );
            })}
          </div>
        </section>

        {priority ? (
          <section className={`priority-alert priority-alert--${priority.severity}`}>
            <span aria-hidden="true" className="priority-alert__symbol"><AlertTriangle size={26} /></span>
            <div className="priority-alert__label"><AlertTriangle aria-hidden="true" size={18} /> เรื่องที่ควรดูก่อน</div>
            <h2>{priority.title}</h2>
            <p>{priority.summary}</p>
            <div className="priority-alert__meta">
              <SeverityBadge severity={priority.severity} />
              <span>{priority.area}</span>
              <span>{priority.source}</span>
              <span>{priority.publishedAt ? `ประกาศ ${formatTime(priority.publishedAt)}` : 'ไม่ทราบวันประกาศ'}</span>
            </div>
            {priority.url && (
              <a className="button button--primary button--compact" href={priority.url} rel="noreferrer" target="_blank">
                อ่านจากต้นทาง <ExternalLink aria-hidden="true" size={16} />
              </a>
            )}
          </section>
        ) : !loading && (
          <section className="empty-state">
            <BellRing aria-hidden="true" size={25} />
            <h2>{error || feedStatus.incomplete ? 'ยังยืนยันประกาศที่ตรงกับตัวกรองไม่ได้' : 'ยังไม่มีประกาศที่ตรงกับตัวกรอง'}</h2>
            <p>ลองเลือก “ทั้งหมด” หรือตรวจจากต้นทาง · การไม่มีรายการไม่ได้ยืนยันว่าพื้นที่ปลอดภัย</p>
          </section>
        )}

        {((loading && !feed) || remaining.length > 0) && (
          <section aria-labelledby="event-list-title" className="event-section">
            <div className="section-heading">
              <div>
                <span className="section-label">ประกาศอื่น ๆ</span>
                <h2 id="event-list-title">{remaining.length} รายการ</h2>
              </div>
            </div>

            {loading && !feed ? (
              <div className="skeleton-list" aria-label="กำลังโหลดประกาศ">
                {[0, 1, 2].map((item) => <div className="skeleton-row" key={item} />)}
              </div>
            ) : (
              <div className="event-list">
                {remaining.map((item) => (
                  <article className={`event-row event-row--${item.severity}`} key={item.id}>
                    <div className="event-row__severity"><SeverityBadge severity={item.severity} /></div>
                    <div className="event-row__body">
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <div className="event-row__meta">
                        <span>{item.area}</span>
                        <span>{item.source}</span>
                        <span>{item.publishedAt ? `ประกาศ ${formatTime(item.publishedAt)}` : 'ไม่ทราบวันประกาศ'}</span>
                      </div>
                    </div>
                    {item.url && (
                      <a aria-label={`เปิดต้นทาง: ${item.title}`} className="event-row__link" href={item.url} rel="noreferrer" target="_blank">
                        <ExternalLink aria-hidden="true" size={18} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <aside className="source-note">
          <ShieldAlert aria-hidden="true" size={18} />
          <div>
            <details>
              <summary>สถานะแหล่งข้อมูล · ยืนยันรายการได้ {feedStatus.available} / {feedStatus.total} แหล่ง</summary>
              <ul>{feedStatus.sources.map(source => <li key={source.label}>{source.label}: {source.status === 'ok' ? 'มีรายการจากต้นทาง' : source.status === 'partial' ? 'อ่านได้บางส่วน' : source.status === 'empty' ? 'ไม่มีรายการที่ยืนยันวันและความใหม่ได้' : 'เชื่อมต่อไม่ได้'} ({source.count || 0} รายการ)</li>)}</ul>
            </details>
            <p>ตรวจประกาศเพิ่มเติม: <a href="https://www.tmd.go.th/warning-and-events/warning-storm" target="_blank" rel="noreferrer">กรมอุตุนิยมวิทยา</a> · <a href="https://www.disaster.go.th/" target="_blank" rel="noreferrer">ปภ.</a></p>
          </div>
        </aside>
        <aside className="source-note">
          <ShieldAlert aria-hidden="true" size={18} />
          <p><strong>กรณีฉุกเฉิน:</strong> ให้ยึดคำเตือนและคำสั่งจากหน่วยงานในพื้นที่</p>
        </aside>
      </div>
    </div>
  );
}
