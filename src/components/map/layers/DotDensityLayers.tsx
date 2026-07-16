import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import { useCameraStore, useAppModeStore } from '../../../store';
import type { ALPRCamera } from '../../../types';

/**
 * Dot size across zoom.
 *
 * Through z11 this holds the historical 2-3px, which is what makes overlapping
 * dots stack into a readable density field. From z13 dots grow into individually
 * legible marks — deliberately taking over the job the removed marker layer did.
 * Linear between hand-tuned anchors: the anchors are the design.
 */
const DOT_RADIUS: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  'interpolate', ['linear'], ['zoom'],
  0, 1.5,
  4, 2,
  10, 3,
  13, 4.8,
  14, 6,
  16, 9,
  18, 12,
];

/**
 * Dot opacity across zoom.
 *
 * Stays at the historical 0.25 while stacking does the work. Once cameras
 * separate past z13 nothing stacks, so a 25% dot would just read as faint —
 * it solidifies to near-opaque by z15.
 */
const DOT_OPACITY: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  'interpolate', ['linear'], ['zoom'],
  4, 0.25,
  11, 0.25,
  13, 0.55,
  15, 0.9,
];

/**
 * Convert cameras to unclustered GeoJSON for dot density rendering.
 * Each camera becomes one small semi-transparent dot.
 * Where dots overlap, opacity stacks — dense areas appear brighter/more solid.
 */
function camerasToDotsGeoJSON(cameras: ALPRCamera[]): GeoJSON.FeatureCollection {
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
        ts: camera.osmTimestamp ? new Date(camera.osmTimestamp).getTime() : 0,
      },
    };
  }
  return { type: 'FeatureCollection', features };
}

export function DotDensityLayers() {
  const filteredCameras = useCameraStore(s => s.filteredCameras);
  const cameras = useCameraStore(s => s.cameras);
  const dotColor = useAppModeStore((s) => s.dotDensitySettings.color);
  const appMode = useAppModeStore((s) => s.appMode);
  const isTimelineActive = appMode === 'explore';

  // Derive camera source outside memo so reference equality prevents recomputation on tab switches
  const cameraSource = isTimelineActive ? cameras : filteredCameras;

  // During timeline, load ALL cameras once; visibility controlled via filter prop
  const geojsonData = useMemo(
    () => camerasToDotsGeoJSON(cameraSource),
    [cameraSource]
  );

  // Timeline filtering is handled entirely by MapLibreContainer's imperative
  // handleTimelineTick (calls map.setFilter on 'dot-density-layer').
  // This initial filter prevents a flash of all dots before the first tick runs.
  const initialFilter = useMemo(() => {
    if (!isTimelineActive) return undefined;
    const { currentDate } = useAppModeStore.getState().timelineSettings;
    const parts = currentDate.split('-').map(Number);
    const cutoffMs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
    // ts=0 (no-date cameras) is always <= cutoffMs, so single comparison suffices
    return ['<=', ['get', 'ts'], cutoffMs] as maplibregl.FilterSpecification;
  }, [isTimelineActive]);

  // Size and opacity are static curves, so color is the only paint property that
  // can change — and only on a rare click. react-map-gl diffs paint props and
  // calls setPaintProperty itself, so no imperative effect is needed here.
  return (
    <Source
      id="cameras-dots"
      type="geojson"
      data={geojsonData}
    >
      <Layer
        id="dot-density-layer"
        type="circle"
        source="cameras-dots"
        filter={initialFilter}
        paint={{
          'circle-color': dotColor,
          'circle-radius': DOT_RADIUS,
          'circle-opacity': DOT_OPACITY,
          'circle-stroke-width': 0,
        }}
      />
    </Source>
  );
}
