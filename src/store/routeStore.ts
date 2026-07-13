import { create } from 'zustand';
import type {
  Location,
  Route,
  RouteComparison,
  CameraOnRoute,
  RouteOptions,
} from '../types';
import { calculateRoute } from '../services/apiClient';

// Location picking mode - which field is waiting for a map click
export type LocationPickingMode = 'origin' | 'destination' | null;

interface RouteState {
  origin: Location | null;
  destination: Location | null;
  normalRoute: Route | null;
  avoidanceRoute: Route | null;
  comparison: RouteComparison | null;
  normalRouteCameras: CameraOnRoute[];
  avoidanceRouteCameras: CameraOnRoute[];
  isCalculating: boolean;
  error: string | null;
  activeRoute: 'normal' | 'avoidance';

  // Route options sent to API
  routeOptions: RouteOptions;

  // Location picking mode - for "choose on map" feature
  pickingLocation: LocationPickingMode;

  // Guided picking sequence state
  pickingSequence: 'single' | 'full' | null;

  // Actions
  setOrigin: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;
  calculateRoutes: () => Promise<void>;
  clearRoutes: () => void;
  setActiveRoute: (type: 'normal' | 'avoidance') => void;
  swapLocations: () => void;
  setCameraDistance: (meters: number) => void;
  setUseDirectionalZones: (enabled: boolean) => void;

  // Location picking actions
  startPickingLocation: (mode: 'origin' | 'destination') => void;
  startPickingSequence: () => void;
  cancelPickingLocation: () => void;
  setPickedLocation: (location: Location) => void;
}

const DEFAULT_ROUTE_OPTIONS: RouteOptions = {
  cameraDistanceMeters: 75,
  costing: 'auto',
  useDirectionalZones: true,
};

export const useRouteStore = create<RouteState>((set, get) => ({
  origin: null,
  destination: null,
  normalRoute: null,
  avoidanceRoute: null,
  comparison: null,
  normalRouteCameras: [],
  avoidanceRouteCameras: [],
  isCalculating: false,
  error: null,
  activeRoute: 'normal',
  routeOptions: DEFAULT_ROUTE_OPTIONS,
  pickingLocation: null,
  pickingSequence: null,

  setOrigin: (location: Location | null) => {
    set({
      origin: location,
      normalRoute: null,
      avoidanceRoute: null,
      comparison: null,
      error: null,
    });
  },

  setDestination: (location: Location | null) => {
    set({
      destination: location,
      normalRoute: null,
      avoidanceRoute: null,
      comparison: null,
      error: null,
    });
  },

  calculateRoutes: async () => {
    const { origin, destination, routeOptions, isCalculating } = get();

    if (isCalculating) return;

    if (!origin || !destination) {
      set({ error: 'Please select both origin and destination' });
      return;
    }

    set({ isCalculating: true, error: null });

    try {
      const result = await calculateRoute(origin, destination, {
        costing: routeOptions.costing,
        cameraDistanceMeters: routeOptions.cameraDistanceMeters,
        useDirectionalZones: routeOptions.useDirectionalZones,
      });

      const comparison: RouteComparison = {
        distanceIncrease: result.improvement.distanceIncrease,
        distanceIncreasePercent: result.improvement.distanceIncreasePercent,
        durationIncrease: result.improvement.durationIncrease,
        durationIncreasePercent: result.improvement.durationIncreasePercent,
        camerasAvoided: result.improvement.camerasAvoided,
        remainingCameras: result.avoidanceRoute.camerasOnRoute.length,
        normalCameras: result.normalRoute.camerasOnRoute,
        avoidanceCameras: result.avoidanceRoute.camerasOnRoute,
      };

      // Discard stale results if endpoints changed while the request was in flight
      const current = get();
      if (current.origin !== origin || current.destination !== destination) {
        set({ isCalculating: false });
        return;
      }

      set({
        normalRoute: result.normalRoute.route,
        avoidanceRoute: result.avoidanceRoute.route,
        normalRouteCameras: result.normalRoute.camerasOnRoute,
        avoidanceRouteCameras: result.avoidanceRoute.camerasOnRoute,
        comparison,
        isCalculating: false,
        activeRoute:
          result.normalRoute.camerasOnRoute.length >
          result.avoidanceRoute.camerasOnRoute.length
            ? 'avoidance'
            : 'normal',
      });
    } catch (error) {
      console.error('Routing failed:', error);

      // Discard stale errors if endpoints changed while the request was in flight
      const current = get();
      if (current.origin !== origin || current.destination !== destination) {
        set({ isCalculating: false });
        return;
      }

      set({
        error:
          error instanceof Error ? error.message : 'Failed to calculate route',
        isCalculating: false,
      });
    }
  },

  clearRoutes: () => {
    set({
      normalRoute: null,
      avoidanceRoute: null,
      comparison: null,
      normalRouteCameras: [],
      avoidanceRouteCameras: [],
      error: null,
      activeRoute: 'normal',
    });
  },

  setActiveRoute: (type: 'normal' | 'avoidance') => {
    set({ activeRoute: type });
  },

  swapLocations: () => {
    const { origin, destination } = get();
    set({
      origin: destination,
      destination: origin,
      normalRoute: null,
      avoidanceRoute: null,
      comparison: null,
      error: null,
    });
  },

  setCameraDistance: (meters: number) => {
    const { routeOptions } = get();
    set({
      routeOptions: {
        ...routeOptions,
        cameraDistanceMeters: Math.max(10, Math.min(150, meters)),
      },
      error: null,
    });
  },

  setUseDirectionalZones: (enabled: boolean) => {
    const { routeOptions } = get();
    set({
      routeOptions: {
        ...routeOptions,
        useDirectionalZones: enabled,
      },
      error: null,
    });
  },

  // Location picking actions
  startPickingLocation: (mode: 'origin' | 'destination') => {
    set({ pickingLocation: mode });
  },

  startPickingSequence: () => {
    const { origin, destination } = get();
    if (origin && !destination) {
      set({ pickingSequence: 'single', pickingLocation: 'destination' });
    } else if (!origin && destination) {
      set({ pickingSequence: 'single', pickingLocation: 'origin' });
    } else {
      // Both empty, or both set (redo): start fresh so the first pick
      // can't auto-calculate against a leftover endpoint mid-sequence.
      set({
        origin: null,
        destination: null,
        normalRoute: null,
        avoidanceRoute: null,
        comparison: null,
        error: null,
        pickingSequence: 'full',
        pickingLocation: 'origin',
      });
    }
  },

  cancelPickingLocation: () => {
    set({ pickingLocation: null, pickingSequence: null });
  },

  setPickedLocation: (location: Location) => {
    const { pickingLocation, pickingSequence } = get();
    if (pickingLocation === 'origin') {
      const continuing = pickingSequence === 'full';
      set({
        origin: location,
        // In a full guided sequence, advance straight to the destination pick
        pickingLocation: continuing ? 'destination' : null,
        pickingSequence: continuing ? 'full' : null,
        normalRoute: null,
        avoidanceRoute: null,
        comparison: null,
        error: null,
      });
    } else if (pickingLocation === 'destination') {
      set({
        destination: location,
        pickingLocation: null,
        pickingSequence: null,
        normalRoute: null,
        avoidanceRoute: null,
        comparison: null,
        error: null,
      });
    }
  },
}));
