# Station observations and mountain reference points

Verified on 16 November 2026. These integrations add station observations alongside model forecasts; station readings must not replace a forecast at another coordinate silently.

## TMD WeatherToday V2

- Official specification: https://data.tmd.go.th/api/doc/reference/WeatherToday_ver2.pdf
- Live endpoint: `https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345&format=json`
- The public `api` / `api12345` example is published in a Thai government data-integration report: https://www.royalrain.go.th/UploadFile/06123725620530.pdf (page 10). These are public demo parameters, not a private application credential. The newer specification's `demo` example returned `Authentication fail` in this check.
- Optional private deployment configuration: `TMD_OBSERVATION_UID` and `TMD_OBSERVATION_KEY`. Values are never returned by the API or logged.
- Live probe returned 128 stations and observations at 07:00 ICT, including WMO 48302 Doi Ang Khang. `Header.LastBuildDate` is generation time, not measurement time.
- `Temperature` is the 07:00 observation. `MinTemperature`, `MaxTemperature`, and `Rainfall` summarize the preceding 24 hours ending at that observation. TMD's daily rain convention is 07:00–07:00, not the model's midnight-to-midnight calendar day: https://www.tmd.go.th/info/faq
- Weather reports become stale after 26 hours. This operational refresh tolerance does not mean a 07:00 temperature is a current/live reading.

## Air4Thai

- Official public endpoint: https://air4thai.pcd.go.th/services/getNewAQI_JSON.php
- Official MNRE catalog provenance: https://naturebi.mnre.go.th/ckan/dataset/changes/d00f0505-a36c-4463-8106-e5f38ecfcbc1
- The station `AQILast.PM25.value` is the reported 24-hour PM2.5 average, not its `aqi` field and not the separate hourly chart. PCD explains the 24-hour display and hourly update: https://epo08.pcd.go.th/th/news/detail/180206
- Live probe returned station-specific `AQILast.date/time` on 16 November 2026 at 09:00 ICT. `-1` and other negative pollutant values are missing markers. Genuine zero is preserved.
- Air4Thai currently omits intermediates required by Node’s bundled trust store. The host-specific HTTPS adapter supplies the public Let’s Encrypt YR1 and cross-signed Root YR certificates from https://letsencrypt.org/certificates/ and verifies their signatures through the already-trusted ISRG Root X1. Certificate and hostname verification remain enabled; the trust configuration applies only to the exact Air4Thai feed, without changing other providers. The included YR1 certificate expires on 2 September 2028 and must be reviewed if the provider changes its chain. A TLS failure remains an explicit unavailable state.
- Air readings are flagged stale after 3 hours. Provider-supplied 24-hour averages do not expose valid-hour coverage, so this app does not claim 24 valid samples.

## Spatial interpretation

The API selects the nearest reporting station with a valid timestamp and usable measurements, retaining its own name, coordinate and distance. A station more than 50 km away gets `farFromLocation: true`; that distance is a display cue, not an accuracy guarantee. Unknown or future timestamps are not eligible. Reading freshness and upstream availability are independent. Cached reads preserve their original source and fetch timestamps on failure.

## Mountain references

- **Doi Inthanon summit:** 18.589493 N, 98.487161 E, 2,565 m. Coordinates and elevation are explicitly given on printed page 14 / PDF page 29 of the NRCT-funded geography research report: https://explore.nrct.go.th/file_upload/submitter/file_upload/lqCpATqVO7o1vPq4ljV88f4d443.pdf . Height independently confirmed by the Department of Tourism: https://www.thailandtourismdirectory.go.th/en/attraction/5148 .
- **Doi Ang Khang, seismic station vicinity:** 19.932489 N, 99.045243 E, 1,533 m. TMD station CMAI publishes this coordinate and height: https://earthquake.tmd.go.th/station-info.html?id=24 . This is a reference location on the mountain, not the summit and not a claim that the seismic instrument measures weather. The meteorological station WMO 48302 is nearby but has a different published coordinate; do not attach the seismic station elevation to that weather station.

Model elevation adjustment is requested explicitly for these named reference points. It does not make a coarse weather grid a physical observation on the summit. Additional mountains should only be added after verifying the exact point and height; do not substitute park-office coordinates for a summit.

## Historical radar viewer

- RainViewer discontinued future nowcast frames on 1 January 2026. The app uses only the `radar.past` list and Universal Blue palette 2, with maximum native zoom 7: https://www.rainviewer.com/api/transition-faq.html and https://www.rainviewer.com/api/color-schemes.html .
- Provider documentation defines frame timestamps as **composite-frame generation time**, not the exact measurement time of every contributing radar: https://www.rainviewer.com/api/weather-maps-api.html . The UI therefore says "เวลาเฟรมภาพ". Frames later than the server clock are rejected; a latest frame older than 30 minutes is explicitly stale.
- The documented coverage mask uses transparent for coverage and black for no coverage. The server checks a central 3 × 3-pixel region; mixed edges, undecodable/missing masks, or unexpected colours do not become "covered". The mask is updated infrequently and cannot prove that a specific radar is currently reporting.
- No extrapolated ETA, 60-minute rainfall, confidence percentage, no-rain conclusion, or local push alert is generated from image pixels. Blank imagery is not proof of no rain. Users can select timestamped past frames on an OpenStreetMap basemap and consult the external provider.
- Manifest requests are shared for five minutes, result cache is capped at 80 coordinates, and requests have finite timeouts. Tile hosts must be HTTPS RainViewer hosts; untrusted paths/hosts are rejected before server requests.
