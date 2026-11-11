import { useState, useCallback, useEffect, useRef } from 'react';
import { forecastUrls, normalizeForecast, weatherDate } from '../utils/weatherData';

const CACHE_KEY = 'air4thai.forecast.v2';
const samePlace = (data, lat, lon) => data?.coords?.lat === lat && data?.coords?.lon === lon;

export function useWeatherData() {
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState('');
  const active = useRef(null);
  const previous = useRef(null);

  const fetchWeatherByCoords = useCallback(async (lat, lon) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setWeatherError('ไม่พบพิกัดพื้นที่ กรุณาเลือกจังหวัดอีกครั้ง');
      setLoadingWeather(false);
      return;
    }
    let cached = samePlace(previous.current, lat, lon) ? previous.current : null;
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!cached && samePlace(saved, lat, lon) && Date.now() - weatherDate(saved.observedAt).getTime() < 86400000) cached = saved;
    } catch { /* Storage is optional. */ }
    setWeatherData(cached ? { ...cached, stale: true } : null);
    setLoadingWeather(true);
    setWeatherError('');
    const timer = setTimeout(() => controller.abort('timeout'), 18000);
    try {
      const results = await Promise.allSettled(forecastUrls(lat, lon).map(async url => {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }));
      if (active.current !== controller) return;
      if (results[0].status !== 'fulfilled') throw results[0].reason;
      const data = normalizeForecast(results[0].value, results[1].status === 'fulfilled' ? results[1].value : null, { lat, lon });
      data.stale = !data.observedAt || Date.now() - weatherDate(data.observedAt).getTime() > 5400000;
      previous.current = data;
      setWeatherData(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Private mode / storage full. */ }
    } catch {
      if (active.current !== controller) return;
      setWeatherError(cached ? 'อัปเดตไม่ได้ กำลังแสดงข้อมูลเดิมของพื้นที่นี้ โปรดตรวจเวลา' : 'เชื่อมต่อข้อมูลอากาศไม่ได้ ลองอีกครั้งหรือเลือกพื้นที่อื่น');
      setWeatherData(cached ? { ...cached, stale: true } : null);
    } finally {
      clearTimeout(timer);
      if (active.current === controller) setLoadingWeather(false);
    }
  }, []);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  return { weatherData, loadingWeather, weatherError, fetchWeatherByCoords };
}
