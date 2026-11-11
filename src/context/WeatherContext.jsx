import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { provinces77 } from '../provinces77';

export const WeatherContext = createContext();
const initialStations = provinces77.map((p, i) => ({ stationID: `PROV_${i}`, areaTH: p.n, lat: p.lat, long: p.lon, AQILast: { PM25: { value: null } } }));
const empty = { stations: initialStations, stationTemps: {}, stationYesterday: {}, stationMaxYesterday: {}, stationDaily: {}, gistdaSummary: null, amphoeData: null, tmdAvailable: false, lastUpdated: null, source: 'unavailable', stale: true };

export function WeatherProvider({ children }) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('theme') === 'dark'; } catch { return false; } });
  const active = useRef(null);
  useEffect(() => {
    try { localStorage.setItem('theme', darkMode ? 'dark' : 'light'); } catch { /* Optional preference. */ }
    document.body.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);
  const refreshWeather = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 25000);
    setRefreshing(true);
    try {
      const response = await fetch('/api/weather-data', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Weather API ${response.status}`);
      const result = await response.json();
      if (active.current !== controller) return;
      if (result.source === 'unavailable' || result.source === 'deterministic-fallback') {
        setData(previous => ({ ...previous, stale: true, source: previous.lastUpdated ? previous.source : 'unavailable', amphoeData: result.amphoeData || previous.amphoeData }));
      } else {
        setData({ ...empty, ...result, stations: result.stations?.length ? result.stations : initialStations });
      }
    } catch {
      if (active.current === controller) setData(previous => ({ ...previous, stale: true }));
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    refreshWeather();
    const refresh = () => { if (document.visibilityState === 'visible') refreshWeather(); };
    const timer = setInterval(refresh, 600000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); active.current?.abort(); active.current = null; };
  }, [refreshWeather]);
  return <WeatherContext.Provider value={{ ...data, weatherMeta: { source: data.source, stale: data.stale, fallbackSource: data.fallbackSource }, loading, refreshing, refreshWeather, darkMode, setDarkMode }}>{children}</WeatherContext.Provider>;
}
