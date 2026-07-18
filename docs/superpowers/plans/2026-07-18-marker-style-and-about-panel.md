# Marker Style Restore + About Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the master-branch camera marker look (dark fill, white ring, strong glow) on the tile rendering path, and replace the map panel's brand breakdown with an "About this map" section.

**Architecture:** Paint-constant changes in the two camera layer components (tiles path + GeoJSON fallback, which must stay visually identical). Panel change is JSX-only in `MapPanelContent`, which serves both the desktop side panel and the mobile drawer. Then dead brand-stats plumbing is deleted from `MapLibreContainer` and `mapStore`.

**Tech Stack:** React 18 + TypeScript, MapLibre GL via react-map-gl, Zustand, Tailwind. Tests: vitest (`npm test`). Build: `npm run build` (tsc + vite). Lint: `npm run lint`.

**Spec:** `docs/superpowers/specs/2026-07-18-marker-style-and-about-panel-design.md`

## Global Constraints

- User-facing copy uses plain declarative statements. Never use em dashes in copy.
- `CameraTileLayers.tsx` and `CameraMarkerLayers.tsx` paint values must stay identical between the two files (existing code requirement; mode swaps must be seamless).
- The z9-10 dots-to-points crossfade structure (interpolate expressions, zoom stops 9 / 9.6 / 10) must be preserved; only colors and end values change.
- Lint gate: zero new warnings (`npm run lint`).
- Task order matters: Task 2 (remove the consumer in MapPanel) must land before Task 3 (remove the producer/store), or the build breaks mid-sequence.
- Testing note: these changes are paint constants, JSX, and deletions with no unit-testable logic, so tasks use build + existing test suite + lint as their verification cycle instead of new unit tests. Do not add tests that assert hex strings.

---

### Task 1: Restore master marker style in both camera layer files

**Files:**
- Modify: `src/components/map/layers/CameraTileLayers.tsx:43-136`
- Modify: `src/components/map/layers/CameraMarkerLayers.tsx:41-122`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on. Layer ids, zoom bands, and component props are unchanged.

Target look (from master): point fill `#0080BC`, ring `#93CBFF` 2px, radius 6; glow `#4DA6FF`, radius 16, opacity 0.4, blur 0.5. The point fill color interpolates from the dot blue at z9 to the master dark blue at z10 so the dots-to-points handoff never changes hue mid-crossfade.

- [ ] **Step 1: Update the glow layer in CameraTileLayers.tsx**

In `src/components/map/layers/CameraTileLayers.tsx`, inside `buildLayerSpecs`, replace the `glowLayer` opacity expression and its comment. The radius expression already reaches 16 at z12 and stays as is.

Replace:

```ts
      // Peaks during the handoff (it carries continuity there), then relaxes
      // once points stand on their own — full-strength halos on every mark
      // at close zoom is the main "too bright" offender.
      'circle-opacity': [
        'interpolate', ['linear'], ['zoom'],
        8, 0,
        9, 0.25,
        10, 0.35,
        12, 0.2,
      ],
```

with:

```ts
      // Ramps up through the handoff and holds the full master-strength halo
      // (0.4) from z12 — the bright glow is the signature DeFlock look,
      // restored 2026-07-18 from the pre-tiles design.
      'circle-opacity': [
        'interpolate', ['linear'], ['zoom'],
        8, 0,
        9, 0.25,
        10, 0.35,
        12, 0.4,
      ],
```

- [ ] **Step 2: Update the point layer in CameraTileLayers.tsx**

In the same file, replace the `pointLayer` color, stroke color, and their comments.

Replace:

```ts
      // Same blue as the density dots — the handoff changes mark anatomy
      // (stroke, size), never hue, so zooming reads as one continuous layer.
      'circle-color': '#4DA6FF',
```

with:

```ts
      // Enters in the dots' blue so the handoff never changes hue mid-fade,
      // then deepens into the master dark fill by z10, where the light ring
      // has reached full width and carries the contrast.
      'circle-color': ['interpolate', ['linear'], ['zoom'], 9, '#4DA6FF', 10, '#0080BC'],
```

Replace:

```ts
      // Dark ring, not light: the light fill carries the identity, the ring
      // just gives it an edge — a lighter-than-fill ring stacks three tiers
      // of brightness (glow + fill + ring) and goes neon at close zoom.
      'circle-stroke-color': '#0B5B93',
```

with:

```ts
      // Light near-white ring on a dark fill — the signature master look
      // (glow + dark core + bright ring), restored 2026-07-18.
      'circle-stroke-color': '#93CBFF',
```

- [ ] **Step 3: Mirror both changes in CameraMarkerLayers.tsx**

In `src/components/map/layers/CameraMarkerLayers.tsx`:

In `geojsonGlowLayer`, replace:

```ts
    // Peaks during the handoff, relaxes at close zoom — matches camera-tile-glow
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      8, 0,
      9, 0.25,
      10, 0.35,
      12, 0.2,
    ],
```

with:

```ts
    // Ramps to the full master-strength halo from z12 — matches camera-tile-glow
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      8, 0,
      9, 0.25,
      10, 0.35,
      12, 0.4,
    ],
```

In `unclusteredPointLayer`, replace:

```ts
    // Same blue as the density dots — matches camera-tile-points
    'circle-color': '#4DA6FF',
```

with:

```ts
    // Dot blue into master dark fill over the handoff — matches camera-tile-points
    'circle-color': ['interpolate', ['linear'], ['zoom'], 9, '#4DA6FF', 10, '#0080BC'],
```

and replace:

```ts
    'circle-stroke-color': '#0B5B93', // dark ring — matches camera-tile-points
```

with:

```ts
    'circle-stroke-color': '#93CBFF', // light master ring — matches camera-tile-points
```

- [ ] **Step 4: Verify build, tests, lint**

Run: `npm run build && npm test && npm run lint`
Expected: build succeeds, all existing tests pass, zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/layers/CameraTileLayers.tsx src/components/map/layers/CameraMarkerLayers.tsx
git commit -m "style: restore master camera marker look (dark fill, light ring, full glow)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Replace brand breakdown with About section in MapPanel

**Files:**
- Modify: `src/components/panels/MapPanel.tsx`

**Interfaces:**
- Consumes: existing `Section` component in the same file (`Section({ title, badge?, defaultOpen?, children })`).
- Produces: `MapPanelContent` no longer reads `tileViewBrandStats` from `useMapStore` or `manifest` from `useCameraStore`. Task 3 relies on this: after this task, the only remaining consumers of `tileViewBrandStats` are `mapStore` itself and `MapLibreContainer`.

- [ ] **Step 1: Remove brand imports and constants**

In `src/components/panels/MapPanel.tsx`, delete the import:

```ts
import { normalizeBrand } from '@/lib/brandNormalization';
```

Delete the `BRAND_COLORS` constant (the whole `const BRAND_COLORS = [...]` block, currently lines 18-25).

- [ ] **Step 2: Add the About section data and component**

Directly below the `CAMERA_VIEW_OPTIONS` constant, add:

```tsx
// ─── About This Map ─────────────────────────────────────────────────────────
const ABOUT_ITEMS: { title: string; body: string; link?: { href: string; label: string } }[] = [
  {
    title: 'How it works',
    body: 'Every marker is an automated license plate reader (ALPR) documented by DeFlock and OpenStreetMap contributors. The map refreshes hourly. Zoom in to see individual cameras and the direction they face.',
  },
  {
    title: 'Contribute',
    body: 'Anyone can add cameras. Spot an ALPR that is not on the map? Add it to OpenStreetMap and it will show up here.',
    link: { href: 'https://deflock.me', label: 'Learn how to contribute' },
  },
  {
    title: 'Fix a camera',
    body: 'See a camera that is wrong or has been removed? Open its popup and use the View OSM link to correct it.',
  },
  {
    title: 'About DeFlock',
    body: 'DeFlock is a volunteer project that maps ALPR surveillance so everyone can see who is watching.',
    link: { href: 'https://deflock.org', label: 'Visit deflock.org' },
  },
];

function AboutSection() {
  return (
    <Section title="About This Map" defaultOpen>
      <div className="space-y-3">
        {ABOUT_ITEMS.map((item) => (
          <div key={item.title} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
            <p className="text-sm text-dark-300 font-medium mb-1">{item.title}</p>
            <p className="text-xs text-dark-400 leading-relaxed">{item.body}</p>
            {item.link && (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs font-medium text-accent hover:underline"
              >
                {item.link.label} →
              </a>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Simplify the viewport stats to a count**

In `MapPanelContent`, replace the entire `viewportStats` useMemo (the block starting `const viewportStats = useMemo(() => {` through its closing `}, [bounds, filteredCameras]);`) with:

```tsx
  const viewportCount = useMemo(() => {
    if (!bounds) return 0;
    return filteredCameras.filter(
      (c) => c.lat >= bounds.south && c.lat <= bounds.north && c.lon >= bounds.west && c.lon <= bounds.east
    ).length;
  }, [bounds, filteredCameras]);
```

Update the hero fallback line that follows to:

```tsx
  const heroViewCount = tileViewCameraCount !== null ? tileViewCameraCount : viewportCount;
```

- [ ] **Step 4: Remove the brand display logic**

Still in `MapPanelContent`, delete:

- the selector `const tileViewBrandStats = useMapStore((s) => s.tileViewBrandStats);`
- the selector `const manifest = useCameraStore((s) => s.manifest);`
- the entire `brandDisplay` useMemo (from the `// Brand rows, best available source:` comment through `}, [tileViewBrandStats, viewportStats, country, manifest]);`)

Keep the `country` selector and the `ensureManifestLoaded` warm-up effect (the filter control's option lists rely on the country-keyed re-warm), but replace its comment with:

```tsx
  // Warm the few-KB manifest so the filter button's option lists are ready
  // without any dataset download. Country switches reset manifestPhase, so
  // the country dep re-warms with the new country's dictionary.
```

- [ ] **Step 5: Swap the JSX**

In the returned JSX of `MapPanelContent`, delete the entire brand breakdown block:

```tsx
      {/* Brand breakdown */}
      {brandDisplay && (
        ...entire conditional block...
      )}
```

and insert `<AboutSection />` between the divider and the Layers section, so the layout reads:

```tsx
      {/* Divider before sections */}
      <div className="h-px bg-dark-700/50 mx-6" />

      {/* Section: About */}
      <AboutSection />

      {/* Section: Layers */}
      <Section title="Layers">
```

- [ ] **Step 6: Verify build, tests, lint**

Run: `npm run build && npm test && npm run lint`
Expected: build succeeds, all existing tests pass, zero lint warnings (in particular no unused-variable warnings in MapPanel.tsx).

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/MapPanel.tsx
git commit -m "feat: replace brand breakdown with About This Map section

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove brand-stats plumbing and fix stale zoom comments

**Files:**
- Modify: `src/components/map/MapLibreContainer.tsx:72-75, 288-370`
- Modify: `src/store/mapStore.ts`

**Interfaces:**
- Consumes: Task 2 must already be merged (MapPanel no longer reads `tileViewBrandStats`).
- Produces: `mapStore` no longer exports `TileViewBrandStats`, `tileViewBrandStats`, or `setTileViewBrandStats`. `tileViewCameraCount` and `setTileViewCameraCount` are unchanged and still feed the hero count.

- [ ] **Step 1: Remove the brand aggregation from MapLibreContainer.tsx**

In `updateVisibleCameras`, delete everything from the comment `// Brand breakdown from the same rendered features:` through `useMapStore.getState().setTileViewBrandStats(brandStats);` (currently lines ~322-362), keeping the count lines above it intact:

```ts
        const feats = map.queryRenderedFeatures(undefined, { layers: [layerForZoom] });
        useMapStore.getState().setTileViewCameraCount(feats.length);
      } catch {
        // layers not ready yet
      }
      return;
```

Below the tiles branch, delete the line:

```ts
    useMapStore.getState().setTileViewBrandStats(null);
```

keeping `useMapStore.getState().setTileViewCameraCount(null);`.

- [ ] **Step 2: Remove now-unused imports from MapLibreContainer.tsx**

- Line 72: remove `CAMERA_METADATA_MINZOOM` from the `cameraTilesService` import (keep `ensurePMTilesProtocol`, `CAMERA_POINTS_MINZOOM`, `cameraTilesUrl`, `cameraFilterTilesUrl`).
- Line 73: delete `import { normalizeBrand } from '../../lib/brandNormalization';`
- Line 75: delete `import type { TileViewBrandStats } from '../../store/mapStore';`

- [ ] **Step 3: Fix the stale z11 comments in the count block**

In the big comment above the count query (lines ~294-313), the zoom references predate the move of the metadata threshold to z9. Replace:

```ts
      // was osmId when present, else lng/lat; z0–10 tiles are built
      // --exclude-all so below z11 there are no properties and it fell back to
      // coordinates. Tile geometry is quantised (~600m per unit at z4), so
```

with:

```ts
      // was osmId when present, else lng/lat; low-zoom tiles carry no
      // attributes (metadata starts at z9) so it fell back to
      // coordinates. Tile geometry is quantised (~600m per unit at z4), so
```

and replace:

```ts
      //  - The dots (z0–12) and points (z11+) layers OVERLAP at z11–12, and
      //    queryRenderedFeatures ignores paint opacity — querying both there
      //    returns every camera twice (measured: +102.8% at z11). Querying the
      //    single layer that covers this zoom yields each camera exactly once.
```

with:

```ts
      //  - The dots (z0–10) and points (z9+) layers OVERLAP on [9, 10), and
      //    queryRenderedFeatures ignores paint opacity — querying both there
      //    returns every camera twice. Querying the single layer that covers
      //    this zoom yields each camera exactly once.
```

- [ ] **Step 4: Remove the brand-stats state from mapStore.ts**

In `src/store/mapStore.ts`, delete:

- the `TileViewBrandStats` interface and its doc comment (lines 4-10)
- the `tileViewBrandStats` field and its doc comment (lines 34-37)
- the `setTileViewBrandStats: (stats: TileViewBrandStats | null) => void;` action declaration (line 54)
- the `tileViewBrandStats: null,` initial value (line 79)
- the `setTileViewBrandStats: (stats) => set({ tileViewBrandStats: stats }),` implementation (line 137)

- [ ] **Step 5: Verify nothing references the removed symbols**

Run: `grep -rn "tileViewBrandStats\|TileViewBrandStats\|setTileViewBrandStats" src`
Expected: no matches.

- [ ] **Step 6: Verify build, tests, lint**

Run: `npm run build && npm test && npm run lint`
Expected: build succeeds, all existing tests pass, zero lint warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/map/MapLibreContainer.tsx src/store/mapStore.ts
git commit -m "refactor: remove brand-stats plumbing behind removed breakdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Manual visual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: all previous tasks committed.
- Produces: confirmation the restored style and new panel look right; any visual tuning feedback goes back to Task 1 values.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (port 3000).

- [ ] **Step 2: Check the marker style (tiles path)**

At z10+ over a metro: points show dark blue `#0080BC` fill, light `#93CBFF` 2px ring, and a soft wide glow. Zoom slowly across z9-10: no color pop, no "green murk" translucency dip.

- [ ] **Step 3: Check the GeoJSON path matches**

Open the camera filter and apply any brand filter that forces the GeoJSON fallback (or use timeline/Explore). The markers must look identical to the tiles path.

- [ ] **Step 4: Check the panel on desktop and mobile**

Desktop side panel: hero count, then About This Map (open by default, four cards, two working links), then Layers. No brand bars anywhere. Narrow the window below 1024px, open the drawer's Map tab fully: same content renders there.
