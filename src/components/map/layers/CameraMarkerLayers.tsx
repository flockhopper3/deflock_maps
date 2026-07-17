import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from '../../../store';
import type { ALPRCamera } from '../../../types';
import { createDirectionCone, parseDirections } from './cameraGeometry';

// Convert cameras to GeoJSON - optimized with pre-allocated array
function camerasToGeoJSON(cameras: ALPRCamera[]): GeoJSON.FeatureCollection {
  // Pre-allocate array for better performance with large camera sets
  const features = new Array(cameras.length);
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];
    features[i] = {
      type: 'Feature' as const,
      id: camera.osmId,
      geometry: {
        type: 'Point' as const,
        coordinates: [camera.lon, camera.lat],
      },
      properties: {
        osmId: camera.osmId,
        osmType: camera.osmType,
        operator: camera.operator || '',
        brand: camera.brand || '',
        direction: camera.direction ?? null,
        directionCardinal: camera.directionCardinal || '',
        surveillanceZone: camera.surveillanceZone || '',
        mountType: camera.mountType || '',
        ref: camera.ref || '',
        startDate: camera.startDate || '',
        lat: camera.lat,
        lon: camera.lon,
        ts: camera.osmTimestamp ? new Date(camera.osmTimestamp).getTime() : 0,
      },
    };
  }
  return { type: 'FeatureCollection', features };
}

// Zoom-scaled glow from z10 — matches camera-tile-glow so mode swaps are seamless.
// Carries visual mass continuously through the z11–12 dot→point handoff and
// restores the pre-tiles camera aura at z12+.
const geojsonGlowLayer: maplibregl.LayerSpecification = {
  id: 'cameras-glow',
  type: 'circle',
  source: 'cameras',
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

// Direction cone layer style - only show once individual cameras are distinguishable
const directionConeLayer: maplibregl.LayerSpecification = {
  id: 'direction-cones',
  type: 'fill',
  source: 'direction-cones',
  minzoom: 12, // Matches unclustered-point's zoom-in fade threshold
  paint: {
    'fill-color': '#4DA6FF',
    'fill-opacity': 0.35,
  },
};

// Direction cone outline - only show once individual cameras are distinguishable
const directionConeOutlineLayer: maplibregl.LayerSpecification = {
  id: 'direction-cones-outline',
  type: 'line',
  source: 'direction-cones',
  minzoom: 12, // Matches unclustered-point's zoom-in fade threshold
  paint: {
    'line-color': '#0080BC',
    'line-width': 2,
    'line-opacity': 0.7,
  },
};

interface CameraMarkerLayersProps {
  cameras: ALPRCamera[];
  visible: boolean;
  mapLoaded: boolean;
  mapRef: React.RefObject<{ getMap: () => maplibregl.Map } | null>;
}

export function CameraMarkerLayers({ cameras, visible }: CameraMarkerLayersProps) {
  const showCameraLayer = useMapStore(s => s.showCameraLayer);
  const cameraLayerVisibility: 'visible' | 'none' = visible ? 'visible' : 'none';

  // Convert cameras to GeoJSON
  const geojsonData = useMemo(
    () => {
      if (!showCameraLayer) return camerasToGeoJSON([]);
      return camerasToGeoJSON(cameras);
    },
    [showCameraLayer, cameras]
  );

  // Generate direction cones for cameras with direction data
  // Multi-directional cameras (directions[]) get one cone per bearing
  const directionConesData = useMemo((): GeoJSON.FeatureCollection => {
    if (!showCameraLayer) {
      return { type: 'FeatureCollection', features: [] };
    }
    const camerasWithDirection = cameras.filter(
      (c) => c.direction !== undefined && c.direction !== null
    );

    if (import.meta.env.DEV) {
      console.log(`[CameraMarkerLayers] Cameras with direction: ${camerasWithDirection.length} / ${cameras.length}`);
    }

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

    return { type: 'FeatureCollection', features };
  }, [cameras, showCameraLayer]);

  return (
    <>
      <Source id="direction-cones" type="geojson" data={directionConesData}>
        <Layer {...directionConeLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...directionConeOutlineLayer} layout={{ visibility: cameraLayerVisibility }} />
      </Source>
      <Source id="cameras" type="geojson" data={geojsonData}>
        {/* Glow first — document order is paint order, and it must sit beneath both marks */}
        <Layer {...geojsonGlowLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...geojsonDotLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...unclusteredPointLayer} layout={{ visibility: cameraLayerVisibility }} />
      </Source>
    </>
  );
}
