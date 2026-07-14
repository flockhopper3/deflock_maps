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
