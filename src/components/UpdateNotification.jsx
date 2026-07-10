import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateNotification() {
  const [registration, setRegistration] = useState(null);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(value) {
      if (value) setRegistration(value);
    },
    onRegisterError(error) {
      console.warn('[PWA] registration failed:', error);
    },
  });

  useEffect(() => {
    if (!registration) return undefined;
    const interval = window.setInterval(() => registration.update(), 60 * 1000);
    const handleVisible = () => {
      if (document.visibilityState === 'visible') registration.update();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [registration]);

  if (!needRefresh) return null;

  const update = () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    updateServiceWorker(false);
  };

  return (
    <aside aria-live="polite" className="update-toast" role="status">
      <span className="install-toast__icon"><RefreshCw aria-hidden="true" size={19} /></span>
      <div><strong>มีเวอร์ชันใหม่</strong><p>อัปเดตเพื่อใช้ข้อมูลและหน้าจอล่าสุด</p></div>
      <button className="button button--primary button--compact" onClick={update} type="button">อัปเดตแอป</button>
      <button aria-label="ปิดข้อความอัปเดต" className="toast-close" onClick={() => setNeedRefresh(false)} type="button"><X size={17} /></button>
    </aside>
  );
}
