import { useEffect, useState, useRef, useCallback } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import {
  CAMERA_TILES_URL,
  CAMERA_TILES_SOURCE_LAYER,
  CAMERA_TILES_MAXZOOM,
  CAMERA_POINTS_MINZOOM,
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
 *
 * A zoom-scaled glow underlies both marks from z10 up. It carries the visual
 * mass continuously through the z11–12 handoff, so the dot→point swap reads as
 * a zoom rather than a pop, and it restores the pre-tiles camera aura at z12+.
 * Starts at z10 (not z0): blurred circles are fill-rate bound, and glowing
 * ~114k features at country zoom would blob dense metros into featureless mass.
 */
const glowLayer: maplibregl.LayerSpecification = {
  id: 'camera-tile-glow',
  type: 'circle',
  source: 'camera-tiles',
  'source-layer': CAMERA_TILES_SOURCE_LAYER,
  minzoom: 10,
  paint: {
    'circle-color': '#4DA6FF',
    // Stays just behind the mark it sits under — at z11 it is barely wider than
    // the r≈4.3 dot. Blooms to the pre-tiles r=16 only at z13+, where cameras
    // have separated and the halo has room to read as presence, not as bulk.
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, 2,
      11, 5,
      12, 10,
      14, 16,
    ],
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      10, 0,
      11, 0.25,
      12, 0.4,
    ],
    'circle-blur': 0.5,
    'circle-stroke-width': 0,
  },
};

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
  // Shared with the viewport count, which queries dots below this zoom and
  // points at/above it — the two layers overlap on [11, 12).
  minzoom: CAMERA_POINTS_MINZOOM,
  paint: {
    'circle-color': '#0080BC',
    // Enters at exactly the dot's z11 radius (4.3) and grows into the pre-tiles
    // r=6, which it holds past z12. The stroke widens 0→2 over the same span:
    // at full width from the start it would bolt 2px of outer radius on the
    // instant the point appears, which is a pop of its own.
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.3, 12, 6],
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 2],
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
        {/* Glow first — document order is paint order, and it must sit beneath both marks */}
        <Layer {...glowLayer} layout={{ visibility }} />
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
