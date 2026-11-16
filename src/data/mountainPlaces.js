// Each entry names the actual reference point, not a province centre or park office.
// Source coordinates and elevations were checked on 2026-11-16. Forecasts at these
// points are still model estimates; a nearby observing station is shown separately.
export const mountainPlaces = [
  {
    id: 'doi-inthanon-summit', name: 'ยอดดอยอินทนนท์', province: 'เชียงใหม่',
    lat: 18.589493, lon: 98.487161, elevation: 2565, type: 'summit',
    sourceUrl: 'https://explore.nrct.go.th/file_upload/submitter/file_upload/lqCpATqVO7o1vPq4ljV88f4d443.pdf',
    elevationSourceUrl: 'https://www.thailandtourismdirectory.go.th/en/attraction/5148',
    sourceNote: 'พิกัดและความสูงจากรายงานวิจัย วช. หน้า 14 (หน้า PDF 29) และกรมการท่องเที่ยว',
  },
  {
    id: 'doi-ang-khang-station-area', name: 'ดอยอ่างขาง · บริเวณสถานีแผ่นดินไหว', province: 'เชียงใหม่',
    lat: 19.932489, lon: 99.045243, elevation: 1533, type: 'station-area',
    sourceUrl: 'https://earthquake.tmd.go.th/station-info.html?id=24',
    elevationSourceUrl: 'https://earthquake.tmd.go.th/station-info.html?id=24',
    sourceNote: 'พิกัดและความสูงสถานี CMAI จากกรมอุตุนิยมวิทยา เป็นจุดอ้างอิงบนดอย ไม่ใช่ยอดดอยหรือเครื่องวัดอุณหภูมิ',
  },
];
