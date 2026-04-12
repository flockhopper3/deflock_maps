import { Source, Layer } from 'react-map-gl/maplibre';
import { useMapModeStore } from '../../../store';
import type { OverlayState } from '../../../store/mapModeStore';
import type { BoundaryLevel } from '../../../services/boundaryDataService';

interface BoundaryConfig {
  id: BoundaryLevel;
  storeKey: keyof OverlayState;
  color: string;
  width: number;
  opacity: number;
  minzoom?: number;
}

const BOUNDARY_CONFIGS: BoundaryConfig[] = [
  { id: 'state', storeKey: 'stateBoundaries', color: '#1e293b', width: 2.5, opacity: 0.8 },
  { id: 'county', storeKey: 'countyBoundaries', color: '#1e293b', width: 2, opacity: 0.7, minzoom: 6 },
  { id: 'municipal', storeKey: 'municipalBoundaries', color: '#1e293b', width: 1.8, opacity: 0.6, minzoom: 8 },
];

export function BoundaryOverlayLayers() {
  const overlays = useMapModeStore((s) => s.overlays);
  const boundaryData = useMapModeStore((s) => s.boundaryData);

  return (
    <>
      {BOUNDARY_CONFIGS.map((config) => {
        const isOn = overlays[config.storeKey];
        const data = boundaryData[config.id];

        if (!isOn || !data) return null;

        return (
          <Source key={config.id} id={`${config.id}-boundaries`} type="geojson" data={data}>
            <Layer
              id={`${config.id}-boundaries-line`}
              type="line"
              source={`${config.id}-boundaries`}
              minzoom={config.minzoom}
              paint={{
                'line-color': config.color,
                'line-width': config.width,
                'line-opacity': config.opacity,
              }}
            />
          </Source>
        );
      })}
    </>
  );
}
