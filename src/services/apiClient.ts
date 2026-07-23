import type {
  Location,
  APIRouteResponse,
  CameraAwareRouteResult,
  ImprovementMetrics,
  POIMetrics,
} from '../types';

const API_URL = 'https://api.dontgetflocked.com';

function getApiUrl(): string {
  return API_URL;
}

export interface CalculateRouteOptions {
  costing?: 'auto' | 'bicycle' | 'pedestrian';
  cameraDistanceMeters?: number;
  useDirectionalZones?: boolean;
}

export interface CalculateRouteResult {
  normalRoute: CameraAwareRouteResult;
  avoidanceRoute: CameraAwareRouteResult;
  improvement: ImprovementMetrics;
  poiMetrics?: POIMetrics;
}

export async function calculateRoute(
  origin: Location,
  destination: Location,
  options?: CalculateRouteOptions
): Promise<CalculateRouteResult> {
  const apiUrl = getApiUrl();

  const body = {
    origin: { lat: origin.lat, lon: origin.lon },
    destination: { lat: destination.lat, lon: destination.lon },
    format: 'full' as const,
    ...(options?.costing && { costing: options.costing }),
    ...(options?.cameraDistanceMeters != null && {
      cameraDistanceMeters: options.cameraDistanceMeters,
    }),
    ...(options?.useDirectionalZones != null && {
      useDirectionalZones: options.useDirectionalZones,
    }),
  };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Unable to reach the routing server. Check your connection.');
  }

  if (!response.ok) {
    if (response.status === 400) {
      const data = await response.json().catch(() => null);
      const apiError: string = data?.error || '';
      // The API's distance-limit error is a two-sentence explanation; the
      // banner only needs the limit itself.
      if (/exceeds maximum|longer than 300 miles/i.test(apiError)) {
        throw new Error('Routes longer than 300 miles are not supported at this time.');
      }
      throw new Error(apiError || 'Invalid route request. Please check your locations.');
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        'Routing service is temporarily unavailable. Please try again.'
      );
    }
    throw new Error(`Routing failed (${response.status}). Please try again.`);
  }

  const data: APIRouteResponse = await response.json();

  if (!data.ok || !data.result) {
    throw new Error('Unexpected response from routing service.');
  }

  return data.result;
}
