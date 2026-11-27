---
name: อากาศไทย
description: Bright, vibrant, readable Thai weather and national monitoring (v2).
colors:
  bg: "#eef7ff"
  surface: "#ffffff"
  surface-2: "#f1f8ff"
  surface-3: "#dceeff"
  ink: "#0f2942"
  ink-soft: "#33506d"
  muted: "#526e8a"
  line: "#d4e8fb"
  primary: "#0b74de"
  primary-vivid: "#0ea5e9"
  primary-hover: "#085cb5"
  primary-soft: "#e6f4ff"
  focus: "oklch(65% 0.2 244)"
  warning: "oklch(62% 0.13 73)"
  warning-soft: "oklch(95% 0.045 78)"
  danger: "oklch(55% 0.18 23)"
  danger-soft: "oklch(94% 0.04 23)"
typography:
  body:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", Tahoma, ui-sans-serif, system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  temperature:
    fontSize: "6rem"
    fontWeight: 550
    lineHeight: 1.1
    letterSpacing: "-0.045em"
  headline:
    fontSize: "clamp(1.55rem, 2.6vw, 2rem)"
    fontWeight: 750
    letterSpacing: "-0.015em"
  title:
    fontSize: "1.17rem"
    fontWeight: 700
  button:
    fontSize: "0.88rem"
    fontWeight: 600
rounded:
  field: "8px"
  control: "9px"
  strip: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-quiet:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  location-select:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
---

# Design System: อากาศไทย

## Overview

Bright, clean white and blue is the explicit user direction. The interface uses readable Thai typography, clear weather values and restrained surfaces. Mobile should be immediately understandable; desktop should support efficient monitoring.

Preserve the อากาศไทย identity and the four routes: วันนี้, แผนที่, ประกาศ and สถิติ. Light is the default, with the existing optional saved dark theme retained. This document records the implemented system, not an approved design comp or a new branding metaphor.

**Key Characteristics:**
- White panels on a pale blue canvas.
- Large weather numbers with readable Thai labels.
- Clear controls and compact monitoring views.

## Colors

Primary blue marks actions, selected navigation, weather details and links. Pale blue supports selected states and quiet controls. White, soft blue borders and dark blue text define the neutral surfaces. Warning and danger colors retain their semantic roles in notices and status feedback.

The frontmatter records the effective light-theme tokens from `src/weather.css`, plus shared semantic colors from `src/index.css`. The former loads last. Existing dark-theme overrides in `src/index.css` remain the authority for that optional mode; do not apply these light primitives indiscriminately to it.

## Typography

Use self-hosted Noto Sans Thai with the existing fallback stack for both Thai text and numbers. Weather values use tabular numerals. The large temperature is the clearest visual anchor; labels and source timestamps remain subordinate and readable.

On narrow weather layouts the temperature becomes 5rem and the page heading becomes 1.45rem. At widths up to 360px, the heading becomes 1.3rem. Avoid forcing Thai labels into uppercase or clipping important place names.

## Layout

The weather page has a maximum width of 1280px, with 32px desktop side clearance. Its main and lower sections use a 1.65:1 split with 20px gaps, reducing to 1.35:1 at 1050px. At 760px they become one column with 16px side clearance. Secondary readings change from six columns to three at 1050px and two at 360px.

The first weather view presents place, current temperature, rain and PM2.5. The 24-hour and seven-day forecasts follow; radar expands on request. These are the current weather-page composition, not a required template for every route.

Desktop navigation is a sticky 68px header. At 700px it changes to four fixed bottom destinations with safe-area spacing. The map places a province list beside the map on desktop; monitor mode widens that list to 410px and enlarges values. On mobile the map precedes the list. Retain monitoring controls and CSV access.

## Elevation & Depth

White panels, pale fills and thin borders provide most separation. The current-weather panel uses a subtle sky-blue gradient. Small selected forecast controls have a restrained shadow; the weather icon has a soft drop shadow. These local effects do not imply a shadow beneath every panel. Existing focus outlines must remain visible.

## Shapes

Panels and grouped readings use gently rounded corners. Smaller buttons and fields use tighter corners; map metric filters use pill shapes. Borders are thin and pale. Use the observed radius roles in the frontmatter rather than introducing a new radius scale.

## Components

- **Buttons:** Primary blue or quiet pale blue, with clear text or an accessible icon label. Weather actions have a minimum height of 44px. Hover deepens the fill; disabled actions reduce opacity. Preserve visible keyboard focus.
- **Fields:** Location selects use pale fills, a thin border, 16px text and a minimum height of 46px. Their expanded grid becomes one column on mobile.
- **Navigation:** Pair icons with Thai labels. Selected destinations use a pale blue fill and darker blue text. Preserve all four destinations in desktop and mobile navigation.
- **Panels:** White fill, thin border and generous internal spacing. Weather panels use 24px padding on desktop and 20px by 16px on mobile.
- **Forecast controls:** Temperature and rain selectors use a pale segmented track with a white selected segment. Hourly items scroll horizontally; daily rows align rain probability and temperature ranges.
- **Map filters and status:** Pill controls expose active state. Keep legends, actual timestamps, missing readings and model attribution readable; color alone must not substitute for a value or status label.
- **Radar:** A labeled disclosure with an arrow reveals the radar content. Preserve its expanded state indication and source context.

State transitions are short, generally 180–200ms. Honor the existing reduced-motion overrides.

## Do's and Don'ts

- **Do** preserve the bright white and blue direction and readable Thai hierarchy.
- **Do** keep source labels, timestamps and missing-data states visible.
- **Do** maintain the four routes and usable mobile navigation.
- **Don't** replace missing readings with invented values.
- **Don't** let decoration obscure weather values or monitoring controls.
- **Don't** turn the optional dark theme into the default visual direction.


## Semantic weather readings (16 November 2026)

Use the shared RiskValue component and riskScale.js across dashboard, daily statistics and monitoring. Keep the bright white/blue identity; semantic color belongs to readings and their labels. Light foregrounds are #155fa0 information, #166534 low/general, #075985 cold, #92400e watch, #9a3412 high, #b91c1c danger, #6b21a8 extreme and #536579 unavailable/stale. The optional dark theme uses lighter foregrounds, including on its dark blue current-weather surface.

Every scale has visible labels and an expandable reference legend. Rainfall classification only applies to 24-hour/calendar-day totals; 1–3-hour amounts remain informational. PM concentration bands only apply to 24-hour means; modeled values are explicitly estimates, not official AQI. Historical multi-day summary values stay neutral. Current humidity, pressure and apparent temperature do not inherit unsupported health thresholds. Cold and heat use separate ends of the temperature scale. Stale and missing values are grey.

Daily low/high temperatures are explicit in the first weather surface. Rain amounts lead the brief and hourly chart, while point probabilities stay secondary. Named mountain reference points retain coordinates, elevation and source. Actual station observations are presented separately with distance and measurement window. The radar surface contains historical frames and coverage status, without inferred ETA or confidence percentages.
