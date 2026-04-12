# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeFlock Maps is a fork of FlockHopper, hosted at `maps.deflock.org`. It is a privacy-focused map application that visualizes ALPR camera locations across the United States and calculates alternative routes that minimize camera exposure. This fork is maintained by DeFlock, the organization that maps ALPR cameras.

## Commands

```bash
npm run dev       # Start development server (port 3000)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

### Tech Stack
- React 18 + TypeScript + Vite
- Zustand for state management
- MapLibre GL for maps
- Tailwind CSS for styling
- FlockHopper Routing API (`api.dontgetflocked.com`) for routing

### Key Data Flow

1. **Camera Data Loading**: `PreloadManager` starts background fetch → `cameraStore` loads camera data → builds spatial grid (0.5° cells) for O(1) lookups

2. **Route Calculation** (`src/services/apiClient.ts`): Calls `api.dontgetflocked.com/api/v1/route` with origin, destination, and options. API handles all camera-aware routing. Returns both normal and avoidance routes with comparison metrics.

### App Modes

The map has 4 modes, selectable via the header tabs:
- **Route**: Camera-avoidance route planning
- **Explore**: Dot density visualization with timeline playback
- **Density (Analysis)**: Choropleth density analysis by state/county/tract
- **Network**: Sharing network visualization between agencies

### Critical Files

| File | Purpose |
|------|---------|
| `src/services/apiClient.ts` | API client — calls FlockHopper routing API |
| `src/services/routingConfig.ts` | Visualization constants for camera cones on map |
| `src/store/cameraStore.ts` | Camera data management + spatial grid indexing |
| `src/store/routeStore.ts` | Route calculation state and UI state |
| `src/pages/MapPage.tsx` | Main application page container |
| `src/components/map/MapLibreContainer.tsx` | Map rendering, camera markers, route layers |

### State Management Pattern

Zustand stores expose both state and actions. Key stores:
- `cameraStore`: Camera data, spatial grid, loading phases
- `routeStore`: Route calculation, active route display, UI state
- `customRouteStore`: Multi-leg waypoint routing
- `mapStore`: Map bounds/viewport
- `appModeStore`: Current app mode, visualization settings
- `densityStore`: Density visualization data
- `networkStore`: Sharing network data

### Directory Structure

```
src/
├── components/
│   ├── common/     # ErrorBoundary, LoadingSpinner, BottomSheet, Seo
│   ├── inputs/     # AddressSearch autocomplete
│   ├── map/        # MapLibreContainer, MapSearch, CameraStats, MapLoadingScreen
│   ├── panels/     # RoutePanel, ExplorePanel, DensityPanel, NetworkPanel
│   └── ui/         # Shadcn components (button, slider, switch)
├── modes/          # Visualization modes (heatmap, timeline, dots, density)
├── pages/          # MapPage, NotFound
├── services/       # apiClient, geocodingService, gpxService, routingConfig
├── store/          # Zustand stores
├── types/          # TypeScript definitions
└── utils/          # geo, polyline, formatting
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | FlockHopper API URL | `https://api.dontgetflocked.com` |
| `VITE_LOCATIONIQ_KEY` | LocationIQ geocoding API key | (optional) |
| `VITE_PERF_LOGGING` | Enable performance logging | `false` |

## Important Patterns

### Spatial Optimization
The spatial grid (0.5° cells) is critical for performance. Always use `getCamerasInBounds()` or `getCamerasInBoundsFromGrid()` rather than filtering the full camera array.

### Map Rendering
`MapLibreContainer.tsx` handles GeoJSON sources for clustered camera markers, direction cone visualization, route line rendering, and pulse animations.

### Code Splitting
Vite splits bundles by vendor: react-vendor, map-vendor, motion, geo-utils, state, deck-vendor. MapPage uses React lazy loading with Suspense.

## Data Sources

- **Camera Data**: Fetched via camera data service
- **ZIP Codes**: `/public/zipcodes-us.json` - Local lookup, no API needed
- **Map Tiles**: OpenStreetMap raster tiles
- **Geocoding**: Photon (OSM-based) with LocationIQ fallback
- **Density Data**: GeoJSON files in `/public/` (states, counties, tracts)
- **Network Data**: JSON files in `/public/` (adjacency, nodes)
