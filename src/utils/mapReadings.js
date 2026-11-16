import { bangkokDateKey, finiteOrNull, isStaleTime } from './weatherData.js';

export function mapReading(station, stationTemps, metric, now = Date.now()) {
  const weather = stationTemps?.[station.stationID] || {};
  const air = metric === 'pm25' || metric === 'pmHour';
  const daily = ['rain', 'tempMin', 'tempMax'].includes(metric);
  const raw = metric === 'pm25' ? station.pm25Average24h ?? weather.pm25Average24h
    : metric === 'pmHour' ? station.AQILast?.PM25?.value
      : metric === 'rain' ? weather.rainMm
        : metric === 'wind' ? weather.windGust : weather[metric];
  let value = finiteOrNull(raw);
  if (!['temp', 'tempMin', 'tempMax'].includes(metric) && value < 0) value = null;
  const validAt = air ? station.pm25Time || weather.pm25Time : metric === 'temp' ? weather.validAt || weather.weatherTime || station.weatherTime : weather.supplementalWeatherTime || (weather.source !== 'tmd' ? weather.weatherTime || station.weatherTime : null);
  if (daily && (metric === 'rain' ? weather.rainDate : weather.tempDate) !== bangkokDateKey(now)) value = null;
  if (metric === 'pm25' && (station.pm25ValidHours24h ?? weather.pm25ValidHours24h) !== 24) value = null;
  const point = metric === 'temp' && weather.source === 'tmd' ? weather.weatherLocation : { lat: station.lat, lon: station.long };
  const source = air ? station.pm25Source || 'cams-model' : metric === 'temp' ? weather.tempSource || weather.source : metric === 'rain' ? weather.rainSource : metric.startsWith('temp') ? weather.tempMinMaxSource : 'open-meteo-model';
  const periodLabel = daily ? 'รายวัน 00:00–24:00 เวลาไทย' : metric === 'pm25' ? 'เฉลี่ย 24 ชั่วโมง' : metric === 'pmHour' ? 'ค่ารายชั่วโมง' : 'ค่าตามเวลาที่ระบุ';
  return { value, validAt, stale: isStaleTime(validAt, now), lat: finiteOrNull(point?.lat) ?? station.lat, lon: finiteOrNull(point?.lon) ?? station.long, source: source || 'ไม่ระบุแหล่ง', riskMetric: metric.startsWith('temp') ? 'temperature' : metric === 'wind' ? 'gust' : metric === 'pmHour' ? 'pm25' : metric, hours: daily || metric === 'pm25' ? 24 : null, periodLabel };
}
