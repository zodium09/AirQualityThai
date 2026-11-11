# อากาศไทย

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The user requested a Thai weather app that people can understand immediately on mobile, with an efficient desktop monitoring view.

## Product Purpose

Help users understand local weather, rain and air pollution, plan their day, and monitor the national picture.

## Capabilities and Constraints

Existing React/Vite PWA, Thai-language interface, 77 province reference locations, optional geolocation and district lookup, hourly and daily forecasts, radar, national map, historical statistics and official notices. Data providers may be unavailable independently. A forecast is not a station observation; a missing reading must stay missing.

## Brand Commitments

User explicitly requested bright, clean white and blue, easy to understand, visually polished, and not gloomy. Preserve the existing อากาศไทย name and four primary routes. Light is the default; the optional saved dark theme remains available.

## Product Principles

- Present the place, weather, rain and PM2.5 before secondary tools.
- Show actual provider timestamps and explicit missing/stale states.
- Use model estimates with source attribution; never manufacture fallback readings.
- Keep touch controls usable and the desktop map useful for monitoring.

## Evidence on Hand

Source code, bundled province boundaries and district names, Open-Meteo documentation, provider responses, controlled regression tests and screenshots in artifacts/review. Test fixtures are synthetic and never part of production data.
