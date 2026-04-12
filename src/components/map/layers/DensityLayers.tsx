import { useEffect, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import { useAppModeStore } from '../../../store';
import { useDensityStore } from '../../../store/densityStore';
import type { DensityMetric, DensityViewMode, DensityColorScheme, DensityHeightScale } from '../../../store/appModeStore';

/** Color ramps keyed by scheme ID. Each maps percentile stops to hex colors.
 *  All ramps are perceptually uniform or single-hue sequential, and designed
 *  to pop on dark basemaps (bright endpoints = high contrast). */
export const DENSITY_COLOR_RAMPS: Record<DensityColorScheme, { label: string; stops: [number, string][]; gradient: string }> = {
  warm: {
    label: 'Warm',
    stops: [[0, '#fef3c7'], [20, '#fde68a'], [40, '#fdba74'], [60, '#f87171'], [80, '#dc2626'], [95, '#7f1d1d']],
    gradient: 'linear-gradient(90deg, #fef3c7, #fde68a, #fdba74, #f87171, #dc2626, #7f1d1d)',
  },
  inferno: {
    label: 'Inferno',
    stops: [[0, '#fcffa4'], [20, '#fca50a'], [40, '#dd513a'], [60, '#932667'], [80, '#420a68'], [95, '#000004']],
    gradient: 'linear-gradient(90deg, #fcffa4, #fca50a, #dd513a, #932667, #420a68, #000004)',
  },
  viridis: {
    label: 'Viridis',
    stops: [[0, '#fde725'], [20, '#90d743'], [40, '#35b779'], [60, '#21918c'], [80, '#31688e'], [95, '#440154']],
    gradient: 'linear-gradient(90deg, #fde725, #90d743, #35b779, #21918c, #31688e, #440154)',
  },
  magma: {
    label: 'Magma',
    stops: [[0, '#fcfdbf'], [20, '#fe9f6d'], [40, '#de4968'], [60, '#8c2981'], [80, '#3b0f70'], [95, '#000004']],
    gradient: 'linear-gradient(90deg, #fcfdbf, #fe9f6d, #de4968, #8c2981, #3b0f70, #000004)',
  },
};

/** Percentile → color ramp using the selected color scheme. */
function buildColorExpression(metric: DensityMetric, colorScheme: DensityColorScheme) {
  const prop = metric === 'perCapita' ? 'percentilePerCapita' : 'percentilePerRoadMile';
  const ramp = DENSITY_COLOR_RAMPS[colorScheme];
  const interp: unknown[] = ['interpolate', ['linear'], ['get', prop]];
  for (const [pct, hex] of ramp.stops) {
    interp.push(pct, hex);
  }
  return [
    'case',
    ['==', ['get', 'cameraCount'], 0], 'rgba(0,0,0,0)',
    ['==', ['get', prop], null], 'rgba(0,0,0,0)',
    interp,
  ];
}

/** Build extrusion height expression using the selected scaling function.
 *  - sqrt: compresses outliers, spreads low/mid (original default)
 *  - log:  stronger compression, makes small differences more visible
 *  - linear: raw proportional, outliers tower dramatically */
function buildHeightExpression(metric: DensityMetric, heightScale: DensityHeightScale) {
  const prop = metric === 'perCapita' ? 'camerasPerCapita' : 'camerasPerRoadMile';

  // Target max height ~160K for all scale modes
  const sqrtScale = metric === 'perCapita' ? 29000 : 500000;
  const logScale  = metric === 'perCapita' ? 70000 : 1200000;
  const linScale  = metric === 'perCapita' ? 5300  : 1600000;

  let valueExpr: unknown[];
  let scale: number;

  switch (heightScale) {
    case 'log':
      valueExpr = ['ln', ['+', ['get', prop], 1]];
      scale = logScale;
      break;
    case 'linear':
      valueExpr = ['get', prop];
      scale = linScale;
      break;
    case 'sqrt':
    default:
      valueExpr = ['sqrt', ['get', prop]];
      scale = sqrtScale;
      break;
  }

  return [
    'case',
    ['==', ['get', 'cameraCount'], 0], 0,
    ['==', ['get', prop], null], 0,
    ['+', ['*', valueExpr, scale], 3000],
  ];
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function DensityLayers() {
  const { current: mapgl } = useMap();
  const { densitySettings } = useAppModeStore();
  const { statesData, countiesData, hoveredFeatureId, selectedFeature, setSelectedFeature } = useDensityStore();
  const prevSettings = useRef(densitySettings);
  const prevHovered = useRef<string | null>(null);
  const prevSelected = useRef<string | null>(null);

  const { level, metric, viewMode, opacity, colorScheme, heightScale } = densitySettings;
  const activeSource = level === 'state' ? 'density-states' : 'density-counties';
  const inactiveSource = level === 'state' ? 'density-counties' : 'density-states';
  const selectedFeatureId = selectedFeature?.GEOID ?? null;

  // --- Hover feature-state management ---
  useEffect(() => {
    if (!mapgl) return;
    const map = mapgl.getMap();

    // Clear previous hover
    if (prevHovered.current) {
      try {
        map.setFeatureState({ source: activeSource, id: prevHovered.current }, { hover: false });
        map.setFeatureState({ source: inactiveSource, id: prevHovered.current }, { hover: false });
      } catch { /* source may not exist yet */ }
    }

    // Set new hover
    if (hoveredFeatureId) {
      try {
        map.setFeatureState({ source: activeSource, id: hoveredFeatureId }, { hover: true });
      } catch { /* source may not exist yet */ }
    }

    prevHovered.current = hoveredFeatureId;
  }, [hoveredFeatureId, mapgl, activeSource, inactiveSource]);

  // --- Selected feature-state management ---
  useEffect(() => {
    if (!mapgl) return;
    const map = mapgl.getMap();

    // Clear previous selected on both sources
    if (prevSelected.current) {
      try {
        map.setFeatureState({ source: 'density-states', id: prevSelected.current }, { selected: false });
        map.setFeatureState({ source: 'density-counties', id: prevSelected.current }, { selected: false });
      } catch { /* source may not exist yet */ }
    }

    // Set new selected
    if (selectedFeatureId) {
      try {
        map.setFeatureState({ source: activeSource, id: selectedFeatureId }, { selected: true });
      } catch { /* source may not exist yet */ }
    }

    prevSelected.current = selectedFeatureId;
  }, [selectedFeatureId, mapgl, activeSource]);

  // --- Clear selection when level changes ---
  useEffect(() => {
    setSelectedFeature(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // --- Imperative paint/layout updates when settings change ---
  // react-map-gl does NOT reliably apply declarative paint/layout changes for
  // fill-extrusion layers, so we must call MapLibre's API directly.
  useEffect(() => {
    if (!mapgl) return;
    const map = mapgl.getMap();
    const prev = prevSettings.current;
    const curr = densitySettings;

    try {
      // Opacity changed
      if (prev.opacity !== curr.opacity) {
        const show2d = curr.viewMode === '2d';
        for (const pfx of ['density-states', 'density-counties']) {
          if (map.getLayer(`${pfx}-fill`))
            map.setPaintProperty(`${pfx}-fill`, 'fill-opacity', show2d ? curr.opacity : 0);
          if (map.getLayer(`${pfx}-extrusion`))
            map.setPaintProperty(`${pfx}-extrusion`, 'fill-extrusion-opacity', show2d ? 0 : curr.opacity);
        }
      }

      // Metric or color scheme changed → update color ramp
      if (prev.metric !== curr.metric || prev.colorScheme !== curr.colorScheme) {
        const color = buildColorExpression(curr.metric, curr.colorScheme);
        for (const pfx of ['density-states', 'density-counties']) {
          if (map.getLayer(`${pfx}-fill`))
            map.setPaintProperty(`${pfx}-fill`, 'fill-color', color);
          if (map.getLayer(`${pfx}-extrusion`))
            map.setPaintProperty(`${pfx}-extrusion`, 'fill-extrusion-color', color);
        }
      }

      // Metric or height scale changed → update height expression
      if (prev.metric !== curr.metric || prev.heightScale !== curr.heightScale) {
        const height = buildHeightExpression(curr.metric, curr.heightScale);
        for (const pfx of ['density-states', 'density-counties']) {
          if (map.getLayer(`${pfx}-extrusion`))
            map.setPaintProperty(`${pfx}-extrusion`, 'fill-extrusion-height', height);
        }
      }

      // Level changed → toggle visibility
      if (prev.level !== curr.level) {
        const stateVis = curr.level === 'state' ? 'visible' : 'none';
        const countyVis = curr.level === 'county' ? 'visible' : 'none';
        for (const suffix of ['-fill', '-extrusion', '-outline']) {
          if (map.getLayer(`density-states${suffix}`))
            map.setLayoutProperty(`density-states${suffix}`, 'visibility', stateVis);
          if (map.getLayer(`density-counties${suffix}`))
            map.setLayoutProperty(`density-counties${suffix}`, 'visibility', countyVis);
        }
        // After switching level, also ensure the correct view mode is applied
        toggleViewMode(map, curr.viewMode, curr.level, curr.opacity);
      }

      // View mode changed → toggle 2D fill / 3D extrusion
      if (prev.viewMode !== curr.viewMode) {
        toggleViewMode(map, curr.viewMode, curr.level, curr.opacity);
      }
    } catch {
      // Layers may not be ready yet
    }

    prevSettings.current = curr;
  }, [densitySettings, mapgl]);

  // --- 3D pitch management ---
  useEffect(() => {
    if (!mapgl) return;
    const map = mapgl.getMap();
    if (viewMode === '3d') {
      map.easeTo({ pitch: 55, duration: 500 });
    } else {
      map.easeTo({ pitch: 0, duration: 500 });
    }
    // Cleanup: reset pitch when unmounting (leaving density mode)
    return () => {
      try { map.easeTo({ pitch: 0, duration: 500 }); } catch { /* map may be gone */ }
    };
     
  }, [viewMode, mapgl]);

  // --- Cleanup on unmount (leaving density mode) ---
  useEffect(() => {
    return () => {
      useDensityStore.getState().setSelectedFeature(null);
      useDensityStore.getState().setHoveredFeatureId(null);
    };
  }, []);

  const stateVis = level === 'state' ? 'visible' : 'none';
  const countyVis = level === 'county' ? 'visible' : 'none';
  const is2d = viewMode === '2d';
  // Hide outlines in 3D — they render on the ground plane and bleed through extrusions
  const stateOutlineVis = (level === 'state' && is2d) ? 'visible' : 'none';
  const countyOutlineVis = (level === 'county' && is2d) ? 'visible' : 'none';

  const colorExpr = buildColorExpression(metric, colorScheme);
  const heightExpr = buildHeightExpression(metric, heightScale);

  // JSX paint values MUST match what the imperative effect sets,
  // otherwise re-renders (hover, selection) reset the imperative values.
  const fillOp = is2d ? opacity : 0;
  const extOp  = is2d ? 0 : opacity;

  return (
    <>
      {/* States source */}
      <Source
        id="density-states"
        type="geojson"
        data={statesData || EMPTY_FC}
        promoteId="GEOID"
      >
        <Layer
          id="density-states-fill"
          type="fill"
          paint={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-color': colorExpr as any,
            'fill-opacity': fillOp,
          }}
          layout={{ visibility: stateVis }}
        />
        <Layer
          id="density-states-extrusion"
          type="fill-extrusion"
          filter={['>', ['get', 'cameraCount'], 0]}
          paint={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-extrusion-color': colorExpr as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-extrusion-height': heightExpr as any,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': extOp,
          }}
          layout={{ visibility: stateVis }}
        />
        <Layer
          id="density-states-outline"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#06b6d4',
              ['boolean', ['feature-state', 'hover'], false], '#ffffff',
              '#94a3b8',
            ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 3,
              ['boolean', ['feature-state', 'hover'], false], 2,
              1,
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'cameraCount'], 0], 0,
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.8,
              0.6,
            ],
          }}
          layout={{ visibility: stateOutlineVis }}
        />
      </Source>

      {/* Counties source */}
      <Source
        id="density-counties"
        type="geojson"
        data={countiesData || EMPTY_FC}
        promoteId="GEOID"
      >
        <Layer
          id="density-counties-fill"
          type="fill"
          paint={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-color': colorExpr as any,
            'fill-opacity': fillOp,
          }}
          layout={{ visibility: countyVis }}
        />
        <Layer
          id="density-counties-extrusion"
          type="fill-extrusion"
          filter={['>', ['get', 'cameraCount'], 0]}
          paint={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-extrusion-color': colorExpr as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'fill-extrusion-height': heightExpr as any,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': extOp,
          }}
          layout={{ visibility: countyVis }}
        />
        <Layer
          id="density-counties-outline"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#06b6d4',
              ['boolean', ['feature-state', 'hover'], false], '#ffffff',
              '#475569',
            ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 2.5,
              ['boolean', ['feature-state', 'hover'], false], 1.5,
              0.5,
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'cameraCount'], 0], 0,
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.7,
              0.2,
            ],
          }}
          layout={{ visibility: countyOutlineVis }}
        />
      </Source>
    </>
  );
}

/** Imperatively toggle 2D fill / 3D extrusion for BOTH level prefixes.
 *  Also hides outline layers in 3D mode to avoid the holographic bleed-through. */
function toggleViewMode(
  map: maplibregl.Map,
  viewMode: DensityViewMode,
  level: 'state' | 'county',
  opacity: number,
) {
  const show2d = viewMode === '2d';
  for (const pfx of ['density-states', 'density-counties']) {
    try {
      if (map.getLayer(`${pfx}-fill`))
        map.setPaintProperty(`${pfx}-fill`, 'fill-opacity', show2d ? opacity : 0);
      if (map.getLayer(`${pfx}-extrusion`))
        map.setPaintProperty(`${pfx}-extrusion`, 'fill-extrusion-opacity', show2d ? 0 : opacity);
      // Hide outlines in 3D — they render on the ground plane and bleed through extrusions
      if (map.getLayer(`${pfx}-outline`)) {
        const isActive = (pfx === 'density-states' && level === 'state') ||
                         (pfx === 'density-counties' && level === 'county');
        map.setLayoutProperty(`${pfx}-outline`, 'visibility', show2d && isActive ? 'visible' : 'none');
      }
    } catch { /* layers may not be ready */ }
  }
}
