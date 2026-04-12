import type { CameraOnRoute } from './camera';

export interface Location {
  lat: number;
  lon: number;
  name?: string;
  address?: string;
}

export interface Route {
  id: string;
  origin: Location;
  destination: Location;
  waypoints?: Location[];
  geometry: [number, number][];
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuvers?: Maneuver[];
  costing: 'auto' | 'bicycle' | 'pedestrian';
  timestamp: Date;
}

export interface Maneuver {
  instruction: string;
  type: number;
  streetNames?: string[];
  length: number;
  time: number;
  beginShapeIndex: number;
  endShapeIndex: number;
}

export interface RouteAnalysis {
  route: Route;
  exposure: {
    totalCameras: number;
    facingCameras: number;
    byOperator: Record<string, number>;
    byBrand: Record<string, number>;
  };
  cameras: CameraOnRoute[];
}

export interface RouteComparison {
  distanceIncrease: number;
  distanceIncreasePercent: number;
  durationIncrease: number;
  durationIncreasePercent: number;
  camerasAvoided: number;
  remainingCameras: number;
  normalCameras: CameraOnRoute[];
  avoidanceCameras: CameraOnRoute[];
}

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance: number;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export interface GPXMetadata {
  name: string;
  description: string;
  author?: string;
}

/**
 * Statistics about zone types used in routing
 */
export interface ZoneStats {
  /** Number of cameras with directional (cone-shaped) zones */
  directionalZones: number;
  /** Number of cameras with circular zones (fallback) */
  circularZones: number;
}

/**
 * Score breakdown for a route
 */
export interface RouteScoreInfo {
  distanceMeters: number;
  durationSeconds: number;
  cameraCount: number;
  totalCameraPenalty: number;
  compositeScore: number;
  exposureRating: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Result from camera-aware routing
 */
export interface CameraAwareRouteResult {
  route: Route;
  camerasOnRoute: CameraOnRoute[];
  score: RouteScoreInfo;
  strategy: string; // e.g., 'normal', 'iterative (5 waypoints)', 'aggressive-polygon'
  attempts: number;
  /** Zone type statistics (only present when avoidance routing was attempted) */
  zoneStats?: ZoneStats;
}

/**
 * Full comparison result from routing
 */
export interface CameraRoutingResult {
  normalRoute: CameraAwareRouteResult;
  avoidanceRoute: CameraAwareRouteResult;
  improvement: {
    camerasAvoided: number;
    cameraReductionPercent: number;
    distanceIncrease: number;
    distanceIncreasePercent: number;
    durationIncrease: number;
    durationIncreasePercent: number;
    penaltyReduction: number;
  };
}

/**
 * API response types — matches FlockHopper API V2 at api.dontgetflocked.com
 */

export interface RouteOptions {
  cameraDistanceMeters: number;
  costing: 'auto' | 'bicycle' | 'pedestrian';
  useDirectionalZones: boolean;
}

export interface ImprovementMetrics {
  camerasAvoided: number;
  cameraReductionPercent: number;
  distanceIncrease: number;
  distanceIncreasePercent: number;
  durationIncrease: number;
  durationIncreasePercent: number;
  penaltyReduction: number;
}

export interface POIMetrics {
  poisInArea: number;
  poisOnNormalRoute: number;
  poisOnAvoidanceRoute: number;
  poisAvoided: number;
}

export interface APIRouteResponse {
  ok: true;
  result: {
    normalRoute: CameraAwareRouteResult;
    avoidanceRoute: CameraAwareRouteResult;
    improvement: ImprovementMetrics;
    poiMetrics?: POIMetrics;
  };
}

export interface APIRouteErrorResponse {
  ok: false;
  error: string;
}

