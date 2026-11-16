import { useState, useCallback, useEffect, useRef } from 'react';
import { finiteOrNull, forecastUrls, normalizeForecast, weatherDate } from '../utils/weatherData';

const CACHE_KEY = 'air4thai.forecast.v3';
const samePlace = (data, lat, lon, elevation) => data?.coords?.lat === lat && data?.coords?.lon === lon && finiteOrNull(data?.coords?.elevation) === finiteOrNull(elevation);
const usableCache = (data, lat, lon, elevation) => samePlace(data, lat, lon, elevation) && Date.now() - weatherDate(data.validAt || data.observedAt).getTime() < 86400000;
const cachedState = data => data ? { ...data, stale: true, airStale: true } : null;

export function useWeatherData() {
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState('');
  const active = useRef(null);
  const previous = useRef(null);

  const fetchWeatherByCoords = useCallback(async (lat, lon, elevation) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (elevation != null && finiteOrNull(elevation) === null)) {
      setWeatherError('ไม่พบพิกัดพื้นที่ กรุณาเลือกจังหวัดอีกครั้ง');
      setLoadingWeather(false);
      return;
    }
    let cached = usableCache(previous.current, lat, lon, elevation) ? previous.current : null;
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!cached && usableCache(saved, lat, lon, elevation)) cached = saved;
    } catch { /* Storage is optional. */ }
    setWeatherData(cachedState(cached));
    setLoadingWeather(true);
    setWeatherError('');
    const timer = setTimeout(() => controller.abort('timeout'), 18000);
    try {
      const results = await Promise.allSettled(forecastUrls(lat, lon, elevation).map(async url => {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }));
      if (active.current !== controller) return;
      if (results[0].status !== 'fulfilled') throw results[0].reason;
      const data = normalizeForecast(results[0].value, results[1].status === 'fulfilled' ? results[1].value : null, { lat, lon, elevation: finiteOrNull(elevation) });
      previous.current = data;
      setWeatherData(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Private mode / storage full. */ }
    } catch {
      if (active.current !== controller) return;
      setWeatherError(cached ? 'อัปเดตไม่ได้ กำลังแสดงข้อมูลเดิมของพื้นที่นี้ โปรดตรวจเวลา' : 'เชื่อมต่อข้อมูลอากาศไม่ได้ ลองอีกครั้งหรือเลือกพื้นที่อื่น');
      setWeatherData(cachedState(cached));
    } finally {
      clearTimeout(timer);
      if (active.current === controller) setLoadingWeather(false);
    }
  }, []);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  return { weatherData, loadingWeather, weatherError, fetchWeatherByCoords };
}
