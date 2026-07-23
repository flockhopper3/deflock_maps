import { DIRECTIONAL_ZONE, CAMERA_DETECTION, ZONE_SAFETY_MULTIPLIERS } from '../../../services/routingConfig';

// Helper to create a direction cone polygon from a point and direction
// Uses the same parameters as the routing algorithm for consistency
export function createDirectionCone(
  lon: number,
  lat: number,
  direction: number,
  // Use routing config values so visualization matches what routing avoids
  lengthMeters: number = CAMERA_DETECTION.routeBufferMeters * ZONE_SAFETY_MULTIPLIERS.block * 0.75,
  spreadDegrees: number = DIRECTIONAL_ZONE.cameraFovDegrees
): GeoJSON.Feature<GeoJSON.Polygon> {
  const earthRadius = 6371000; // meters
  const latRad = (lat * Math.PI) / 180;

  // Convert meters to degrees (approximate)
  const lengthDeg = (lengthMeters / earthRadius) * (180 / Math.PI);

  // Calculate the three points of the cone
  const points: [number, number][] = [[lon, lat]]; // Start at camera

  // Left edge of cone
  const leftAngle = ((direction - spreadDegrees / 2) * Math.PI) / 180;
  const leftLon = lon + lengthDeg * Math.sin(leftAngle) / Math.cos(latRad);
  const leftLat = lat + lengthDeg * Math.cos(leftAngle);
  points.push([leftLon, leftLat]);

  // Create arc for the front of the cone
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const angle = ((direction - spreadDegrees / 2 + (spreadDegrees * i) / steps) * Math.PI) / 180;
    const arcLon = lon + lengthDeg * Math.sin(angle) / Math.cos(latRad);
    const arcLat = lat + lengthDeg * Math.cos(angle);
    points.push([arcLon, arcLat]);
  }

  // Right edge of cone
  const rightAngle = ((direction + spreadDegrees / 2) * Math.PI) / 180;
  const rightLon = lon + lengthDeg * Math.sin(rightAngle) / Math.cos(latRad);
  const rightLat = lat + lengthDeg * Math.cos(rightAngle);
  points.push([rightLon, rightLat]);

  // Close the polygon
  points.push([lon, lat]);

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [points],
    },
  };
}

/**
 * Normalize a camera's bearing(s). `directions` may be a real array (from the
 * GeoJSON dataset) or a JSON-encoded string like "[90,270]" (from vector
 * tiles, where tippecanoe stringifies array attributes).
 */
export function parseDirections(
  direction: number | null | undefined,
  directions: unknown
): number[] {
  if (Array.isArray(directions) && directions.length > 1) {
    return directions.filter((d): d is number => Number.isFinite(d));
  }
  if (typeof directions === 'string' && directions.length > 0) {
    try {
      const parsed = JSON.parse(directions);
      if (Array.isArray(parsed)) {
        const nums = parsed.map(Number).filter(Number.isFinite);
        if (nums.length > 1) return nums;
      }
    } catch {
      // fall through to single direction
    }
  }
  return direction !== null && direction !== undefined && Number.isFinite(direction)
    ? [direction]
    : [];
}
