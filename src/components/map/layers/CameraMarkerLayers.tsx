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
        <Layer {...geojsonDotLayer} layout={{ visibility: cameraLayerVisibility }} />
        <Layer {...unclusteredPointLayer} layout={{ visibility: cameraLayerVisibility }} />
      </Source>
    </>
  );
}
