---
name: verify
description: Build, launch, and drive DeFlock Maps (Vite React SPA) to verify changes end-to-end with Playwright.
---

# Verifying DeFlock Maps changes

## Launch

```bash
npm run dev   # wants port 3000; falls back to 3001+ if taken
```

**Gotcha — CORS:** external APIs (`data.dontgetflocked.com`, `sanitas.deflock.org`, `api.deflock.org`) only allow origin `http://localhost:3000`. If the dev server lands on another port, the app shows "Couldn't Load Map". Fix in Playwright by proxying those hosts through `page.route()` with `route.fetch()` + injected `access-control-allow-origin: *` header (also answer OPTIONS preflights with 204 + permissive headers). Do NOT use `--disable-web-security` — it breaks the basemap's pmtiles HTTP range requests.

## Drive

- Default app mode is **Map**. Desktop: click the `ROUTE` header tab. Mobile: tap the `Route` pill inside `[role="dialog"]` (the bottom sheet).
- `AddressSearch` inputs only geocode on **Enter** or the search button — typing alone shows no suggestions. Flow: fill → press Enter → click suggestion in the dropdown (`button/li` filtered by place name). Give geocoding up to 20s (primary geocoder may be CORS-blocked locally; Nominatim/Photon fallback kicks in).
- Good fast test route: "Denton, TX" → "Frisco, TX" (~30s calculation).
- Mobile viewport: 390x844, `hasTouch: true`, iPhone UA. The bottom sheet is `[role="dialog"]`; expand by mouse-dragging the header area upward (header/strip tap is disabled — dragging is the only way to expand). After route calculation the sheet should snap to ~180px (peek, `UNIFORM_PEEK_HEIGHT`) with the route visible on the map.

## Verify checkpoints

- Desktop empty state (Route tab): FlockHopper header with App Store / Android Beta buttons.
- Desktop results: "Drive this route with live navigation" card between the camera-reduction success banner and the "Start over" button. There is no GPX export button.
- Mobile results: once routes calculate, the floating search inputs are replaced by the RouteScoreboard card (DIRECT / PRIVACY halves with camera counts, a green verdict line, the "maps.deflock.org" watermark, and an "Edit route" button that brings the inputs back); the user's addresses are hidden from view. A "Back to results" button appears while editing if routes still exist.
- Mobile peek: sheet height ≈ 180px (`UNIFORM_PEEK_HEIGHT`). Shows the FlockHopper wordmark ad with a "Free · iOS & Android" label, one-liner, and full-width red "Navigate this route in the app" button linking to the platform store URL — there is no summary strip and no "Get FlockHopper" row, and nothing in the peek is tap-to-expand; expand by dragging the sheet header.
- Mobile floating card: focusing an empty field opens a quick-actions dropdown — "Use my location" (origin field only) and "Choose on map" (either field). A standalone "Choose on map" pill also sits under the card (guided two-tap sequence); it hides while picking, while a dropdown is open, and while the scoreboard is showing.

Working script from 2026-07-11 session: see `verify-flockhopper.mjs` pattern (Playwright, chromium, CORS proxy routes).

**Gotcha — WIP-contaminated tree:** if the working tree has unrelated uncommitted WIP, the dev server serves committed+WIP combined; a failure may not be the branch's. Isolate with a git worktree at the commit under test: `git worktree add /tmp/check <sha>`, symlink the main repo's `node_modules` into it, `npx vite --port 3010 --strictPort`, and use the CORS proxy (non-3000 port). Remove the symlink before `git worktree remove`.

**Gotcha — map-tap tests:** the route tab starts at nationwide zoom; blind map clicks pick unroutable points hundreds of miles apart (slow/failing calcs). Zoom to a metro first (search-pick e.g. "denton", then clear the field) before tapping the map.
