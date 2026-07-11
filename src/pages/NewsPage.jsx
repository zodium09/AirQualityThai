import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CloudRain,
  ExternalLink,
  Flame,
  Gauge,
  Globe2,
  RefreshCw,
  Search,
  ShieldAlert,
  ThermometerSun,
  Waves,
} from 'lucide-react';

const CACHE_KEY = 'air4thai-news-v2-cache';

const categories = [
  { id: 'all', label: 'ทั้งหมด', icon: BellRing, topics: [] },
  { id: 'warning', label: 'ประกาศทางการ', icon: ShieldAlert, topics: ['warning', 'alert', 'disaster'] },
  { id: 'rain', label: 'ฝนและน้ำ', icon: CloudRain, topics: ['rain', 'flood', 'weather', 'storm'] },
  { id: 'storm', label: 'พายุ', icon: AlertTriangle, topics: ['storm', 'cyclone', 'hurricane', 'typhoon'] },
  { id: 'earthquake', label: 'แผ่นดินไหว', icon: Waves, topics: ['earthquake'] },
  { id: 'fire', label: 'ไฟป่า', icon: Flame, topics: ['fire', 'wildfire'] },
  { id: 'air', label: 'ฝุ่นและอากาศ', icon: Gauge, topics: ['air', 'pm25'] },
  { id: 'climate', label: 'ภูมิอากาศโลก', icon: Globe2, topics: ['climate', 'enso', 'drought', 'volcano'] },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return cached?.payload || null;
  } catch {
    return null;
  }
}

function normalizeItem(item, index) {
  const sources = asArray(item?.sources);
  const source = item?.source || sources[0] || 'ไม่ระบุแหล่ง';
  const topicHint = `${item?.topic || ''} ${item?.eventType || ''} ${item?.category || ''} ${item?.title || ''} ${item?.summary || item?.description || ''}`.toLowerCase();
  const topic = /earthquake|quake|แผ่นดินไหว/.test(topicHint) ? 'earthquake'
    : /wildfire|fire|ไฟป่า/.test(topicHint) ? 'fire'
      : /storm|cyclone|hurricane|typhoon|พายุ/.test(topicHint) ? 'storm'
        : /flood|น้ำท่วม/.test(topicHint) ? 'flood'
          : /volcano|ภูเขาไฟ/.test(topicHint) ? 'volcano'
            : /drought|ภัยแล้ง/.test(topicHint) ? 'drought'
              : String(item?.topic || item?.eventType || item?.category || 'other').toLowerCase();
  const severity = item?.severity === 'high' ? 'high' : item?.severity === 'medium' ? 'medium' : 'low';
  const publishedAt = item?.publishedAt || item?.updatedAt || item?.at || null;
  const areas = asArray(item?.areas);
  const rawTitle = item?.title || 'ประกาศเหตุการณ์ธรรมชาติ';
  const rawSummary = item?.summary || item?.description || 'เปิดแหล่งข้อมูลเพื่อดูรายละเอียดเพิ่มเติม';
  const isGenericDdpmNotice = /^\d{3,5}\s*:\s*กรมป้องกันและบรรเทาสาธารณภัย/.test(rawTitle);
  return {
    id: item?.id || `${source}-${publishedAt || index}-${item?.title || index}`,
    title: isGenericDdpmNotice ? 'ปภ. มีประกาศล่าสุดสำหรับประเทศไทย' : rawTitle,
    summary: isGenericDdpmNotice ? 'โปรดตรวจสอบรายละเอียดและคำแนะนำล่าสุดจากกรมป้องกันและบรรเทาสาธารณภัย' : rawSummary,
    topic,
    severity,
    publishedAt,
    source,
    sources: sources.length ? sources : [source],
    area: item?.primaryArea || areas[0] || item?.area || 'ประเทศไทย',
    url: item?.url || item?.link || asArray(item?.items)[0]?.url || '',
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    scope: item?.scope || 'thailand',
  };
}

function collectItems(feed) {
  if (!feed) return [];
  const thailand = feed.thailand || {};
  const global = feed.global || {};
  const candidates = [
    ...asArray(thailand.warnings),
    ...asArray(thailand.storms),
    ...asArray(thailand.earthquakes),
    ...asArray(thailand.disasters),
    ...asArray(thailand.ddpm),
    ...asArray(global.alerts).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.earthquakes).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.earthquakesRegional).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.disasters).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.climate).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(global.eonet).map((item) => ({ ...item, scope: 'global' })),
    ...asArray(feed.events).map((item) => ({ ...item, scope: item.scope || 'mixed' })),
    ...asArray(feed.topStories).map((item) => ({ ...item, scope: item.scope || 'mixed' })),
  ];
  const seen = new Set();
  return candidates.map(normalizeItem).filter((item) => {
    const relevanceText = `${item.title} ${item.summary} ${item.area} ${item.source}`;
    const isRelevant = item.scope === 'global' || item.scope === 'mixed' || item.severity === 'high'
      || /ประเทศไทย|ไทย|Thailand|TMD|ปภ\.|กรมป้องกัน|Myanmar|Laos|Cambodia|Vietnam|Malaysia|Indonesia|Philippines|China|Japan|ภูมิภาคเอเชีย|อ่าวไทย|อันดามัน/i.test(relevanceText);
    if (!isRelevant) return false;
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
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadNews() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(refreshToken ? `/api/news?fresh=${refreshToken}` : '/api/news', {
          cache: refreshToken ? 'no-store' : 'default',
          headers: { Accept: 'application/json', ...(refreshToken ? { 'X-User-Refresh': '1' } : {}) },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`ระบบประกาศตอบกลับ ${response.status}`);
        const payload = await response.json();
        if (!active) return;
        setFeed(payload);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), payload }));
      } catch (loadError) {
        if (loadError.name !== 'AbortError' && active) {
          setError(readCache() ? 'โหลดรอบล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่บันทึกไว้' : 'ยังโหลดประกาศไม่ได้ กรุณาลองอีกครั้ง');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNews();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(refreshToken ? `/api/enso?fresh=${refreshToken}` : '/api/enso', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => payload && setEnso(payload))
      .catch(() => null);
    return () => controller.abort();
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
  const watchCount = items.filter((item) => item.severity === 'medium').length;
  const globalCount = items.filter((item) => item.scope === 'global').length;
  const earthquakeCount = items.filter((item) => item.topic.includes('earthquake')).length;
  const stormCount = items.filter((item) => /storm|cyclone|hurricane|typhoon/.test(item.topic)).length;
  const priority = filtered[0];
  const generatedAt = feed?.generatedAt || feed?.fetchedAt || feed?.updatedAt;

  return (
    <div className="page news-page">
      <div className="page__inner page__inner--narrow">
        <header className="news-header">
          <div>
            <span className="section-label">ประกาศและเหตุการณ์ธรรมชาติ</span>
            <h1>รู้เรื่องที่กระทบคุณก่อนออกเดินทาง</h1>
            <p>รวมประกาศจากหน่วยงานและแหล่งข้อมูลที่ตรวจสอบย้อนกลับได้ เรียงเรื่องสำคัญไว้ก่อน</p>
          </div>
          <button className="button button--secondary button--compact" disabled={loading} onClick={() => setRefreshToken(Date.now())} type="button">
            <RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : ''} size={17} /> {loading ? 'กำลังอัปเดต' : 'อัปเดตประกาศ'}
          </button>
        </header>

        <div className="news-status" aria-live="polite">
          <span className={`status-dot ${error ? 'is-fallback' : 'is-live'}`} />
          <span>{error || (feed ? `อัปเดต ${formatTime(generatedAt)}` : 'กำลังเชื่อมต่อแหล่งข้อมูล')}</span>
          <span className="news-status__counts">สำคัญ {highCount} · เฝ้าระวัง {watchCount} · ทั้งหมด {items.length}</span>
        </div>

        <section className="world-monitor" aria-label="ภาพรวมภัยธรรมชาติและภูมิอากาศโลก">
          <article className="world-monitor__intro">
            <span><Globe2 aria-hidden="true" size={21} /></span>
            <div><small>ศูนย์ติดตามโลก</small><strong>เห็นทั้งเหตุการณ์ใกล้ตัวและสัญญาณระดับโลก</strong><p>รวมประกาศไทย แผ่นดินไหว พายุ ไฟป่า ภัยธรรมชาติ และแนวโน้ม ENSO โดยไม่ตัดเหตุการณ์ต่างประเทศออก</p></div>
          </article>
          <article className="world-monitor__card"><Waves aria-hidden="true" size={21} /><span>แผ่นดินไหว</span><strong>{earthquakeCount}</strong><small>เหตุการณ์ที่กำลังติดตาม</small></article>
          <article className="world-monitor__card"><CloudRain aria-hidden="true" size={21} /><span>พายุและฝน</span><strong>{stormCount}</strong><small>เหตุการณ์ที่กำลังติดตาม</small></article>
          <article className="world-monitor__card"><Globe2 aria-hidden="true" size={21} /><span>ทั่วโลก</span><strong>{globalCount}</strong><small>รายการจากแหล่งสากล</small></article>
          <article className="world-monitor__enso"><ThermometerSun aria-hidden="true" size={21} /><div><span>ENSO ล่าสุด</span><strong>{enso?.alert || enso?.status || 'กำลังตรวจสอบ NOAA / IRI'}</strong><small>{enso?.summary || 'ติดตามสัญญาณ El Niño, La Niña และผลต่อฝน–ความร้อน'}</small></div></article>
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
              <span>{formatTime(priority.publishedAt)}</span>
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
            <h2>ยังไม่มีประกาศที่ตรงกับตัวกรอง</h2>
            <p>ลองเลือก “ทั้งหมด” หรือล้างคำค้นหา</p>
          </section>
        )}

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

        <section aria-labelledby="event-list-title" className="event-section">
          <div className="section-heading">
            <div>
              <span className="section-label">รายการล่าสุด</span>
              <h2 id="event-list-title">{filtered.length} เรื่องที่ตรงกับตัวกรอง</h2>
            </div>
          </div>

          {loading && !feed ? (
            <div className="skeleton-list" aria-label="กำลังโหลดประกาศ">
              {[0, 1, 2].map((item) => <div className="skeleton-row" key={item} />)}
            </div>
          ) : (
            <div className="event-list">
              {filtered.map((item) => (
                <article className={`event-row event-row--${item.severity}`} key={item.id}>
                  <div className="event-row__severity"><SeverityBadge severity={item.severity} /></div>
                  <div className="event-row__body">
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div className="event-row__meta">
                      <span>{item.area}</span>
                      <span>{item.source}</span>
                      <span>{formatTime(item.publishedAt)}</span>
                      {item.confidence !== null && <span>ความมั่นใจ {item.confidence}%</span>}
                    </div>
                  </div>
                  {item.url && (
                    <a aria-label={`เปิดต้นทาง: ${item.title}`} className="event-row__link" href={item.url} rel="noreferrer" target="_blank">
                      <ExternalLink aria-hidden="true" size={18} />
                    </a>
                  )}
                </article>
              ))}
              {!filtered.length && !loading && <div className="empty-inline">ไม่พบเรื่องที่ตรงกับคำค้นหาหรือตัวกรองนี้</div>}
            </div>
          )}
        </section>

        <aside className="source-note">
          <ShieldAlert aria-hidden="true" size={18} />
          <p><strong>กรณีฉุกเฉิน:</strong> ใช้ประกาศจากหน่วยงานรัฐในพื้นที่เป็นหลัก รายการในแอปช่วยรวมข้อมูลเพื่อการติดตาม แต่ไม่แทนคำสั่งอพยพหรือคำเตือนอย่างเป็นทางการ</p>
        </aside>
      </div>
    </div>
  );
}
