# Marker Style Restore + About Panel Design

**Date:** 2026-07-18
**Branch:** camera-tiles-refactor
**Status:** Approved by user

## Overview

Two changes to the main map page:

1. Restore the master-branch camera marker look (dark fill, white ring, soft glow) on the tile-based rendering path.
2. Remove the brand breakdown from the map panel and replace it with an "About this map" section covering how the map works, how to contribute, how to fix a camera, and DeFlock's mission.

## Part 1: Restore master marker style

### Target look (from master `CameraMarkerLayers.tsx`)

| Element | Master value |
|---------|--------------|
| Point fill | `#0080BC` |
| Point ring | `#93CBFF`, 2px stroke |
| Point radius | 6 (static) |
| Glow color | `#4DA6FF` |
| Glow radius | 16 |
| Glow opacity | 0.4 |
| Glow blur | 0.5 |

### Changes

**`src/components/map/layers/CameraTileLayers.tsx`** (default tiles path):

- Point layer (`camera-tile-points`): fill becomes `#0080BC`, stroke color becomes `#93CBFF`. Keep the existing zoom-interpolate expressions for radius, stroke width, and opacity (they drive the z9-10 dots-to-points crossfade); only the color constants and interpolation end values change so the fully-zoomed-in state matches master (radius ~6, stroke 2).
- Glow layer (`camera-tile-glow`): keep `#4DA6FF` and blur 0.5. Raise the interpolation targets so the glow reaches radius 16 and opacity 0.4 at full presence, instead of the current toned-down peak of 0.35 relaxing to 0.2. Keep the z8-9 fade-in ramp.
- Density dots (`camera-tile-dots`, below z10): behavior unchanged; color stays in the `#4DA6FF` family so the handoff into the restored glow reads smoothly.
- Cones: unchanged.

**`src/components/map/layers/CameraMarkerLayers.tsx`** (GeoJSON fallback for filters/timeline/heatmap/Canada):

- Mirror the exact same paint values so both render paths are visually identical (existing code-comment requirement).

### Known trade-off

The current branch's dark ring was a deliberate choice to avoid a bright glow + fill + light ring stack at close zoom. The user explicitly prefers the master look, so it is ported faithfully. If it reads too hot in practice, the fix is a two-constant tweak (ring color or glow opacity).

## Part 2: Replace brand breakdown with About section

### Context

The brand breakdown in `MapPanelContent` cannot show viewport stats below zoom 9 in plain tiles mode (tile metadata starts at z9) and currently falls back silently to a nationwide breakdown, flipping its label. Decision: remove it entirely rather than zoom-gate it.

### Changes in `src/components/panels/MapPanel.tsx`

`MapPanelContent` serves both the desktop side panel and the mobile drawer's Map tab, so one change covers both surfaces.

- **Remove** the brand breakdown block (currently lines ~320-357), `brandDisplay` memo, the brands portion of `viewportStats`, and `BRAND_COLORS`.
- **Keep** the hero "cameras in view" count and its existing fallback behavior.
- **Add** an "About this map" section between the hero count and Layers, built with the existing collapsible `Section` component and the info-card styling used by "About Heatmap" / "About Dot Density". Content (plain declarative copy, no em dashes):
  1. **How it works:** crowdsourced ALPR camera locations from DeFlock and OSM contributors, refreshed hourly. Zoom in to see individual cameras and the direction they face.
  2. **Contribute:** anyone can add cameras. Link/button to the deflock.me contribute guide.
  3. **Fix a camera:** wrong or moved camera? Open its popup and use the View OSM link to correct it.
  4. **About DeFlock:** one sentence on the mission (mapping ALPR surveillance), linking deflock.org.
- Layers and Heatmap Settings sections unchanged.

### Cleanup of breakdown-only plumbing

Remove code that exists solely to feed the breakdown:

- `tileViewBrandStats` state, setter, and `TileViewBrandStats` interface in `src/store/mapStore.ts`.
- The brand aggregation inside `MapLibreContainer.tsx`'s `queryRenderedFeatures` stats handler (~lines 314-362). The camera count portion feeding the hero count stays.
- Fix stale comments in `mapStore.ts` and `MapLibreContainer.tsx` that say metadata is available at "z11+"; the threshold is `CAMERA_METADATA_MINZOOM = 9`.

**Do not touch** anything shared with other features: `brandNormalization` (used by filters), `cameraManifestService` (used by filters and the hero count fallback), and the manifest warm-up if the hero fallback still needs it.

## Error handling

No new failure modes. The About section is static content. Removing the breakdown removes the silent-fallback edge case. Hero count fallback behavior is unchanged.

## Testing

- Existing test suites must pass; delete or update tests that cover removed brand-stats plumbing (e.g. mapStore brand stats tests if present).
- Visual check on the dev server: dots-to-points crossfade at z9-10 shows no pop; restored colors match master's look at z10+ in both tiles and GeoJSON (filter active) paths; panel renders correctly on desktop and in the mobile drawer.
- Lint gate: zero new warnings.
