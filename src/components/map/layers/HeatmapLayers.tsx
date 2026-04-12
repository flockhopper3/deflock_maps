import { useEffect, useMemo, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import { useCameraStore, useAppModeStore } from '../../../store';
import { buildHeatmapColorExpression } from '../../../modes/heatmap/colorSchemes';
import type { ALPRCamera } from '../../../types';

/**
 * Convert cameras to unclustered GeoJSON for heatmap rendering.
 * Heatmap needs raw individual points, not clusters.
 * Coordinates rounded to 4 decimals (~11m precision) — sufficient for heatmap.
 * Includes `ts` (Unix epoch ms) for timeline filtering via setFilter.
 */
function camerasToHeatmapGeoJSON(cameras: ALPRCamera[]): GeoJSON.FeatureCollection {
  const features = new Array(cameras.length);
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];
    features[i] = {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [
          Math.round(camera.lon * 10000) / 10000,
          Math.round(camera.lat * 10000) / 10000,
        ],
      },
      properties: {
        weight: 1,
        ts: camera.osmTimestamp ? new Date(camera.osmTimestamp).getTime() : 0,
      },
    };
  }
  return { type: 'FeatureCollection', features };
}

export function HeatmapLayers({ visible = true }: { visible?: boolean }) {
  const filteredCameras = useCameraStore(s => s.filteredCameras);
  const cameras = useCameraStore(s => s.cameras);
  // Selective subscriptions: only re-render for settings/mode changes, NOT currentDate
  const heatmapSettings = useAppModeStore((s) => s.heatmapSettings);
  const appMode = useAppModeStore((s) => s.appMode);
  const isTimelineActive = appMode === 'explore';
  const { current: map } = useMap();
  const prevSettingsRef = useRef(heatmapSettings);

  // Derive camera source outside memo so reference equality prevents recomputation on tab switches
  const cameraSource = isTimelineActive ? cameras : filteredCameras;

  // During timeline, load ALL cameras once; visibility controlled via filter prop
  const geojsonData = useMemo(
    () => camerasToHeatmapGeoJSON(cameraSource),
    [cameraSource]
  );

  // Timeline filtering is handled entirely by MapLibreContainer's imperative
  // handleTimelineTick (calls map.setFilter on 'heatmap-layer'). No filter
  // prop on the Layer — avoids react-map-gl declarative/imperative conflicts.

  const colorExpression = useMemo(
    () => buildHeatmapColorExpression(heatmapSettings.colorScheme),
    [heatmapSettings.colorScheme]
  );

  // Update paint properties imperatively when settings change (avoids full re-render)
  useEffect(() => {
    if (!map) return;
    const mapInstance = map.getMap();
    if (!mapInstance.getLayer('heatmap-layer')) return;

    const prev = prevSettingsRef.current;
    const curr = heatmapSettings;

    try {
      if (prev.intensity !== curr.intensity) {
        mapInstance.setPaintProperty('heatmap-layer', 'heatmap-intensity', [
          'interpolate', ['linear'], ['zoom'],
          0,  curr.intensity * 0.15,
          4,  curr.intensity * 0.4,
          7,  curr.intensity * 0.8,
          9,  curr.intensity,
          12, curr.intensity * 2.0,
          14, curr.intensity * 3.0,
        ]);
      }
      if (prev.radius !== curr.radius) {
        mapInstance.setPaintProperty('heatmap-layer', 'heatmap-radius', [
          'interpolate', ['linear'], ['zoom'],
          0,  2,
          4,  Math.max(4, curr.radius * 0.2),
          7,  Math.max(8, curr.radius * 0.5),
          9,  curr.radius,
          12, curr.radius * 1.4,
          14, curr.radius * 1.8,
        ]);
      }
      if (prev.opacity !== curr.opacity) {
        mapInstance.setPaintProperty('heatmap-layer', 'heatmap-opacity', [
          'interpolate', ['linear'], ['zoom'],
          0,  curr.opacity,
          9,  curr.opacity,
          11, curr.opacity * 0.7,
          13, curr.opacity * 0.2,
          14, 0,
        ]);
      }
      if (prev.colorScheme !== curr.colorScheme) {
        const newColor = buildHeatmapColorExpression(curr.colorScheme);
        mapInstance.setPaintProperty('heatmap-layer', 'heatmap-color', newColor);
      }
    } catch {
      // Layer may not be ready yet
    }

    prevSettingsRef.current = curr;
  }, [heatmapSettings, map]);

  return (
    <Source
      id="cameras-heatmap"
      type="geojson"
      data={geojsonData}
      maxzoom={14}
    >
      <Layer
        id="heatmap-layer"
        type="heatmap"
        source="cameras-heatmap"
        maxzoom={14}
        layout={{ visibility: visible ? 'visible' : 'none' }}
        paint={{
          'heatmap-weight': 1,
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0,  heatmapSettings.intensity * 0.15,
            4,  heatmapSettings.intensity * 0.4,
            7,  heatmapSettings.intensity * 0.8,
            9,  heatmapSettings.intensity,
            12, heatmapSettings.intensity * 2.0,
            14, heatmapSettings.intensity * 3.0,
          ] as unknown as number,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'heatmap-color': colorExpression as any,
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0,  2,
            4,  Math.max(4, heatmapSettings.radius * 0.2),
            7,  Math.max(8, heatmapSettings.radius * 0.5),
            9,  heatmapSettings.radius,
            12, heatmapSettings.radius * 1.4,
            14, heatmapSettings.radius * 1.8,
          ] as unknown as number,
          'heatmap-opacity': [
            'interpolate', ['linear'], ['zoom'],
            0,  heatmapSettings.opacity,
            9,  heatmapSettings.opacity,
            11, heatmapSettings.opacity * 0.7,
            13, heatmapSettings.opacity * 0.2,
            14, 0,
          ] as unknown as number,
        }}
      />
    </Source>
  );
}
