import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { provinces77 } from '../src/provinces77.js';
import { currentForecast, dailyAirMax, dailyForecast, providerSlots, roundedOrNull } from '../src/server/providerData.js';
import { bangkokDateKey, isStaleTime, weatherDate } from '../src/utils/weatherData.js';

// TMD API Regions — 6 calls ได้ข้อมูลทั้งประเทศ
const TMD_REGIONS = ['N', 'NE', 'C', 'E', 'W', 'S'];
const TMD_BASE = 'https://data.tmd.go.th/nwpapi/v1/forecast/location';
const TMD_FIELDS = 'tc,rh,rain,slp,cond';

// พจนานุกรมรหัสจังหวัด 2 ตัวแรก (TIS-1099)
const provMap = {
  "10": "กรุงเทพมหานคร", "11": "สมุทรปราการ", "12": "นนทบุรี", "13": "ปทุมธานี", "14": "พระนครศรีอยุธยา", "15": "อ่างทอง", "16": "ลพบุรี", "17": "สิงห์บุรี",
  "18": "ชัยนาท", "19": "สระบุรี", "20": "ชลบุรี", "21": "ระยอง", "22": "จันทบุรี", "23": "ตราด", "24": "ฉะเชิงเทรา", "25": "ปราจีนบุรี", "26": "นครนายก",
  "27": "สระแก้ว", "30": "นครราชสีมา", "31": "บุรีรัมย์", "32": "สุรินทร์", "33": "ศรีสะเกษ", "34": "อุบลราชธานี", "35": "ยโสธร", "36": "ชัยภูมิ",
  "37": "อำนาจเจริญ", "38": "บึงกาฬ", "39": "หนองบัวลำภู", "40": "ขอนแก่น", "41": "อุดรธานี", "42": "เลย", "43": "หนองคาย", "44": "มหาสารคาม",
  "45": "ร้อยเอ็ด", "46": "กาฬสินธุ์", "47": "สกลนคร", "48": "นครพนม", "49": "มุกดาหาร", "50": "เชียงใหม่", "51": "ลำพูน", "52": "ลำปาง", "53": "อุตรดิตถ์",
  "54": "แพร่", "55": "น่าน", "56": "พะเยา", "57": "เชียงราย", "58": "แม่ฮ่องสอน", "60": "นครสวรรค์", "61": "อุทัยธานี", "62": "กำแพงเพชร", "63": "ตาก",
  "64": "สุโขทัย", "65": "พิษณุโลก", "66": "พิจิตร", "67": "เพชรบูรณ์", "70": "ราชบุรี", "71": "กาญจนบุรี", "72": "สุพรรณบุรี", "73": "นครปฐม",
  "74": "สมุทรสาคร", "75": "สมุทรสงคราม", "76": "เพชรบุรี", "77": "ประจวบคีรีขันธ์", "80": "นครศรีธรรมราช", "81": "กระบี่", "82": "พังงา", "83": "ภูเก็ต",
  "84": "สุราษฎร์ธานี", "85": "ระนอง", "86": "ชุมพร", "90": "สงขลา", "91": "สตูล", "92": "ตรัง", "93": "พัทลุง", "94": "ปัตตานี", "95": "ยะลา", "96": "นราธิวาส"
};

// ===== TMD API Helper =====
async function fetchTmdRegions(token) {
    let allForecasts = [];

    for (const region of TMD_REGIONS) {
        try {
            // ไม่ใส่ date/hour — ให้ TMD คืนข้อมูลพยากรณ์ล่าสุดอัตโนมัติ
            const url = `${TMD_BASE}/hourly/region?region=${region}&fields=${TMD_FIELDS}&duration=1`;
            console.log(`TMD fetching: ${url}`);
            const res = await fetch(url, {
                signal: AbortSignal.timeout(15000), headers: {
                    'accept': 'application/json',
                    'authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                // TMD typo: sometimes WeatherForecasts, sometimes WeatherForecast
                const forecasts = data.WeatherForecasts || data.WeatherForcasts || data.WeatherForecast || [];
                if (forecasts.length === 0 && data.fields) {
                    console.error(`TMD Region ${region}: field error:`, JSON.stringify(data));
                } else {
                    allForecasts.push(...forecasts);
                    console.log(`TMD Region ${region}: ${forecasts.length} locations`);
                }
            } else {
                const errBody = await res.text().catch(() => '');
                console.warn(`TMD Region ${region} failed: ${res.status} — ${errBody.substring(0, 200)}`);
            }
        } catch (e) {
            console.error(`TMD Region ${region} error:`, e.message);
        }
        // Rate limit protection
        await new Promise(r => setTimeout(r, 300));
    }
    return allForecasts;
}

// ===== Process TMD data → province & amphoe level =====
function processTmdData(forecasts) {
    const provinceMap = {}; 
    
    forecasts.forEach(item => {
        if (!item.location) return;
        const loc = item.location;
        const provName = loc.province || '';
        const amphoeName = loc.amphoe || null;
        const areatype = loc.areatype || 'province';
        
        const d = item.forecasts?.[0]?.data || {};
        const entry = {
            name: amphoeName || provName,
            province: provName,
            amphoe: amphoeName,
            areatype,
            lat: roundedOrNull(loc.lat, 6),
            lon: roundedOrNull(loc.lon, 6),
            geocode: loc.geocode || '',
            validAt: item.forecasts?.[0]?.time || null,
            source: 'tmd-nwp-model',
            tc: roundedOrNull(d.tc), rh: roundedOrNull(d.rh), rain: roundedOrNull(d.rain),
            slp: roundedOrNull(d.slp), cond: roundedOrNull(d.cond),
            hourlyForecasts: (item.forecasts || []).slice(0, 24).map(fc => ({
                time: fc.time || null,
                tc: roundedOrNull(fc.data?.tc), rh: roundedOrNull(fc.data?.rh), rain: roundedOrNull(fc.data?.rain)
            }))
        };

        if (!provinceMap[provName]) {
            provinceMap[provName] = { amphoes: [], provinceLevelData: null };
        }

        // เก็บข้อมูลระดับจังหวัด
        if (areatype === 'province' || !amphoeName) {
            provinceMap[provName].provinceLevelData = entry;
        } 
        // เก็บข้อมูลระดับอำเภอ
        else {
            provinceMap[provName].amphoes.push(entry);
        }
    });

    return provinceMap;
}

export default async function handler(req, res) {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return res.status(500).json({ success: false, error: 'CRON_SECRET is not configured' });
    }
    if (req.headers.authorization !== `Bearer ${expected}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log("Cron: เริ่มทำงาน — Hybrid TMD + Open-Meteo Pipeline...");

    const dbUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    if (!dbUrl) return res.status(500).json({ success: false, error: "🚨 หา VITE_FIREBASE_DATABASE_URL ไม่เจอ!" });

    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: dbUrl,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getDatabase(app, dbUrl);

    const timestamp = Date.now();

    // ========================================
    // STEP 1: TMD API — ข้อมูลระดับอำเภอ (Primary)
    // ========================================
    let tmdSuccess = false;
    let tmdProvinceMap = {};
    const tmdToken = process.env.TMD_API_TOKEN;

    if (tmdToken) {
        console.log("Cron: กำลังดึงข้อมูลจาก TMD API (6 regions)...");
        try {
            const forecasts = await fetchTmdRegions(tmdToken);
            if (forecasts.length > 0) {
                tmdProvinceMap = processTmdData(forecasts);
                tmdSuccess = true;
                console.log(`Cron: TMD สำเร็จ — ได้ข้อมูล ${Object.keys(tmdProvinceMap).length} จังหวัด`);
            } else {
                console.warn("Cron: TMD ไม่ได้ข้อมูลกลับมา (empty response)");
            }
        } catch (e) {
            console.error("Cron: TMD API ล้มเหลว:", e.message);
        }
    } else {
        console.warn("Cron: ไม่มี TMD_API_TOKEN — ข้ามขั้นตอน TMD");
    }

    // ========================================
    // STEP 2: Open-Meteo — PM2.5, UV, และ Backup
    // ========================================
    console.log("Cron: กำลังดึงข้อมูลจาก Open-Meteo...");
    const chunkSize = 40;
    let allWData = [];
    let allAData = [];

    for (let i = 0; i < provinces77.length; i += chunkSize) {
      const chunk = provinces77.slice(i, i + chunkSize);
      const lats = chunk.map(p => p.lat).join(',');
      const lons = chunk.map(p => p.lon).join(',');

      const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max&timezone=Asia%2FBangkok&wind_speed_unit=kmh&past_days=7&forecast_days=8&_t=${timestamp}`;
      const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=pm2_5&hourly=pm2_5&timezone=Asia%2FBangkok&past_days=7&forecast_days=5&_t=${timestamp}`;

      const results = await Promise.allSettled([wUrl, aUrl].map(async url => {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Weather provider HTTP ${response.status}`);
        return response.json();
      }));
      allWData.push(...providerSlots(results[0], chunk.length));
      allAData.push(...providerSlots(results[1], chunk.length));
      if (i + chunkSize < provinces77.length) await new Promise(r => setTimeout(r, 200));
    }

    // ========================================
    // STEP 3: Merge — รวม TMD + Open-Meteo เข้าด้วยกัน
    // ========================================
    console.log("Cron: Merging TMD + Open-Meteo data...");

    const newStations = [];
    const newTemps = {};
    const newYesterday = {};
    const newMaxYesterday = {};
    const newDaily = {};

    provinces77.forEach((p, idx) => {
      const w = allWData[idx] || {};
      const a = allAData[idx] || {};
      const sID = `PROV_${idx}`;

      // Try to find TMD data for this province
      const tmdProv = tmdProvinceMap[p.n];
      const tmdData = tmdProv?.provinceLevelData || null;
      const current = currentForecast(w, a, tmdSuccess ? tmdData : null, timestamp);
      const hasTmd = current.source === 'tmd';

      newStations.push({
        stationID: sID, areaTH: p.n, lat: p.lat, long: p.lon,
        AQILast: { PM25: { value: roundedOrNull(a.current?.pm2_5) } },
        pm25Source: 'cams-model',
        pm25Time: a.current?.time || null,
        weatherTime: current.weatherTime,
        weatherLocation: current.weatherLocation,
        pm25Average24h: current.pm25Average24h, pm25ValidHours24h: current.pm25ValidHours24h,
        pm25WindowStart: current.pm25WindowStart, pm25WindowEnd: current.pm25WindowEnd,
        airStale: current.airStale, stale: current.stale,
        // Flag source
        dataSource: hasTmd ? 'tmd' : 'openmeteo',
        tmdCond: hasTmd ? tmdData.cond : null
      });

      // Match timestamps, never fixed positions: providers can omit hours or days.
      const yesterdayDate = bangkokDateKey(timestamp - 86400000);
      const yesterdayDailyIdx = w.daily?.time?.indexOf(yesterdayDate) ?? -1;
      const currentTime = weatherDate(w.current?.time).getTime();
      const yesterdayHour = Math.floor((Number.isFinite(currentTime) ? currentTime : timestamp) / 3600000) * 3600000 - 86400000;
      const yesterdayHourlyIdx = w.hourly?.time?.findIndex(time => weatherDate(time).getTime() === yesterdayHour) ?? -1;
      const yesterdayAirIdx = a.hourly?.time?.findIndex(time => weatherDate(time).getTime() === yesterdayHour) ?? -1;

      // Current values: TMD primary, OpenMeteo fallback
      newTemps[sID] = current;

      // Yesterday comparison — still from Open-Meteo (has historical data)
      const prevTemp = w.hourly?.temperature_2m?.[yesterdayHourlyIdx];
      const prevPm25 = a.hourly?.pm2_5?.[yesterdayAirIdx];
      const prevUv = w.hourly?.uv_index?.[yesterdayHourlyIdx];
      const prevRain = w.hourly?.precipitation_probability?.[yesterdayHourlyIdx];
      const prevWind = w.hourly?.wind_speed_10m?.[yesterdayHourlyIdx];

      newYesterday[sID] = {
        temp: roundedOrNull(prevTemp),
        minTemp: roundedOrNull(w.daily?.temperature_2m_min?.[yesterdayDailyIdx]),
        tempMin: roundedOrNull(w.daily?.temperature_2m_min?.[yesterdayDailyIdx]),
        tempMax: roundedOrNull(w.daily?.temperature_2m_max?.[yesterdayDailyIdx]),
        rainMm: roundedOrNull(w.daily?.precipitation_sum?.[yesterdayDailyIdx], 1), rainDate: yesterdayDate,
        pm25: roundedOrNull(prevPm25), uv: roundedOrNull(prevUv),
        rain: roundedOrNull(prevRain), wind: roundedOrNull(prevWind),
        weatherTime: w.hourly?.time?.[yesterdayHourlyIdx] || null, pm25Time: a.hourly?.time?.[yesterdayAirIdx] || null, source: 'open-meteo-model'
      };
      newMaxYesterday[sID] = {
        temp: roundedOrNull(w.daily?.temperature_2m_max?.[yesterdayDailyIdx]),
        tempMax: roundedOrNull(w.daily?.temperature_2m_max?.[yesterdayDailyIdx]), tempMin: roundedOrNull(w.daily?.temperature_2m_min?.[yesterdayDailyIdx]),
        pm25: dailyAirMax([yesterdayDate], a.hourly)[0],
        uv: roundedOrNull(w.daily?.uv_index_max?.[yesterdayDailyIdx]),
        rain: roundedOrNull(w.daily?.precipitation_sum?.[yesterdayDailyIdx], 1),
        rainMm: roundedOrNull(w.daily?.precipitation_sum?.[yesterdayDailyIdx], 1), rainDate: yesterdayDate,
        wind: roundedOrNull(w.daily?.wind_speed_10m_max?.[yesterdayDailyIdx])
      };

      // Daily arrays for Map Slider
      newDaily[sID] = dailyForecast(w, a);
    });

    // ========================================
    // STEP 4: Save Province-level to Firebase (weather_data — compatible path)
    // ========================================
    const validTimes = newStations.flatMap(station => [
        newTemps[station.stationID].temp !== null ? station.weatherTime : null,
        station.AQILast.PM25.value !== null ? station.pm25Time : null,
    ]).map(time => weatherDate(time).getTime()).filter(Number.isFinite);
    const oldestValidTime = validTimes.length ? Math.min(...validTimes) : null;
    const payload = {
        schemaVersion: 3,
        lastUpdated: oldestValidTime === null ? null : new Date(oldestValidTime).toISOString(),
        fetchedAt: new Date(timestamp).toISOString(),
        stale: oldestValidTime === null || isStaleTime(oldestValidTime, timestamp),
        tmdAvailable: tmdSuccess,
        stations: newStations,
        stationTemps: newTemps,
        stationYesterday: newYesterday,
        stationMaxYesterday: newMaxYesterday,
        stationDaily: newDaily
    };

    await set(ref(db, 'weather_data'), payload);
    console.log("Cron: weather_data บันทึกสำเร็จ");

    // ========================================
    // STEP 5: Save Amphoe-level to Firebase (weather_data_amphoe — NEW)
    // ========================================
    if (tmdSuccess && Object.keys(tmdProvinceMap).length > 0) {
        console.log("Cron: กำลังบันทึกข้อมูลระดับอำเภอ...");

        const amphoePayload = {
            lastUpdated: new Date(timestamp).toISOString(),
            provinces: {}
        };

        Object.entries(tmdProvinceMap).forEach(([provName, provData]) => {
            // เก็บข้อมูลระดับอำเภอ (ถ้ามี)
            const amphoeList = (provData.amphoes || []).map(a => ({
                n: a.name,
                lat: a.lat,
                lon: a.lon,
                gc: a.geocode,
                tc: a.tc,
                rh: a.rh,
                rain: a.rain,
                cond: a.cond, validAt: a.validAt, source: a.source
            }));

            // เก็บข้อมูลระดับจังหวัดด้วย (ใช้แทนอำเภอเมื่อ /region ไม่มีอำเภอ)
            const provLevel = provData.provinceLevelData;
            if (amphoeList.length > 0 || provLevel) {
                amphoePayload.provinces[provName] = {
                    count: amphoeList.length,
                    amphoes: amphoeList,
                    // Province-level summary จาก TMD
                    prov: provLevel ? {
                        tc: provLevel.tc,
                        rh: provLevel.rh,
                        rain: provLevel.rain,
                        slp: provLevel.slp,
                        cond: provLevel.cond,
                        lat: provLevel.lat,
                        lon: provLevel.lon, validAt: provLevel.validAt, source: provLevel.source
                    } : null
                };
            }
        });

        await set(ref(db, 'weather_data_amphoe'), amphoePayload);
        console.log(`Cron: weather_data_amphoe บันทึก ${Object.keys(amphoePayload.provinces).length} จังหวัด สำเร็จ`);
    }

    // ========================================
    // STEP 6: GISTDA Disaster Data (เดิม)
    // ========================================
    console.log("Cron: กำลังดึงข้อมูล GISTDA...");
    let hotspotsTop5 = [];
    let burntAreaTop5 = [];
    let hotspotsAvailable = false;
    let burntAreaAvailable = false;

    try {
        const fireRes = await fetch("https://disaster.gistda.or.th/app-api/services/viirs/7days", { signal: AbortSignal.timeout(15000) });
        if (fireRes.ok) {
            const fireData = await fireRes.json();
            if (Array.isArray(fireData?.items)) {
                hotspotsAvailable = true;
                const provCount = {};
                fireData.items.forEach(it => {
                    const provCode = String(it.amphoeCode).substring(0, 2);
                    const provName = provMap[provCode] || it.amphoe;
                    provCount[provName] = (provCount[provName] || 0) + 1;
                });
                hotspotsTop5 = Object.entries(provCount)
                    .map(([name, val]) => ({ province: name, value: val }))
                    .sort((a,b) => b.value - a.value).slice(0, 5);
            }
        }
    } catch(e) { console.error("Cron GISTDA Fire Error:", e); }

    try {
        const burnRes = await fetch("https://disaster.gistda.or.th/app-api/analytics/services/burn_10_Days/burn_10_days?sort=provinceCode:asc,amphoeCode:asc,tambonCode:asc,lu_name:asc,area:asc&offset=0&limit=10000", { signal: AbortSignal.timeout(15000) });
        if (burnRes.ok) {
            const burnData = await burnRes.json();
            if (Array.isArray(burnData?.items)) {
                burntAreaAvailable = true;
                const provCount = {};
                burnData.items.forEach(it => {
                    const provCode = String(it.amphoeCode).substring(0, 2);
                    const provName = provMap[provCode] || it.amphoe;
                    provCount[provName] = (provCount[provName] || 0) + (it.area || 0);
                });
                burntAreaTop5 = Object.entries(provCount)
                    .map(([name, val]) => ({ province: name, value: Math.round(val) }))
                    .sort((a,b) => b.value - a.value).slice(0, 5);
            }
        }
    } catch(e) { console.error("Cron GISTDA Burn Error:", e); }

    const gistdaPayload = {
        lastUpdated: new Date(timestamp).toISOString(),
        hotspots: hotspotsTop5, burntArea: burntAreaTop5,
        lowSoilMoisture: [], lowVegetationMoisture: [], floodArea: [],
        available: { hotspots: hotspotsAvailable, burntArea: burntAreaAvailable, lowSoilMoisture: false, lowVegetationMoisture: false, floodArea: false },
        source: 'GISTDA',
        missingReason: 'Unavailable datasets are empty; no fallback measurements are generated.'
    };
    await set(ref(db, 'gistda_disaster'), gistdaPayload);

    const summary = tmdSuccess 
      ? `Hybrid Sync สำเร็จ — TMD (${Object.keys(tmdProvinceMap).length} จว.) + Open-Meteo + GISTDA`
      : `Open-Meteo Only Sync สำเร็จ (TMD unavailable) + GISTDA`;
      
    return res.status(200).json({ success: true, message: summary, tmdAvailable: tmdSuccess });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.toString() });
  }
}
