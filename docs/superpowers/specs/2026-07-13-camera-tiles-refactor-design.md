# Camera Tiles Refactor — Design

**Date:** 2026-07-13
**Branch:** `camera-tiles-refactor` (off `ui-tweaks`)
**Status:** Approved

## Goal

Replace the eager 62k-camera GeoJSON download with PMTiles-based vector tile
rendering for the default map view. The map should paint camera dots at
national zoom within a few hundred KB of network transfer, instead of waiting
on the full dataset. The full GeoJSON remains, but loads lazily — only when a
feature actually needs per-camera attributes (filters, timeline, heatmap,
Canada).

## Current state (for context)

- App eagerly downloads `data.dontgetflocked.com/cameras.geojson.gz` (~62k
  cameras), builds a spatial grid + timeline indexes in `cameraStore`, and
  renders clusters/points/glow/cones from in-memory GeoJSON sources.
- `cameras-local.pmtiles` (US only; Canada will be added later) is uploaded to
  the `flockhopper-tiles` R2 bucket behind `tiles.dontgetflocked.com`.
- Tile attributes exist only at z11+; below z11 tiles are geometry-only dots.
- **The deployed tiles worker currently throws (CF error 1101) on every
  route**, and it has no route that serves raw `.pmtiles` files with Range
  support. Both must be fixed as part of this work.
- The basemap already uses the client-side `pmtiles://` protocol (against
  `sanitas.deflock.org`), so the rendering pattern is proven in this app.

## Decisions made

| Decision | Choice |
|---|---|
| Data architecture | Hybrid: tiles-only by default; JSON loads lazily on demand |
| Clusters | Removed. Dot density at all low/mid zooms ("dots all the way") |
| Glow layer | Removed everywhere (perf) |
| Cones | Kept, z12+, same styling as today |
| Background full-file (~40MB) prefetch | **Deferred** — future optimization (saves worker requests). v1 is per-tile range requests only |
| Canada | Stays on the existing GeoJSON path until it's in the tileset |
| Header camera count | Tiles mode shows total dataset count; viewport count returns once JSON is loaded |

## Architecture

### 1. Server — `flockhopper-tiles` worker

- Diagnose and fix the current 1101 exception (all routes 500 today,
  including `/basemap.json`). Verify with `wrangler tail` + redeploy from the
  repo source.
- Add raw-archive route: `GET`/`HEAD` `/{name}.pmtiles`
  - Pass the `Range` header through to R2 (`bucket.get(key, { range })`).
  - Respond `206 Partial Content` with `Content-Range`, `Content-Length`,
    `ETag`, `Accept-Ranges: bytes`.
  - CORS: allow `Range` request header; expose `ETag`, `Content-Range`,
    `Content-Length`.
  - Do **not** edge-cache range responses (Cache API doesn't handle 206);
    R2 reads are cheap and the browser caches aggressively.
- Existing `/{name}/{z}/{x}/{y}.mvt` and `/{name}.json` routes stay as
  debug/fallback endpoints.

### 2. Client — `src/services/cameraTilesService.ts` (new)

- Owns the shared pmtiles `Protocol` instance (moved out of
  `MapLibreContainer` module scope; basemap registration unchanged).
- Exposes the camera tiles URL
  (`pmtiles://https://tiles.dontgetflocked.com/cameras-local.pmtiles`) and the
  source-layer name (read from the archive's TileJSON/metadata once, at
  build time of this feature — hardcoded constant thereafter).
- ETag revalidation for data updates is handled by the pmtiles protocol and
  browser cache; no custom versioning.
- (Future, out of scope for v1: background full-file prefetch that swaps an
  in-memory source into the protocol under the same URL key.)

### 3. Rendering — `src/components/map/layers/CameraTileLayers.tsx` (new)

One vector source, three zoom bands, replacing `CameraMarkerLayers` when in
tiles mode:

- **z0–z10 — density dots.** Small circles, no stroke, current dot-density
  color; radius and opacity interpolated by zoom so national level reads as
  dot density and mid-zoom stays legible. No clusters, no glow.
- **z11+ — camera points.** Current unclustered point style (blue core +
  light stroke), crossfaded in from the dots band.
- **z12+ — direction cones.** Cone polygons cannot come from tile geometry,
  so: on map idle at zoom ≥ 11.5 (debounced), `querySourceFeatures` on the
  camera source-layer, build cone GeoJSON client-side from `direction` /
  `directions` attributes (available at z11+), set into a local GeoJSON
  source. Same fill/outline paint and minzoom 12 as today. Only ever a
  viewport's worth of cones.
- **Click/popups** use tile feature properties via `queryRenderedFeatures`
  at z11+ (below z11 dots are too small to be meaningful click targets, and
  attributes don't exist anyway). Property names adapted to the tile schema.

### 4. Mode switching — `cameraRenderMode`

Derived value: `'tiles' | 'geojson'`.

`geojson` when ANY of:
- camera filters are active (brand/operator/zone/mount)
- app mode is Explore (timeline playback)
- app mode is Heatmap
- selected country is Canada

Otherwise `tiles`.

Transition rules (the edge cases):
- Opening the filter panel or entering Explore/Heatmap calls
  `ensureCamerasLoaded()` (existing lazy path). **Tile layers stay visible
  until the JSON dataset is hydrated**, then visibility swaps — never a
  blank map mid-download.
- The filter panel shows an inline loading state until
  `availableBrands`/`availableOperators` exist (it already can't render its
  lists without them).
- Clearing all filters or leaving Explore/Heatmap swaps back to tiles
  instantly; the tile source never unmounts.
- Country → Canada uses the existing GeoJSON flow unchanged; country → US
  returns to tiles.
- Startup no longer calls `preloadCameras()` — the eager background JSON
  fetch is removed from the boot path.

### 5. Loading experience

- `MapLoadingScreen` gates on map style readiness + first camera tile source
  data, not on the camera JSON load phase.
- Header camera count: in tiles mode, show total dataset count (single
  lightweight fetch of `/{name}.json` TileJSON metadata, or constant if the
  metadata lacks a count); once JSON is loaded for any reason, the existing
  viewport count logic takes over.

### 6. Error handling / resilience

- If the camera tile source errors fatally (worker down, archive missing),
  fall back automatically to the legacy JSON rendering path — the code
  remains for filters/timeline anyway, so the app degrades to exactly
  today's behavior.
- Tile-level 404s/aborts are normal pmtiles protocol behavior; ignored.
- JSON lazy-load failures keep their existing retry UI.

## Not in scope (explicitly)

- Background full-file prefetch / in-memory swap (future optimization).
- Heatmap changes — heatmap mode keeps the JSON path as-is.
- Canada in the tileset (data work, later).
- Any styling changes beyond: clusters removed, glow removed, dots band added.

## Testing

- Worker: `curl` checks — 206 with correct `Content-Range`/`ETag`/CORS on
  ranged requests, 200 on full GET, HEAD support; tile + TileJSON routes
  healthy again.
- Client: Playwright (repo `verify` skill) —
  - map paints camera dots at national zoom with no `cameras.geojson.gz`
    request in the network log;
  - zoom to z12+: points + cones render, popup opens with metadata;
  - apply a brand filter: JSON loads, rendering swaps with no blank frame,
    filtered points shown; clear filter: back to tiles;
  - Explore mode timeline still plays (JSON path);
  - kill the tiles host (route override): map falls back to JSON rendering.
