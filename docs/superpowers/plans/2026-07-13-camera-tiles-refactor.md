# Camera Tiles Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render camera dots from PMTiles vector tiles so the map paints instantly, with the 62k-camera GeoJSON loading lazily only when filters/timeline/heatmap/Canada need it.

**Architecture:** MapLibre reads `pmtiles://https://tiles.dontgetflocked.com/cameras.pmtiles` via the client-side pmtiles protocol (range requests). A `cameraRenderMode` (`'tiles' | 'geojson'`) derived hook decides which rendering path is visible; the GeoJSON path stays mounted but empty until a feature triggers `ensureCamerasLoaded()`. The tiles worker gains a raw-archive route with Range support and stops crashing on missing R2 keys.

**Tech Stack:** React 18 + TypeScript, MapLibre GL / react-map-gl, Zustand, pmtiles v4, Cloudflare Worker + R2.

## Global Constraints

- Camera archive: R2 key `cameras.pmtiles` (NOT `cameras-local` — verified it does not exist). Served at `https://tiles.dontgetflocked.com`.
- Source-layer name inside the archive: `cameras`. Tile zooms 0–14. Attributes (brand, operator, direction, directions, directionCardinal, mountType, ref, startDate, surveillanceZone, osmId, osmType, osmTimestamp, osmVersion) exist **only at z11+**; z0–10 tiles are geometry-only. `directions` arrives as a JSON-encoded string (e.g. `"[90,270]"`).
- No glow layer anywhere. No cluster layers anywhere. Cones keep today's paint (`fill-color #4DA6FF` / 0.35, outline `#0080BC` / width 2 / 0.7) with minzoom 12.
- No background full-file prefetch in v1 (deferred per spec).
- The frontend repo has NO unit-test framework. Verification per task = `npm run build` (tsc) + `npm run lint` + browser/curl checks as specified. Final task runs end-to-end Playwright verification via the repo `verify` skill.
- Working dir for frontend: `flockhopper 3/`. Worker dir: `flockhopper 3/flockhopper-tiles/`.
- Branch: `camera-tiles-refactor`. Commit after every task.

---

### Task 1: Worker — graceful 404s + raw `.pmtiles` Range route

**Files:**
- Modify: `flockhopper-tiles/src/index.js` (the handler section at the bottom, lines ~965–1074 — this file is a compiled bundle but is the deployed source; edit it directly)

**Interfaces:**
- Produces: `GET/HEAD https://tiles.dontgetflocked.com/{name}.pmtiles` honoring `Range: bytes=a-b` with `206`, `Content-Range`, `ETag`, `Accept-Ranges`, CORS. This is what the pmtiles JS `FetchSource` requires in Task 2+.

**Context:** The deployed worker currently throws (CF error 1101) whenever an R2 key is missing, because `R2Source.getBytes` throws and nothing catches it. It also has no raw-file route.

- [ ] **Step 1: Widen CORS exposed headers**

In `corsHeaders()` (around line 960), replace:

```js
  headers.set("Access-Control-Expose-Headers", "ETag");
```

with:

```js
  headers.set(
    "Access-Control-Expose-Headers",
    "ETag, Content-Range, Content-Length, Accept-Ranges"
  );
```

- [ ] **Step 2: Add the raw-archive route and top-level error guard**

In the `fetch` handler, wrap the origin-fetch section in try/catch and add the raw route as the FIRST branch after the fonts/sprites branch. The structure becomes:

```js
    // --- Origin fetch (R2) ---
    const path = url.pathname;
    let response;

    try {
      if (path.startsWith("/fonts/") || path.startsWith("/sprites/")) {
        // ... existing fonts/sprites branch unchanged ...
      } else if ((rawMatch = path.match(/^\/([^/]+)\.pmtiles$/))) {
        var rawMatch;
        const key = `${rawMatch[1]}.pmtiles`;

        if (request.method === "HEAD") {
          const head = await env.BUCKET.head(key);
          if (!head) return new Response("Not found", { status: 404, headers: cors });
          const headers = new Headers(cors);
          headers.set("Content-Type", "application/octet-stream");
          headers.set("Content-Length", String(head.size));
          headers.set("Accept-Ranges", "bytes");
          headers.set("ETag", head.httpEtag);
          return new Response(null, { status: 200, headers });
        }

        const rangeHeader = request.headers.get("Range");
        if (rangeHeader) {
          // Support bytes=a-b, bytes=a-, and bytes=-n (suffix)
          const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
          if (!m || (m[1] === "" && m[2] === "")) {
            return new Response("Invalid range", { status: 416, headers: cors });
          }
          let r2range;
          if (m[1] === "") {
            r2range = { suffix: Number(m[2]) };
          } else if (m[2] === "") {
            r2range = { offset: Number(m[1]) };
          } else {
            r2range = { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
          }
          const obj = await env.BUCKET.get(key, { range: r2range });
          if (!obj) return new Response("Not found", { status: 404, headers: cors });
          const total = obj.size;
          const start = m[1] === "" ? total - Number(m[2]) : Number(m[1]);
          const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), total - 1) : total - 1;
          const headers = new Headers(cors);
          headers.set("Content-Type", "application/octet-stream");
          headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
          headers.set("Content-Length", String(end - start + 1));
          headers.set("Accept-Ranges", "bytes");
          headers.set("ETag", obj.httpEtag);
          headers.set("Cache-Control", "public, max-age=86400");
          // 206 responses must NOT go through cfCache.put (throws on partial content)
          return new Response(obj.body, { status: 206, headers });
        }

        const obj = await env.BUCKET.get(key);
        if (!obj) return new Response("Not found", { status: 404, headers: cors });
        const headers = new Headers(cors);
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Length", String(obj.size));
        headers.set("Accept-Ranges", "bytes");
        headers.set("ETag", obj.httpEtag);
        headers.set("Cache-Control", "public, max-age=86400");
        response = new Response(obj.body, { status: 200, headers });
      } else if ((tileMatch = path.match(
        // ... existing tile branch unchanged ...
```

and close the try after the final `else` (the "Not found. Routes:" branch), adding:

```js
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found|does not exist/i.test(msg)) {
        return new Response("Not found", { status: 404, headers: cors });
      }
      return new Response(`Worker error: ${msg}`, { status: 500, headers: cors });
    }
```

Also update the fallback 404 message to include the new route:

```js
      "Not found. Routes: /{name}.pmtiles, /{name}/{z}/{x}/{y}.mvt, /{name}.json, /fonts/*, /sprites/*",
```

Note: `var rawMatch;`/`var tileMatch;` hoisting matches the existing bundle style — keep it consistent (declare `var rawMatch` inside the branch exactly as the existing `var tileMatch` is done).

- [ ] **Step 3: Deploy**

```bash
cd "flockhopper 3/flockhopper-tiles" && npx wrangler deploy
```

Expected: deploy succeeds, prints the tiles.dontgetflocked.com route.

- [ ] **Step 4: Verify with curl**

```bash
# Range request → 206 with correct headers
curl -sI -H "Range: bytes=0-16383" https://tiles.dontgetflocked.com/cameras.pmtiles | grep -iE "HTTP|content-range|content-length|etag|accept-ranges|access-control"
# Expected: HTTP/2 206, content-range: bytes 0-16383/<total>, content-length: 16384, etag present,
#           access-control-expose-headers includes Content-Range

# Missing key → clean 404 (was 1101/500 before)
curl -s -o /dev/null -w "%{http_code}\n" https://tiles.dontgetflocked.com/nonexistent.json
# Expected: 404

# Existing routes still healthy
curl -s -o /dev/null -w "%{http_code}\n" https://tiles.dontgetflocked.com/cameras.json
# Expected: 200

# HEAD works
curl -sI https://tiles.dontgetflocked.com/cameras.pmtiles | head -1
# Expected: HTTP/2 200
```

- [ ] **Step 5: Commit**

```bash
git add flockhopper-tiles/src/index.js
git commit -m "feat(tiles-worker): raw pmtiles Range route + graceful 404s for missing R2 keys"
```

---

### Task 2: Client foundation — cameraTilesService + shared camera geometry module

**Files:**
- Create: `src/services/cameraTilesService.ts`
- Create: `src/components/map/layers/cameraGeometry.ts`
- Modify: `src/components/map/MapLibreContainer.tsx:69-75` (Protocol creation)
- Modify: `src/components/map/layers/CameraMarkerLayers.tsx:8-59` (remove local `createDirectionCone`, import shared)
- Modify: `src/services/index.ts` (re-export new service)

**Interfaces:**
- Produces:
  - `cameraTilesService`: `CAMERA_TILES_URL: string` (`pmtiles://…/cameras.pmtiles`), `CAMERA_TILES_SOURCE_LAYER = 'cameras'`, `CAMERA_TILES_MAXZOOM = 14`, `CAMERA_METADATA_MINZOOM = 11`, `ensurePMTilesProtocol(): Protocol`
  - `cameraGeometry`: `createDirectionCone(lon: number, lat: number, direction: number): GeoJSON.Feature<GeoJSON.Polygon>` (same body as the current one in CameraMarkerLayers, defaults included), `parseDirections(direction: number | null | undefined, directions: unknown): number[]`

- [ ] **Step 1: Create `src/services/cameraTilesService.ts`**

```ts
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

/**
 * Camera vector tiles served as a raw PMTiles archive from the
 * flockhopper-tiles worker (R2-backed, Range requests).
 *
 * Archive facts (from its TileJSON):
 * - source-layer: 'cameras', zooms 0-14
 * - z0-10 tiles are geometry-only (built with --exclude-all)
 * - z11+ tiles carry full attributes for popups/cones
 */
export const CAMERA_TILES_HOST = 'https://tiles.dontgetflocked.com';
export const CAMERA_TILES_ARCHIVE = `${CAMERA_TILES_HOST}/cameras.pmtiles`;
export const CAMERA_TILES_URL = `pmtiles://${CAMERA_TILES_ARCHIVE}`;
export const CAMERA_TILES_SOURCE_LAYER = 'cameras';
export const CAMERA_TILES_MAXZOOM = 14;
/** Below this zoom, tile features have no attributes (no osmId, no direction). */
export const CAMERA_METADATA_MINZOOM = 11;

let _protocol: Protocol | null = null;

/** Register the shared pmtiles protocol exactly once (basemap + camera tiles). */
export function ensurePMTilesProtocol(): Protocol {
  if (!_protocol) {
    _protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', _protocol.tile.bind(_protocol));
  }
  return _protocol;
}
```

- [ ] **Step 2: Create `src/components/map/layers/cameraGeometry.ts`**

Move `createDirectionCone` from `CameraMarkerLayers.tsx` (lines 10–59) verbatim into this file and export it. Add:

```ts
/**
 * Normalize a camera's bearing(s). `directions` may be a real array (from the
 * GeoJSON dataset) or a JSON-encoded string like "[90,270]" (from vector
 * tiles, where tippecanoe stringifies array attributes).
 */
export function parseDirections(
  direction: number | null | undefined,
  directions: unknown
): number[] {
  if (Array.isArray(directions) && directions.length > 1) {
    return directions.filter((d): d is number => Number.isFinite(d));
  }
  if (typeof directions === 'string' && directions.length > 0) {
    try {
      const parsed = JSON.parse(directions);
      if (Array.isArray(parsed)) {
        const nums = parsed.map(Number).filter(Number.isFinite);
        if (nums.length > 1) return nums;
      }
    } catch {
      // fall through to single direction
    }
  }
  return direction !== null && direction !== undefined && Number.isFinite(direction)
    ? [direction]
    : [];
}
```

- [ ] **Step 3: Rewire imports**

- `CameraMarkerLayers.tsx`: delete its local `createDirectionCone` (lines 8–59), add `import { createDirectionCone, parseDirections } from './cameraGeometry';` and replace the inline multi-direction logic in `directionConesData` (lines 336–347):

```ts
    const features: GeoJSON.Feature[] = [];
    for (const camera of camerasWithDirection) {
      const bearings = parseDirections(camera.direction, camera.directions);
      const ts = camera.osmTimestamp ? new Date(camera.osmTimestamp).getTime() : 0;
      for (const bearing of bearings) {
        const cone = createDirectionCone(camera.lon, camera.lat, bearing);
        cone.properties = { ...cone.properties, ts };
        features.push(cone);
      }
    }
```

- `MapLibreContainer.tsx`: remove lines 70–75 (`import { Protocol } from 'pmtiles';`, `const TILES_URL…` stays, `const _pmtilesProtocol…`, `maplibregl.addProtocol…`) and replace the protocol setup with:

```ts
import { ensurePMTilesProtocol } from '../../services/cameraTilesService';

const TILES_URL = "https://sanitas.deflock.org";

ensurePMTilesProtocol();
```

- `src/services/index.ts`: add `export * from './cameraTilesService';`

- [ ] **Step 4: Verify build**

```bash
cd "flockhopper 3" && npm run build
```

Expected: clean tsc + vite build. Then `npm run dev`, load http://localhost:3000 — basemap renders exactly as before (protocol still registered once).

- [ ] **Step 5: Commit**

```bash
git add src/services/cameraTilesService.ts src/services/index.ts src/components/map/layers/cameraGeometry.ts src/components/map/layers/CameraMarkerLayers.tsx src/components/map/MapLibreContainer.tsx
git commit -m "feat: cameraTilesService with shared pmtiles protocol + shared cone geometry"
```

---

### Task 3: Render-mode logic — store flag + useCameraRenderMode hook

**Files:**
- Modify: `src/store/cameraStore.ts` (add `tilesFailed` state + `setTilesFailed` action)
- Create: `src/hooks/useCameraRenderMode.ts`

**Interfaces:**
- Consumes: `useCameraStore` (`country`, `filters`, `isInitialized`, `tilesFailed`, `ensureCamerasLoaded`), `useAppModeStore` (`appMode`), `useMapModeStore` (`visualization`)
- Produces: `useCameraRenderMode(): { renderMode: 'tiles' | 'geojson'; needsGeojson: boolean }`
  - `needsGeojson` = the app currently wants attribute-dependent rendering
  - `renderMode` = what to actually show right now (`'tiles'` until the JSON is hydrated, so there is never a blank map during the swap)
  - The hook itself triggers `ensureCamerasLoaded()` when `needsGeojson` becomes true — callers don't have to.

- [ ] **Step 1: Add `tilesFailed` to cameraStore**

In the `CameraState` interface add:

```ts
  /** Set when the camera tile source fails repeatedly before ever loading —
   *  forces the legacy GeoJSON rendering path as a fallback. */
  tilesFailed: boolean;
  setTilesFailed: (failed: boolean) => void;
```

In the store implementation add (near the other simple state):

```ts
  tilesFailed: false,
  setTilesFailed: (failed: boolean) => set({ tilesFailed: failed }),
```

- [ ] **Step 2: Create `src/hooks/useCameraRenderMode.ts`**

```ts
import { useEffect } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { useAppModeStore } from '../store/appModeStore';
import { useMapModeStore } from '../store/mapModeStore';

export type CameraRenderMode = 'tiles' | 'geojson';

/**
 * Decides which camera rendering path is active.
 *
 * geojson is needed when a feature depends on per-camera attributes at all
 * zooms (tiles only carry attributes at z11+):
 * - brand/operator/zone/mount filters active
 * - Explore mode (timeline playback / heatmap / dots)
 * - map-mode heatmap visualization
 * - Canada (not in the tileset yet)
 * - tile source failed (resilience fallback)
 *
 * renderMode stays 'tiles' until the JSON dataset is hydrated so the swap
 * never blanks the map mid-download.
 */
export function useCameraRenderMode(): {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
} {
  const country = useCameraStore(s => s.country);
  const filters = useCameraStore(s => s.filters);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const tilesFailed = useCameraStore(s => s.tilesFailed);
  const appMode = useAppModeStore(s => s.appMode);
  const mapModeViz = useMapModeStore(s => s.visualization);

  const filtersActive = !filters.showAll || !!filters.timelineDate;
  const needsGeojson =
    tilesFailed ||
    country === 'ca' ||
    filtersActive ||
    appMode === 'explore' ||
    (appMode === 'map' && mapModeViz === 'heatmap');

  // Lazily hydrate the JSON dataset the moment anything needs it
  useEffect(() => {
    if (needsGeojson) {
      void useCameraStore.getState().ensureCamerasLoaded();
    }
  }, [needsGeojson]);

  return {
    renderMode: needsGeojson && isInitialized ? 'geojson' : 'tiles',
    needsGeojson,
  };
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build && npm run lint
```

Expected: clean (hook not yet consumed — that's fine, tsc allows unused exports).

- [ ] **Step 4: Commit**

```bash
git add src/store/cameraStore.ts src/hooks/useCameraRenderMode.ts
git commit -m "feat: cameraRenderMode hook — tiles by default, geojson on demand"
```

---

### Task 4: CameraTileLayers + MapLibreContainer integration

**Files:**
- Create: `src/components/map/layers/CameraTileLayers.tsx`
- Modify: `src/components/map/MapLibreContainer.tsx` (mount tile layers, renderMode wiring, interactiveLayerIds, onClick tile branch, markersReady/tile-failure listeners, drop map-mode auto heatmap)

**Interfaces:**
- Consumes: Task 2 service constants + `createDirectionCone`/`parseDirections`; Task 3 `useCameraRenderMode`, `setTilesFailed`.
- Produces: layer ids `'camera-tile-dots'`, `'camera-tile-points'`, `'camera-tile-cones'`, `'camera-tile-cones-outline'`; source ids `'camera-tiles'` (vector) and `'camera-tile-cones'` (geojson). Component: `<CameraTileLayers visible={boolean} />`.

- [ ] **Step 1: Create `src/components/map/layers/CameraTileLayers.tsx`**

```tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import {
  CAMERA_TILES_URL,
  CAMERA_TILES_SOURCE_LAYER,
  CAMERA_TILES_MAXZOOM,
} from '../../../services/cameraTilesService';
import { createDirectionCone, parseDirections } from './cameraGeometry';

/** Zoom where cones start being built (slightly before their minzoom 12). */
const CONE_BUILD_MINZOOM = 11.5;
const CONE_FEATURE_CAP = 4000;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Camera rendering straight from vector tiles — no client-side dataset.
 * Three zoom bands, one source:
 *  z0–11:  density dots (tiny, semi-transparent; overlaps read as density)
 *  z11–12: dots crossfade out, full camera points fade in
 *  z12+:   direction cones (built client-side from tile attributes)
 */
const dotLayer: maplibregl.LayerSpecification = {
  id: 'camera-tile-dots',
  type: 'circle',
  source: 'camera-tiles',
  'source-layer': CAMERA_TILES_SOURCE_LAYER,
  maxzoom: 12,
  paint: {
    'circle-color': '#4DA6FF',
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, 1,
      4, 1.5,
      7, 2.2,
      10, 3.5,
      11.9, 5,
    ],
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      0, 0.5,
      8, 0.6,
      10.5, 0.75,
      11, 0.75,
      12, 0,
    ],
    'circle-stroke-width': 0,
  },
};

const pointLayer: maplibregl.LayerSpecification = {
  id: 'camera-tile-points',
  type: 'circle',
  source: 'camera-tiles',
  'source-layer': CAMERA_TILES_SOURCE_LAYER,
  minzoom: 11,
  paint: {
    'circle-color': '#0080BC',
    'circle-radius': 6,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#93CBFF',
    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
    'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
  },
};

const coneLayer: maplibregl.LayerSpecification = {
  id: 'camera-tile-cones',
  type: 'fill',
  source: 'camera-tile-cones',
  minzoom: 12,
  paint: { 'fill-color': '#4DA6FF', 'fill-opacity': 0.35 },
};

const coneOutlineLayer: maplibregl.LayerSpecification = {
  id: 'camera-tile-cones-outline',
  type: 'line',
  source: 'camera-tile-cones',
  minzoom: 12,
  paint: { 'line-color': '#0080BC', 'line-width': 2, 'line-opacity': 0.7 },
};

export function CameraTileLayers({ visible }: { visible: boolean }) {
  const { current: mapInstance } = useMap();
  const [conesData, setConesData] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const debounceRef = useRef<number | null>(null);

  const rebuildCones = useCallback(() => {
    const map = mapInstance?.getMap();
    if (!map) return;
    if (!visible || map.getZoom() < CONE_BUILD_MINZOOM) {
      setConesData(prev => (prev.features.length === 0 ? prev : EMPTY_FC));
      return;
    }
    if (!map.getSource('camera-tiles')) return;

    const rendered = map.querySourceFeatures('camera-tiles', {
      sourceLayer: CAMERA_TILES_SOURCE_LAYER,
    });

    // Tiles duplicate features in buffers — dedupe by osmId (present at z11+)
    const seen = new Set<number>();
    const features: GeoJSON.Feature[] = [];
    for (const f of rendered) {
      const props = f.properties;
      if (!props || props.osmId == null || seen.has(props.osmId)) continue;
      seen.add(props.osmId);
      const bearings = parseDirections(
        props.direction as number | undefined,
        props.directions
      );
      if (bearings.length === 0) continue;
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
      for (const bearing of bearings) {
        features.push(createDirectionCone(lon, lat, bearing));
        if (features.length >= CONE_FEATURE_CAP) break;
      }
      if (features.length >= CONE_FEATURE_CAP) break;
    }
    setConesData({ type: 'FeatureCollection', features });
  }, [mapInstance, visible]);

  // Rebuild cones when tiles finish loading or the camera stops moving
  useEffect(() => {
    const map = mapInstance?.getMap();
    if (!map) return;

    const schedule = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(rebuildCones, 200);
    };
    const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === 'camera-tiles' && e.isSourceLoaded) schedule();
    };

    map.on('moveend', schedule);
    map.on('sourcedata', onSourceData);
    schedule();

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      map.off('moveend', schedule);
      map.off('sourcedata', onSourceData);
    };
  }, [mapInstance, rebuildCones]);

  const visibility: 'visible' | 'none' = visible ? 'visible' : 'none';

  return (
    <>
      <Source
        id="camera-tiles"
        type="vector"
        url={CAMERA_TILES_URL}
        maxzoom={CAMERA_TILES_MAXZOOM}
      >
        <Layer {...dotLayer} layout={{ visibility }} />
        <Layer {...pointLayer} layout={{ visibility }} />
      </Source>
      <Source id="camera-tile-cones" type="geojson" data={conesData}>
        <Layer {...coneLayer} layout={{ visibility }} />
        <Layer {...coneOutlineLayer} layout={{ visibility }} />
      </Source>
    </>
  );
}
```

- [ ] **Step 2: Wire into MapLibreContainer**

All edits in `src/components/map/MapLibreContainer.tsx`:

a. Imports:

```ts
import { CameraTileLayers } from './layers/CameraTileLayers';
import { useCameraRenderMode } from '../../hooks/useCameraRenderMode';
```

b. Inside the component (near the other mode flags, ~line 210):

```ts
  const { renderMode } = useCameraRenderMode();
  const isTilesMode = renderMode === 'tiles';
```

c. Replace the `showCameraMarkers` computation (lines ~228–235). Map-mode auto no longer crossfades heatmap→markers; heatmap is only shown when explicitly selected:

```ts
  const isMapModeHeatmap = isMapMode && mapModeViz === 'heatmap';
  const showCameraMarkers = !isNetworkMode && !isDensityMode && !isMapModeHeatmap && (
    appMode === 'route'
    || isMapMode
    || (isHeatmapMode && (heatmapSettings.showMarkers || zoom >= 13))
    || (isDotsMode && (dotDensitySettings.showMarkers || zoom >= 13))
  );
```

(`isMapModeAuto` becomes unused — delete it and its usages: the `crossfadeZoom` prop and `clustered` computation in the `CameraMarkerLayers` JSX, see step d.)

d. In the JSX (~line 1002–1021), change heatmap mounting and camera layers:

```tsx
      {isHeatmapMode && <HeatmapLayers />}
      {isMapMode && <HeatmapLayers visible={mapModeViz === 'heatmap'} />}
      {isDotsMode && <DotDensityLayers />}
      {isDensityMode && <DensityLayers />}
      {isNetworkMode && <NetworkLayers />}
      {isMapMode && <BoundaryOverlayLayers />}

      {/* Camera tiles — the default rendering path. Always mounted; hidden
          when the geojson path (filters/timeline/heatmap/CA) is active. */}
      <CameraTileLayers visible={isTilesMode && showCameraMarkers && showCameraLayer} />

      {/* Legacy GeoJSON camera layers — empty until the dataset lazily loads;
          becomes the active path for filters/timeline/heatmap/Canada. */}
      <CameraMarkerLayers
        cameras={cameraSource}
        visible={!isTilesMode && showCameraMarkers}
        clustered={false}
        mapLoaded={mapLoaded}
        mapRef={mapRef}
      />
```

e. `interactiveLayerIds` (~line 985):

```tsx
      interactiveLayerIds={isNetworkMode
        ? []
        : isDensityMode
          ? ['density-states-fill', 'density-counties-fill', 'density-states-extrusion', 'density-counties-extrusion']
          : showCameraMarkers
            ? (isTilesMode ? ['camera-tile-points'] : ['unclustered-point'])
            : []}
```

f. `onClick` (~line 705–753): delete the cluster branch (`if (clusterId) { … }` including the `getClusterExpansionZoom` call) and handle both point layers. Tile features carry coordinates in geometry, not properties:

```ts
    const feature = event.features?.[0];
    if (!feature) return;

    const props = feature.properties;
    if (!props || props.osmId == null) return;

    const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
    const camera: ALPRCamera = {
      osmId: Number(props.osmId),
      osmType: (props.osmType as 'node' | 'way') || 'node',
      lat: props.lat ?? lat,
      lon: props.lon ?? lon,
      operator: props.operator || undefined,
      brand: props.brand || undefined,
      direction: props.direction ?? undefined,
      directionCardinal: props.directionCardinal || undefined,
      surveillanceZone: props.surveillanceZone || undefined,
      mountType: props.mountType || undefined,
      ref: props.ref || undefined,
      startDate: props.startDate || undefined,
      wikimediaCommons: props.wikimediaCommons || undefined,
    };

    setPopupInfo({
      longitude: camera.lon,
      latitude: camera.lat,
      camera,
    });
```

g. Tiles readiness + failure fallback — add a new effect near the markers-ready plumbing:

```ts
  // Tiles mode readiness: first successful camera-tiles load ⇒ markers ready.
  // Repeated failures before any load ⇒ flip tilesFailed (geojson fallback).
  useEffect(() => {
    if (!mapLoaded || renderMode !== 'tiles') return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let tileLoadSeen = false;
    let errorCount = 0;

    const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId !== 'camera-tiles' || !e.isSourceLoaded) return;
      tileLoadSeen = true;
      setMarkersReady(true);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onError = (e: any) => {
      if (e?.sourceId !== 'camera-tiles' && e?.source?.id !== 'camera-tiles') return;
      if (tileLoadSeen) return;
      errorCount += 1;
      if (errorCount >= 3) {
        console.warn('[MapLibre] Camera tiles failing — falling back to GeoJSON path');
        useCameraStore.getState().setTilesFailed(true);
      }
    };

    map.on('sourcedata', onSourceData);
    map.on('error', onError);
    return () => {
      map.off('sourcedata', onSourceData);
      map.off('error', onError);
    };
  }, [mapLoaded, renderMode]);
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000 with devtools Network tab:
- Camera dots visible at national zoom; network shows range requests to `tiles.dontgetflocked.com/cameras.pmtiles` (status 206) and **no** `cameras.geojson.gz` fetch (the eager preload is still in main.tsx until Task 6 — for this check, temporarily filter network to `tiles.dontgetflocked.com` and confirm 206s appear and dots render).
- Zoom to a city (z12+): points with stroke render, cones appear over cameras that have direction data, clicking a point opens the popup with brand/operator.
- Zoom back out: points crossfade to dots around z11–12.

- [ ] **Step 4: Build + lint, commit**

```bash
npm run build && npm run lint
git add src/components/map/layers/CameraTileLayers.tsx src/components/map/MapLibreContainer.tsx
git commit -m "feat: camera vector tile layers — dots, points, cones from pmtiles"
```

---

### Task 5: CameraMarkerLayers simplification — drop glow, clusters, crossfade

**Files:**
- Modify: `src/components/map/layers/CameraMarkerLayers.tsx` (remove glow/cluster/clusterCount layers, `clustered` prop, crossfade machinery; match tile styling bands)
- Modify: `src/components/map/MapLibreContainer.tsx` (drop `clustered` prop from call site)

**Interfaces:**
- Produces: `CameraMarkerLayers({ cameras, visible, mapLoaded, mapRef })` — geojson source id stays `'cameras'`, point layer id stays `'unclustered-point'` (popup/interactivity code depends on these), cone source/layers keep ids `'direction-cones'`, `'direction-cones-outline'`.

- [ ] **Step 1: Rewrite layer specs in CameraMarkerLayers.tsx**

Delete: `clusterLayer`, `clusterCountLayer`, `unclusteredGlowLayer`, the `crossfadeZoom` prop, `fadeIn`, `crossfadePaints`, and the entire imperative crossfade `useEffect` (lines 259–310). The `Source` loses `cluster`/`clusterMaxZoom`/`clusterRadius` props and its `key` becomes static (`id="cameras"` only).

Replace `unclusteredPointLayer` with two layers mirroring the tile bands so tiles↔geojson swaps are visually seamless:

```ts
// Density dots below z12 — matches camera-tile-dots so mode swaps are seamless
const geojsonDotLayer: maplibregl.LayerSpecification = {
  id: 'cameras-dots-lowzoom',
  type: 'circle',
  source: 'cameras',
  maxzoom: 12,
  paint: {
    'circle-color': '#4DA6FF',
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, 1,
      4, 1.5,
      7, 2.2,
      10, 3.5,
      11.9, 5,
    ],
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      0, 0.5,
      8, 0.6,
      10.5, 0.75,
      11, 0.75,
      12, 0,
    ],
    'circle-stroke-width': 0,
  },
};

const unclusteredPointLayer: maplibregl.LayerSpecification = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'cameras',
  minzoom: 11,
  paint: {
    'circle-color': '#0080BC',
    'circle-radius': 6,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#93CBFF',
    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
    'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
  },
};
```

Component body becomes:

```tsx
interface CameraMarkerLayersProps {
  cameras: ALPRCamera[];
  visible: boolean;
  mapLoaded: boolean;
  mapRef: React.RefObject<{ getMap: () => maplibregl.Map } | null>;
}

export function CameraMarkerLayers({ cameras, visible }: CameraMarkerLayersProps) {
  const showCameraLayer = useMapStore(s => s.showCameraLayer);
  const cameraLayerVisibility: 'visible' | 'none' = visible ? 'visible' : 'none';

  // geojsonData and directionConesData memos unchanged (minus dev logging tweaks)

  return (
    <>
      <Source id="direction-cones" type="geojson" data={directionConesData}>
        <Layer {...directionConeLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...directionConeOutlineLayer} layout={{ visibility: cameraLayerVisibility }} />
      </Source>
      <Source id="cameras" type="geojson" data={geojsonData}>
        <Layer {...geojsonDotLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...unclusteredPointLayer} layout={{ visibility: cameraLayerVisibility }} />
      </Source>
    </>
  );
}
```

Keep the `geojsonData` and `directionConesData` memos exactly as they are (they already handle `showCameraLayer`).

- [ ] **Step 2: Update the call site**

In `MapLibreContainer.tsx` remove `clustered={false}` from the `<CameraMarkerLayers …/>` JSX (prop no longer exists). Also search the file for `'clusters'`/`'cluster-count'` string references (e.g. the watchdog around line 493 uses `querySourceFeatures('cameras')` — that stays) and remove any layer-id references to `clusters`/`cluster-count`.

- [ ] **Step 3: Verify**

```bash
npm run build && npm run lint
```

Browser (`npm run dev`): apply a brand filter from the Map panel (this loads the JSON and switches to geojson mode) — filtered cameras render as dots at low zoom / points at high zoom, no clusters, no glow, cones still show z12+. Clear the filter — instantly back to tiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/layers/CameraMarkerLayers.tsx src/components/map/MapLibreContainer.tsx
git commit -m "refactor: geojson camera layers match tile styling — clusters, glow, crossfade removed"
```

---

### Task 6: Lazy-load triggers + boot path cleanup

**Files:**
- Modify: `src/main.tsx` (delete PreloadManager)
- Modify: `src/components/panels/MapPanel.tsx` (FilterDataGate around filter section content; trim CAMERA_VIEW_OPTIONS)

**Interfaces:**
- Consumes: `useCameraStore` (`isInitialized`, `loadPhase`, `ensureCamerasLoaded`, `retryCameraLoad`)
- Produces: no new exports. Behavior: nothing downloads the camera JSON at boot; opening the Filters section or selecting Heatmap view triggers it.

- [ ] **Step 1: main.tsx — remove eager preload**

Delete the entire `PreloadManager` function (lines 70–96) and its `<PreloadManager />` usage. Keep the `?country=ca` seeding at the top (Canada still needs it — the render-mode hook sees `country === 'ca'` and loads JSON automatically). Remove the now-unused `useCameraStore` import **only if** the country seeding no longer needs it (it does need it — keep the import, delete only PreloadManager).

- [ ] **Step 2: MapPanel — FilterDataGate**

Add above `MapPanelContent`:

```tsx
/**
 * Filters need the full dataset (brand/operator lists). Mounts only when the
 * Filters section is expanded (Section renders children lazily), so this is
 * the lazy-load trigger for the JSON download.
 */
function FilterDataGate({ children }: { children: React.ReactNode }) {
  const isInitialized = useCameraStore((s) => s.isInitialized);
  const loadPhase = useCameraStore((s) => s.loadPhase);
  const ensureCamerasLoaded = useCameraStore((s) => s.ensureCamerasLoaded);
  const retryCameraLoad = useCameraStore((s) => s.retryCameraLoad);

  useEffect(() => {
    void ensureCamerasLoaded().catch(() => {});
  }, [ensureCamerasLoaded]);

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        {loadPhase === 'error' ? (
          <>
            <span className="text-xs text-dark-400">Couldn't load camera data</span>
            <button
              onClick={() => void retryCameraLoad().catch(() => {})}
              className="text-xs text-accent hover:underline"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="w-5 h-5 border-2 border-dark-600 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-dark-400">Loading camera data…</span>
          </>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
```

Wrap the Filters section contents (line ~649):

```tsx
      <Section title="Filters" badge={appliedFilterCount} defaultOpen={false}>
        <FilterDataGate>
          {/* existing children: the space-y-1 div and the Apply/Reset div */}
        </FilterDataGate>
      </Section>
```

(Ensure `useEffect` is imported in MapPanel.tsx.)

- [ ] **Step 3: Trim camera view options**

In `MapPanel.tsx` line 26, remove `clusters` and `individual` (clusters no longer exist; individual is identical to auto now):

```ts
const CAMERA_VIEW_OPTIONS: { id: MapVisualization; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Dots that sharpen as you zoom' },
  { id: 'heatmap', label: 'Heatmap', description: 'Density blobs' },
];
```

Note: heatmap selection needs no explicit trigger here — `useCameraRenderMode` sees `mapModeViz === 'heatmap'` and loads the JSON. Do not remove the `'clusters' | 'individual'` members from the `MapVisualization` type in `mapModeStore.ts` (persisted/older state may hold them); only the UI options shrink.

- [ ] **Step 4: Verify**

```bash
npm run build && npm run lint
```

Browser: hard-reload with devtools Network open — **no** request to `cameras.geojson.gz` on plain load. Open Map panel → Filters: spinner appears, JSON downloads, brand/operator lists populate. Select Heatmap view: JSON loads (if not already), heatmap renders.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/components/panels/MapPanel.tsx
git commit -m "feat: lazy camera JSON — no eager preload; filters/heatmap trigger load"
```

---

### Task 7: MapPage readiness, loading screen, CameraStats

**Files:**
- Modify: `src/pages/MapPage.tsx` (readiness derivation ~lines 295–305)
- Modify: `src/store/mapStore.ts` (add `tileViewCameraCount`)
- Modify: `src/components/map/MapLibreContainer.tsx` (`updateVisibleCameras` computes tile-mode viewport count)
- Modify: `src/components/map/CameraStats.tsx` (tiles-mode display)

**Interfaces:**
- Consumes: `useCameraRenderMode` from Task 3.
- Produces: `useMapStore` gains `tileViewCameraCount: number | null` + `setTileViewCameraCount(count: number | null): void`.

- [ ] **Step 1: MapPage readiness**

In `MapPage.tsx`, import and call the hook, then replace the readiness block:

```ts
  const { needsGeojson } = useCameraRenderMode();

  // Tiles mode: the map is "ready" when the tile source has rendered
  // (markersReady). The JSON dataset only gates readiness when a feature
  // actually needs it (filters/timeline/heatmap/Canada).
  const cameraProgress = needsGeojson ? (error ? 'error' : loadPhase) : 'ready';
  const camerasReady = needsGeojson ? (isInitialized && cameras.length > 0) : true;
  const isFullyReady = camerasReady && markersReady;
```

(`isInitialized` is already selected in this component; check the top of MapPage for the existing selectors and reuse them.) The `MapLoadingScreen` props (`cameraProgress`, `cameraCount`, `camerasReady`) keep working — in tiles mode `cameraProgress` is `'ready'` immediately and the overlay clears as soon as `markersReady` flips.

- [ ] **Step 2: mapStore — tile viewport count**

Add to the store's state interface and implementation:

```ts
  /** Approximate camera count in view when rendering from tiles (null = geojson mode). */
  tileViewCameraCount: number | null;
  setTileViewCameraCount: (count: number | null) => void;
```

```ts
  tileViewCameraCount: null,
  setTileViewCameraCount: (count) => set({ tileViewCameraCount: count }),
```

- [ ] **Step 3: MapLibreContainer — compute count in tiles mode**

Replace `updateVisibleCameras` (lines ~261–278):

```ts
  const updateVisibleCameras = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();

    if (renderMode === 'tiles') {
      // Approximate: rendered tile features, deduped (tile buffers duplicate
      // edge features — osmId exists z11+, coordinates otherwise)
      try {
        const feats = map.queryRenderedFeatures(undefined, {
          layers: ['camera-tile-dots', 'camera-tile-points'],
        });
        const seen = new Set<string>();
        for (const f of feats) {
          const key = f.properties?.osmId != null
            ? String(f.properties.osmId)
            : (f.geometry as GeoJSON.Point).coordinates.join(',');
          seen.add(key);
        }
        useMapStore.getState().setTileViewCameraCount(seen.size);
      } catch {
        // layers not ready yet
      }
      return;
    }

    useMapStore.getState().setTileViewCameraCount(null);
    const bounds = map.getBounds();
    getCamerasInBounds(
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest()
    );
  }, [getCamerasInBounds, renderMode]);
```

Also add a `moveend`-driven refresh if `updateVisibleCameras` is currently only called from `onMove`: it already runs on every `onMove`, which fires continuously — `queryRenderedFeatures` there is too hot. Guard it: in `onMove`, only call `updateVisibleCameras()` when `renderMode !== 'tiles'`; add a separate `onMoveEnd={updateVisibleCameras}` prop on the `<Map>` component (react-map-gl supports `onMoveEnd`) so tile counting happens once per gesture.

- [ ] **Step 4: CameraStats tiles display**

```tsx
import { useMapStore, useCameraStore } from '../../store';
import { COUNTRIES } from '../../services/cameraDataService';

export function CameraStats() {
  const bounds = useMapStore(s => s.bounds);
  const tileViewCameraCount = useMapStore(s => s.tileViewCameraCount);
  const getCamerasInBounds = useCameraStore(s => s.getCamerasInBounds);
  const cameraCount = useCameraStore(s => s.cameras.length);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const isLoading = useCameraStore(s => s.isLoading);
  const country = useCameraStore(s => s.country);

  const viewCameraCount = tileViewCameraCount !== null
    ? tileViewCameraCount
    : bounds
      ? getCamerasInBounds(bounds.north, bounds.south, bounds.east, bounds.west).length
      : 0;
```

and in the Total row, show a dash until the dataset exists:

```tsx
            {isLoading ? (
              <span className="text-dark-400">—</span>
            ) : isInitialized ? (
              cameraCount.toLocaleString()
            ) : (
              <span className="text-dark-400">—</span>
            )}
```

(The tile archive's own metadata count is wrong — 1.8M, feature copies summed across zoom levels — so the total only shows once the real dataset is loaded.)

- [ ] **Step 5: Verify**

```bash
npm run build && npm run lint
```

Browser: fresh load → loading screen clears as soon as tiles render (JSON never fetched); "in view" count populates after the first gesture and updates on pan end; Total row shows "—". Open Filters (loads JSON) → Total shows the real count.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MapPage.tsx src/store/mapStore.ts src/components/map/MapLibreContainer.tsx src/components/map/CameraStats.tsx
git commit -m "feat: tiles-aware readiness gating and viewport camera counts"
```

---

### Task 8: Cleanup + docs

**Files:**
- Modify: `CLAUDE.md` (data flow + data sources sections)
- Modify: anything the greps below surface

- [ ] **Step 1: Dead-reference sweep**

```bash
grep -rn "clusters\|cluster-count\|unclustered-glow\|crossfadeZoom\|getClusterExpansionZoom\|point_count" src --include="*.ts" --include="*.tsx"
grep -rn "cameras-us.json" src index.html public/_headers
grep -rn "preloadCameras\|isPreloading" src --include="*.ts" --include="*.tsx"
```

- Remove leftover references from the first grep (excluding DotDensityLayers/HeatmapLayers which never used clusters; `MapStyleControl.tsx` may reference view options — align it with the trimmed options).
- `preloadCameras`/`isPreloading` in `cameraStore.ts`: keep the store action (harmless, used by retry paths?) ONLY if still referenced; if the only caller was PreloadManager, delete the action and the `isPreloading` state + its uses in `ensureCamerasLoaded` (the 50ms race-wait block, lines 287–296) — `ensureCamerasLoaded` no longer races a preload.
- `MapLibreContainer.tsx` has its own now-possibly-unused `camerasToGeoJSON` (line ~119) — it's used by the applyDataToSource watchdog; leave it if referenced, delete if not.

- [ ] **Step 2: Update CLAUDE.md**

In "Key Data Flow", replace item 1 with:

```markdown
1. **Camera Rendering**: Default path renders straight from PMTiles vector
   tiles (`tiles.dontgetflocked.com/cameras.pmtiles`, source-layer `cameras`,
   attributes at z11+ only) via the client-side pmtiles protocol — no dataset
   download. The full GeoJSON (`cameraStore`) loads lazily only when filters,
   Explore/timeline, heatmap, or Canada need per-camera attributes
   (`useCameraRenderMode` decides which path is visible).
```

In "Data Sources", update the camera data line:

```markdown
- **Camera Tiles**: `tiles.dontgetflocked.com/cameras.pmtiles` — PMTiles archive, Range requests via `flockhopper-tiles` worker
- **Camera Data (attributes)**: `data.dontgetflocked.com/cameras.geojson.gz` — lazy-loaded for filters/timeline/heatmap/Canada
```

Add `src/services/cameraTilesService.ts`, `src/hooks/useCameraRenderMode.ts`, and `src/components/map/layers/CameraTileLayers.tsx` to the Critical Files table.

- [ ] **Step 3: Full build + lint + commit**

```bash
npm run build && npm run lint
git add -A src CLAUDE.md
git commit -m "chore: remove dead cluster/preload code, update architecture docs"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the repo verify skill**

Use the `flockhopper 3:verify` skill (Playwright against `npm run dev`) and check every item:

1. **Fresh load, tiles only**: no request whose URL contains `cameras.geojson` in the network log; ≥1 request to `tiles.dontgetflocked.com/cameras.pmtiles` returning 206; camera dots visible in a screenshot at national zoom.
2. **Zoom-in detail**: fly to a dense city at z13 — points and cones in screenshot; click a camera → popup shows brand/operator.
3. **Filter swap**: open Map panel → Filters (spinner → lists), apply a brand filter → `cameras.geojson.gz` fetched, map still shows cameras (geojson path), no blank frame between; clear filter → tiles path returns.
4. **Explore/timeline**: switch to Explore — JSON loads, timeline bar populates, playback runs.
5. **Fallback**: block `tiles.dontgetflocked.com/cameras.pmtiles` via Playwright route interception, reload — after tile errors, map falls back to the GeoJSON path and renders cameras.
6. `npm run build` passes.

- [ ] **Step 2: Fix anything that fails, commit fixes individually.**

- [ ] **Step 3: Report results** with screenshots and the network-log evidence for items 1 and 3.
