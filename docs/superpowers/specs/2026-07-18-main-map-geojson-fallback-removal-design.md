# Main-map GeoJSON fallback removal

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan

## Problem

The full camera GeoJSON dataset (~114k features, multi-MB) is the only render
path that does per-frame work scaling with feature count: in geojson mode
`onMove` runs `updateVisibleCameras()` every drag tick over the whole
FeatureCollection held in memory. The default tiles path has no per-tick work
and cannot pin a core.

Two fallback paths can silently drop the plain map and route views into that
geojson path without the user asking for it:

1. **Tiles failure** — `resolveCameraRenderMode` sets `needsGeojson` when
   `tilesFailed` is true, so 3 camera-tile errors route the main map into a
   full geojson hydration.
2. **Filter failure** — the `attributeFiltersActive` branch falls back to
   geojson when `manifestPhase === 'error'` or `filterTilesFailed`.

Both are reachable from views that should never carry the CPU cost of the full
dataset. A related defect compounds this: when tiles fail, the mode flip to
geojson disarms MapPage's 15s init watchdog (`watchdogArmed = !needsGeojson ||
(isInitialized && cameras.length > 0)`), so a total outage can leave a blank
faded map with no error surface.

## Goal

Make it structurally impossible to load the camera GeoJSON from the plain map
or route views. GeoJSON stays available only for the modes that genuinely need
per-camera attributes at all zooms: Timeline/Explore, and the heatmap
visualization. When camera tiles cannot load, the basemap stays usable and a
non-blocking retry pill appears instead of any geojson load or full-screen
error.

## Scope

- In scope: `appMode === 'map'` and `appMode === 'route'` (route rides with
  map).
- Out of scope, unchanged: Timeline/Explore (`appMode === 'explore'` /
  `timelineActive`) and heatmap (`map + mapModeViz === 'heatmap'`) continue to
  load GeoJSON. `ensureCamerasLoaded` itself is not removed; only its triggers
  from map/route are fenced off.

## Design

### 1. Render-mode logic — `src/hooks/cameraRenderModeLogic.ts`

- Remove `i.tilesFailed` from `needsGeojsonBase`. The only inputs that yield
  `needsGeojson: true` become `timelineActive`, `appMode === 'explore'`, and
  `appMode === 'map' && mapModeViz === 'heatmap'`. A tiles failure leaves the
  mode at `'tiles'`; the failed source renders nothing until a retry succeeds.
- In the `attributeFiltersActive` branch, replace the
  `manifestPhase === 'error' || filterTilesFailed` geojson return with a
  fall-through to plain unfiltered `'tiles'`. Filtering without geojson is
  impossible, so a broken filter degrades to "all cameras shown" plus a notice
  (see 3), never to geojson.
- `tilesFailed` and `filterTilesFailed` become pill signals only, not routing
  signals.

### 2. Hard guard — `src/hooks/useCameraRenderMode.ts`

Add an explicit predicate
`isGeojsonMode = timelineActive || appMode === 'explore' ||
(appMode === 'map' && mapModeViz === 'heatmap')` and gate the
`ensureCamerasLoaded()` effect on it, so a stray future flip of `tilesFailed`
cannot hydrate geojson on a plain map/route view. This is the structural
guarantee behind the goal: removal of today's triggers plus a fence that keeps
the path unreachable.

### 3. Failure UX

**Reveal the basemap — `src/components/map/MapLibreContainer.tsx`.**
`markersReady` (which gates both the map fade-in and the watchdog) is currently
set only when the camera source loads or the geojson pipeline finishes. Add an
effect: when `mapLoaded` (basemap ready) is true and `tilesFailed` is true, set
`markersReady(true)`. The interactive basemap fades in even though cameras did
not load.

**Two non-blocking pills** (new component in the `StatusPill` / `PILL_BASE`
family, rendered in MapPage alongside `LoadingPill`):

- Camera tiles failed. Copy: `Camera layer unavailable. Tap to retry.`
  Shown when `tilesFailed` on a map/route context.
- Filter tiles or manifest failed while a filter is active. Copy:
  `Filters unavailable. Showing all cameras. Tap to retry.` Cameras render
  unfiltered underneath (per section 1).

Precedence: the camera-tiles-failed pill wins over the filter pill; if no
cameras load at all, the filter notice is moot. Copy uses plain declarative
sentences with no em dashes, per project copy style.

**Retry action.** The camera-tiles pill reuses the existing remount pipeline
(`handleRetryWithRemount` -> `mapKey` bump), which resets the tile error
counters (the `mapKey` effect) and re-requests the archive fresh. Because
`needsGeojson` is false on map/route, that handler's
`if (needsGeojson) retryCameraLoad()` branch is skipped, so a retry reloads
tiles only. The filter pill's retry resets `filterTilesFailed`, sets `manifestPhase` back
to `idle`, and calls `ensureManifestLoaded()`; when the manifest resolves, the
filter-tiles path resumes on the next render-mode resolution.

### 4. Watchdog, corrected — `src/pages/MapPage.tsx`

With `needsGeojson` staying false on map/route, `watchdogArmed` stays true and
the reveal effect flips `markersReady` as soon as the basemap loads, so the 15s
deadline clears normally on a camera-tile failure (pill, not error screen). The
full-screen `MapLoadingScreen` now fires only when the basemap itself never
loads within 15s (WebGL unavailable, or the whole tiles host down so even the
basemap fails). This closes the watchdog-disarm gap: basemap up + cameras down
yields a pill; basemap down yields the error screen.

## Data flow (main map, tiles fail)

tiles error x3 -> `setTilesFailed(true)` -> render mode stays `'tiles'` (no
geojson) -> basemap revealed + retry pill shown -> user taps retry (or
auto-retry via watchdog) -> tiles reload -> cameras appear. GeoJSON is never
fetched anywhere in that path.

## Testing

- Unit — extend `src/hooks/cameraRenderModeLogic.test.ts`:
  - `tilesFailed` on map/route -> `'tiles'`, `needsGeojson: false`.
  - filter active + `filterTilesFailed` / `manifestPhase === 'error'` ->
    `'tiles'` unfiltered, `needsGeojson: false`.
  - timeline / explore / heatmap -> `needsGeojson: true` even with
    `tilesFailed`.
- Unit — hook guard: `ensureCamerasLoaded` not called on map/route under
  `tilesFailed`; still called for explore / timeline / heatmap.
- E2E via the `flockhopper 3:verify` skill: block `tiles.dontgetflocked.com`,
  assert basemap visible, pill shown, and no `cameras.geojson.gz` request. The
  last assertion is the guarantee that the CPU path is unreachable.

## Risks and trade-offs

- Removing the tiles-failure fallback removes genuine resilience: if the tiles
  archive is broken but the geojson endpoint is healthy, the main map now shows
  no cameras (pill) rather than recovering via geojson. Accepted: the geojson
  recovery pegs CPU, and a clear retry affordance is preferable to a silent
  CPU-pegging degrade.
- A broken filter now shows all cameras unfiltered with a notice, which is less
  precise than the old client-side geojson filter. Accepted for the same
  reason; filter-tile failures are rare (same host as the basemap).
