import React, { lazy, Suspense } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import { WeatherProvider } from './context/WeatherContext';

const CHUNK_RELOAD_KEY = 'air4thai-chunk-reload-attempted';

function isChunkLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|dynamically imported module/i.test(error?.message || String(error || ''));
}

async function recoverFromStaleChunk() {
  if (typeof window === 'undefined' || window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return false;
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');

  try {
    if ('caches' in window) {
      const names = await window.caches.keys();
      await Promise.all(names.filter((name) => /workbox|precache|air4thai/i.test(name)).map((name) => window.caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => null)));
    }
  } catch {
    // Reload still gives the app the best chance to recover from an old mobile chunk.
  }

  window.location.reload();
  return true;
}

function lazyWithRetry(loader) {
  return lazy(() => loader().catch(async (error) => {
    if (isChunkLoadError(error) && await recoverFromStaleChunk()) return new Promise(() => {});
    throw error;
  }));
}

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const MapPage = lazyWithRetry(() => import('./pages/MapPage'));
const NewsPage = lazyWithRetry(() => import('./pages/NewsPage'));

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Route failed:', error);
    if (isChunkLoadError(error)) recoverFromStaleChunk();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="route-error" role="alert">
        <div className="route-error__panel">
          <span className="route-error__icon"><ShieldAlert aria-hidden="true" size={24} /></span>
          <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
          <p>การเชื่อมต่ออาจสะดุด หรือแอปมีเวอร์ชันใหม่ ลองโหลดอีกครั้ง</p>
          <div className="button-row">
            <button className="button button--primary" onClick={() => window.location.reload()} type="button">
              <RefreshCw aria-hidden="true" size={17} /> โหลดอีกครั้ง
            </button>
            <button className="button button--secondary" onClick={() => { window.location.href = '/'; }} type="button">
              กลับหน้าวันนี้
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function LazyRoute({ children }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LoadingScreen title="กำลังเปิดหน้า" subtitle="เตรียมข้อมูลล่าสุด" />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <WeatherProvider>
      <Routes>
        <Route element={<Layout />} path="/">
          <Route index element={<LazyRoute><Dashboard /></LazyRoute>} />
          <Route element={<LazyRoute><MapPage /></LazyRoute>} path="map" />
          <Route element={<LazyRoute><NewsPage /></LazyRoute>} path="news" />
          <Route element={<Navigate replace to="/" />} path="ai" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </WeatherProvider>
  );
}
