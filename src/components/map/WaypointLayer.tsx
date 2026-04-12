import { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { Location } from '../../types';

interface WaypointLayerProps {
  waypoints: Location[];
  customRouteGeometry: [number, number][] | null;
  isActive: boolean;
  onWaypointDragEnd?: (index: number, location: Location) => void;
}

export function WaypointLayer({
  waypoints,
  customRouteGeometry,
  isActive,
  onWaypointDragEnd,
}: WaypointLayerProps) {
  // Build route GeoJSON
  const routeGeoJSON = useMemo((): GeoJSON.FeatureCollection => {
    if (!customRouteGeometry || customRouteGeometry.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'custom', active: isActive },
          geometry: {
            type: 'LineString',
            // Convert [lat, lon] to [lon, lat] for GeoJSON
            coordinates: customRouteGeometry.map(([lat, lon]) => [lon, lat]),
          },
        },
      ],
    };
  }, [customRouteGeometry, isActive]);


  if (!isActive) return null;

  return (
    <>
      {/* Custom Route Line */}
      {customRouteGeometry && customRouteGeometry.length >= 2 && (
        <Source id="custom-route" type="geojson" data={routeGeoJSON}>
          {/* Route outline */}
          <Layer
            id="custom-route-outline"
            type="line"
            paint={{
              'line-color': '#000000',
              'line-width': 8,
              'line-opacity': 0.3,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
          {/* Route line - accent blue for custom routes */}
          <Layer
            id="custom-route-line"
            type="line"
            paint={{
              'line-color': '#0080BC', // Accent blue
              'line-width': 5,
              'line-opacity': 0.9,
              'line-dasharray': [2, 1], // Dashed line to distinguish from normal routes
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </Source>
      )}

      {/* Waypoint Markers using react-map-gl Marker for drag support */}
      {waypoints.map((wp, index) => {
        const isOrigin = index === 0;
        const isDestination = index === waypoints.length - 1;
        const isIntermediate = !isOrigin && !isDestination;

        return (
          <Marker
            key={`waypoint-${index}`}
            longitude={wp.lon}
            latitude={wp.lat}
            anchor="center"
            draggable={true}
            onDragEnd={(event) => {
              if (onWaypointDragEnd) {
                onWaypointDragEnd(index, {
                  lat: event.lngLat.lat,
                  lon: event.lngLat.lng,
                  name: wp.name,
                });
              }
            }}
          >
            <div
              className={`
                flex items-center justify-center
                rounded-full cursor-grab active:cursor-grabbing
                shadow-lg transition-transform hover:scale-110 active:scale-95
                touch-manipulation select-none
                ${isOrigin
                  ? 'w-11 h-11 md:w-8 md:h-8 bg-success border-2 border-white'
                  : isDestination
                    ? 'w-11 h-11 md:w-8 md:h-8 bg-danger border-2 border-white'
                    : 'w-10 h-10 md:w-7 md:h-7 bg-accent border-2 border-white'
                }
              `}
              title={wp.name || `Waypoint ${index + 1}`}
            >
              {isIntermediate && (
                <span className="text-sm md:text-xs font-bold text-white">{index}</span>
              )}
              {isOrigin && (
                <svg className="w-5 h-5 md:w-4 md:h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6" />
                </svg>
              )}
              {isDestination && (
                <svg className="w-5 h-5 md:w-4 md:h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}

