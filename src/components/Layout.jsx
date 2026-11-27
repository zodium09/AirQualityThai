import { createElement, useContext } from 'react';
import { BarChart3, BellRing, CloudSun, House, Map, Moon, Sun } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { WeatherContext } from '../context/WeatherContext';
import InstallPrompt from './InstallPrompt';
import UpdateNotification from './UpdateNotification';

const navigation = [
  { to: '/', label: 'วันนี้', icon: House, end: true },
  { to: '/map', label: 'แผนที่', icon: Map },
  { to: '/news', label: 'ประกาศ', icon: BellRing },
  { to: '/stats', label: 'สถิติ', icon: BarChart3 },
];

function NavigationLinks({ mobile = false }) {
  return navigation.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      className={({ isActive }) => `${mobile ? 'mobile-nav__link' : 'top-nav__link'}${isActive ? ' is-active' : ''}`}
      end={end}
      key={to}
      to={to}
    >
      {createElement(Icon, { 'aria-hidden': true, size: mobile ? 20 : 17, strokeWidth: 2.2 })}
      <span>{label}</span>
    </NavLink>
  ));
}

export default function Layout() {
  const { darkMode, setDarkMode } = useContext(WeatherContext);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">ข้ามไปเนื้อหาหลัก</a>

      <header className="topbar">
        <div className="topbar__inner">
          <NavLink aria-label="อากาศไทย หน้าหลัก" className="brand" to="/">
            <span aria-hidden="true" className="brand__mark"><CloudSun size={22} strokeWidth={2.2} /></span>
            <span className="brand__copy">
              <strong>อากาศไทย</strong>
              <small>รู้ก่อน วางแผนได้</small>
            </span>
          </NavLink>

          <nav aria-label="เมนูหลัก" className="top-nav">
            <div className="top-nav__pill">
              <NavigationLinks />
            </div>
          </nav>

          <div className="topbar__actions">
            <button
              aria-label={darkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
              className="icon-button theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}
              type="button"
            >
              {darkMode ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
              <span className="theme-toggle__label">{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-content" id="main-content">
        <Outlet />
      </main>

      <nav aria-label="เมนูหลักบนมือถือ" className="mobile-nav">
        <NavigationLinks mobile />
        <button className="mobile-nav__link mobile-nav__theme" aria-label={darkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'} onClick={() => setDarkMode(!darkMode)} type="button">
          {darkMode ? <Sun aria-hidden="true" size={20} /> : <Moon aria-hidden="true" size={20} />}
          <span>{darkMode ? 'สว่าง' : 'โหมดมืด'}</span>
        </button>
      </nav>

      <InstallPrompt />
      <UpdateNotification />
    </div>
  );
}
