import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return undefined;
    if (localStorage.getItem('pwa-install-dismissed') || sessionStorage.getItem('pwa-install-dismissed')) return undefined;

    let timer;
    const reveal = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowBanner(true), 45000);
    };
    if (isIOS) {
      reveal();
      return () => window.clearTimeout(timer);
    }

    const handlePrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      reveal();
    };
    const handleInstalled = () => setShowBanner(false);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isIOS]);

  const dismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <aside aria-label="ติดตั้งแอป" className="install-toast">
      <span className="install-toast__icon"><Download aria-hidden="true" size={19} /></span>
      <div>
        <strong>ติดตั้งอากาศไทย</strong>
        <p>{isIOS ? 'กด Share แล้วเลือก Add to Home Screen' : 'เปิดจากหน้าจอหลักได้เร็วขึ้น และดูข้อมูลล่าสุดที่เคยโหลดได้'}</p>
      </div>
      {!isIOS && <button className="button button--primary button--compact" onClick={install} type="button">ติดตั้งแอป</button>}
      <button aria-label="ปิดคำแนะนำติดตั้ง" className="toast-close" onClick={dismiss} type="button"><X size={17} /></button>
    </aside>
  );
}
